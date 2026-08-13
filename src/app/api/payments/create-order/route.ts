import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import Razorpay from 'razorpay'

// Platform's own Razorpay instance — all orders collected here first
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID ?? '',
  key_secret: process.env.RAZORPAY_KEY_SECRET ?? '',
})

export async function POST(request: NextRequest) {
  try {
    // Both students (seat booking) and library owners (subscription) create orders
    const session = await requireAuth(['STUDENT', 'LIBRARY_OWNER'])
    const body = await request.json()
    const { amount, currency = 'INR', receipt, notes } = body

    if (!amount || amount <= 0) {
      return Response.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // paise
      currency,
      receipt: receipt ?? `rcpt_${Date.now()}`,
      notes: {
        userId: session.userId,
        role: session.role,
        ...notes,
      },
    })

    return Response.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    console.error('Razorpay order error:', error)
    return Response.json({ error: 'Payment initialization failed' }, { status: 500 })
  }
}
