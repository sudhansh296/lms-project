'use client'

import { useEffect, useState } from 'react'
import { PageLoading } from '@/components/ui/loading'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, MapPin, AlertCircle, CheckCircle } from 'lucide-react'
import { formatDate, formatTime } from '@/lib/utils'
import Link from 'next/link'

interface ActiveBooking {
  id: string
  startTime: string
  endTime: string
  status: string
  library: { id: string; name: string; city: string }
  seat: { label: string; seatType: string }
}

export default function StudentExpiryPage() {
  const [activeBooking, setActiveBooking] = useState<ActiveBooking | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch active or upcoming confirmed bookings
    fetch('/api/student/bookings?status=CONFIRMED&limit=1')
      .then(r => r.json())
      .then(data => {
        const bookings = data.bookings ?? []
        // Find the earliest upcoming or active booking
        const now = new Date()
        const active = bookings.find((b: ActiveBooking) => 
          b.status === 'CONFIRMED' && new Date(b.endTime) > now
        )
        setActiveBooking(active ?? null)
      })
      .finally(() => setLoading(false))
  }, [])

  const getRemainingTime = (endTime: string) => {
    const now = new Date()
    const end = new Date(endTime)
    const diff = end.getTime() - now.getTime()

    if (diff <= 0) return { text: 'Expired', urgent: true }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (days > 0) {
      return { text: `${days} day${days > 1 ? 's' : ''} remaining`, urgent: days < 3 }
    } else if (hours > 0) {
      return { text: `${hours} hour${hours > 1 ? 's' : ''} remaining`, urgent: true }
    } else {
      return { text: `${minutes} minute${minutes > 1 ? 's' : ''} remaining`, urgent: true }
    }
  }

  if (loading) return <PageLoading />

  if (!activeBooking) {
    return (
      <div className="px-4 py-4 space-y-4">
        <h1 className="text-xl font-bold text-slate-900">Booking Expiry</h1>
        
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
          <div className="rounded-full bg-slate-100 p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-slate-400" />
          </div>
          <p className="font-semibold text-slate-700 mb-2">No Active Booking</p>
          <p className="text-sm text-slate-500 mb-6">
            You don't have any active seat bookings at the moment.
          </p>
          <Link href="/student/explore">
            <button className="rounded-xl bg-indigo-600 text-white px-6 py-2.5 text-sm font-medium hover:bg-indigo-700 transition-colors">
              Book a Seat
            </button>
          </Link>
        </div>
      </div>
    )
  }

  const remaining = getRemainingTime(activeBooking.endTime)
  const isExpired = new Date(activeBooking.endTime) < new Date()

  return (
    <div className="px-4 py-4 space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Booking Expiry</h1>

      {/* Status Banner */}
      <div className={`rounded-2xl p-4 ${
        isExpired 
          ? 'bg-red-50 border border-red-200' 
          : remaining.urgent 
            ? 'bg-amber-50 border border-amber-200' 
            : 'bg-emerald-50 border border-emerald-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`rounded-full p-2 ${
            isExpired 
              ? 'bg-red-100' 
              : remaining.urgent 
                ? 'bg-amber-100' 
                : 'bg-emerald-100'
          }`}>
            {isExpired ? (
              <AlertCircle className="h-5 w-5 text-red-600" />
            ) : (
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            )}
          </div>
          <div className="flex-1">
            <p className={`font-bold text-sm ${
              isExpired 
                ? 'text-red-800' 
                : remaining.urgent 
                  ? 'text-amber-800' 
                  : 'text-emerald-800'
            }`}>
              {isExpired ? 'Booking Expired' : remaining.text}
            </p>
            <p className={`text-xs mt-0.5 ${
              isExpired 
                ? 'text-red-600' 
                : remaining.urgent 
                  ? 'text-amber-600' 
                  : 'text-emerald-600'
            }`}>
              {isExpired 
                ? 'Your seat booking has ended' 
                : remaining.urgent 
                  ? 'Booking expiring soon' 
                  : 'Your booking is active'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Booking Details Card */}
      <div className="rounded-2xl bg-white border border-slate-100 overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-4 text-white">
          <p className="text-xs opacity-80 mb-1">Current Booking</p>
          <h2 className="text-lg font-bold">{activeBooking.library.name}</h2>
          <p className="text-sm opacity-90 flex items-center gap-1 mt-1">
            <MapPin className="h-3.5 w-3.5" /> {activeBooking.library.city}
          </p>
        </div>

        <div className="p-4 space-y-3">
          {/* Seat Info */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-sm text-slate-500">Seat</span>
            <div className="text-right">
              <p className="font-bold text-slate-900">{activeBooking.seat.label}</p>
              <p className="text-xs text-slate-500 capitalize">{activeBooking.seat.seatType.toLowerCase()}</p>
            </div>
          </div>

          {/* Start Date */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-sm text-slate-500 flex items-center gap-1.5">
              <Calendar className="h-4 w-4" /> Booking Start
            </span>
            <div className="text-right">
              <p className="font-bold text-slate-900 text-sm">{formatDate(activeBooking.startTime)}</p>
              <p className="text-xs text-slate-500">{formatTime(activeBooking.startTime)}</p>
            </div>
          </div>

          {/* Expiry Date */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-sm text-slate-500 flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> Expiry Date
            </span>
            <div className="text-right">
              <p className={`font-bold text-sm ${
                isExpired 
                  ? 'text-red-600' 
                  : remaining.urgent 
                    ? 'text-amber-600' 
                    : 'text-slate-900'
              }`}>
                {formatDate(activeBooking.endTime)}
              </p>
              <p className="text-xs text-slate-500">{formatTime(activeBooking.endTime)}</p>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Status</span>
            <Badge variant={isExpired ? 'suspended' : 'active'}>
              {isExpired ? 'EXPIRED' : activeBooking.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2">
        <Link href={`/student/library/${activeBooking.library.id}`}>
          <button className="w-full rounded-xl bg-indigo-600 text-white py-3 text-sm font-medium hover:bg-indigo-700 transition-colors">
            View Library Details
          </button>
        </Link>
        
        {isExpired && (
          <Link href="/student/explore">
            <button className="w-full rounded-xl border-2 border-indigo-600 text-indigo-600 py-3 text-sm font-medium hover:bg-indigo-50 transition-colors">
              Book Another Seat
            </button>
          </Link>
        )}
      </div>

      {/* Info Note */}
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
        <p className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-slate-400" />
          <span>
            Your booking serves as your membership. When the booking expires, your access to the library seat ends. 
            {!isExpired && ' You can book another seat to extend your access.'}
          </span>
        </p>
      </div>
    </div>
  )
}
