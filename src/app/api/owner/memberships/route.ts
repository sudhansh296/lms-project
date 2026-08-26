import { NextRequest } from 'next/server'
import { requireAuth, createAuditLog } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { membershipPlanCreateSchema, approxDurationDays, generatePlanName } from '@/lib/validations'

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
    const parsed = membershipPlanCreateSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const d = parsed.data
    const isMonthlyRate = d.pricingModel === 'MONTHLY_RATE'

    // Auto-generate name if not provided (for MONTHLY_RATE plans)
    const planName = d.name?.trim() || (isMonthlyRate ? generatePlanName(d.dailyMinutes) : 'Unnamed Plan')

    // Check for duplicate monthly rate plan (library + dailyMinutes must be unique for MONTHLY_RATE)
    if (isMonthlyRate) {
      const existing = await prisma.membershipPlan.findFirst({
        where: {
          libraryId: library.id,
          dailyMinutes: d.dailyMinutes,
          pricingModel: 'MONTHLY_RATE',
          isActive: true,
        },
      })
      if (existing) {
        return Response.json({
          error: `A monthly rate for ${generatePlanName(d.dailyMinutes)} already exists. Please edit the existing plan or deactivate it first.`,
        }, { status: 409 })
      }
    }

    // Prepare data based on pricing model
    const planData: Record<string, unknown> = {
      libraryId: library.id,
      name: planName,
      description: d.description,
      pricingModel: d.pricingModel,
      dailyMinutes: d.dailyMinutes,
      timeSelectionMode: d.timeSelectionMode,
      fixedStartTime: d.timeSelectionMode === 'FIXED' ? d.fixedStartTime ?? null : null,
      fixedEndTime: d.timeSelectionMode === 'FIXED' ? d.fixedEndTime ?? null : null,
      allowedDays: d.allowedDays,
      benefits: d.benefits,
    }

    if (isMonthlyRate) {
      // New monthly rate model
      planData.monthlyPrice = d.monthlyPrice
      planData.price = d.monthlyPrice // For compatibility, mirror monthlyPrice
      planData.durationValue = 1
      planData.durationUnit = 'MONTH'
      planData.durationDays = 30
    } else {
      // Legacy package model
      planData.price = d.price
      planData.durationValue = d.durationValue
      planData.durationUnit = d.durationUnit
      planData.durationDays = approxDurationDays(d.durationValue!, d.durationUnit as 'DAY' | 'WEEK' | 'MONTH' | 'YEAR')
      planData.monthlyPrice = null
    }

    const plan = await prisma.membershipPlan.create({ data: planData as any })

    await createAuditLog({
      userId: session.userId,
      role: session.role,
      libraryId: library.id,
      action: 'PRICING_PLAN_CREATED',
      entityType: 'MembershipPlan',
      entityId: plan.id,
      metadata: { pricingModel: d.pricingModel, dailyMinutes: d.dailyMinutes },
    })

    return Response.json({ plan }, { status: 201 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    console.error('Create plan error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
