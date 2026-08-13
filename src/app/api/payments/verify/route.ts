import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import crypto from 'crypto'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    await requireAuth(['STUDENT'])
    const body = await request.json()
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, paymentId } = body

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET ?? '')
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex')

    if (expectedSignature !== razorpaySignature) {
      return Response.json({ error: 'Payment verification failed' }, { status: 400 })
    }

    // Update payment record
    if (paymentId) {
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'PAID',
          gatewayOrderId: razorpayOrderId,
          gatewayPaymentId: razorpayPaymentId,
          gatewaySignature: razorpaySignature,
        },
      })
    }

    return Response.json({ success: true, verified: true })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    console.error('Payment verify error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
