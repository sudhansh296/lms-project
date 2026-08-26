/**
 * Razorpay Route API service — all Route/Linked-Account calls in one place.
 *
 * Uses the PLATFORM Razorpay credentials only.
 * Never uses or exposes Library Owner Razorpay keys.
 *
 * Official docs: https://razorpay.com/docs/route/
 *
 * All HTTP calls use the Razorpay Node SDK where possible;
 * where the SDK doesn't expose Route endpoints directly we use
 * native fetch with Basic-Auth (standard Razorpay API approach).
 */

const RZP_BASE = 'https://api.razorpay.com'

function authHeader(): string {
  const key = process.env.RAZORPAY_KEY_ID ?? ''
  const secret = process.env.RAZORPAY_KEY_SECRET ?? ''
  return 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64')
}

async function rzpFetch<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${RZP_BASE}${path}`, {
    method,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) {
    const errMsg =
      data?.error?.description ??
      data?.error?.reason ??
      data?.message ??
      `Razorpay API error ${res.status}`
    throw new Error(errMsg)
  }
  return data as T
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RzpLinkedAccount {
  id: string          // acc_XXXXXXXXXX
  type: string        // route
  status: string      // created | activated | suspended
  email: string
  profile: {
    category: string
    subcategory: string
    addresses: { registered: Record<string, string> }
  }
  legal_info?: { pan?: string; gst?: string }
}

export interface RzpStakeholder {
  entity: string
  id: string          // sth_XXXXXXXXXX
  name: string
}

export interface RzpRouteProduct {
  id: string          // acc_prd_XXXXXXXXXX
  account_id: string
  product_name: string
  requested_at: number
  activation_status: string  // created | under_review | needs_clarification | activated | suspended
  requirements?: Array<{
    field_reference: string
    resolution: string
    reason_code: string
    description: string
  }>
}

export interface RzpTransferItem {
  id: string          // trf_XXXXXXXXXX
  entity: string
  source: string
  recipient: string
  amount: number
  currency: string
  status: string
}

export interface RzpPaymentEntity {
  id: string
  order_id: string
  amount: number
  currency: string
  status: string      // created | authorized | captured | refunded | failed
}

// ─── Linked Account ───────────────────────────────────────────────────────────

/**
 * Create a Razorpay Route Linked Account for the library owner.
 * POST /v2/accounts
 */
export async function createLinkedAccount(params: {
  email: string
  profile: {
    category: string
    subcategory: string
    addresses: {
      registered: {
        street1: string
        street2?: string
        city: string
        state: string
        postal_code: string
        country: string
      }
    }
  }
  legal_info: {
    pan: string
    gst?: string
  }
  legal_business_name: string
  business_type: string
  contact_name: string
  contact_info: {
    mobile: string
    email?: string
  }
}): Promise<RzpLinkedAccount> {
  return rzpFetch<RzpLinkedAccount>('POST', '/v2/accounts', {
    email: params.email,
    profile: params.profile,
    legal_info: params.legal_info,
    legal_business_name: params.legal_business_name,
    business_type: params.business_type,
    contact_name: params.contact_name,
    contact_info: params.contact_info,
    type: 'route',
  })
}

/**
 * Fetch an existing Linked Account.
 * GET /v2/accounts/{accountId}
 */
export async function fetchLinkedAccount(accountId: string): Promise<RzpLinkedAccount> {
  return rzpFetch<RzpLinkedAccount>('GET', `/v2/accounts/${accountId}`)
}

// ─── Stakeholder ──────────────────────────────────────────────────────────────

/**
 * Create a stakeholder (owner/director identity) for the Linked Account.
 * POST /v2/accounts/{accountId}/stakeholders
 */
export async function createStakeholder(
  accountId: string,
  params: {
    name: string
    relationship: { director: boolean; executive: boolean }
    phone: { primary: string; secondary?: string }
    addresses: {
      residential: {
        street: string
        city: string
        state: string
        postal_code: string
        country: string
      }
    }
    kyc: { pan: string }
  }
): Promise<RzpStakeholder> {
  return rzpFetch<RzpStakeholder>('POST', `/v2/accounts/${accountId}/stakeholders`, params)
}

// ─── Route Product ────────────────────────────────────────────────────────────

/**
 * Request the Route product for the Linked Account.
 * POST /v2/accounts/{accountId}/products
 */
export async function requestRouteProduct(accountId: string): Promise<RzpRouteProduct> {
  return rzpFetch<RzpRouteProduct>('POST', `/v2/accounts/${accountId}/products`, {
    product_name: 'route',
    requested_at: Math.floor(Date.now() / 1000),
    tnc_accepted: true,
  })
}

/**
 * Update the Route product with bank settlement details.
 * PATCH /v2/accounts/{accountId}/products/{productId}
 */
export async function updateRouteProductWithBankDetails(
  accountId: string,
  productId: string,
  params: {
    settlements: {
      account_number: string
      ifsc_code: string
      beneficiary_name: string
    }
    tnc_accepted: boolean
  }
): Promise<RzpRouteProduct> {
  return rzpFetch<RzpRouteProduct>(
    'PATCH',
    `/v2/accounts/${accountId}/products/${productId}`,
    params
  )
}

/**
 * Fetch the current Route product status (includes requirements list).
 * GET /v2/accounts/{accountId}/products/{productId}
 */
export async function fetchRouteProductStatus(
  accountId: string,
  productId: string
): Promise<RzpRouteProduct> {
  return rzpFetch<RzpRouteProduct>('GET', `/v2/accounts/${accountId}/products/${productId}`)
}

// ─── Payment Fetch & Transfer ─────────────────────────────────────────────────

/**
 * Fetch a Razorpay payment entity for verification.
 * GET /v1/payments/{paymentId}
 */
export async function fetchPayment(paymentId: string): Promise<RzpPaymentEntity> {
  return rzpFetch<RzpPaymentEntity>('GET', `/v1/payments/${paymentId}`)
}

/**
 * Transfer the owner's share from a captured payment.
 * POST /v1/payments/{paymentId}/transfers
 *
 * Returns the first transfer item.
 */
export async function transferPaymentToOwner(
  razorpayPaymentId: string,
  ownerAccountId: string,
  amountPaise: number,
  meta: Record<string, string>
): Promise<RzpTransferItem> {
  const res = await rzpFetch<{ items: RzpTransferItem[] }>(
    'POST',
    `/v1/payments/${razorpayPaymentId}/transfers`,
    {
      transfers: [
        {
          account: ownerAccountId,
          amount: amountPaise,
          currency: 'INR',
          notes: meta,
          linked_account_notes: Object.keys(meta).slice(0, 2),
          on_hold: false,
        },
      ],
    }
  )
  const item = res.items?.[0]
  if (!item) throw new Error('Razorpay transfer response missing items')
  return item
}

/**
 * Initiate a refund on a captured payment.
 * POST /v1/payments/{paymentId}/refund
 */
export async function refundPayment(
  razorpayPaymentId: string,
  amountPaise: number,
  notes?: Record<string, string>
): Promise<{ id: string; amount: number; status: string }> {
  return rzpFetch('POST', `/v1/payments/${razorpayPaymentId}/refund`, {
    amount: amountPaise,
    notes,
  })
}

/**
 * Normalize Razorpay activation_status to our internal status string.
 */
export function normalizeActivationStatus(rzpStatus: string | null | undefined): string {
  switch (rzpStatus) {
    case 'activated':          return 'ACTIVE'
    case 'under_review':       return 'UNDER_REVIEW'
    case 'needs_clarification':return 'ACTION_REQUIRED'
    case 'suspended':          return 'SUSPENDED'
    case 'created':            return 'IN_PROGRESS'
    default:                   return 'NOT_STARTED'
  }
}
