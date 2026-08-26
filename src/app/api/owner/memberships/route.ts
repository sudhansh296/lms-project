import { NextRequest } from 'next/server'
import { requireAuth, createAuditLog } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { membershipPlanSchema, approxDurationDays } from '@/lib/validations'

async function getOwnerLibrary(userId: string) {
  return prisma.library.findFirst({ where: { owner: { userId } } })
}

export async function GET() {
  try {
    const session = await requireAuth(['LIBRARY_OWNER', 'LIBRARY_MANAGER', 'LIBRARY_STAFF'])
    const library = await getOwnerLibrary(session.userId)
    if (!library) return Response.json({ error: 'Library not found' }, { status: 404 })

    const plans = await prisma.membershipPlan.findMany({
      where: { libraryId: library.id },
      include: {
        _count: { select: { bookings: { where: { status: { in: ['CONFIRMED', 'ACTIVE'] } } } } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return Response.json({ plans })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(['LIBRARY_OWNER', 'LIBRARY_MANAGER'])
    const library = await getOwnerLibrary(session.userId)
    if (!library) return Response.json({ error: 'Library not found' }, { status: 404 })

    const body = await request.json()
    const parsed = membershipPlanSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const d = parsed.data
    const durationDays = approxDurationDays(d.durationValue, d.durationUnit)

    const plan = await prisma.membershipPlan.create({
      data: {
        libraryId: library.id,
        name: d.name,
        description: d.description,
        dailyMinutes: d.dailyMinutes,
        durationValue: d.durationValue,
        durationUnit: d.durationUnit,
        durationDays,
        price: d.price,
        timeSelectionMode: d.timeSelectionMode,
        fixedStartTime: d.timeSelectionMode === 'FIXED' ? d.fixedStartTime ?? null : null,
        fixedEndTime:   d.timeSelectionMode === 'FIXED' ? d.fixedEndTime   ?? null : null,
        allowedDays: d.allowedDays,
        benefits: d.benefits,
      },
    })

    await createAuditLog({
      userId: session.userId,
      role: session.role,
      libraryId: library.id,
      action: 'PRICING_PLAN_CREATED',
      entityType: 'MembershipPlan',
      entityId: plan.id,
    })

    return Response.json({ plan }, { status: 201 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
