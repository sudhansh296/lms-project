'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Search, MapPin, Star, Wifi, Zap, Wind, Clock, ChevronRight } from 'lucide-react'
import { PageLoading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { formatCurrency } from '@/lib/utils'

interface LibraryCard {
  id: string; name: string; city: string; area?: string; pincode: string
  coverPhoto: string | null; facilities: string[]; totalSeats: number
  availableSeats: number; avgRating: number; reviewCount: number
  isOpen: boolean; lowestPrice: number | null; distance: number | null; is24Hours: boolean
}

const FACILITY_ICONS: Record<string, React.ReactNode> = {
  WIFI: <Wifi className="h-3 w-3" />,
  AC: <Wind className="h-3 w-3" />,
  CHARGING_POINTS: <Zap className="h-3 w-3" />,
}

const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Latest' },
  { value: 'distance', label: 'Nearest' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'price', label: 'Lowest Price' },
  { value: 'seats', label: 'Most Seats' },
]

export default function ExplorePage() {
  const [libraries, setLibraries] = useState<LibraryCard[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('createdAt')
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchLibraries = useCallback(async () => {
    setLoading(true)
    const q = new URLSearchParams({ search, sortBy, page: String(page), limit: '15' })
    if (userLocation) {
      q.set('lat', String(userLocation.lat))
      q.set('lng', String(userLocation.lng))
    }
    const res = await fetch(`/api/libraries?${q}`)
    const data = await res.json()
    setLibraries(page === 1 ? (data.libraries ?? []) : prev => [...prev, ...(data.libraries ?? [])])
    setTotal(data.pagination?.total ?? 0)
    setLoading(false)
  }, [search, sortBy, page, userLocation])

  useEffect(() => { fetchLibraries() }, [fetchLibraries])

  const getLocation = () => {
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setSortBy('distance')
        setPage(1)
        setLocating(false)
      },
      () => { setLocating(false) }
    )
  }

  const handleSearch = (val: string) => {
    setSearch(val)
    setPage(1)
  }

  return (
    <div className="pb-4">
      {/* Search */}
      <div className="sticky top-0 z-10 bg-white px-4 pt-4 pb-3 border-b border-slate-100 space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search libraries, city, area..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <button onClick={getLocation} disabled={locating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-medium whitespace-nowrap shrink-0">
            <MapPin className="h-3.5 w-3.5" />
            {locating ? 'Locating...' : 'Near Me'}
          </button>
          {SORT_OPTIONS.map(o => (
            <button key={o.value} onClick={() => { setSortBy(o.value); setPage(1) }}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                sortBy === o.value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        {loading && page === 1 ? (
          <PageLoading message="Finding libraries..." />
        ) : libraries.length === 0 ? (
          <EmptyState
            icon={<MapPin className="h-8 w-8" />}
            title="No libraries found"
            description="Try a different search term or location."
          />
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">{total} libraries found</p>
            {libraries.map(lib => (
              <Link key={lib.id} href={`/student/library/${lib.id}`}>
                <div className="rounded-2xl bg-white border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  {/* Cover Image */}
                  <div className="h-36 bg-gradient-to-br from-indigo-100 to-violet-100 relative overflow-hidden">
                    {lib.coverPhoto ? (
                      <img src={lib.coverPhoto} alt={lib.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-5xl opacity-20">📚</div>
                      </div>
                    )}
                    <div className="absolute top-3 right-3 flex gap-1.5">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        lib.isOpen ? 'bg-emerald-500 text-white' : 'bg-slate-800/80 text-slate-200'
                      }`}>
                        {lib.is24Hours ? '24h' : lib.isOpen ? 'Open' : 'Closed'}
                      </span>
                    </div>
                    {lib.distance !== null && (
                      <div className="absolute bottom-3 left-3 rounded-full bg-black/60 text-white text-xs px-2.5 py-1 flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {lib.distance} km
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 truncate">{lib.name}</h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {lib.area ? `${lib.area}, ` : ''}{lib.city}
                        </p>
                      </div>
                      {lib.avgRating > 0 && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                          <span className="text-sm font-bold text-slate-800">{lib.avgRating}</span>
                          <span className="text-xs text-slate-400">({lib.reviewCount})</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-1.5">
                        {lib.facilities.slice(0, 4).map(f => (
                          <span key={f} className="text-slate-400">
                            {FACILITY_ICONS[f] ?? null}
                          </span>
                        ))}
                        {lib.facilities.length > 4 && (
                          <span className="text-xs text-slate-400">+{lib.facilities.length - 4}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-medium flex items-center gap-1 ${
                          lib.availableSeats > 0 ? 'text-emerald-600' : 'text-red-500'
                        }`}>
                          <span>{lib.availableSeats}</span> seats free
                        </span>
                        {lib.lowestPrice !== null && (
                          <span className="text-xs font-bold text-indigo-600">
                            from {formatCurrency(lib.lowestPrice)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}

            {libraries.length < total && (
              <button onClick={() => setPage(p => p + 1)} disabled={loading}
                className="w-full rounded-2xl border border-slate-200 py-3 text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors">
                {loading ? 'Loading...' : 'Load More'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
