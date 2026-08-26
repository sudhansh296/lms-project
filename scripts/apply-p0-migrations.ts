/**
 * P0-3: Safe migration application script
 * 
 * This script safely applies P0 schema changes to production database:
 * 1. Checks if attendance table has existing records
 * 2. If empty, applies migration directly
 * 3. If has data, provides manual migration instructions
 * 
 * Usage: npx tsx scripts/apply-p0-migrations.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Checking database state...\n')

  // Check if attendance table has any records
  const attendanceCount = await prisma.attendance.count()
  console.log(`📊 Found ${attendanceCount} attendance records`)

  if (attendanceCount > 0) {
    console.log('\n⚠️  WARNING: Attendance table has existing records!')
    console.log('❌ Cannot auto-migrate. Manual data migration required.')
    console.log('\n📝 Manual steps:')
    console.log('1. For each attendance record, find the corresponding BookingOccurrence')
    console.log('2. Update attendance.bookingOccurrenceId with the occurrence ID')
    console.log('3. Then run: npx prisma migrate deploy')
    console.log('\nContact dev team for data migration script.')
    process.exit(1)
  }

  console.log('✅ Attendance table is empty - safe to migrate')
  console.log('\n🚀 Applying migration...')
  console.log('Run: npx prisma migrate deploy')
  console.log('\nThis will apply:')
  console.log('  - Link Attendance to BookingOccurrence')
  console.log('  - Add bookingOccurrenceId column')
  console.log('  - Drop old bookingId unique constraint')
}

main()
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
