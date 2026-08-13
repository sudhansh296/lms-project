'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface SessionUser {
  id: string
  userId: string
  name: string
  mobile: string
  email?: string | null
  role: string
  profilePhoto?: string | null
}

interface AuthContextValue {
  user: SessionUser | null
  loading: boolean
  login: (mobile: string, password: string) => Promise<{ error?: string }>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [refresh])

  const login = useCallback(async (mobile: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile, password }),
    })
    const data = await res.json()
    if (!res.ok) return { error: data.error ?? 'Login failed' }
    setUser(data.user)
    return {}
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    router.push('/login')
  }, [router])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function useRequireAuth(role?: string | string[]) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) { router.push('/login'); return }
    if (role) {
      const roles = Array.isArray(role) ? role : [role]
      if (!roles.includes(user.role)) {
        if (user.role === 'SUPER_ADMIN') router.push('/admin')
        else if (['LIBRARY_OWNER', 'LIBRARY_MANAGER', 'LIBRARY_STAFF'].includes(user.role)) router.push('/owner')
        else router.push('/student')
      }
    }
  }, [user, loading, role, router])

  return { user, loading }
}
