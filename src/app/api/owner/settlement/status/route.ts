/**
 * GET /api/owner/settlement/status
 *
 * Returns the current settlement onboarding status from our DB
 * (use /sync to refresh from Razorpay live state).
 */
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const session = await requireAuth(['LIBRARY_OWNER'])

    const owner = await prisma.libraryOwner.findUnique({
      where: { userId: session.userId },
      select: {
        razorpayAccountId: true,
        razorpayAccountStatus: true,
        razorpayStakeholderId: true,
        razorpayProductId: true,
        razorpayActivationStatus: true,
        settlementReady: true,
        settlementRequirements: true,
        settlementActivatedAt: true,
        bankLast4: true,
      },
    })
    if (!owner) return Response.json({ error: 'Owner not found' }, { status: 404 })

    const hasAccount     = !!owner.razorpayAccountId
    const hasStakeholder = !!owner.razorpayStakeholderId
    const hasProduct     = !!owner.razorpayProductId
    const hasBankDetails = !!owner.bankLast4

    // Derive a simple step label for the UI
    let step: string
    if (!hasAccount)     step = 'NOT_STARTED'
    else if (!hasProduct) step = 'ACCOUNT_CREATED'
    else if (!hasBankDetails) step = 'PRODUCT_REQUESTED'
    else                 step = 'BANK_SUBMITTED'

    return Response.json({
      hasAccount,
      hasStakeholder,
      hasProduct,
      hasBankDetails,
      step,
      status: owner.razorpayActivationStatus ?? 'NOT_STARTED',
      settlementReady: owner.settlementReady,
      // Only show masked account hint — never full number
      bankLast4: owner.bankLast4 ?? null,
      activatedAt: owner.settlementActivatedAt ?? null,
      // Cast Json to array safely
      requirements: (owner.settlementRequirements as unknown[]) ?? [],
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
