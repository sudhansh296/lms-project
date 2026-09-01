import { NextRequest } from 'next/server'
import { requireAuth, createAuditLog } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getMembershipLevel } from '@/lib/referral'
import { serialize } from '@/lib/serialize'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(['SUPER_ADMIN'])
    const { id } = await params

    const library = await prisma.library.findUnique({
      where: { id },
      include: {
        owner: { include: { user: true, subscription: { include: { plan: true } } } },
        photos: { orderBy: { order: 'asc' } },
        facilities: true,
        hours: { orderBy: { dayOfWeek: 'asc' } },
        rules: { orderBy: { order: 'asc' } },
        seats: true,
        membershipPlans: true,
        _count: {
          select: {
            seats: true,
            bookings: true,
            studentMemberships: { where: { status: 'ACTIVE' } },
          },
        },
      },
    })

    if (!library) {
      return Response.json({ error: 'Library not found' }, { status: 404 })
    }

    const revenue = await prisma.payment.aggregate({
      where: {
        status: 'PAID',
        OR: [
          { booking: { libraryId: id } },
          { membership: { libraryId: id } },
        ],
      },
      _sum: { amount: true },
    })

    return Response.json(serialize({ library, totalRevenue: Number(revenue._sum.amount ?? 0) }))
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(['SUPER_ADMIN'])
    const { id } = await params
    const body = await request.json()
    const { action, reason, razorpayAccountId } = body

    // P0-6: Handle Razorpay account update with verification
    if (razorpayAccountId !== undefined) {
      const library = await prisma.library.findUnique({
        where: { id },
        select: { ownerId: true, name: true },
      })
      
      if (!library) {
        return Response.json({ error: 'Library not found' }, { status: 404 })
      }

      // Validate Razorpay account ID format if provided
      if (razorpayAccountId && !razorpayAccountId.startsWith('acc_')) {
        return Response.json({ 
          error: 'Invalid Razorpay account ID. Must start with "acc_"' 
        }, { status: 400 })
      }

      // P0-6 FIX: Verify account exists with Razorpay before saving
      if (razorpayAccountId) {
        try {
          const { fetchLinkedAccount } = await import('@/lib/razorpay-route')
          const account = await fetchLinkedAccount(razorpayAccountId)
          
          // Verify account is actually a Route account
          if (account.type !== 'route') {
            return Response.json({ 
              error: 'Invalid account type. Must be a Razorpay Route account.' 
            }, { status: 400 })
          }

          // Check if account is suspended
          if (account.status === 'suspended') {
            return Response.json({ 
              error: 'This Razorpay account is suspended and cannot be linked.' 
            }, { status: 400 })
          }
        } catch (error) {
          console.error('[P0-6] Razorpay account verification failed:', error)
          const msg = error instanceof Error ? error.message : 'Unknown error'
          return Response.json({ 
            error: `Razorpay account verification failed: ${msg}` 
          }, { status: 400 })
        }
      }

      // P0-9 FIX: When account ID changes OR is removed, reset all onboarding state
      // Get current account ID to detect changes
      const currentOwner = await prisma.libraryOwner.findUnique({
        where: { id: library.ownerId },
        select: { razorpayAccountId: true },
      })

      const isAccountChanging = currentOwner?.razorpayAccountId !== razorpayAccountId
      const isAccountRemoved = !razorpayAccountId && !!currentOwner?.razorpayAccountId

      await prisma.libraryOwner.update({
        where: { id: library.ownerId },
        data: {
          razorpayAccountId: razorpayAccountId || null,
          razorpayAccountStatus: razorpayAccountId ? 'ACTIVE' : 'PENDING',
          // P0-9: Reset ALL onboarding state when account changes or removed
          ...(isAccountChanging || isAccountRemoved ? {
            settlementReady: false,
            razorpayProductId: null,
            razorpayStakeholderId: null,
            razorpayActivationStatus: null,
            settlementRequirements: Prisma.JsonNull,
            settlementActivatedAt: null,
            bankLast4: null,
          } : {}),
        },
      })

      await createAuditLog({
        userId: session.userId,
        role: session.role,
        libraryId: id,
        action: 'UPDATE_RAZORPAY_ACCOUNT',
        entityType: 'LibraryOwner',
        entityId: library.ownerId,
        metadata: { razorpayAccountId, libraryName: library.name },
      })

      return Response.json({ 
        success: true, 
        message: razorpayAccountId 
          ? 'Razorpay account verified and linked successfully' 
          : 'Razorpay account removed'
      })
    }

    const validActions = ['APPROVE', 'REJECT', 'SUSPEND', 'REACTIVATE', 'CLOSE']
    if (!validActions.includes(action)) {
      return Response.json({ error: 'Invalid action' }, { status: 400 })
    }

    const statusMap: Record<string, 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | 'CLOSED'> = {
      APPROVE: 'ACTIVE',
      REJECT: 'REJECTED',
      SUSPEND: 'SUSPENDED',
      REACTIVATE: 'ACTIVE',
      CLOSE: 'CLOSED',
    }

    const library = await prisma.library.update({
      where: { id },
      data: {
        status: statusMap[action],
        rejectionReason: action === 'REJECT' ? reason ?? null : null,
      },
      include: { owner: { include: { user: true } } },
    })

    // ── Referral qualification ────────────────────────────────────────────────
    // When a library is APPROVED, check whether its owner was referred by
    // another owner. If so, mark that referral QUALIFIED and recalculate the
    // referrer's membership level automatically.
    if (action === 'APPROVE') {
      try {
        const referral = await prisma.ownerReferral.findUnique({
          where: { referredOwnerId: library.ownerId },
        })

        if (referral && referral.status === 'PENDING') {
          // Mark the referral qualified and link the approved library
          await prisma.ownerReferral.update({
            where: { id: referral.id },
            data: {
              status: 'QUALIFIED',
              referredLibraryId: id,
              qualifiedAt: new Date(),
            },
          })

          // Count all qualified referrals for the referrer
          const qualifiedCount = await prisma.ownerReferral.count({
            where: { referrerOwnerId: referral.referrerOwnerId, status: 'QUALIFIED' },
          })

          // Compute new level and persist it
          const newLevel = getMembershipLevel(qualifiedCount)
          await prisma.libraryOwner.update({
            where: { id: referral.referrerOwnerId },
            data: { ownerMembershipLevel: newLevel },
          })
        }
      } catch (referralErr) {
        // Referral processing must never break the main approval flow
        console.error('Referral qualification error:', referralErr)
      }
    }

    // ── Reject/Invalidate referral when library is rejected ───────────────────
    if (action === 'REJECT') {
      try {
        await prisma.ownerReferral.updateMany({
          where: { referredOwnerId: library.ownerId, status: 'PENDING' },
          data: { status: 'REJECTED', invalidatedAt: new Date() },
        })
      } catch {
        // Non-critical — do not propagate
      }
    }

    const notifTypeMap: Record<string, 'LIBRARY_APPROVED' | 'LIBRARY_REJECTED' | 'LIBRARY_SUSPENDED'> = {
      APPROVE: 'LIBRARY_APPROVED',
      REJECT: 'LIBRARY_REJECTED',
      SUSPEND: 'LIBRARY_SUSPENDED',
    }
    const notifType = notifTypeMap[action]
    if (notifType) {
      await prisma.notification.create({
        data: {
          userId: library.owner.userId,
          libraryId: id,
          type: notifType,
          title: action === 'APPROVE' ? 'Library Approved' : action === 'REJECT' ? 'Library Rejected' : 'Library Suspended',
          message:
            action === 'APPROVE'
              ? `${library.name} has been approved and is now active.`
              : action === 'REJECT'
              ? `${library.name} was rejected. Reason: ${reason ?? 'Not specified'}`
              : `${library.name} has been suspended.`,
          data: { libraryId: id, reason },
        },
      })
    }

    await createAuditLog({
      userId: session.userId,
      role: session.role,
      libraryId: id,
      action: `LIBRARY_${action}`,
      entityType: 'Library',
      entityId: id,
      metadata: { reason },
    })

    return Response.json({ library })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
