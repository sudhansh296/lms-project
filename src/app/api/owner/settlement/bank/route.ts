/**
 * POST /api/owner/settlement/bank
 *
 * Step 2 of Route onboarding: submit bank settlement details.
 * The backend verifies accountNumber === confirmAccountNumber,
 * then PATCHes the Route product with bank info.
 */
import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  updateRouteProductWithBankDetails,
  normalizeActivationStatus,
} from '@/lib/razorpay-route'

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(['LIBRARY_OWNER'])
    const body = await request.json()
    const { beneficiaryName, accountNumber, confirmAccountNumber, ifscCode } = body

    // Validate inputs
    if (!beneficiaryName || !accountNumber || !confirmAccountNumber || !ifscCode) {
      return Response.json({ error: 'All bank fields are required' }, { status: 400 })
    }
    if (accountNumber !== confirmAccountNumber) {
      return Response.json({ error: 'Account numbers do not match' }, { status: 400 })
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(ifscCode)) {
      return Response.json({ error: 'Invalid IFSC code format' }, { status: 400 })
    }

    const owner = await prisma.libraryOwner.findUnique({
      where: { userId: session.userId },
      select: {
        id: true,
        razorpayAccountId: true,
        razorpayProductId: true,
      },
    })
    if (!owner) return Response.json({ error: 'Owner not found' }, { status: 404 })

    if (!owner.razorpayAccountId || !owner.razorpayProductId) {
      return Response.json({
        error: 'Please complete business onboarding first',
      }, { status: 400 })
    }

    // PATCH the Route product with bank details
    const product = await updateRouteProductWithBankDetails(
      owner.razorpayAccountId,
      owner.razorpayProductId,
      {
        settlements: {
          account_number: accountNumber,
          ifsc_code: ifscCode.toUpperCase(),
          beneficiary_name: beneficiaryName,
        },
        tnc_accepted: true,
      }
    )

    const activationStatus = normalizeActivationStatus(product.activation_status)
    const settlementReady = product.activation_status === 'activated'
    const requirements = product.requirements ?? []

    // Store last 4 digits only — never store full account number
    const bankLast4 = String(accountNumber).slice(-4)

    await prisma.libraryOwner.update({
      where: { id: owner.id },
      data: {
        razorpayActivationStatus: activationStatus,
        razorpayAccountStatus: activationStatus,
        settlementReady,
        settlementRequirements: requirements.length > 0 ? requirements : undefined,
        settlementActivatedAt: settlementReady ? new Date() : undefined,
        bankLast4,
      },
    })

    return Response.json({
      success: true,
      status: activationStatus,
      settlementReady,
      requirements,
      bankLast4,
      message: settlementReady
        ? 'Bank details verified. Settlement is active.'
        : 'Bank details submitted. Awaiting verification.',
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    console.error('Settlement bank error:', error)
    return Response.json({ error: msg || 'Failed to submit bank details' }, { status: 500 })
  }
}
