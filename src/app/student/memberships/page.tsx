'use client'

/**
 * Student memberships page — redirects to bookings.
 * Seat bookings are now the source of truth; there is no separate membership concept.
 */
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PageLoading } from '@/components/ui/loading'

export default function StudentMembershipsRedirectPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/student/bookings') }, [router])
  return <PageLoading message="Redirecting to bookings..." />
}
