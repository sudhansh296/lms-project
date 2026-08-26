import { z } from 'zod'

export const loginSchema = z.object({
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Invalid mobile number'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const studentRegisterSchema = z.object({
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Invalid mobile number'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const ownerRegisterSchema = z.object({
  // Owner details
  name: z.string().min(2, 'Name required'),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Invalid mobile number'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  // Library details
  libraryName: z.string().min(2, 'Library name required'),
  description: z.string().optional(),
  libraryPhone: z.string().optional(),
  libraryEmail: z.string().email().optional().or(z.literal('')),
  // Location
  addressLine1: z.string().min(3, 'Address required'),
  addressLine2: z.string().optional(),
  area: z.string().optional(),
  landmark: z.string().optional(),
  city: z.string().min(2, 'City required'),
  state: z.string().min(2, 'State required'),
  pincode: z.string().regex(/^\d{6}$/, 'Invalid pincode'),
  country: z.string().default('India'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  // Optional referral code used during registration
  referralCode: z.string().optional(),
})

export const libraryUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  phone: z.string().optional(),
  emailContact: z.string().email().optional().or(z.literal('')),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  area: z.string().optional(),
  landmark: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().regex(/^\d{6}$/).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  formattedAddress: z.string().optional(),
  bookingMode: z.enum(['FLEXIBLE', 'FIXED_SLOT']).optional(),
  minBookingMins: z.number().min(15).max(60).optional(),
  maxBookingMins: z.number().min(60).max(1440).optional(),
  bookingInterval: z.number().min(5).max(60).optional(),
  is24Hours: z.boolean().optional(),
  basePrice: z.number().min(0).optional(),
})

export const seatSchema = z.object({
  label: z.string().min(1, 'Seat label required'),
  seatType: z.enum(['STANDARD', 'PREMIUM', 'WINDOW', 'CHARGING', 'CABIN', 'PRIVATE', 'CORNER', 'OTHER']),
  x: z.number(),
  y: z.number(),
  width: z.number().default(60),
  height: z.number().default(60),
  rotation: z.number().default(0),
  extraPrice: z.number().optional(),
})

export const bookingSchema = z.object({
  libraryId: z.string(),
  seatId: z.string(),
  bookingDate: z.string(), // ISO date string
  startTime: z.string(), // ISO datetime string
  endTime: z.string(), // ISO datetime string
})

// ─── Monthly Rate Pricing Schema (NEW CORRECT MODEL) ─────────────────────────

export const monthlyRatePlanSchema = z.object({
  name: z.string().min(2, 'Plan name required').optional(), // Auto-generated if not provided
  description: z.string().optional(),

  // Pricing Model
  pricingModel: z.literal('MONTHLY_RATE').default('MONTHLY_RATE'),

  // Daily access duration
  dailyMinutes: z.number().int().min(15, 'Minimum 15 minutes/day').max(1440, 'Max 24 hours/day'),

  // Monthly pricing (owner sets price per month for this daily duration)
  monthlyPrice: z.number().min(0, 'Monthly price must be 0 or more'),

  // Time selection mode
  timeSelectionMode: z.enum(['FLEXIBLE', 'FIXED']).default('FLEXIBLE'),
  fixedStartTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format').optional().nullable(),
  fixedEndTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format').optional().nullable(),

  // Allowed days of week (0=Sun … 6=Sat)
  allowedDays: z.array(z.number().int().min(0).max(6)).min(1, 'At least one day required').default([0,1,2,3,4,5,6]),

  benefits: z.array(z.string()).default([]),
}).superRefine((data, ctx) => {
  if (data.timeSelectionMode === 'FIXED') {
    if (!data.fixedStartTime) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Start time required for fixed plans', path: ['fixedStartTime'] })
    }
    if (!data.fixedEndTime) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'End time required for fixed plans', path: ['fixedEndTime'] })
    }
    if (data.fixedStartTime && data.fixedEndTime) {
      const [sh, sm] = data.fixedStartTime.split(':').map(Number)
      const [eh, em] = data.fixedEndTime.split(':').map(Number)
      const startMins = sh * 60 + sm
      const endMins   = eh * 60 + em
      if (endMins <= startMins) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'End time must be after start time', path: ['fixedEndTime'] })
      }
      const diff = endMins - startMins
      if (diff !== data.dailyMinutes) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Time slot duration (${diff} min) must match daily minutes (${data.dailyMinutes} min)`, path: ['fixedEndTime'] })
      }
    }
  }
})

// ─── Legacy Package Pricing Schema (BACKWARD COMPATIBILITY) ──────────────────

export const legacyPackagePlanSchema = z.object({
  name: z.string().min(2, 'Plan name required'),
  description: z.string().optional(),

  // Pricing Model
  pricingModel: z.literal('LEGACY_PACKAGE').default('LEGACY_PACKAGE'),

  // Daily access
  dailyMinutes: z.number().int().min(15, 'Minimum 15 minutes/day').max(1440, 'Max 24 hours/day'),

  // Duration (owner-defined for legacy plans)
  durationValue: z.number().int().min(1, 'Duration must be at least 1'),
  durationUnit: z.enum(['DAY', 'WEEK', 'MONTH', 'YEAR']),

  // Package pricing (total price for the duration)
  price: z.number().min(0, 'Price must be 0 or more'),

  // Time selection mode
  timeSelectionMode: z.enum(['FLEXIBLE', 'FIXED']).default('FLEXIBLE'),
  fixedStartTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format').optional().nullable(),
  fixedEndTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format').optional().nullable(),

  // Allowed days of week
  allowedDays: z.array(z.number().int().min(0).max(6)).min(1, 'At least one day required').default([0,1,2,3,4,5,6]),

  benefits: z.array(z.string()).default([]),
}).superRefine((data, ctx) => {
  if (data.timeSelectionMode === 'FIXED') {
    if (!data.fixedStartTime) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Start time required for fixed plans', path: ['fixedStartTime'] })
    }
    if (!data.fixedEndTime) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'End time required for fixed plans', path: ['fixedEndTime'] })
    }
    if (data.fixedStartTime && data.fixedEndTime) {
      const [sh, sm] = data.fixedStartTime.split(':').map(Number)
      const [eh, em] = data.fixedEndTime.split(':').map(Number)
      const startMins = sh * 60 + sm
      const endMins   = eh * 60 + em
      if (endMins <= startMins) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'End time must be after start time', path: ['fixedEndTime'] })
      }
      const diff = endMins - startMins
      if (diff !== data.dailyMinutes) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Time slot duration (${diff} min) must match daily minutes (${data.dailyMinutes} min)`, path: ['fixedEndTime'] })
      }
    }
  }
})

// ─── Unified Membership Plan Schema (accepts both models) ────────────────────

export const membershipPlanSchema = z.discriminatedUnion('pricingModel', [
  monthlyRatePlanSchema,
  legacyPackagePlanSchema,
])

// For APIs that don't specify pricingModel, default to monthly rate
export const membershipPlanCreateSchema = z.object({
  name: z.string().min(2, 'Plan name required').optional(),
  description: z.string().optional(),
  pricingModel: z.enum(['MONTHLY_RATE', 'LEGACY_PACKAGE']).default('MONTHLY_RATE'),
  dailyMinutes: z.number().int().min(15, 'Minimum 15 minutes/day').max(1440, 'Max 24 hours/day'),
  monthlyPrice: z.number().min(0).optional(),
  durationValue: z.number().int().min(1).optional(),
  durationUnit: z.enum(['DAY', 'WEEK', 'MONTH', 'YEAR']).optional(),
  price: z.number().min(0).optional(),
  timeSelectionMode: z.enum(['FLEXIBLE', 'FIXED']).default('FLEXIBLE'),
  fixedStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  fixedEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  allowedDays: z.array(z.number().int().min(0).max(6)).min(1).default([0,1,2,3,4,5,6]),
  benefits: z.array(z.string()).default([]),
}).superRefine((data, ctx) => {
  // Validate based on pricing model
  if (data.pricingModel === 'MONTHLY_RATE') {
    if (data.monthlyPrice === undefined || data.monthlyPrice === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Monthly price required for MONTHLY_RATE plans', path: ['monthlyPrice'] })
    }
  } else if (data.pricingModel === 'LEGACY_PACKAGE') {
    if (data.price === undefined || data.price === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Price required for LEGACY_PACKAGE plans', path: ['price'] })
    }
    if (!data.durationValue) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Duration value required for LEGACY_PACKAGE plans', path: ['durationValue'] })
    }
    if (!data.durationUnit) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Duration unit required for LEGACY_PACKAGE plans', path: ['durationUnit'] })
    }
  }
  
  // Time selection validation
  if (data.timeSelectionMode === 'FIXED') {
    if (!data.fixedStartTime) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Start time required for fixed plans', path: ['fixedStartTime'] })
    }
    if (!data.fixedEndTime) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'End time required for fixed plans', path: ['fixedEndTime'] })
    }
    if (data.fixedStartTime && data.fixedEndTime) {
      const [sh, sm] = data.fixedStartTime.split(':').map(Number)
      const [eh, em] = data.fixedEndTime.split(':').map(Number)
      const startMins = sh * 60 + sm
      const endMins   = eh * 60 + em
      if (endMins <= startMins) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'End time must be after start time', path: ['fixedEndTime'] })
      }
      const diff = endMins - startMins
      if (diff !== data.dailyMinutes) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Time slot duration (${diff} min) must match daily minutes (${data.dailyMinutes} min)`, path: ['fixedEndTime'] })
      }
    }
  }
})

export const reviewSchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type StudentRegisterInput = z.infer<typeof studentRegisterSchema>
export type OwnerRegisterInput = z.infer<typeof ownerRegisterSchema>
export type BookingInput = z.infer<typeof bookingSchema>
export type MembershipPlanInput = z.infer<typeof membershipPlanCreateSchema>
export type MonthlyRatePlanInput = z.infer<typeof monthlyRatePlanSchema>
export type LegacyPackagePlanInput = z.infer<typeof legacyPackagePlanSchema>

/**
 * Calculate the end date of a plan given a start date, durationValue and durationUnit.
 * Uses calendar arithmetic for MONTH/YEAR so durations are exact.
 * 
 * Returns an EXCLUSIVE end date boundary.
 * Example: 1 month from Sep 1 → Oct 1 (last included day is Sep 30)
 */
export function calcPlanEndDate(
  startDate: Date,
  durationValue: number,
  durationUnit: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR'
): Date {
  const d = new Date(startDate)
  switch (durationUnit) {
    case 'DAY':   d.setDate(d.getDate() + durationValue);           break
    case 'WEEK':  d.setDate(d.getDate() + durationValue * 7);       break
    case 'MONTH': d.setMonth(d.getMonth() + durationValue);         break
    case 'YEAR':  d.setFullYear(d.getFullYear() + durationValue);   break
  }
  return d
}

/** Approximate durationDays for backward-compat durationDays field. */
export function approxDurationDays(value: number, unit: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR'): number {
  switch (unit) {
    case 'DAY':   return value
    case 'WEEK':  return value * 7
    case 'MONTH': return value * 30
    case 'YEAR':  return value * 365
  }
}

/**
 * Generate a readable plan name from daily minutes.
 * E.g., 60 → "1 Hour / Day", 120 → "2 Hours / Day", 90 → "1.5 Hours / Day"
 */
export function generatePlanName(dailyMinutes: number): string {
  const hours = dailyMinutes / 60
  if (hours === 1) return '1 Hour / Day'
  if (Number.isInteger(hours)) return `${hours} Hours / Day`
  return `${hours.toFixed(1)} Hours / Day`
}
