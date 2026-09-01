import { NextRequest } from 'next/server'
import { requireAuth, createAuditLog } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { seatSchema } from '@/lib/validations'
import { serialize } from '@/lib/serialize'
import { checkSeatLimit } from '@/lib/level-limits'
import type { OwnerMembershipLevel } from '@/lib/referral'

async function getOwnerLibrary(userId: string) {
  return prisma.library.findFirst({
    where: { owner: { userId } },
  })
}

export async function GET() {
  try {
    const session = await requireAuth(['LIBRARY_OWNER', 'LIBRARY_MANAGER', 'LIBRARY_STAFF'])
    const library = await getOwnerLibrary(session.userId)
    if (!library) return Response.json({ error: 'Library not found' }, { status: 404 })

    const seats = await prisma.seat.findMany({
      where: { libraryId: library.id },
      orderBy: { label: 'asc' },
    })

    return Response.json(serialize({ seats }))
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown'
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
    const parsed = seatSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    // ── Seat limit check ─────────────────────────────────────────────────────
    const owner = await prisma.libraryOwner.findUnique({
      where: { userId: session.userId },
      select: {
        ownerMembershipLevel: true,
        _count: { select: { libraries: true } },
      },
    })
    if (owner) {
      // Count total seats across all the owner's libraries
      const ownerLibraries = await prisma.library.findMany({
        where: { owner: { userId: session.userId } },
        select: { id: true },
      })
      const totalSeats = await prisma.seat.count({
        where: { libraryId: { in: ownerLibraries.map(l => l.id) } },
      })
      const limitCheck = checkSeatLimit(owner.ownerMembershipLevel as OwnerMembershipLevel, totalSeats)
      if (!limitCheck.allowed) {
        return Response.json({ error: limitCheck.reason }, { status: 403 })
      }
    }

    // Check label uniqueness within library
    const existing = await prisma.seat.findUnique({
      where: { libraryId_label: { libraryId: library.id, label: parsed.data.label } },
    })
    if (existing) {
      return Response.json({ error: `Seat label '${parsed.data.label}' already exists` }, { status: 409 })
    }

    const seat = await prisma.seat.create({
      data: { ...parsed.data, libraryId: library.id },
    })

    await createAuditLog({
      userId: session.userId,
      role: session.role,
      libraryId: library.id,
      action: 'SEAT_CREATED',
      entityType: 'Seat',
      entityId: seat.id,
    })

    return Response.json(serialize({ seat }), { status: 201 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown'
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
