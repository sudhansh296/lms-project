import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables
config({ path: resolve(__dirname, '../.env') })

import prisma from '../src/lib/prisma'

async function main() {
  console.log('🌱 Seeding subscription plans...')

  // Check if plans already exist
  const existingPlans = await prisma.subscriptionPlan.findMany()
  if (existingPlans.length > 0) {
    console.log('✓ Subscription plans already exist:')
    existingPlans.forEach(plan => {
      console.log(`  - ${plan.name} (${plan.billingCycle}): ₹${plan.price}`)
    })
    return
  }

  // Create subscription plans
  const plans = [
    {
      name: 'Starter',
      description: 'Perfect for single library owners getting started',
      price: 0,
      billingCycle: 'MONTHLY',
      trialDays: 30,
      maxSeats: 50,
      maxStudents: 100,
      maxStaff: 2,
      maxBranches: 1,
      features: [
        'Up to 50 seats',
        'Up to 100 students',
        '2 staff members',
        'Basic analytics',
        'Email support',
        '30-day free trial',
      ],
      isActive: true,
    },
    {
      name: 'Basic Monthly',
      description: 'Essential features for growing libraries',
      price: 499,
      billingCycle: 'MONTHLY',
      trialDays: 14,
      maxSeats: 100,
      maxStudents: 300,
      maxStaff: 5,
      maxBranches: 1,
      features: [
        'Up to 100 seats',
        'Up to 300 students',
        '5 staff members',
        'Advanced analytics',
        'Priority email support',
        'Custom branding',
        '14-day free trial',
      ],
      isActive: true,
    },
    {
      name: 'Basic Yearly',
      description: 'Essential features for growing libraries (Save 20%)',
      price: 4790, // 499 * 12 * 0.8 = 4790 (20% discount)
      billingCycle: 'YEARLY',
      trialDays: 14,
      maxSeats: 100,
      maxStudents: 300,
      maxStaff: 5,
      maxBranches: 1,
      features: [
        'Up to 100 seats',
        'Up to 300 students',
        '5 staff members',
        'Advanced analytics',
        'Priority email support',
        'Custom branding',
        '14-day free trial',
        '💰 Save 20% vs monthly',
      ],
      isActive: true,
    },
    {
      name: 'Professional Monthly',
      description: 'For established libraries with multiple branches',
      price: 999,
      billingCycle: 'MONTHLY',
      trialDays: 7,
      maxSeats: 300,
      maxStudents: 1000,
      maxStaff: 15,
      maxBranches: 3,
      features: [
        'Up to 300 seats',
        'Up to 1000 students',
        '15 staff members',
        'Up to 3 branches',
        'Premium analytics & reports',
        'Phone + email support',
        'API access',
        'Custom integrations',
      ],
      isActive: true,
    },
    {
      name: 'Professional Yearly',
      description: 'For established libraries with multiple branches (Save 20%)',
      price: 9590, // 999 * 12 * 0.8 = 9590 (20% discount)
      billingCycle: 'YEARLY',
      trialDays: 7,
      maxSeats: 300,
      maxStudents: 1000,
      maxStaff: 15,
      maxBranches: 3,
      features: [
        'Up to 300 seats',
        'Up to 1000 students',
        '15 staff members',
        'Up to 3 branches',
        'Premium analytics & reports',
        'Phone + email support',
        'API access',
        'Custom integrations',
        '💰 Save 20% vs monthly',
      ],
      isActive: true,
    },
    {
      name: 'Enterprise Monthly',
      description: 'Unlimited power for large library chains',
      price: 2499,
      billingCycle: 'MONTHLY',
      trialDays: 0,
      maxSeats: null, // unlimited
      maxStudents: null,
      maxStaff: null,
      maxBranches: null,
      features: [
        'Unlimited seats',
        'Unlimited students',
        'Unlimited staff',
        'Unlimited branches',
        'White-label solution',
        'Dedicated account manager',
        '24/7 priority support',
        'Custom feature development',
        'SLA guarantee',
      ],
      isActive: true,
    },
    {
      name: 'Enterprise Yearly',
      description: 'Unlimited power for large library chains (Save 25%)',
      price: 22490, // 2499 * 12 * 0.75 = 22490 (25% discount)
      billingCycle: 'YEARLY',
      trialDays: 0,
      maxSeats: null, // unlimited
      maxStudents: null,
      maxStaff: null,
      maxBranches: null,
      features: [
        'Unlimited seats',
        'Unlimited students',
        'Unlimited staff',
        'Unlimited branches',
        'White-label solution',
        'Dedicated account manager',
        '24/7 priority support',
        'Custom feature development',
        'SLA guarantee',
        '💰 Save 25% vs monthly',
      ],
      isActive: true,
    },
  ]

  for (const planData of plans) {
    const plan = await prisma.subscriptionPlan.create({ data: planData })
    console.log(`✓ Created: ${plan.name} (${plan.billingCycle}) - ₹${plan.price}`)
  }

  console.log('\n✅ Subscription plans seeded successfully!')
  console.log('\nPlan Summary:')
  console.log('  • Starter (Free) - 30 day trial')
  console.log('  • Basic Monthly - ₹499/mo')
  console.log('  • Basic Yearly - ₹4,790/yr (save 20%)')
  console.log('  • Professional Monthly - ₹999/mo')
  console.log('  • Professional Yearly - ₹9,590/yr (save 20%)')
  console.log('  • Enterprise Monthly - ₹2,499/mo')
  console.log('  • Enterprise Yearly - ₹22,490/yr (save 25%)')
}

main()
  .catch(error => {
    console.error('❌ Error seeding plans:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
