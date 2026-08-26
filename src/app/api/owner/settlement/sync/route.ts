/**
 * POST /api/owner/settlement/sync
 *
 * Fetches the live Razorpay Route product status and syncs it to our DB.
 * Owner or admin can call this to refresh the onboarding state.
 */
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { fetchRouteProductStatus, normalizeActivationStatus } from '@/lib/razorpay-route'

export async function POST() {
  try {
    const session = await requireAuth(['LIBRARY_OWNER'])

    const owner = await prisma.libraryOwner.findUnique({
      where: { userId: session.userId },
      select: {
        id: true,
        razorpayAccountId: true,
        razorpayProductId: true,
        settlementReady: true,
      },
    })
    if (!owner) return Response.json({ error: 'Owner not found' }, { status: 404 })

    if (!owner.razorpayAccountId || !owner.razorpayProductId) {
      return Response.json({
        error: 'No Razorpay account/product to sync — complete onboarding first',
      }, { status: 400 })
    }

    const product = await fetchRouteProductStatus(
      owner.razorpayAccountId,
      owner.razorpayProductId
    )

    const activationStatus = normalizeActivationStatus(product.activation_status)
    const settlementReady  = product.activation_status === 'activated'
    const requirements     = product.requirements ?? []

    await prisma.libraryOwner.update({
      where: { id: owner.id },
      data: {
        razorpayActivationStatus: activationStatus,
        razorpayAccountStatus: activationStatus,
        settlementReady,
        settlementRequirements: requirements.length > 0 ? requirements : undefined,
        settlementActivatedAt: settlementReady && !owner.settlementReady
          ? new Date()
          : undefined,
      },
    })

    return Response.json({
      success: true,
      status: activationStatus,
      settlementReady,
      requirements,
      message: settlementReady
        ? 'Settlement account is ACTIVE.'
        : requirements.length > 0
        ? 'Action required — see requirements list.'
        : 'Verification in progress.',
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    console.error('Settlement sync error:', error)
    return Response.json({ error: msg || 'Sync failed' }, { status: 500 })
  }
}
