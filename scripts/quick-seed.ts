import prisma from '../src/lib/prisma'
import bcrypt from 'bcrypt'

async function main() {
  console.log('🌱 Quick seeding database...')

  // Create owner user
  const hashedPassword = await bcrypt.hash('password123', 10)
  
  const ownerUser = await prisma.user.upsert({
    where: { mobile: '9999999999' },
    update: {},
    create: {
      id: 'owner-user-1',
      mobile: '9999999999',
      email: 'owner@test.com',
      password: hashedPassword,
      name: 'Test Owner',
      role: 'LIBRARY_OWNER',
    },
  })

  console.log('✓ Created owner user')

  // Create library owner
  const libraryOwner = await prisma.libraryOwner.upsert({
    where: { userId: ownerUser.id },
    update: {},
    create: {
      id: 'lib-owner-1',
      userId: ownerUser.id,
      referralCode: 'TEST123',
      membershipTier: 'FREE',
    },
  })

  console.log('✓ Created library owner')

  // Create library
  const library = await prisma.library.upsert({
    where: { id: 'lib-1' },
    update: {},
    create: {
      id: 'lib-1',
      ownerId: libraryOwner.id,
      name: 'Test Library',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      status: 'ACTIVE',
    },
  })

  console.log('✓ Created library')

  // Create a membership plan
  await prisma.membershipPlan.upsert({
    where: { id: 'plan-1' },
    update: {},
    create: {
      id: 'plan-1',
      libraryId: library.id,
      name: '2 Hours/Day - Monthly Rate',
      dailyMinutes: 120,
      price: 100, // legacy compat
      pricingModel: 'MONTHLY_RATE',
      monthlyPrice: 1500,
      isActive: true,
    },
  })

  console.log('✓ Created membership plan')

  // Create a seat
  await prisma.seat.upsert({
    where: { id: 'seat-1' },
    update: {},
    create: {
      id: 'seat-1',
      libraryId: library.id,
      label: 'A1',
      seatType: 'STANDARD',
      status: 'AVAILABLE',
      x: 100,
      y: 100,
    },
  })

  console.log('✓ Created seat')

  console.log('✅ Database seeded successfully!')
  console.log('\nLogin credentials:')
  console.log('Mobile: 9999999999')
  console.log('Password: password123')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
