import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getMembershipLevel, getNextLevelInfo, LEVEL_LABELS } from '@/lib/referral'

/**
 * GET /api/owner/referral
 *
 * Returns the owner's referral code, membership level, referral history,
 * and progress toward the next level.
 */
export async function GET() {
  try {
    const session = await requireAuth(['LIBRARY_OWNER'])

    const owner = await prisma.libraryOwner.findUnique({
      where: { userId: session.userId },
      select: {
        id: true,
        referralCode: true,
        ownerMembershipLevel: true,
        referralsGiven: {
          orderBy: { createdAt: 'desc' },
          include: {
            referred: {
              select: {
                libraries: {
                  select: { id: true, name: true, status: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
    })

    if (!owner) return Response.json({ error: 'Owner not found' }, { status: 404 })

    const qualifiedCount = owner.referralsGiven.filter(r => r.status === 'QUALIFIED').length
    const pendingCount = owner.referralsGiven.filter(r => r.status === 'PENDING').length
    const currentLevel = getMembershipLevel(qualifiedCount)
    const nextLevelInfo = getNextLevelInfo(qualifiedCount)

    const referralHistory = owner.referralsGiven.map(r => {
      const lib = r.referred.libraries[0]
      return {
        id: r.id,
        libraryId: lib?.id ?? null,
        libraryName: lib?.name ?? 'Library not created yet',
        libraryStatus: lib?.status ?? null,
        referralStatus: r.status,
        registeredAt: r.registeredAt,
        qualifiedAt: r.qualifiedAt,
      }
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const referralUrl = owner.referralCode
      ? `${appUrl}/register/owner?ref=${owner.referralCode}`
      : null

    return Response.json({
      referralCode: owner.referralCode,
      referralUrl,
      ownerMembershipLevel: currentLevel,
      levelLabel: LEVEL_LABELS[currentLevel],
      qualifiedCount,
      pendingCount,
      nextLevel: nextLevelInfo.nextLevel,
      nextLevelLabel: nextLevelInfo.nextLevel ? LEVEL_LABELS[nextLevelInfo.nextLevel] : null,
      nextLevelThreshold: nextLevelInfo.threshold,
      needed: nextLevelInfo.needed,
      referralHistory,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    console.error('Referral API error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
