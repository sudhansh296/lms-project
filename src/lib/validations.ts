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

export const membershipPlanSchema = z.object({
  name: z.string().min(2, 'Plan name required'),
  description: z.string().optional(),
  durationDays: z.number().min(1, 'Duration required'),
  price: z.number().min(0, 'Price required'),
  benefits: z.array(z.string()).default([]),
})

export const reviewSchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type StudentRegisterInput = z.infer<typeof studentRegisterSchema>
export type OwnerRegisterInput = z.infer<typeof ownerRegisterSchema>
export type BookingInput = z.infer<typeof bookingSchema>
export type MembershipPlanInput = z.infer<typeof membershipPlanSchema>
