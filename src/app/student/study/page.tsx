'use client'

import { useEffect, useState, useRef } from 'react'
import { PageLoading } from '@/components/ui/loading'
import { Badge } from '@/components/ui/badge'
import { BarChart3 } from 'lucide-react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StudyData {
  todayStudyMinutes: number
  weeklyStudyMinutes: number
  monthlyStudyMinutes: number
  streak: { current: number; longest: number }
  currentSession: {
    checkInAt: string
    library: { name: string } | null
    seat: { label: string } | null
  } | null
  todaySession: {
    occurrenceId: string
    date: string
    startTime: string
    endTime: string
    status: 'UPCOMING' | 'CHECKED_IN' | 'COMPLETED' | 'MISSED'
    library: { id: string; name: string } | null
    seat: { label: string } | null
    attendance: { checkInAt: string; checkOutAt: string | null } | null
  } | null
  nextSession: {
    occurrenceId: string
    date: string
    startTime: string
    endTime: string
    library: { id: string; name: string } | null
    seat: { label: string } | null
  } | null
  weeklyChart: Array<{ date: string; minutes: number }>
  recentSessions: Array<{
    id: string
    date: string
    checkInAt: string
    checkOutAt: string
    durationMinutes: number
    library: { name: string } | null
    seat: { label: string } | null
  }>
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmt(minutes: number): string {
  if (minutes <= 0) return '0m'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return `${h}h ${String(m).padStart(2, '0')}m`
}

function fmtTime(dt: string): string {
  const d = new Date(dt)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function fmtDate(dt: string): string {
  // dt may be "YYYY-MM-DD" or ISO string
  const d = dt.length === 10 ? new Date(dt + 'T00:00:00') : new Date(dt)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase().slice(0, 3)
}

function relativeDay(dateStr: string, todayStr: string, tomorrowStr: string): string {
  if (dateStr === todayStr) return 'Today'
  if (dateStr === tomorrowStr) return 'Tomorrow'
  return fmtDate(dateStr)
}

function getTodayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getTomorrowStr(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function elapsedTimer(checkInAt: string): string {
  const diff = Date.now() - new Date(checkInAt).getTime()
  if (diff < 0) return '0:00'
  const totalSec = Math.floor(diff / 1000)
  const h = Math.floor(totalSec / 3600)
  const min = Math.floor((totalSec % 3600) / 60)
  const sec = totalSec % 60
  if (h > 0) {
    return `${h}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }
  return `${min}:${String(sec).padStart(2, '0')}`
}

// ─── Status badge variant mapping ────────────────────────────────────────────

const SESSION_STATUS_VARIANT: Record<
  'UPCOMING' | 'CHECKED_IN' | 'COMPLETED' | 'MISSED',
  'active' | 'pending' | 'secondary' | 'suspended'
> = {
  UPCOMING: 'pending',
  CHECKED_IN: 'active',
  COMPLETED: 'secondary',
  MISSED: 'suspended',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudentStudyPage() {
  const [studyData, setStudyData] = useState<StudyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [liveTimer, setLiveTimer] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch('/api/student/study')
      .then((r) => r.json())
      .then((data) => setStudyData(data))
      .finally(() => setLoading(false))
  }, [])

  // Live timer for current session
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    const checkInAt = studyData?.currentSession?.checkInAt
    if (!checkInAt) {
      setLiveTimer('')
      return
    }
    const tick = () => setLiveTimer(elapsedTimer(checkInAt))
    tick()
    timerRef.current = setInterval(tick, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [studyData?.currentSession?.checkInAt])

  if (loading) return <PageLoading />

  if (!studyData) {
    return (
      <div className="px-4 py-4">
        <p className="text-sm text-slate-500">Failed to load study data.</p>
      </div>
    )
  }

  const {
    todayStudyMinutes,
    weeklyStudyMinutes,
    monthlyStudyMinutes,
    streak,
    currentSession,
    todaySession,
    nextSession,
    weeklyChart,
    recentSessions,
  } = studyData

  const todayStr = getTodayStr()
  const tomorrowStr = getTomorrowStr()
  const isEmpty =
    !todaySession && recentSessions.length === 0 && weeklyStudyMinutes === 0

  const maxWeeklyMinutes = Math.max(...weeklyChart.map((d) => d.minutes), 60)

  return (
    <div className="px-4 py-4 space-y-4">
      <h1 className="text-xl font-bold text-slate-900">My Study</h1>

      {/* Empty state */}
      {isEmpty && (
        <div className="text-center py-12">
          <BarChart3 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-600">No Study Sessions Yet</p>
          <p className="text-sm text-slate-400 mt-1 max-w-xs mx-auto">
            Your actual study progress will appear here after you start attending your booked
            library sessions.
          </p>
          <Link href="/student/explore">
            <button className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium">
              Explore Libraries
            </button>
          </Link>
        </div>
      )}

      {/* Currently Studying Banner */}
      {currentSession && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-emerald-800 text-sm">Currently Studying</span>
          </div>
          <p className="text-xs text-emerald-600 mt-1">
            {currentSession.library?.name} · Seat {currentSession.seat?.label}
          </p>
          <p className="text-2xl font-bold text-emerald-700 mt-2">{liveTimer}</p>
          <p className="text-xs text-emerald-600">Started {fmtTime(currentSession.checkInAt)}</p>
        </div>
      )}

      {/* 4 Stat Cards — 2x2 grid */}
      {!isEmpty && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white border border-slate-100 p-4 shadow-sm">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Today</p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">{fmt(todayStudyMinutes)}</p>
          </div>
          <div className="rounded-2xl bg-white border border-slate-100 p-4 shadow-sm">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Streak</p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">
              🔥 {streak.current} {streak.current === 1 ? 'Day' : 'Days'}
            </p>
          </div>
          <div className="rounded-2xl bg-white border border-slate-100 p-4 shadow-sm">
            <p className="text-xs text-slate-500 uppercase tracking-wide">This Week</p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">{fmt(weeklyStudyMinutes)}</p>
          </div>
          <div className="rounded-2xl bg-white border border-slate-100 p-4 shadow-sm">
            <p className="text-xs text-slate-500 uppercase tracking-wide">This Month</p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">{fmt(monthlyStudyMinutes)}</p>
          </div>
        </div>
      )}

      {/* Today's Session */}
      <div className="rounded-2xl bg-white border border-slate-100 p-4 shadow-sm">
        <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Today's Session</p>
        {todaySession ? (
          <>
            <p className="font-bold text-slate-900">{todaySession.library?.name}</p>
            <p className="text-sm text-slate-500">Seat {todaySession.seat?.label}</p>
            <p className="text-sm text-slate-700 mt-1">
              {fmtTime(todaySession.startTime)} – {fmtTime(todaySession.endTime)}
            </p>
            <div className="mt-2">
              <Badge variant={SESSION_STATUS_VARIANT[todaySession.status]}>
                {todaySession.status.replace('_', ' ')}
              </Badge>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-400">No session scheduled for today</p>
        )}
      </div>

      {/* Weekly Chart (CSS bars) */}
      {!isEmpty && (
        <div className="rounded-2xl bg-white border border-slate-100 p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase mb-3">This Week</p>
          <div className="space-y-2">
            {weeklyChart.map(({ date, minutes }) => {
              const pct = Math.round((minutes / maxWeeklyMinutes) * 100)
              return (
                <div key={date} className="flex items-center gap-2 text-xs">
                  <span className="w-8 text-slate-500">{fmtDay(date)}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-indigo-500 h-2 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-slate-600">{fmt(minutes)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Next Session */}
      <div className="rounded-2xl bg-white border border-slate-100 p-4 shadow-sm">
        <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Next Session</p>
        {nextSession ? (
          <>
            <p className="text-xs text-indigo-500 font-medium">
              {relativeDay(nextSession.date, todayStr, tomorrowStr)}
            </p>
            <p className="font-bold text-slate-900">{nextSession.library?.name}</p>
            <p className="text-sm text-slate-500">Seat {nextSession.seat?.label}</p>
            <p className="text-sm text-slate-700">
              {fmtTime(nextSession.startTime)} – {fmtTime(nextSession.endTime)}
            </p>
          </>
        ) : (
          <div className="text-center py-2">
            <p className="text-sm text-slate-400 mb-2">No upcoming sessions</p>
            <Link href="/student/explore">
              <button className="text-xs text-indigo-600 font-medium">
                Explore Libraries →
              </button>
            </Link>
          </div>
        )}
      </div>

      {/* Recent Sessions */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase">Recent Sessions</p>
        {recentSessions.length === 0 ? (
          <div className="rounded-2xl bg-white border border-slate-100 p-6 text-center">
            <p className="text-sm text-slate-400">No completed sessions yet</p>
          </div>
        ) : (
          recentSessions.map((s) => (
            <div
              key={s.id}
              className="rounded-2xl bg-white border border-slate-100 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-slate-900 text-sm">
                    {s.library?.name ?? 'Library'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Seat {s.seat?.label} · {fmtDate(s.date)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {fmtTime(s.checkInAt)} → {fmtTime(s.checkOutAt)}
                  </p>
                </div>
                <p className="text-sm font-bold text-indigo-600">{fmt(s.durationMinutes)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
