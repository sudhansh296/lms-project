/**
 * POST /api/auth/change-password
 * 
 * FIX 21: Real password change endpoint with proper validation
 * Requires authenticated user and current password verification
 */
import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const body = await request.json()
    const { currentPassword, newPassword } = body

    // Validation
    if (!currentPassword || !newPassword) {
      return Response.json({ 
        error: 'Current password and new password are required' 
      }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return Response.json({ 
        error: 'New password must be at least 6 characters long' 
      }, { status: 400 })
    }

    if (currentPassword === newPassword) {
      return Response.json({ 
        error: 'New password must be different from current password' 
      }, { status: 400 })
    }

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, passwordHash: true },
    })

    if (!user || !user.passwordHash) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!isValidPassword) {
      return Response.json({ 
        error: 'Current password is incorrect' 
      }, { status: 401 })
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashedPassword },
    })

    return Response.json({ 
      success: true,
      message: 'Password changed successfully' 
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Change password error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
