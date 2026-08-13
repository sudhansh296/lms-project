'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageLoading } from '@/components/ui/loading'
import toast from 'react-hot-toast'
import { Save, MapPin, Clock, Building2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const FACILITY_LABELS: Record<string, string> = {
  WIFI: 'Wi-Fi', AC: 'AC', POWER_BACKUP: 'Power Backup', CHARGING_POINTS: 'Charging Points',
  DRINKING_WATER: 'Drinking Water', PARKING: 'Parking', WASHROOM: 'Washroom', CCTV: 'CCTV',
  LOCKER: 'Locker', NEWSPAPER: 'Newspaper',
}

interface Library {
  id: string; name: string; description?: string; phone?: string; emailContact?: string
  city: string; state: string; pincode: string; addressLine1?: string; formattedAddress?: string
  status: string; is24Hours: boolean; minBookingMins: number; maxBookingMins: number; bookingInterval: number
  hours: Array<{ dayOfWeek: number; isOpen: boolean; openTime?: string; closeTime?: string }>
  facilities: Array<{ name: string }>
  rules: Array<{ rule: string }>
}

export default function OwnerLibraryPage() {
  const [library, setLibrary] = useState<Library | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState<Partial<Library>>({})

  useEffect(() => {
    fetch('/api/owner/library').then(r => r.json()).then(d => {
      setLibrary(d.library)
      setForm(d.library ?? {})
    }).finally(() => setLoading(false))
  }, [])

  const saveChanges = async () => {
    setSaving(true)
    const res = await fetch('/api/owner/library', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name, description: form.description,
        phone: form.phone, emailContact: form.emailContact,
        city: form.city, state: form.state, pincode: form.pincode,
        addressLine1: form.addressLine1, formattedAddress: form.formattedAddress,
        minBookingMins: form.minBookingMins, maxBookingMins: form.maxBookingMins,
        bookingInterval: form.bookingInterval, is24Hours: form.is24Hours,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { toast.error(data.error ?? 'Failed'); return }
    setLibrary(data.library)
    setEditMode(false)
    toast.success('Library updated')
  }

  if (loading) return <PageLoading />
  if (!library) return <div className="text-center py-16 text-slate-500">Library not found</div>

  const inp = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{library.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <MapPin className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-sm text-slate-500">{library.city}, {library.state}</span>
            <Badge variant={library.status === 'ACTIVE' ? 'active' : library.status === 'PENDING_VERIFICATION' ? 'pending' : 'suspended'}>
              {library.status.replace('_', ' ')}
            </Badge>
          </div>
        </div>
        {!editMode ? (
          <Button onClick={() => setEditMode(true)} variant="outline">Edit Library Info</Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setEditMode(false); setForm(library) }}>Cancel</Button>
            <Button loading={saving} onClick={saveChanges}><Save className="h-4 w-4" /> Save</Button>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Basic Info */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Basic Information</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {editMode ? (
              <>
                {[['name','Library Name'],['description','Description'],['phone','Phone'],['emailContact','Email'],
                  ['addressLine1','Address'],['city','City'],['state','State'],['pincode','Pincode']].map(([field, label]) => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                    <input value={(form as Record<string,string>)[field] ?? ''}
                      onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))} className={inp} />
                  </div>
                ))}
              </>
            ) : (
              <div className="space-y-3 text-sm">
                {[
                  ['Name', library.name],
                  ['Description', library.description ?? '—'],
                  ['Phone', library.phone ?? '—'],
                  ['Email', library.emailContact ?? '—'],
                  ['Address', library.addressLine1 ?? '—'],
                  ['City', `${library.city}, ${library.state} ${library.pincode}`],
                ].map(([l, v]) => (
                  <div key={l} className="flex gap-3 border-b border-slate-50 pb-2 last:border-0">
                    <span className="w-24 text-slate-500 shrink-0">{l}</span>
                    <span className="font-medium text-slate-900">{v}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Booking Settings */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4" /> Booking Settings</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {editMode ? (
              <>
                <div className="flex items-center gap-3">
                  <label className="text-slate-700 font-medium">24 Hours</label>
                  <input type="checkbox" checked={!!form.is24Hours}
                    onChange={e => setForm(p => ({ ...p, is24Hours: e.target.checked }))} className="h-4 w-4 rounded" />
                </div>
                {[['minBookingMins','Min Booking (mins)'],['maxBookingMins','Max Booking (mins)'],['bookingInterval','Interval (mins)']].map(([f,l]) => (
                  <div key={f}>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{l}</label>
                    <input type="number" value={(form as Record<string, number>)[f] ?? ''}
                      onChange={e => setForm(p => ({ ...p, [f]: Number(e.target.value) }))} className={inp} />
                  </div>
                ))}
              </>
            ) : (
              <>
                {[
                  ['24 Hours', library.is24Hours ? 'Yes' : 'No'],
                  ['Min Booking', `${library.minBookingMins} mins`],
                  ['Max Booking', `${library.maxBookingMins} mins`],
                  ['Interval', `${library.bookingInterval} mins`],
                ].map(([l, v]) => (
                  <div key={l} className="flex gap-3 border-b border-slate-50 pb-2 last:border-0">
                    <span className="w-28 text-slate-500 shrink-0">{l}</span>
                    <span className="font-medium text-slate-900">{v}</span>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Hours */}
      <Card>
        <CardHeader><CardTitle>Opening Hours</CardTitle></CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-2">
            {library.hours?.map(h => (
              <div key={h.dayOfWeek} className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-2.5">
                <span className="w-20 text-sm font-medium text-slate-700">{DAYS[h.dayOfWeek]}</span>
                <Badge variant={h.isOpen ? 'active' : 'secondary'}>{h.isOpen ? 'Open' : 'Closed'}</Badge>
                {h.isOpen && h.openTime && <span className="text-sm text-slate-600">{h.openTime} – {h.closeTime}</span>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Facilities */}
      {library.facilities?.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Facilities</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {library.facilities.map(f => (
                <Badge key={f.name} variant="secondary">{FACILITY_LABELS[f.name] ?? f.name}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
