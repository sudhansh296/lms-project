import { NextRequest } from 'next/server'
import { requireAuth, createAuditLog } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { membershipPlanCreateSchema, approxDurationDays, generatePlanName } from '@/lib/validations'

async function getOwnerLibrary(userId: string) {
  return prisma.library.findFirst({ where: { owner: { userId } } })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(['LIBRARY_OWNER', 'LIBRARY_MANAGER', 'LIBRARY_STAFF'])
    const { id } = await params
    const library = await getOwnerLibrary(session.userId)
    if (!library) return Response.json({ error: 'Library not found' }, { status: 404 })
    const plan = await prisma.membershipPlan.findFirst({ where: { id, libraryId: library.id } })
    if (!plan) return Response.json({ error: 'Plan not found' }, { status: 404 })
    return Response.json({ plan })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(['LIBRARY_OWNER', 'LIBRARY_MANAGER'])
    const { id } = await params
    const library = await getOwnerLibrary(session.userId)
    if (!library) return Response.json({ error: 'Library not found' }, { status: 404 })

    const plan = await prisma.membershipPlan.findFirst({ where: { id, libraryId: library.id } })
    if (!plan) return Response.json({ error: 'Plan not found' }, { status: 404 })

    const body = await request.json()
    const parsed = membershipPlanCreateSchema.partial().safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const d = parsed.data
    const updateData: Record<string, unknown> = {}
    const currentPricingModel = plan.pricingModel || 'LEGACY_PACKAGE'

    // Only allow changing fields relevant to the current pricing model
    if (d.name !== undefined) updateData.name = d.name
    if (d.description !== undefined) updateData.description = d.description
    if (d.dailyMinutes !== undefined) updateData.dailyMinutes = d.dailyMinutes
    if (d.timeSelectionMode !== undefined) updateData.timeSelectionMode = d.timeSelectionMode
    if (d.allowedDays !== undefined) updateData.allowedDays = d.allowedDays
    if (d.benefits !== undefined) updateData.benefits = d.benefits
    
    // Check if isActive is in the body directly (not in parsed.data since it's not in schema)
    if ('isActive' in body && body.isActive !== undefined) {
      updateData.isActive = body.isActive
    }

    // Handle pricing fields based on model
    if (currentPricingModel === 'MONTHLY_RATE') {
      if (d.monthlyPrice !== undefined) {
        updateData.monthlyPrice = d.monthlyPrice
        updateData.price = d.monthlyPrice // Mirror for compatibility
      }
    } else {
      // Legacy package
      if (d.price !== undefined) updateData.price = d.price
      if (d.durationValue !== undefined) updateData.durationValue = d.durationValue
      if (d.durationUnit !== undefined) updateData.durationUnit = d.durationUnit
      
      // Recalculate durationDays if duration fields changed
      const newDurationValue = d.durationValue ?? plan.durationValue
      const newDurationUnit = (d.durationUnit ?? plan.durationUnit) as 'DAY' | 'WEEK' | 'MONTH' | 'YEAR'
      if (d.durationValue !== undefined || d.durationUnit !== undefined) {
        updateData.durationDays = approxDurationDays(newDurationValue, newDurationUnit)
      }
    }

    // Handle time selection
    if (d.timeSelectionMode === 'FIXED') {
      if (d.fixedStartTime !== undefined) updateData.fixedStartTime = d.fixedStartTime
      if (d.fixedEndTime !== undefined) updateData.fixedEndTime = d.fixedEndTime
    } else if (d.timeSelectionMode === 'FLEXIBLE') {
      updateData.fixedStartTime = null
      updateData.fixedEndTime = null
    }

    const updated = await prisma.membershipPlan.update({ where: { id }, data: updateData })

    await createAuditLog({
      userId: session.userId,
      role: session.role,
      libraryId: library.id,
      action: 'PRICING_PLAN_UPDATED',
      entityType: 'MembershipPlan',
      entityId: id,
      metadata: { pricingModel: currentPricingModel },
    })

    return Response.json({ plan: updated })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    console.error('Update plan error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(['LIBRARY_OWNER'])
    const { id } = await params
    const library = await getOwnerLibrary(session.userId)
    if (!library) return Response.json({ error: 'Library not found' }, { status: 404 })

    const plan = await prisma.membershipPlan.findFirst({ where: { id, libraryId: library.id } })
    if (!plan) return Response.json({ error: 'Plan not found' }, { status: 404 })

    // Soft-delete: keep record if active bookings reference this plan
    await prisma.membershipPlan.update({ where: { id }, data: { isActive: false } })

    return Response.json({ success: true })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
