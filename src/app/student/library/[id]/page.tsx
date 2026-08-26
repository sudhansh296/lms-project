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
  membershipPlans: Array<{ 
    id: string; name: string; description?: string; 
    pricingModel?: string;
    price: number; 
    monthlyPrice?: number;
    dailyMinutes: number; durationValue: number; durationUnit: string; durationDays: number
    timeSelectionMode: string; fixedStartTime?: string; fixedEndTime?: string
    allowedDays: number[]; benefits: string[]; isActive: boolean
  }>
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

  const TABS = ['overview', 'plans', 'seats', 'facilities', 'rules', 'reviews']

  // The cheapest active plan — used for display purposes
  const lowestPlan = library.membershipPlans.length > 0
    ? library.membershipPlans.reduce((a, b) => {
        const priceA = a.pricingModel === 'MONTHLY_RATE' ? (a.monthlyPrice ?? a.price) : a.price
        const priceB = b.pricingModel === 'MONTHLY_RATE' ? (b.monthlyPrice ?? b.price) : b.price
        return priceA <= priceB ? a : b
      })
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

        {/* ── Study Plans tab — show all owner's pricing packages ── */}
        {activeTab === 'plans' && (
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
                <p className="font-bold text-indigo-900 text-sm">Choose Your Study Duration</p>
              </div>
              <p className="text-sm text-indigo-800 leading-relaxed">
                Select your preferred daily study hours. You'll choose how many months to purchase during booking.
              </p>
            </div>

            {/* Study Plans */}
            {library.membershipPlans.length === 0 ? (
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 text-center">
                <BookOpen className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                <p className="font-semibold text-amber-800 text-sm">No pricing plans available</p>
                <p className="text-xs text-amber-700 mt-1">This library hasn't set up pricing plans yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <h3 className="font-bold text-slate-900 text-sm">Available Daily Study Options</h3>
                {library.membershipPlans.filter(p => p.isActive !== false).map(plan => {
                  const isMonthlyRate = plan.pricingModel === 'MONTHLY_RATE'
                  const displayPrice = isMonthlyRate ? (plan.monthlyPrice ?? plan.price) : plan.price
                  
                  return (
                    <div key={plan.id} className="rounded-2xl bg-white border border-slate-100 p-4 hover:border-indigo-200 hover:shadow-sm transition-all">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="font-bold text-slate-900">{plan.name}</p>
                          {plan.description && <p className="text-xs text-slate-500 mt-0.5">{plan.description}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-2xl font-bold text-indigo-600">₹{displayPrice.toFixed(0)}</p>
                          <p className="text-xs text-slate-500">{isMonthlyRate ? '/ month' : `for ${plan.durationValue} ${plan.durationUnit.toLowerCase()}(s)`}</p>
                        </div>
                      </div>
                      
                      {/* Plan details */}
                      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                        <div className="rounded-lg bg-indigo-50 px-3 py-2">
                          <p className="text-indigo-500 mb-0.5 flex items-center gap-1"><Clock className="h-3 w-3" /> Daily Access</p>
                          <p className="font-bold text-indigo-800">
                            {Math.floor(plan.dailyMinutes / 60)}h {plan.dailyMinutes % 60 > 0 ? `${plan.dailyMinutes % 60}m` : ''}
                          </p>
                        </div>
                        {isMonthlyRate ? (
                          <div className="rounded-lg bg-emerald-50 px-3 py-2">
                            <p className="text-emerald-500 mb-0.5 flex items-center gap-1"><Calendar className="h-3 w-3" /> Duration</p>
                            <p className="font-bold text-emerald-800">You choose</p>
                          </div>
                        ) : (
                          <div className="rounded-lg bg-violet-50 px-3 py-2">
                            <p className="text-violet-500 mb-0.5 flex items-center gap-1"><Calendar className="h-3 w-3" /> Duration</p>
                            <p className="font-bold text-violet-800">{plan.durationDays} days</p>
                          </div>
                        )}
                      </div>

                      {/* Time mode */}
                      <div className="text-xs mb-3">
                        {plan.timeSelectionMode === 'FIXED' ? (
                          <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded-full font-medium">
                            Fixed: {plan.fixedStartTime} – {plan.fixedEndTime}
                          </span>
                        ) : (
                          <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full font-medium">
                            Flexible timing
                          </span>
                        )}
                      </div>

                      {/* Pricing info for monthly rate */}
                      {isMonthlyRate && displayPrice > 0 && (
                        <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 mb-3 text-xs space-y-1">
                          <p className="text-slate-600 font-medium">Example pricing:</p>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                              <p className="text-slate-500">1 month</p>
                              <p className="font-bold text-slate-900">₹{displayPrice.toFixed(0)}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">3 months</p>
                              <p className="font-bold text-slate-900">₹{(displayPrice * 3).toFixed(0)}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">6 months</p>
                              <p className="font-bold text-slate-900">₹{(displayPrice * 6).toFixed(0)}</p>
                            </div>
                          </div>
                        </div>
                      )}

                    {/* Benefits */}
                    {plan.benefits.length > 0 && (
                      <div className="space-y-1 mb-4">
                        {plan.benefits.slice(0, 3).map((b, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-xs text-slate-600">
                            <Check className="h-3 w-3 text-emerald-500 shrink-0" /> {b}
                          </div>
                        ))}
                        {plan.benefits.length > 3 && (
                          <p className="text-xs text-slate-400 pl-4">+{plan.benefits.length - 3} more benefits</p>
                        )}
                      </div>
                    )}

                    {/* Select button */}
                    <Button 
                      className="w-full" 
                      size="sm" 
                      onClick={() => router.push(`/student/library/${id}/book?plan=${plan.id}`)}
                    >
                      {isMonthlyRate ? 'Choose This Rate' : 'Select This Plan'}
                    </Button>
                  </div>
                )})}
              </div>
            )}

            {/* General CTA if no specific plan selection */}
            {library.membershipPlans.length > 0 && (
              <div className="text-center pt-2">
                <p className="text-xs text-slate-500 mb-3">Or browse all plans while booking</p>
                <Button
                  variant="outline"
                  className="w-full"
                  size="lg"
                  onClick={() => router.push(`/student/library/${id}/book`)}
                >
                  <CreditCard className="h-4 w-4" />
                  View All Plans & Book Seat
                </Button>
              </div>
            )}
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
