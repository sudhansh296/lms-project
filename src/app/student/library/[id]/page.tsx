'use client'

import { useEffect, useState, use } from 'react'
import { PageLoading } from '@/components/ui/loading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, isLibraryOpen } from '@/lib/utils'
import { MapPin, Phone, Clock, Star, ArrowLeft, Check, Calendar, CreditCard, BookOpen } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const FACILITY_LABELS: Record<string, string> = {
  WIFI: 'Wi-Fi', AC: 'AC', POWER_BACKUP: 'Power Backup', CHARGING_POINTS: 'Charging',
  DRINKING_WATER: 'Water', PARKING: 'Parking', WASHROOM: 'Washroom', CCTV: 'CCTV',
  LOCKER: 'Locker', NEWSPAPER: 'Newspaper', SEPARATE_CABINS: 'Cabins', WINDOW_SEATS: 'Window Seats',
}

interface Library {
  id: string; name: string; description?: string; phone?: string; emailContact?: string
  city: string; area?: string; pincode: string; formattedAddress?: string; addressLine1?: string
  latitude?: number; longitude?: number; is24Hours: boolean; avgRating: number
  reviewCount: number; isOpen: boolean; availableSeats: number; totalSeats: number
  status: string
  photos: Array<{ url: string; isCover: boolean; category: string }>
  facilities: Array<{ name: string }>
  hours: Array<{ dayOfWeek: number; isOpen: boolean; openTime?: string; closeTime?: string }>
  rules: Array<{ rule: string; order: number }>
  membershipPlans: Array<{ id: string; name: string; price: number; durationDays: number; description?: string; benefits: string[] }>
  reviews: Array<{ rating: number; comment?: string; student: { user: { name: string } } }>
}

export default function LibraryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [library, setLibrary] = useState<Library | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [hasActiveMembership, setHasActiveMembership] = useState(false)

  useEffect(() => {
    fetch(`/api/libraries/${id}`)
      .then(r => r.json())
      .then(d => setLibrary(d.library))
      .finally(() => setLoading(false))

    // Check if student already has an active membership (from a previous booking)
    fetch('/api/student/memberships')
      .then(r => r.json())
      .then(d => {
        const active = d.memberships?.find((m: { libraryId: string; status: string }) =>
          m.libraryId === id && m.status === 'ACTIVE'
        )
        setHasActiveMembership(!!active)
      })
  }, [id])

  if (loading) return <PageLoading />
  if (!library) return (
    <div className="p-4 text-center py-16">
      <p className="text-slate-500">Library not found</p>
      <Link href="/student/explore"><Button className="mt-4" size="sm">Back to Explore</Button></Link>
    </div>
  )

  const TABS = ['overview', 'seats', 'membership', 'facilities', 'rules', 'reviews']

  // The cheapest active plan — shown as the seat booking price
  const lowestPlan = library.membershipPlans.length > 0
    ? library.membershipPlans.reduce((a, b) => a.price <= b.price ? a : b)
    : null

  return (
    <div>
      {/* Header image */}
      <div className="relative h-52 bg-gradient-to-br from-indigo-200 to-violet-200">
        {library.photos.find(p => p.isCover) && (
          <img src={library.photos.find(p => p.isCover)!.url} alt={library.name} className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <Link href="/student/explore" className="absolute top-4 left-4">
          <div className="rounded-full bg-white/20 backdrop-blur-sm p-2">
            <ArrowLeft className="h-4 w-4 text-white" />
          </div>
        </Link>
        <div className="absolute bottom-4 left-4 right-4">
          <h1 className="text-xl font-bold text-white">{library.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-white/80 flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {library.area ? `${library.area}, ` : ''}{library.city}
            </p>
            {library.avgRating > 0 && (
              <span className="flex items-center gap-1 bg-white/20 rounded-full px-2 py-0.5 text-xs text-white">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {library.avgRating}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <Badge variant={library.isOpen ? 'active' : 'suspended'}>
          {library.is24Hours ? '24 Hours' : library.isOpen ? 'Open Now' : 'Closed'}
        </Badge>
        <span className="text-sm text-slate-500">{library.availableSeats} / {library.totalSeats} seats free</span>
        {library.phone && (
          <a href={`tel:${library.phone}`} className="ml-auto">
            <Button size="sm" variant="outline"><Phone className="h-3.5 w-3.5" /> Call</Button>
          </a>
        )}
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-slate-100 bg-white sticky top-[57px] z-10">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-xs font-semibold capitalize whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'
            }`}>
            {tab}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {library.description && (
              <div className="rounded-2xl bg-white border border-slate-100 p-4">
                <p className="text-sm text-slate-700 leading-relaxed">{library.description}</p>
              </div>
            )}
            <div className="rounded-2xl bg-white border border-slate-100 p-4 space-y-3 text-sm">
              {library.formattedAddress && (
                <div className="flex gap-3">
                  <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <span className="text-slate-700">{library.formattedAddress}</span>
                </div>
              )}
              {library.phone && (
                <div className="flex gap-3">
                  <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                  <a href={`tel:${library.phone}`} className="text-indigo-600 font-medium">{library.phone}</a>
                </div>
              )}
              <div className="flex gap-3">
                <Clock className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 flex-1">
                  {library.hours.map(h => (
                    <div key={h.dayOfWeek} className="flex justify-between text-xs">
                      <span className="text-slate-500">{DAYS[h.dayOfWeek]}</span>
                      <span className={h.isOpen ? 'text-slate-700' : 'text-slate-400'}>
                        {h.isOpen ? `${h.openTime} – ${h.closeTime}` : 'Closed'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Membership tab — booking IS membership ── */}
        {activeTab === 'membership' && (
          <div className="space-y-4">
            {/* Active membership banner */}
            {hasActiveMembership && (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3">
                <div className="rounded-xl bg-emerald-100 p-2 shrink-0">
                  <Check className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-bold text-emerald-800 text-sm">Membership Active</p>
                  <p className="text-xs text-emerald-600 mt-0.5">You have an active membership here. Book a seat to extend it.</p>
                </div>
              </div>
            )}

            {/* Explanation card */}
            <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-indigo-600 shrink-0" />
                <p className="font-bold text-indigo-900 text-sm">How membership works</p>
              </div>
              <p className="text-sm text-indigo-800 leading-relaxed">
                There is no separate membership fee. When you book and pay for a seat, your membership is automatically activated for that booking period.
              </p>
              <ul className="space-y-1.5 pt-1">
                {[
                  'Select a seat and time slot',
                  'Complete payment via Razorpay',
                  'Seat booked + Membership activated instantly',
                  'Membership dates match your booking dates',
                ].map((step, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-indigo-700">
                    <span className="rounded-full bg-indigo-200 text-indigo-800 font-bold w-4 h-4 flex items-center justify-center shrink-0 text-[10px]">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pricing info */}
            {lowestPlan && (
              <div className="rounded-2xl bg-white border border-slate-100 p-4 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-bold text-slate-900">Seat Booking</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Payment activates membership</p>
                  </div>
                  <p className="text-xl font-bold text-indigo-600">
                    {lowestPlan.price === 0 ? 'Free' : `from ${formatCurrency(lowestPlan.price)}`}
                  </p>
                </div>
                {lowestPlan.benefits.length > 0 && (
                  <ul className="space-y-1 mb-4">
                    {lowestPlan.benefits.map((b, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-slate-600">
                        <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> {b}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* CTA — same as seats tab */}
            <Button
              className="w-full"
              size="lg"
              onClick={() => router.push(`/student/library/${id}/book`)}
            >
              <CreditCard className="h-4 w-4" />
              {hasActiveMembership ? 'Book Another Seat' : 'Book a Seat & Get Membership'}
            </Button>
          </div>
        )}

        {/* ── Seats ── */}
        {activeTab === 'seats' && (
          <Link href={`/student/library/${id}/book`}>
            <div className="rounded-2xl bg-indigo-600 text-white p-6 text-center cursor-pointer hover:bg-indigo-700 transition-colors">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-80" />
              <p className="font-bold text-lg">Book a Seat</p>
              <p className="text-indigo-200 text-sm mt-1">{library.availableSeats} seats currently available</p>
              <div className="mt-4 rounded-xl bg-white/10 py-2 text-sm font-medium">
                Select Date, Time & Seat →
              </div>
            </div>
          </Link>
        )}

        {/* ── Facilities ── */}
        {activeTab === 'facilities' && (
          <div className="grid grid-cols-2 gap-2">
            {library.facilities.map(f => (
              <div key={f.name} className="rounded-2xl bg-white border border-slate-100 p-3 flex items-center gap-2">
                <div className="rounded-lg bg-indigo-50 p-1.5">
                  <Check className="h-3.5 w-3.5 text-indigo-600" />
                </div>
                <span className="text-sm font-medium text-slate-700">
                  {FACILITY_LABELS[f.name] ?? f.name.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
            {library.facilities.length === 0 && (
              <p className="col-span-2 text-center text-slate-400 py-8 text-sm">No facilities listed</p>
            )}
          </div>
        )}

        {/* ── Rules ── */}
        {activeTab === 'rules' && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-3">
            <p className="font-bold text-amber-800 text-sm">Library Rules</p>
            {library.rules.length === 0 ? (
              <p className="text-amber-700 text-sm">No specific rules listed.</p>
            ) : library.rules.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-amber-800">
                <span className="font-bold shrink-0">{i + 1}.</span>
                <span>{r.rule}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Reviews ── */}
        {activeTab === 'reviews' && (
          <div className="space-y-3">
            {library.reviews.length === 0 ? (
              <p className="text-center text-slate-400 py-8 text-sm">No reviews yet</p>
            ) : library.reviews.map((r, i) => (
              <div key={i} className="rounded-2xl bg-white border border-slate-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-sm">{r.student.user.name}</p>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, s) => (
                      <Star key={s} className={`h-3.5 w-3.5 ${s < r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                    ))}
                  </div>
                </div>
                {r.comment && <p className="text-sm text-slate-600">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
