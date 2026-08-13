'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { PageLoading } from '@/components/ui/loading'
import toast from 'react-hot-toast'
import {
  Plus, Save, Trash2, Edit2, Move, Settings,
  Grid3X3, Layers
} from 'lucide-react'
import { cn } from '@/lib/utils'

type SeatType = 'STANDARD' | 'PREMIUM' | 'WINDOW' | 'CHARGING' | 'CABIN' | 'PRIVATE' | 'CORNER' | 'OTHER'
type SeatStatus = 'AVAILABLE' | 'BOOKED' | 'OCCUPIED' | 'MAINTENANCE' | 'DISABLED'
type ObjectType = 'PILLAR' | 'WALL' | 'DOOR' | 'WINDOW_OBJ' | 'RECEPTION' | 'STAIRCASE' | 'WASHROOM' | 'TABLE' | 'CABINET' | 'PASSAGE' | 'CUSTOM'

interface Seat {
  id: string; label: string; seatType: SeatType; status: SeatStatus
  x: number; y: number; width: number; height: number; rotation: number; extraPrice?: number
}

interface LayoutObject {
  id: string; objectType: ObjectType; label?: string
  x: number; y: number; width: number; height: number; rotation: number; color?: string
}

interface Layout {
  canvasWidth: number; canvasHeight: number
  objects: LayoutObject[]
}

const SEAT_COLORS: Record<SeatStatus, string> = {
  AVAILABLE: '#22c55e',
  BOOKED: '#f59e0b',
  OCCUPIED: '#ef4444',
  MAINTENANCE: '#94a3b8',
  DISABLED: '#e2e8f0',
}

const SEAT_TYPE_COLORS: Record<SeatType, string> = {
  STANDARD: '#6366f1',
  PREMIUM: '#8b5cf6',
  WINDOW: '#0ea5e9',
  CHARGING: '#f59e0b',
  CABIN: '#10b981',
  PRIVATE: '#ec4899',
  CORNER: '#f97316',
  OTHER: '#94a3b8',
}

const OBJ_COLORS: Record<string, string> = {
  PILLAR: '#475569',
  WALL: '#64748b',
  DOOR: '#a3e635',
  WINDOW_OBJ: '#7dd3fc',
  RECEPTION: '#fbbf24',
  STAIRCASE: '#c084fc',
  WASHROOM: '#60a5fa',
  TABLE: '#d1d5db',
  CABINET: '#a8a29e',
  PASSAGE: '#e2e8f0',
  CUSTOM: '#f1f5f9',
}

export default function SeatsPage() {
  const [seats, setSeats] = useState<Seat[]>([])
  const [layout, setLayout] = useState<Layout>({ canvasWidth: 900, canvasHeight: 600, objects: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [mode, setMode] = useState<'select' | 'add-seat' | 'add-object'>('select')
  const [addSeatModal, setAddSeatModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [newSeat, setNewSeat] = useState({ label: '', seatType: 'STANDARD' as SeatType, extraPrice: '' })
  const [newObjType, setNewObjType] = useState<ObjectType>('PILLAR')
  const canvasRef = useRef<HTMLDivElement>(null)

  const selectedSeat = seats.find(s => s.id === selected)
  const selectedObj = layout.objects.find(o => o.id === selected)

  const fetchLayout = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/owner/layout')
    const data = await res.json()
    if (data.seats) setSeats(data.seats)
    if (data.layout) setLayout({ canvasWidth: data.layout.canvasWidth, canvasHeight: data.layout.canvasHeight, objects: data.layout.objects ?? [] })
    setLoading(false)
  }, [])

  useEffect(() => { fetchLayout() }, [fetchLayout])

  const saveLayout = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/owner/layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canvasWidth: layout.canvasWidth,
          canvasHeight: layout.canvasHeight,
          objects: layout.objects.map(({ id, ...o }) => o),
          seats: seats.map(s => ({ id: s.id, x: s.x, y: s.y, rotation: s.rotation })),
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Layout saved')
    } catch {
      toast.error('Failed to save layout')
    } finally {
      setSaving(false)
    }
  }

  const addSeat = async () => {
    if (!newSeat.label.trim()) { toast.error('Seat label required'); return }
    const res = await fetch('/api/owner/seats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: newSeat.label.trim(),
        seatType: newSeat.seatType,
        x: 50 + Math.random() * 200,
        y: 50 + Math.random() * 200,
        width: 60, height: 60, rotation: 0,
        extraPrice: newSeat.extraPrice ? parseFloat(newSeat.extraPrice) : undefined,
      }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Failed to add seat'); return }
    setSeats(p => [...p, data.seat])
    setAddSeatModal(false)
    setNewSeat({ label: '', seatType: 'STANDARD', extraPrice: '' })
    toast.success('Seat added')
  }

  const deleteSeat = async (id: string) => {
    const res = await fetch(`/api/owner/seats/${id}`, { method: 'DELETE' })
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Failed'); return }
    setSeats(p => p.filter(s => s.id !== id))
    setSelected(null)
    toast.success('Seat deleted')
  }

  const updateSeatStatus = async (id: string, status: SeatStatus) => {
    const res = await fetch(`/api/owner/seats/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Failed'); return }
    setSeats(p => p.map(s => s.id === id ? { ...s, status } : s))
    toast.success('Seat status updated')
  }

  const addObject = (x: number, y: number) => {
    const obj: LayoutObject = {
      id: `obj-${Date.now()}`,
      objectType: newObjType,
      x, y, width: 60, height: 40, rotation: 0,
      color: OBJ_COLORS[newObjType],
    }
    setLayout(l => ({ ...l, objects: [...l.objects, obj] }))
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode === 'add-seat') { setAddSeatModal(true); return }
    if (mode === 'add-object') {
      const rect = canvasRef.current!.getBoundingClientRect()
      addObject(e.clientX - rect.left, e.clientY - rect.top)
      return
    }
    setSelected(null)
  }

  const handleMouseDown = (e: React.MouseEvent, id: string, type: 'seat' | 'obj') => {
    if (mode !== 'select') return
    e.stopPropagation()
    setSelected(id)
    setDragging(id)
    const rect = canvasRef.current!.getBoundingClientRect()
    const item = type === 'seat' ? seats.find(s => s.id === id) : layout.objects.find(o => o.id === id)
    if (item) setDragOffset({ x: e.clientX - rect.left - item.x, y: e.clientY - rect.top - item.y })
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragging) return
    const rect = canvasRef.current!.getBoundingClientRect()
    const nx = Math.max(0, e.clientX - rect.left - dragOffset.x)
    const ny = Math.max(0, e.clientY - rect.top - dragOffset.y)

    const isSeat = seats.some(s => s.id === dragging)
    if (isSeat) {
      setSeats(p => p.map(s => s.id === dragging ? { ...s, x: nx, y: ny } : s))
    } else {
      setLayout(l => ({ ...l, objects: l.objects.map(o => o.id === dragging ? { ...o, x: nx, y: ny } : o) }))
    }
  }

  const handleMouseUp = () => setDragging(null)

  if (loading) return <PageLoading />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Seat Layout</h1>
          <p className="text-slate-500 text-sm">{seats.length} seats · Drag to rearrange</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setAddSeatModal(true)}>
            <Plus className="h-4 w-4" /> Add Seat
          </Button>
          <Button size="sm" onClick={saveLayout} loading={saving}>
            <Save className="h-4 w-4" /> Save Layout
          </Button>
        </div>
      </div>

      {/* Mode Toolbar */}
      <Card className="p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500 font-medium">Mode:</span>
          {[
            { value: 'select', label: 'Select / Move', icon: Move },
            { value: 'add-seat', label: 'Add Seat', icon: Plus },
            { value: 'add-object', label: 'Add Object', icon: Layers },
          ].map(({ value, label, icon: Icon }) => (
            <Button key={value} size="sm" variant={mode === value ? 'default' : 'outline'}
              onClick={() => setMode(value as typeof mode)}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </Button>
          ))}
          {mode === 'add-object' && (
            <select value={newObjType} onChange={e => setNewObjType(e.target.value as ObjectType)}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm focus:outline-none">
              {['PILLAR','WALL','DOOR','WINDOW_OBJ','RECEPTION','STAIRCASE','WASHROOM','TABLE','CABINET','PASSAGE','CUSTOM'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}
        </div>
      </Card>

      <div className="flex gap-4 flex-col xl:flex-row">
        {/* Canvas */}
        <Card className="flex-1 overflow-auto">
          <div
            ref={canvasRef}
            className="relative seat-canvas bg-slate-50 rounded-xl"
            style={{ width: layout.canvasWidth, height: layout.canvasHeight, cursor: mode === 'select' ? 'default' : 'crosshair', minWidth: 600 }}
            onClick={handleCanvasClick}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Grid */}
            <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
              <defs>
                <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>

            {/* Layout objects */}
            {layout.objects.map((obj) => (
              <div
                key={obj.id}
                className={cn('absolute flex items-center justify-center text-xs font-medium rounded-lg border-2 cursor-move select-none transition-shadow',
                  selected === obj.id ? 'ring-2 ring-indigo-500 shadow-lg' : '')}
                style={{
                  left: obj.x, top: obj.y, width: obj.width, height: obj.height,
                  background: obj.color ?? '#e2e8f0',
                  borderColor: selected === obj.id ? '#6366f1' : 'transparent',
                  transform: `rotate(${obj.rotation}deg)`,
                }}
                onMouseDown={(e) => handleMouseDown(e, obj.id, 'obj')}
              >
                <span className="text-slate-600 text-[10px] truncate px-1">{obj.label ?? obj.objectType}</span>
              </div>
            ))}

            {/* Seats */}
            {seats.map((seat) => (
              <div
                key={seat.id}
                className={cn('absolute flex flex-col items-center justify-center text-xs font-bold rounded-xl cursor-move select-none transition-shadow',
                  selected === seat.id ? 'ring-2 ring-indigo-500 shadow-lg scale-110' : 'hover:shadow-md')}
                style={{
                  left: seat.x, top: seat.y, width: seat.width, height: seat.height,
                  background: SEAT_COLORS[seat.status],
                  transform: `rotate(${seat.rotation}deg) ${selected === seat.id ? 'scale(1.1)' : ''}`,
                  color: seat.status === 'DISABLED' ? '#94a3b8' : '#fff',
                }}
                onMouseDown={(e) => handleMouseDown(e, seat.id, 'seat')}
              >
                <span className="text-[11px] leading-none">{seat.label}</span>
                <span className="text-[9px] opacity-80 mt-0.5">{seat.seatType.charAt(0)}</span>
              </div>
            ))}

            {seats.length === 0 && layout.objects.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <Grid3X3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No seats yet</p>
                  <p className="text-sm mt-1">Click "Add Seat" to get started</p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Properties Panel */}
        <div className="w-full xl:w-72 space-y-4">
          {/* Legend */}
          <Card className="p-4">
            <p className="text-sm font-semibold text-slate-700 mb-3">Legend</p>
            <div className="space-y-2">
              {Object.entries(SEAT_COLORS).map(([status, color]) => (
                <div key={status} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ background: color }} />
                  <span className="text-xs text-slate-600">{status}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Selected Item Properties */}
          {selectedSeat && (
            <Card className="p-4">
              <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Settings className="h-4 w-4" /> Seat: {selectedSeat.label}
              </p>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Type</p>
                  <Badge variant="secondary">{selectedSeat.seatType}</Badge>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Status</p>
                  <select
                    value={selectedSeat.status}
                    onChange={(e) => updateSeatStatus(selectedSeat.id, e.target.value as SeatStatus)}
                    className="w-full rounded-xl border border-slate-200 px-2 py-1.5 text-sm"
                  >
                    {['AVAILABLE', 'MAINTENANCE', 'DISABLED'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" onClick={() => deleteSeat(selectedSeat.id)} className="flex-1">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {selectedObj && (
            <Card className="p-4">
              <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Layers className="h-4 w-4" /> Object: {selectedObj.objectType}
              </p>
              <Button size="sm" variant="destructive" onClick={() => {
                setLayout(l => ({ ...l, objects: l.objects.filter(o => o.id !== selectedObj.id) }))
                setSelected(null)
              }}>
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </Button>
            </Card>
          )}

          {/* Seat list */}
          <Card className="p-4">
            <p className="text-sm font-semibold text-slate-700 mb-3">All Seats ({seats.length})</p>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {seats.map(s => (
                <div key={s.id}
                  onClick={() => setSelected(s.id)}
                  className={cn('flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer text-sm transition-colors',
                    selected === s.id ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50'
                  )}>
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: SEAT_COLORS[s.status] }} />
                  <span className="font-medium flex-1">{s.label}</span>
                  <span className="text-xs text-slate-400">{s.seatType.charAt(0)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Add Seat Modal */}
      <Modal open={addSeatModal} onOpenChange={setAddSeatModal} title="Add New Seat">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Seat Label *</label>
            <input value={newSeat.label} onChange={e => setNewSeat(p => ({ ...p, label: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. A01, Window-1, Cabin-3" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Seat Type</label>
            <select value={newSeat.seatType} onChange={e => setNewSeat(p => ({ ...p, seatType: e.target.value as SeatType }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {['STANDARD','PREMIUM','WINDOW','CHARGING','CABIN','PRIVATE','CORNER','OTHER'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Extra Price (optional)</label>
            <input type="number" value={newSeat.extraPrice} onChange={e => setNewSeat(p => ({ ...p, extraPrice: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="₹ additional charge" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setAddSeatModal(false)}>Cancel</Button>
            <Button onClick={addSeat}>Add Seat</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
