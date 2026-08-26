import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import Razorpay from 'razorpay'

// Platform's own Razorpay instance — all orders collected here first
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID ?? '',
  key_secret: process.env.RAZORPAY_KEY_SECRET ?? '',
})

export async function POST(request: NextRequest) {
  // DISABLED: This route accepts arbitrary amounts from frontend.
  // Students MUST use: POST /api/payments/seat-order (calculates pricing server-side)
  // Owner subscriptions are NOT part of the current business model.
  
  try {
    const session = await requireAuth(['STUDENT', 'LIBRARY_OWNER'])
    
    return Response.json({ 
      error: 'This endpoint is disabled. Use the secure booking flow.',
      details: session.role === 'STUDENT' 
        ? 'Students: Use POST /api/payments/seat-order for bookings'
        : 'Owner subscriptions are not part of the current pricing model'
    }, { status: 410 }) // 410 Gone
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
