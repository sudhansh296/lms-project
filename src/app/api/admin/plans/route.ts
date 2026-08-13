import { NextRequest } from 'next/server'
import { requireAuth, createAuditLog } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    await requireAuth(['SUPER_ADMIN'])
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { price: 'asc' },
      include: {
        _count: { select: { subscriptions: true } },
      },
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
    const session = await requireAuth(['SUPER_ADMIN'])
    const body = await request.json()
    const {
      name, description, price, billingCycle, trialDays,
      maxSeats, maxStudents, maxStaff, maxBranches, features,
    } = body

    if (!name) return Response.json({ error: 'Plan name required' }, { status: 400 })

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name, description, price: price ?? 0,
        billingCycle: billingCycle ?? 'MONTHLY',
        trialDays: trialDays ?? 0,
        maxSeats: maxSeats ?? null,
        maxStudents: maxStudents ?? null,
        maxStaff: maxStaff ?? null,
        maxBranches: maxBranches ?? null,
        features: features ?? [],
      },
    })

    await createAuditLog({
      userId: session.userId,
      role: session.role,
      action: 'SUBSCRIPTION_PLAN_CREATED',
      entityType: 'SubscriptionPlan',
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
