import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { serialize } from '@/lib/serialize'

async function getOwnerLibrary(userId: string) {
  return prisma.library.findFirst({ where: { owner: { userId } } })
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(['LIBRARY_OWNER', 'LIBRARY_MANAGER', 'LIBRARY_STAFF'])
    const library = await getOwnerLibrary(session.userId)
    if (!library) return Response.json({ error: 'Library not found' }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') ?? ''
    const page = parseInt(searchParams.get('page') ?? '1')
    const limit = parseInt(searchParams.get('limit') ?? '20')
    const skip = (page - 1) * limit

    const [memberships, total] = await Promise.all([
      prisma.studentMembership.findMany({
        where: { libraryId: library.id },
        include: {
          student: {
            include: {
              user: true,
              bookings: {
                where: { libraryId: library.id },
                orderBy: { startTime: 'desc' },
                take: 1,
                include: { seat: true },
              },
            },
          },
          plan: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.studentMembership.count({ where: { libraryId: library.id } }),
    ])

    const filtered = search
      ? memberships.filter((m: { student: { user: { name: string; mobile: string; email: string | null } } }) => {
          const u = m.student.user
          const q = search.toLowerCase()
          return (
            u.name.toLowerCase().includes(q) ||
            u.mobile.includes(q) ||
            (u.email ?? '').toLowerCase().includes(q)
          )
        })
      : memberships

    return Response.json(serialize({
      students: filtered,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    }))
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
