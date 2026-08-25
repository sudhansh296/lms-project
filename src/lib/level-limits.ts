/**
 * Enforce referral-level limits for library owners.
 *
 * Call these helpers inside API routes before allowing actions that are
 * constrained by the owner's current membership level.
 */
import { LEVEL_BENEFITS } from './referral'
import type { OwnerMembershipLevel } from './referral'

export interface LimitCheckResult {
  allowed: boolean
  reason?: string
}

/**
 * Check whether the owner can create another library branch.
 * @param level    Owner's current membership level
 * @param current  Number of libraries the owner already has
 */
export function checkBranchLimit(
  level: OwnerMembershipLevel,
  current: number
): LimitCheckResult {
  const max = LEVEL_BENEFITS[level].maxBranches
  if (max === null) return { allowed: true }                       // unlimited
  if (current >= max) {
    return {
      allowed: false,
      reason: `Your ${level.replace('_', ' ')} level allows a maximum of ${max} ${max === 1 ? 'library branch' : 'library branches'}. Refer more owners to unlock higher limits.`,
    }
  }
  return { allowed: true }
}

/**
 * Check whether the owner can add another seat to a library.
 * @param level        Owner's current membership level
 * @param currentSeats Total seats across ALL of the owner's libraries
 */
export function checkSeatLimit(
  level: OwnerMembershipLevel,
  currentSeats: number
): LimitCheckResult {
  const max = LEVEL_BENEFITS[level].maxSeats
  if (max === null) return { allowed: true }
  if (currentSeats >= max) {
    return {
      allowed: false,
      reason: `Your ${level.replace('_', ' ')} level allows a maximum of ${max} seats total. Refer more owners to unlock higher limits.`,
    }
  }
  return { allowed: true }
}

/**
 * Check whether the owner can access analytics at the requested tier.
 * @param level    Owner's current membership level
 * @param required 'basic' | 'full'
 */
export function checkAnalyticsAccess(
  level: OwnerMembershipLevel,
  required: 'basic' | 'full'
): LimitCheckResult {
  const access = LEVEL_BENEFITS[level].analytics
  if (required === 'basic' && access === 'none') {
    return { allowed: false, reason: 'Analytics requires Level 1 or higher. Refer libraries to unlock.' }
  }
  if (required === 'full' && access !== 'full') {
    return { allowed: false, reason: 'Full analytics requires Level 2 or higher. Refer libraries to unlock.' }
  }
  return { allowed: true }
}
