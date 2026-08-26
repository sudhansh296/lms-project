import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

const connectionString = process.env.DATABASE_URL ?? ''
const adapter = new PrismaPg({ connectionString })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any)

async function main() {
  console.log('🌱 Seeding database...')

  // Create free subscription plan
  const freePlan = await prisma.subscriptionPlan.upsert({
    where: { id: 'free-plan' },
    update: {},
    create: {
      id: 'free-plan',
      name: 'Free',
      description: 'Free starter plan for library owners',
      price: 0,
      billingCycle: 'MONTHLY',
      trialDays: 30,
      maxSeats: 100,
      maxStudents: 500,
      maxStaff: 3,
      maxBranches: 1,
      features: [
        'Up to 100 seats',
        'Up to 500 students',
        'Seat layout editor',
        'Booking management',
        'Basic analytics',
      ],
      isActive: true,
    },
  })
  console.log('✅ Free plan created')

  // Create Super Admin
  const adminMobile = process.env.SUPER_ADMIN_MOBILE ?? '9999999999'
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD ?? 'SuperAdmin@123'
  const adminName = process.env.SUPER_ADMIN_NAME ?? 'Platform Admin'

  const passwordHash = await bcrypt.hash(adminPassword, 12)

  const admin = await prisma.user.upsert({
    where: { 
      unique_mobile_role: { 
        mobile: adminMobile, 
        role: 'SUPER_ADMIN' 
      } 
    },
    update: {},
    create: {
      mobile: adminMobile,
      name: adminName,
      email: 'admin@studylib.in',
      passwordHash,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  })
  console.log(`✅ Super Admin created: ${adminMobile} / ${adminPassword}`)

  // Create a demo library owner
  const ownerHash = await bcrypt.hash('Owner@1234', 12)
  const ownerUser = await prisma.user.upsert({
    where: { 
      unique_mobile_role: { 
        mobile: '9876543210', 
        role: 'LIBRARY_OWNER' 
      } 
    },
    update: {},
    create: {
      mobile: '9876543210',
      name: 'Rajesh Kumar',
      email: 'rajesh@studypoint.in',
      passwordHash: ownerHash,
      role: 'LIBRARY_OWNER',
      isActive: true,
      libraryOwner: {
        create: {
          subscription: {
            create: {
              planId: freePlan.id,
              status: 'TRIAL',
              startDate: new Date(),
              trialEnd: new Date(Date.now() + 30 * 86400000),
              endDate: new Date(Date.now() + 30 * 86400000),
            },
          },
          libraries: {
            create: {
              name: 'Study Point Library',
              description: 'A premium study space in the heart of the city with 60+ seats, AC, Wi-Fi, and silent zones.',
              phone: '9876543210',
              emailContact: 'info@studypoint.in',
              status: 'ACTIVE',
              addressLine1: '12, Main Road',
              addressLine2: 'Near City Mall',
              area: 'Koregaon Park',
              landmark: 'Near Starbucks',
              city: 'Pune',
              state: 'Maharashtra',
              pincode: '411001',
              country: 'India',
              latitude: 18.5362,
              longitude: 73.8942,
              formattedAddress: '12, Main Road, Koregaon Park, Pune - 411001',
              is24Hours: false,
              minBookingMins: 60,
              maxBookingMins: 480,
              bookingInterval: 30,
              facilities: {
                createMany: {
                  data: [
                    { name: 'WIFI' },
                    { name: 'AC' },
                    { name: 'POWER_BACKUP' },
                    { name: 'CHARGING_POINTS' },
                    { name: 'DRINKING_WATER' },
                    { name: 'WASHROOM' },
                    { name: 'CCTV' },
                    { name: 'PARKING' },
                  ],
                },
              },
              hours: {
                createMany: {
                  data: [
                    { dayOfWeek: 0, isOpen: true, openTime: '07:00', closeTime: '22:00' },
                    { dayOfWeek: 1, isOpen: true, openTime: '06:00', closeTime: '23:00' },
                    { dayOfWeek: 2, isOpen: true, openTime: '06:00', closeTime: '23:00' },
                    { dayOfWeek: 3, isOpen: true, openTime: '06:00', closeTime: '23:00' },
                    { dayOfWeek: 4, isOpen: true, openTime: '06:00', closeTime: '23:00' },
                    { dayOfWeek: 5, isOpen: true, openTime: '06:00', closeTime: '23:00' },
                    { dayOfWeek: 6, isOpen: true, openTime: '07:00', closeTime: '22:00' },
                  ],
                },
              },
              rules: {
                createMany: {
                  data: [
                    { rule: 'Maintain silence at all times', order: 1 },
                    { rule: 'No food or beverages inside the reading hall', order: 2 },
                    { rule: 'Keep mobile phones on silent mode', order: 3 },
                    { rule: 'Carry valid membership card or booking confirmation', order: 4 },
                    { rule: 'No smoking or alcohol on premises', order: 5 },
                    { rule: 'Keep your study area clean', order: 6 },
                  ],
                },
              },
              membershipPlans: {
                createMany: {
                  data: [
                    {
                      name: 'Daily Pass',
                      description: 'Single day access to all seats',
                      durationDays: 1,
                      price: 99,
                      benefits: ['Full day access', 'Wi-Fi included', 'Any available seat'],
                    },
                    {
                      name: 'Weekly Plan',
                      description: '7-day unlimited access',
                      durationDays: 7,
                      price: 499,
                      benefits: ['7 days unlimited access', 'Wi-Fi included', 'Priority seat selection'],
                    },
                    {
                      name: 'Monthly Plan',
                      description: '30-day premium membership',
                      durationDays: 30,
                      price: 1499,
                      benefits: ['30 days access', 'Wi-Fi included', 'Priority seat booking', 'Locker access'],
                    },
                    {
                      name: 'Quarterly Plan',
                      description: '90-day best value plan',
                      durationDays: 90,
                      price: 3999,
                      benefits: ['90 days access', 'All amenities', 'Priority booking', 'Locker access', 'Newspaper'],
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    include: { libraryOwner: { include: { libraries: true } } },
  })

  if (!ownerUser.libraryOwner) {
    throw new Error('Failed to create library owner')
  }

  const library = ownerUser.libraryOwner.libraries[0]
  console.log(`✅ Demo library owner created: 9876543210 / Owner@1234`)
  console.log(`✅ Demo library created: ${library.name}`)

  // Create seats for the demo library
  const seatData: Array<{
    libraryId: string; label: string; seatType: 'STANDARD' | 'WINDOW'
    status: 'AVAILABLE'; x: number; y: number; width: number; height: number; rotation: number
  }> = []
  const rows = ['A', 'B', 'C', 'D', 'E', 'F']
  const cols = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < cols.length; c++) {
      const seatType: 'STANDARD' | 'WINDOW' = r === 0 ? 'WINDOW' : 'STANDARD'
      seatData.push({
        libraryId: library.id,
        label: `${rows[r]}${cols[c].toString().padStart(2, '0')}`,
        seatType,
        status: 'AVAILABLE',
        x: 80 + c * 75,
        y: 80 + r * 75,
        width: 60,
        height: 60,
        rotation: 0,
      })
    }
  }

  await prisma.seat.createMany({ data: seatData, skipDuplicates: true })
  console.log(`✅ ${seatData.length} seats created`)

  // Create seat layout
  const seats = await prisma.seat.findMany({ where: { libraryId: library.id } })
  const seatLayout = await prisma.seatLayout.upsert({
    where: { libraryId: library.id },
    update: {},
    create: {
      libraryId: library.id,
      canvasWidth: 900,
      canvasHeight: 600,
      objects: {
        createMany: {
          data: [
            { objectType: 'RECEPTION', label: 'Reception', x: 10, y: 10, width: 120, height: 50, color: '#e2e8f0' },
            { objectType: 'DOOR', label: 'Entrance', x: 10, y: 70, width: 60, height: 20, color: '#94a3b8' },
            { objectType: 'WASHROOM', label: 'Washroom', x: 800, y: 10, width: 80, height: 60, color: '#bfdbfe' },
            { objectType: 'PILLAR', label: '', x: 300, y: 250, width: 30, height: 30, color: '#475569' },
            { objectType: 'PILLAR', label: '', x: 600, y: 250, width: 30, height: 30, color: '#475569' },
          ],
        },
      },
    },
  })
  console.log(`✅ Seat layout created`)

  // Create a demo student
  const studentHash = await bcrypt.hash('Student@1234', 12)
  const studentUser = await prisma.user.upsert({
    where: { 
      unique_mobile_role: { 
        mobile: '9123456789', 
        role: 'STUDENT' 
      } 
    },
    update: {},
    create: {
      mobile: '9123456789',
      name: 'Amit Sharma',
      email: 'amit@example.com',
      passwordHash: studentHash,
      role: 'STUDENT',
      isActive: true,
      student: {
        create: {},
      },
    },
    include: { student: true },
  })
  console.log(`✅ Demo student created: 9123456789 / Student@1234`)

  // Give student an active membership
  const monthlyPlan = await prisma.membershipPlan.findFirst({
    where: { libraryId: library.id, name: 'Monthly Plan' },
  })

  if (monthlyPlan && studentUser.student) {
    const now = new Date()
    const endDate = new Date(now.getTime() + 25 * 86400000)

    await prisma.studentMembership.upsert({
      where: { id: 'demo-membership' },
      update: {},
      create: {
        id: 'demo-membership',
        studentId: studentUser.student.id,
        libraryId: library.id,
        planId: monthlyPlan.id,
        status: 'ACTIVE',
        startDate: new Date(now.getTime() - 5 * 86400000),
        endDate,
        paidAmount: monthlyPlan.price,
        payment: {
          create: {
            studentId: studentUser.student.id,
            amount: monthlyPlan.price,
            status: 'PAID',
            paymentMethod: 'RAZORPAY',
          },
        },
      },
    })
    console.log(`✅ Demo student membership created (expires in 25 days)`)
  }

  console.log('\n🎉 Seed complete!')
  console.log('─────────────────────────────────────')
  console.log('Super Admin  :', adminMobile, '/', adminPassword)
  console.log('Library Owner:', '9876543210 / Owner@1234')
  console.log('Student      :', '9123456789 / Student@1234')
  console.log('─────────────────────────────────────')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
