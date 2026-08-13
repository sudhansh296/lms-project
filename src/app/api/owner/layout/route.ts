import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'

async function getOwnerLibrary(userId: string) {
  return prisma.library.findFirst({ where: { owner: { userId } } })
}

export async function GET() {
  try {
    const session = await requireAuth(['LIBRARY_OWNER', 'LIBRARY_MANAGER', 'LIBRARY_STAFF'])
    const library = await getOwnerLibrary(session.userId)
    if (!library) return Response.json({ error: 'Library not found' }, { status: 404 })

    const layout = await prisma.seatLayout.findUnique({
      where: { libraryId: library.id },
      include: { objects: true },
    })

    const seats = await prisma.seat.findMany({
      where: { libraryId: library.id },
      orderBy: { label: 'asc' },
    })

    return Response.json({ layout, seats })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth(['LIBRARY_OWNER', 'LIBRARY_MANAGER'])
    const library = await getOwnerLibrary(session.userId)
    if (!library) return Response.json({ error: 'Library not found' }, { status: 404 })

    const body = await request.json()
    const { canvasWidth, canvasHeight, objects, seats } = body

    // Upsert layout
    const layout = await prisma.seatLayout.upsert({
      where: { libraryId: library.id },
      update: { canvasWidth, canvasHeight },
      create: { libraryId: library.id, canvasWidth, canvasHeight },
    })

    // Replace all layout objects
    if (objects !== undefined) {
      await prisma.layoutObject.deleteMany({ where: { layoutId: layout.id } })
      if (objects.length > 0) {
        await prisma.layoutObject.createMany({
          data: objects.map((o: {
            objectType: string; label?: string; x: number; y: number;
            width: number; height: number; rotation?: number; color?: string
          }) => ({ ...o, layoutId: layout.id })),
        })
      }
    }

    // Update seat positions if provided
    if (seats && Array.isArray(seats)) {
      await Promise.all(
        seats.map((s: { id: string; x: number; y: number; rotation?: number }) =>
          prisma.seat.updateMany({
            where: { id: s.id, libraryId: library.id },
            data: { x: s.x, y: s.y, rotation: s.rotation ?? 0 },
          })
        )
      )
    }

    const updatedLayout = await prisma.seatLayout.findUnique({
      where: { id: layout.id },
      include: { objects: true },
    })

    return Response.json({ layout: updatedLayout })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
