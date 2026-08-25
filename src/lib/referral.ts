/**
 * Referral system utilities
 *
 * Membership level thresholds — change these constants to adjust tiers
 * without touching any business logic elsewhere.
 */

export const REFERRAL_THRESHOLDS = {
  STANDARD: 0,
  LEVEL_1: 20,
  LEVEL_2: 50,
  LEVEL_3: 100,
} as const

export type OwnerMembershipLevel = 'STANDARD' | 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3'

/** null = unlimited */
export interface LevelBenefits {
  maxBranches: number | null
  maxSeats: number | null
  analytics: 'none' | 'basic' | 'full'
  revenueReports: boolean
  featuredListing: boolean
  prioritySupport: boolean
  /** Human-readable feature list for display */
  features: string[]
}

export const LEVEL_BENEFITS: Record<OwnerMembershipLevel, LevelBenefits> = {
  STANDARD: {
    maxBranches: 1,
    maxSeats: 250,
    analytics: 'none',
    revenueReports: false,
    featuredListing: false,
    prioritySupport: false,
    features: [
      'Max 1 library branch',
      'Up to 250 seats',
      'Basic booking management',
    ],
  },
  LEVEL_1: {
    maxBranches: 2,
    maxSeats: 500,
    analytics: 'basic',
    revenueReports: false,
    featuredListing: false,
    prioritySupport: false,
    features: [
      'Max 2 library branches',
      'Up to 500 seats',
      'Basic booking management',
      'Basic analytics',
    ],
  },
  LEVEL_2: {
    maxBranches: 5,
    maxSeats: 1000,
    analytics: 'full',
    revenueReports: true,
    featuredListing: false,
    prioritySupport: false,
    features: [
      'Max 5 library branches',
      'Up to 1,000 seats',
      'Full analytics',
      'Revenue reports',
    ],
  },
  LEVEL_3: {
    maxBranches: null,
    maxSeats: null,
    analytics: 'full',
    revenueReports: true,
    featuredListing: true,
    prioritySupport: true,
    features: [
      'Unlimited branches',
      'Unlimited seats',
      'Full analytics + revenue',
      'Featured listing',
      'Priority support',
    ],
  },
}

/** Derive membership level from a count of qualified referrals */
export function getMembershipLevel(qualifiedCount: number): OwnerMembershipLevel {
  if (qualifiedCount >= REFERRAL_THRESHOLDS.LEVEL_3) return 'LEVEL_3'
  if (qualifiedCount >= REFERRAL_THRESHOLDS.LEVEL_2) return 'LEVEL_2'
  if (qualifiedCount >= REFERRAL_THRESHOLDS.LEVEL_1) return 'LEVEL_1'
  return 'STANDARD'
}

/** How many more qualified referrals are needed for the next level */
export function getNextLevelInfo(qualifiedCount: number): {
  nextLevel: OwnerMembershipLevel | null
  needed: number
  threshold: number
} {
  if (qualifiedCount < REFERRAL_THRESHOLDS.LEVEL_1) {
    return { nextLevel: 'LEVEL_1', needed: REFERRAL_THRESHOLDS.LEVEL_1 - qualifiedCount, threshold: REFERRAL_THRESHOLDS.LEVEL_1 }
  }
  if (qualifiedCount < REFERRAL_THRESHOLDS.LEVEL_2) {
    return { nextLevel: 'LEVEL_2', needed: REFERRAL_THRESHOLDS.LEVEL_2 - qualifiedCount, threshold: REFERRAL_THRESHOLDS.LEVEL_2 }
  }
  if (qualifiedCount < REFERRAL_THRESHOLDS.LEVEL_3) {
    return { nextLevel: 'LEVEL_3', needed: REFERRAL_THRESHOLDS.LEVEL_3 - qualifiedCount, threshold: REFERRAL_THRESHOLDS.LEVEL_3 }
  }
  return { nextLevel: null, needed: 0, threshold: REFERRAL_THRESHOLDS.LEVEL_3 }
}

/** Generate a unique referral code like STUDYLIB-A82K9 */
export function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous I,O,1,0
  let suffix = ''
  for (let i = 0; i < 5; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)]
  }
  return `STUDYLIB-${suffix}`
}

/**
 * Generate a guaranteed-unique referral code by checking the DB.
 * Retries up to 10 times before throwing.
 */
export async function generateUniqueReferralCode(
  prisma: { libraryOwner: { findUnique: (args: { where: { referralCode: string } }) => Promise<unknown> } }
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateReferralCode()
    const existing = await prisma.libraryOwner.findUnique({ where: { referralCode: code } })
    if (!existing) return code
  }
  throw new Error('Could not generate unique referral code after 10 attempts')
}

/** Human-readable level labels */
export const LEVEL_LABELS: Record<OwnerMembershipLevel, string> = {
  STANDARD: 'Standard',
  LEVEL_1: 'Level 1',
  LEVEL_2: 'Level 2',
  LEVEL_3: 'Level 3',
}

/** Badge colors for each level */
export const LEVEL_COLORS: Record<OwnerMembershipLevel, string> = {
  STANDARD: 'bg-slate-100 text-slate-700',
  LEVEL_1: 'bg-blue-100 text-blue-700',
  LEVEL_2: 'bg-violet-100 text-violet-700',
  LEVEL_3: 'bg-amber-100 text-amber-700',
}
