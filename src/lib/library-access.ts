import prisma from './prisma'

/**
 * P1-6: Resolve library access for owner/manager/staff
 * 
 * - LIBRARY_OWNER: Find library where owner.userId matches
 * - LIBRARY_MANAGER/LIBRARY_STAFF: Find library via staff assignment
 * 
 * Returns library or null if not found/not authorized
 */
export async function resolveAuthorizedLibrary(
  userId: string,
  role: string
): Promise<{ id: string; ownerId: string; name: string; status: string } | null> {
  if (role === 'LIBRARY_OWNER') {
    // Owner: Find via owner relation
    return await prisma.library.findFirst({
      where: { owner: { userId } },
      select: { id: true, ownerId: true, name: true, status: true },
    })
  }

  if (role === 'LIBRARY_MANAGER' || role === 'LIBRARY_STAFF') {
    // Manager/Staff: Find via staff assignment
    // TODO: Implement LibraryStaff table and relation
    // For now, this is a placeholder that returns null
    // 
    // Future implementation:
    // const staffAssignment = await prisma.libraryStaff.findFirst({
    //   where: { userId, isActive: true },
    //   include: { library: { select: { id, ownerId, name, status } } }
    // })
    // return staffAssignment?.library ?? null
    
    console.warn('[P1-6] Manager/Staff support not yet implemented. LibraryStaff table needed.')
    return null
  }

  return null
}

/**
 * Legacy helper for backward compatibility
 * Use resolveAuthorizedLibrary() for new code
 */
export async function getOwnerLibrary(userId: string) {
  return prisma.library.findFirst({ 
    where: { owner: { userId } },
    select: { id: true, ownerId: true, name: true, status: true },
  })
}
