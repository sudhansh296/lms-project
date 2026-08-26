import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import crypto from 'crypto'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest) {
  // DISABLED: This route only verifies HMAC signature but does NOT perform:
  // - Razorpay payment status check (captured vs pending)
  // - Amount/currency verification
  // - Seat availability confirmation
  // - Route settlement to owner
  // - BookingOccurrence confirmation
  // - Proper idempotency
  //
  // Students MUST use: POST /api/student/bookings/:id/pay
  // Which calls the secure finalizeCapturedBookingPayment() from payment-service.ts
  
  try {
    await requireAuth(['STUDENT'])
    
    return Response.json({ 
      error: 'This endpoint is disabled. Payment verification happens automatically.',
      details: 'The booking flow handles payment verification securely through the webhook and payment finalizer'
    }, { status: 410 }) // 410 Gone
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
