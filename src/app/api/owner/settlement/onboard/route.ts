/**
 * POST /api/owner/settlement/onboard
 *
 * Step 1 of Route onboarding: collect business/KYC info, create the
 * Razorpay Linked Account and Stakeholder, then request the Route product.
 *
 * The owner never sees or types an acc_ ID — it is stored automatically.
 */
import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  createLinkedAccount,
  createStakeholder,
  requestRouteProduct,
  normalizeActivationStatus,
} from '@/lib/razorpay-route'

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(['LIBRARY_OWNER'])
    const body = await request.json()

    const {
      // Contact / owner
      contactName,
      mobile,
      email,
      // Business
      legalBusinessName,
      businessType,       // e.g. "individual" | "proprietorship" | "partnership" | "private_limited" | "public_limited" | "llp" | "ngo" | "trust" | "society"
      category,           // e.g. "education"
      subcategory,        // e.g. "coaching"
      // Address
      street1,
      street2,
      city,
      state,
      postalCode,
      country = 'IN',
      // KYC
      pan,
      gst,
    } = body

    // Basic required field validation
    const missing = ['contactName', 'mobile', 'email', 'legalBusinessName', 'businessType',
      'category', 'subcategory', 'street1', 'city', 'state', 'postalCode', 'pan']
      .filter(f => !body[f])
    if (missing.length) {
      return Response.json({ error: `Missing required fields: ${missing.join(', ')}` }, { status: 400 })
    }

    const owner = await prisma.libraryOwner.findUnique({
      where: { userId: session.userId },
      include: { user: { select: { name: true } } },
    })
    if (!owner) return Response.json({ error: 'Owner not found' }, { status: 404 })

    // ── 1. Create Linked Account ──────────────────────────────────────────────
    // Idempotent: if accountId already saved, reuse it
    let accountId = owner.razorpayAccountId
    if (!accountId) {
      const account = await createLinkedAccount({
        email,
        profile: {
          category,
          subcategory,
          addresses: {
            registered: {
              street1,
              street2: street2 ?? '',
              city,
              state,
              postal_code: postalCode,
              country,
            },
          },
        },
        legal_info: { pan, ...(gst ? { gst } : {}) },
        legal_business_name: legalBusinessName,
        business_type: businessType,
        contact_name: contactName,
        contact_info: { mobile, email },
      })
      accountId = account.id
      // Persist immediately so a crash here doesn't orphan the Razorpay account
      await prisma.libraryOwner.update({
        where: { id: owner.id },
        data: { razorpayAccountId: accountId, razorpayAccountStatus: 'IN_PROGRESS' },
      })
    }

    // ── 2. Create Stakeholder ─────────────────────────────────────────────────
    // Idempotent: skip if stakeholderId already recorded for THIS account
    let stakeholderId = owner.razorpayStakeholderId
    if (!stakeholderId && accountId) {
      const stakeholder = await createStakeholder(accountId, {
        name: contactName,
        relationship: { director: true, executive: true },
        phone: { primary: mobile },
        addresses: {
          residential: {
            street: street1,
            city,
            state,
            postal_code: postalCode,
            country,
          },
        },
        kyc: { pan },
      })
      stakeholderId = stakeholder.id
      // Persist immediately
      await prisma.libraryOwner.update({
        where: { id: owner.id },
        data: { razorpayStakeholderId: stakeholderId },
      })
    }

    // ── 3. Request Route product ──────────────────────────────────────────────
    // Idempotent: skip if productId already recorded for THIS account
    let productId = owner.razorpayProductId
    let activationStatus = owner.razorpayActivationStatus
    if (!productId && accountId) {
      const product = await requestRouteProduct(accountId)
      productId = product.id
      activationStatus = normalizeActivationStatus(product.activation_status)
    }

    // ── 4. Final consolidated DB write ────────────────────────────────────────
    const updated = await prisma.libraryOwner.update({
      where: { id: owner.id },
      data: {
        razorpayAccountId:       accountId,
        razorpayAccountStatus:   activationStatus ?? 'IN_PROGRESS',
        razorpayStakeholderId:   stakeholderId,
        razorpayProductId:       productId,
        razorpayActivationStatus: activationStatus,
      },
      select: {
        razorpayAccountId:       true,
        razorpayActivationStatus: true,
        settlementReady:          true,
      },
    })

    return Response.json({
      success: true,
      status: updated.razorpayActivationStatus,
      settlementReady: updated.settlementReady,
      message: 'Onboarding submitted. Proceed to add bank details.',
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    console.error('Settlement onboard error:', error)
    return Response.json({ error: msg || 'Onboarding failed' }, { status: 500 })
  }
}
