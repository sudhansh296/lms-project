import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

const connectionString = process.env.DATABASE_URL ?? ''
const adapter = new PrismaPg({ connectionString })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any)

async function main() {
  console.log('🌱 Starting complete database seed...\n')

  // 1. Create Library Owner User
  const ownerPassword = await bcrypt.hash('owner123', 12)
  const ownerUser = await prisma.user.upsert({
    where: { mobile: '9876543210' },
    update: {},
    create: {
      id: 'test-owner-user-1',
      mobile: '9876543210',
      email: 'testowner@library.com',
      passwordHash: ownerPassword,
      name: 'Test Owner',
      role: 'LIBRARY_OWNER',
    },
  })
  console.log('✓ Created owner user: 9876543210 / owner123')

  // 2. Create LibraryOwner record
  const libraryOwner = await prisma.libraryOwner.upsert({
    where: { userId: ownerUser.id },
    update: {},
    create: {
      id: 'test-lib-owner-1',
      userId: ownerUser.id,
      referralCode: 'TESTOWNER',
      ownerMembershipLevel: 'STANDARD',
    },
  })
  console.log('✓ Created library owner record')

  // 3. Create Library
  const library = await prisma.library.upsert({
    where: { id: 'test-library-1' },
    update: {},
    create: {
      id: 'test-library-1',
      ownerId: libraryOwner.id,
      name: 'Test Study Library',
      description: 'A test library for development',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      country: 'India',
      addressLine1: '123 Test Street',
      area: 'Andheri',
      status: 'ACTIVE',
      phone: '9876543210',
      emailContact: 'testowner@library.com',
    },
  })
  console.log('✓ Created library')

  // 4. Create Library Hours (Open all week)
  const daysOfWeek = [0, 1, 2, 3, 4, 5, 6]
  for (const day of daysOfWeek) {
    await prisma.libraryHours.upsert({
      where: {
        libraryId_dayOfWeek: {
          libraryId: library.id,
          dayOfWeek: day,
        },
      },
      update: {},
      create: {
        id: `test-hours-${day}`,
        libraryId: library.id,
        dayOfWeek: day,
        isOpen: true,
        openTime: '08:00',
        closeTime: '22:00',
      },
    })
  }
  console.log('✓ Created library hours (8 AM - 10 PM, all days)')

  // 5. Create Membership Plans (Monthly Rate model)
  const plans = [
    {
      id: 'test-plan-1',
      name: '2 Hours/Day',
      dailyMinutes: 120,
      monthlyPrice: 1500,
    },
    {
      id: 'test-plan-2',
      name: '4 Hours/Day',
      dailyMinutes: 240,
      monthlyPrice: 2500,
    },
    {
      id: 'test-plan-3',
      name: '6 Hours/Day',
      dailyMinutes: 360,
      monthlyPrice: 3500,
    },
  ]

  for (const plan of plans) {
    await prisma.membershipPlan.upsert({
      where: { id: plan.id },
      update: {},
      create: {
        id: plan.id,
        libraryId: library.id,
        name: plan.name,
        description: `${plan.dailyMinutes / 60} hours per day with flexible timing`,
        dailyMinutes: plan.dailyMinutes,
        price: plan.monthlyPrice, // legacy compat
        pricingModel: 'MONTHLY_RATE',
        monthlyPrice: plan.monthlyPrice,
        durationValue: 1,
        durationUnit: 'MONTH',
        durationDays: 30,
        timeSelectionMode: 'FLEXIBLE',
        isActive: true,
        benefits: [
          'Flexible timing',
          'High-speed WiFi',
          'AC facility',
          'Power backup',
        ],
      },
    })
  }
  console.log('✓ Created 3 membership plans (MONTHLY_RATE)')

  // 6. Create Seat Layout
  const seatLayout = await prisma.seatLayout.upsert({
    where: { libraryId: library.id },
    update: {},
    create: {
      id: 'test-layout-1',
      libraryId: library.id,
      canvasWidth: 800,
      canvasHeight: 600,
    },
  })
  console.log('✓ Created seat layout')

  // 7. Create Seats
  const seats = []
  const rows = ['A', 'B', 'C', 'D']
  const seatsPerRow = 10

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    for (let seatNum = 1; seatNum <= seatsPerRow; seatNum++) {
      const label = `${rows[rowIdx]}${seatNum}`
      const seat = await prisma.seat.upsert({
        where: { id: `test-seat-${label}` },
        update: {},
        create: {
          id: `test-seat-${label}`,
          libraryId: library.id,
          label: label,
          seatType: 'STANDARD',
          status: 'AVAILABLE',
          x: 50 + (seatNum - 1) * 70,
          y: 50 + rowIdx * 120,
          width: 60,
          height: 60,
          extraPrice: null,
        },
      })
      seats.push(seat)
    }
  }
  console.log(`✓ Created ${seats.length} seats (A1-D10, all STANDARD)`)

  // 8. Create a Test Student User
  const studentPassword = await bcrypt.hash('student123', 12)
  const studentUser = await prisma.user.upsert({
    where: { mobile: '9123456789' },
    update: {},
    create: {
      id: 'test-student-user-1',
      mobile: '9123456789',
      email: 'teststudent@library.com',
      passwordHash: studentPassword,
      name: 'Test Student',
      role: 'STUDENT',
    },
  })
  console.log('✓ Created student user: 9123456789 / student123')

  // 9. Create Student record
  await prisma.student.upsert({
    where: { userId: studentUser.id },
    update: {},
    create: {
      id: 'test-student-1',
      userId: studentUser.id,
      studentId: 'STU001',
    },
  })
  console.log('✓ Created student record')

  console.log('\n✅ Database seeded successfully!\n')
  console.log('═══════════════════════════════════════════')
  console.log('📋 Test Credentials:')
  console.log('═══════════════════════════════════════════')
  console.log('\n👤 Library Owner:')
  console.log('   Mobile: 9876543210')
  console.log('   Password: owner123')
  console.log('\n👤 Student:')
  console.log('   Mobile: 9123456789')
  console.log('   Password: student123')
  console.log('\n🏢 Library Details:')
  console.log('   Name: Test Study Library')
  console.log('   Plans: 3 (2hr, 4hr, 6hr/day)')
  console.log('   Seats: 40 (A1-D10)')
  console.log('   Status: ACTIVE')
  console.log('═══════════════════════════════════════════\n')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
