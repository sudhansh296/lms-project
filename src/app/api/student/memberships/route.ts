import { NextRequest } from 'next/server'
import { requireAuth, createAuditLog } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { addDays } from 'date-fns'

export async function GET() {
  try {
    const session = await requireAuth(['STUDENT'])

    const memberships = await prisma.studentMembership.findMany({
      where: { studentId: session.id },
      include: {
        library: {
          select: {
            id: true, name: true, city: true, area: true,
            photos: { where: { isCover: true }, take: 1 },
            phone: true,
          },
        },
        plan: true,
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return Response.json({ memberships })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(['STUDENT'])
    const body = await request.json()
    const { planId, paymentMethod, razorpayOrderId, razorpayPaymentId, razorpaySignature } = body

    if (!planId) return Response.json({ error: 'Plan ID required' }, { status: 400 })

    const plan = await prisma.membershipPlan.findUnique({
      where: { id: planId, isActive: true },
      include: { library: true },
    })
    if (!plan) return Response.json({ error: 'Plan not found' }, { status: 404 })

    if (plan.library.status !== 'ACTIVE') {
      return Response.json({ error: 'Library is not active' }, { status: 400 })
    }

    // Check if already has active membership at this library
    const existing = await prisma.studentMembership.findFirst({
      where: {
        studentId: session.id,
        libraryId: plan.libraryId,
        status: 'ACTIVE',
        endDate: { gte: new Date() },
      },
    })
    if (existing) {
      return Response.json({ error: 'You already have an active membership at this library' }, { status: 409 })
    }

    const startDate = new Date()
    const endDate = addDays(startDate, plan.durationDays)

    const membership = await prisma.studentMembership.create({
      data: {
        studentId: session.id,
        libraryId: plan.libraryId,
        planId,
        status: 'ACTIVE',
        startDate,
        endDate,
        paidAmount: plan.price,
        payment: {
          create: {
            studentId: session.id,
            amount: plan.price,
            status: plan.price === 0 ? 'PAID' : (razorpayPaymentId ? 'PAID' : 'PENDING'),
            paymentMethod: paymentMethod ?? 'RAZORPAY',
            gatewayOrderId: razorpayOrderId,
            gatewayPaymentId: razorpayPaymentId,
            gatewaySignature: razorpaySignature,
          },
        },
      },
      include: { plan: true, library: { select: { name: true } }, payment: true },
    })

    // Notify library owner
    await prisma.notification.create({
      data: {
        userId: (await prisma.library.findUnique({
          where: { id: plan.libraryId },
          include: { owner: { include: { user: true } } },
        }))!.owner.userId,
        libraryId: plan.libraryId,
        type: 'NEW_MEMBERSHIP',
        title: 'New Membership Purchased',
        message: `A student purchased the ${plan.name} plan.`,
        data: { membershipId: membership.id },
      },
    })

    await createAuditLog({
      userId: session.userId,
      role: session.role,
      libraryId: plan.libraryId,
      action: 'MEMBERSHIP_CREATED',
      entityType: 'StudentMembership',
      entityId: membership.id,
    })

    return Response.json({ membership }, { status: 201 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    console.error('Membership error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
