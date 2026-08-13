import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, differenceInDays, isPast } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: Date | string): string {
  return format(new Date(date), 'dd MMM yyyy')
}

export function formatDateTime(date: Date | string): string {
  return format(new Date(date), 'dd MMM yyyy, hh:mm a')
}

export function formatTime(date: Date | string): string {
  return format(new Date(date), 'hh:mm a')
}

export function getDaysLeft(endDate: Date | string): number {
  return differenceInDays(new Date(endDate), new Date())
}

export function getMembershipExpiryLabel(endDate: Date | string): {
  label: string
  urgent: boolean
  expired: boolean
} {
  const days = getDaysLeft(endDate)
  if (days < 0) return { label: 'EXPIRED', urgent: true, expired: true }
  if (days === 0) return { label: 'EXPIRES TODAY', urgent: true, expired: false }
  if (days <= 5)
    return { label: `${days} DAY${days === 1 ? '' : 'S'} LEFT`, urgent: true, expired: false }
  return { label: `${days} DAYS LEFT`, urgent: false, expired: false }
}

export function generateBookingRef(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `BK-${timestamp}-${random}`
}

export function getDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c * 10) / 10
}

export function isLibraryOpen(
  hours: Array<{ dayOfWeek: number; isOpen: boolean; openTime?: string | null; closeTime?: string | null }>,
  is24Hours: boolean,
  checkDate?: Date
): boolean {
  if (is24Hours) return true
  const date = checkDate ?? new Date()
  const dayOfWeek = date.getDay()
  const todayHours = hours.find((h) => h.dayOfWeek === dayOfWeek)
  if (!todayHours?.isOpen || !todayHours.openTime || !todayHours.closeTime)
    return false
  const [openH, openM] = todayHours.openTime.split(':').map(Number)
  const [closeH, closeM] = todayHours.closeTime.split(':').map(Number)
  const now = date.getHours() * 60 + date.getMinutes()
  const open = openH * 60 + openM
  const close = closeH * 60 + closeM
  return now >= open && now < close
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

export function maskMobile(mobile: string): string {
  return mobile.replace(/(\d{2})\d{6}(\d{2})/, '$1******$2')
}
