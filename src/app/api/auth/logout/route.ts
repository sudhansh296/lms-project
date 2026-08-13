import { cookies } from 'next/headers'
import { getSession, createAuditLog } from '@/lib/auth'

export async function POST() {
  const session = await getSession()

  if (session) {
    await createAuditLog({
      userId: session.userId,
      role: session.role,
      action: 'LOGOUT',
    })
  }

  const cookieStore = await cookies()
  cookieStore.delete('auth-token')

  return Response.json({ success: true })
}
