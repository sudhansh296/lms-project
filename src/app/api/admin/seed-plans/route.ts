import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    // Check if plans already exist
    const existingPlans = await prisma.subscriptionPlan.findMany()
    if (existingPlans.length > 0) {
      return Response.json({
        message: 'Subscription plans already exist',
        plans: existingPlans.map(p => ({ name: p.name, billingCycle: p.billingCycle, price: p.price })),
      })
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

    const createdPlans = []
    for (const planData of plans) {
      const plan = await prisma.subscriptionPlan.create({ data: planData })
      createdPlans.push({
        name: plan.name,
        billingCycle: plan.billingCycle,
        price: plan.price,
        trialDays: plan.trialDays,
      })
    }

    return Response.json({
      success: true,
      message: 'Subscription plans created successfully',
      plans: createdPlans,
      summary: {
        starter: 'Free with 30-day trial',
        basicMonthly: '₹499/month',
        basicYearly: '₹4,790/year (save 20%)',
        proMonthly: '₹999/month',
        proYearly: '₹9,590/year (save 20%)',
        enterpriseMonthly: '₹2,499/month',
        enterpriseYearly: '₹22,490/year (save 25%)',
      },
    })
  } catch (error) {
    console.error('Seed plans error:', error)
    return Response.json({ error: 'Failed to seed plans' }, { status: 500 })
  }
}

// GET - View existing plans
export async function GET() {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: [{ price: 'asc' }, { billingCycle: 'asc' }],
    })
    return Response.json({ plans, count: plans.length })
  } catch (error) {
    console.error('Get plans error:', error)
    return Response.json({ error: 'Failed to fetch plans' }, { status: 500 })
  }
}
