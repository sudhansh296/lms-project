import { NextRequest } from 'next/server'
import { requireAuth, createAuditLog } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { libraryUpdateSchema } from '@/lib/validations'
import { serialize } from '@/lib/serialize'

export async function GET() {
  try {
    const session = await requireAuth(['LIBRARY_OWNER', 'LIBRARY_MANAGER', 'LIBRARY_STAFF'])

    const library = await prisma.library.findFirst({
      where: { owner: { userId: session.userId } },
      include: {
        photos: { orderBy: { order: 'asc' } },
        facilities: true,
        hours: { orderBy: { dayOfWeek: 'asc' } },
        rules: { orderBy: { order: 'asc' } },
        seats: { orderBy: { label: 'asc' } },
        membershipPlans: { where: { isActive: true } },
        owner: { include: { subscription: { include: { plan: true } } } },
      },
    })

    if (!library) {
      return Response.json({ error: 'Library not found' }, { status: 404 })
    }

    return Response.json(serialize({ library }))
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown'
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuth(['LIBRARY_OWNER', 'LIBRARY_MANAGER'])

    const library = await prisma.library.findFirst({
      where: { owner: { userId: session.userId } },
    })

    if (!library) {
      return Response.json({ error: 'Library not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = libraryUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const updated = await prisma.library.update({
      where: { id: library.id },
      data: parsed.data,
    })

    await createAuditLog({
      userId: session.userId,
      role: session.role,
      libraryId: library.id,
      action: 'LIBRARY_UPDATED',
      entityType: 'Library',
      entityId: library.id,
    })

    return Response.json({ library: updated })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown'
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
