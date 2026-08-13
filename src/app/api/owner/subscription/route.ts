import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import crypto from 'crypto'
import { addDays, addMonths, addYears } from 'date-fns'

// GET — fetch current subscription + available plans
export async function GET() {
  try {
    const session = await requireAuth(['LIBRARY_OWNER'])

    const owner = await prisma.libraryOwner.findUnique({
      where: { userId: session.userId },
      include: {
        subscription: { include: { plan: true } },
      },
    })

    if (!owner) return Response.json({ error: 'Owner not found' }, { status: 404 })

    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    })

    return Response.json({
      subscription: owner.subscription,
      plans,
      razorpayAccountId: owner.razorpayAccountId,
      razorpayAccountStatus: owner.razorpayAccountStatus,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST — verify subscription payment and activate plan
// Money goes to platform's own Razorpay account (normal order, no transfer)
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(['LIBRARY_OWNER'])
    const body = await request.json()
    const { planId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = body

    if (!planId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify Razorpay signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET ?? '')
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex')

    if (expectedSignature !== razorpaySignature) {
      return Response.json({ error: 'Payment verification failed' }, { status: 400 })
    }

    // Idempotency check
    const alreadyProcessed = await prisma.ownerPayment.findFirst({
      where: { gatewayPaymentId: razorpayPaymentId },
    })
    if (alreadyProcessed) {
      return Response.json({ success: true, alreadyProcessed: true })
    }

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } })
    if (!plan) return Response.json({ error: 'Plan not found' }, { status: 404 })

    const owner = await prisma.libraryOwner.findUnique({
      where: { userId: session.userId },
      include: { subscription: true },
    })
    if (!owner) return Response.json({ error: 'Owner not found' }, { status: 404 })

    const now = new Date()
    const endDate = plan.billingCycle === 'YEARLY'
      ? addYears(now, 1)
      : plan.billingCycle === 'MONTHLY'
      ? addMonths(now, 1)
      : addDays(now, 30)

    // Create or update subscription
    if (owner.subscription) {
      await prisma.ownerSubscription.update({
        where: { ownerId: owner.id },
        data: {
          planId,
          status: 'ACTIVE',
          startDate: now,
          endDate,
          trialEnd: null,
        },
      })
    } else {
      await prisma.ownerSubscription.create({
        data: {
          ownerId: owner.id,
          planId,
          status: 'ACTIVE',
          startDate: now,
          endDate,
        },
      })
    }

    // Record the payment — this goes to platform's own Razorpay account
    await prisma.ownerPayment.create({
      data: {
        ownerId: owner.id,
        amount: plan.price,
        status: 'PAID',
        paymentMethod: 'RAZORPAY',
        gatewayOrderId: razorpayOrderId,
        gatewayPaymentId: razorpayPaymentId,
        gatewaySignature: razorpaySignature,
        subscriptionId: owner.subscription?.id,
        description: `${plan.name} subscription — ${plan.billingCycle}`,
      },
    })

    return Response.json({ success: true, endDate })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    console.error('Subscription payment error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
