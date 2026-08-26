import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import prisma from '@/lib/prisma'
import { hashPassword, createToken, createAuditLog } from '@/lib/auth'
import { ownerRegisterSchema, normalizeEmail } from '@/lib/validations'
import { generateUniqueReferralCode } from '@/lib/referral'
import { verifyVerificationToken, consumeOtpVerification } from '@/lib/otp'

// FIX 7, 13-19: Role-aware owner registration with full data persistence
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = ownerRegisterSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const {
      name, mobile, email, password,
      libraryName, description, libraryPhone, libraryEmail,
      addressLine1, addressLine2, area, landmark, city, state, pincode, country,
      latitude, longitude,
      facilities, hours, rules,
      referralCode: usedReferralCode,
      verificationToken,
    } = parsed.data

    // FIX 10: Verify OTP registration proof
    const tokenResult = verifyVerificationToken(verificationToken)
    if (!tokenResult.valid) {
      return Response.json({ error: tokenResult.error }, { status: 401 })
    }

    // Verify token matches request data
    if (tokenResult.mobile !== mobile) {
      return Response.json({ 
        error: 'Mobile number mismatch. Please verify OTP again.' 
      }, { status: 401 })
    }

    if (tokenResult.purpose !== 'REGISTRATION') {
      return Response.json({ 
        error: 'Invalid verification token purpose' 
      }, { status: 401 })
    }

    if (tokenResult.userType !== 'LIBRARY_OWNER') {
      return Response.json({ 
        error: 'Invalid verification token user type' 
      }, { status: 401 })
    }

    // FIX 2: Normalize email values
    const normalizedEmailValue = normalizeEmail(email)
    const normalizedLibraryEmail = normalizeEmail(libraryEmail)

    // Get free plan
    let freePlan = await prisma.subscriptionPlan.findFirst({
      where: { price: 0, isActive: true },
    })

    if (!freePlan) {
      freePlan = await prisma.subscriptionPlan.create({
        data: {
          name: 'Free',
          description: 'Free starter plan',
          price: 0,
          billingCycle: 'MONTHLY',
          trialDays: 30,
          features: ['Basic features', 'Up to 50 seats', 'Up to 200 students'],
        },
      })
    }

    // Resolve referrer if a referral code was provided
    let referrerOwner: { id: string } | null = null
    if (usedReferralCode) {
      referrerOwner = await prisma.libraryOwner.findUnique({
        where: { referralCode: usedReferralCode },
        select: { id: true },
      })
      // Invalid code — proceed without referral rather than blocking registration
    }

    // Generate unique referral code for this new owner
    const newReferralCode = await generateUniqueReferralCode(prisma)

    const passwordHash = await hashPassword(password)
    const trialEnd = new Date(Date.now() + freePlan.trialDays * 24 * 60 * 60 * 1000)

    // P0-3: Use transaction to atomically consume OTP and create all records
    // If user creation fails, OTP consumption is rolled back
    const user = await prisma.$transaction(async (tx) => {
      // P0-1: Check if token was already used (single-use enforcement)
      const consumeResult = await consumeOtpVerification(tokenResult.otpRecordId!, tx)
      if (!consumeResult.consumed) {
        throw new Error(consumeResult.error || 'Failed to consume verification token')
      }

      // FIX 7: Check only for existing LIBRARY_OWNER account with this mobile
      const existingOwner = await tx.user.findFirst({ 
        where: { mobile, role: 'LIBRARY_OWNER' } 
      })
      if (existingOwner) {
        throw new Error('Library owner account already exists with this mobile number')
      }

      // FIX 2: Check role-scoped email uniqueness
      if (normalizedEmailValue) {
        const emailExists = await tx.user.findFirst({ 
          where: { email: normalizedEmailValue, role: 'LIBRARY_OWNER' } 
        })
        if (emailExists) {
          throw new Error('Library owner account already exists with this email')
        }
      }

      // FIX 18: Create everything atomically
      return await tx.user.create({
      data: {
        mobile,
        name,
        email: normalizedEmailValue,
        passwordHash,
        role: 'LIBRARY_OWNER',
        libraryOwner: {
          create: {
            referralCode: newReferralCode,
            referredByOwnerId: referrerOwner?.id ?? null,
            ownerMembershipLevel: 'STANDARD',
            libraries: {
              create: {
                name: libraryName,
                description,
                phone: libraryPhone,
                emailContact: normalizedLibraryEmail,
                addressLine1,
                addressLine2,
                area,
                landmark,
                city,
                state,
                pincode,
                country: country ?? 'India',
                latitude,
                longitude,
                status: 'PENDING_VERIFICATION',
                // FIX 13: Create facilities
                facilities: {
                  create: facilities.map(name => ({ name })),
                },
                // FIX 14: Create library hours
                hours: {
                  create: hours.map(h => ({
                    dayOfWeek: h.dayOfWeek,
                    isOpen: h.isOpen,
                    openTime: h.openTime || null,
                    closeTime: h.closeTime || null,
                  })),
                },
                // FIX 15: Create library rules
                rules: {
                  create: rules.map((rule, index) => ({
                    rule,
                    order: index,
                  })),
                },
              },
            },
            subscription: {
              create: {
                planId: freePlan.id,
                status: 'TRIAL',
                startDate: new Date(),
                trialEnd,
                endDate: trialEnd,
              },
            },
          },
        },
      },
      include: {
        libraryOwner: {
          include: { 
            libraries: {
              include: {
                facilities: true,
                hours: true,
                rules: true,
              },
            },
          },
        },
      },
    })
    }) // Close transaction

    // If a valid referrer exists, create referral record (outside transaction)
    if (referrerOwner && usedReferralCode) {
      await prisma.ownerReferral.create({
        data: {
          referrerOwnerId: referrerOwner.id,
          referredOwnerId: user.libraryOwner!.id,
          referralCode: usedReferralCode,
          status: 'PENDING', // Will be QUALIFIED when library is approved
        },
      })
    }

    // Send notification to admins
    const adminUsers = await prisma.user.findMany({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true },
    })

    await Promise.all(adminUsers.map(admin =>
      prisma.notification.create({
        data: {
          userId: admin.id,
          type: 'NEW_STUDENT' as const, // reusing, will use PLATFORM_ALERT
          title: 'New Library Registration',
          message: `${libraryName} has been registered and is pending verification.`,
          data: { libraryId: user.libraryOwner!.libraries[0].id },
        },
      })
    ))

    // FIX 20-21: Create session for new LIBRARY_OWNER account
    const sessionUser = {
      id: user.libraryOwner!.id,
      userId: user.id,
      name: user.name,
      mobile: user.mobile,
      email: user.email,
      role: user.role,
      profilePhoto: user.profilePhoto,
    }

    const token = await createToken(sessionUser)
    const cookieStore = await cookies()
    cookieStore.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    await createAuditLog({
      userId: user.id,
      role: 'LIBRARY_OWNER',
      action: 'OWNER_REGISTERED',
      entityType: 'LibraryOwner',
      entityId: user.libraryOwner!.id,
      metadata: { 
        libraryName,
        facilities: facilities.length,
        rules: rules.length,
      },
    })

    return Response.json({ user: sessionUser }, { status: 201 })
  } catch (error) {
    console.error('Owner register error:', error)
    // FIX 19: Handle Prisma unique constraint errors
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return Response.json({ 
        error: 'Account with this mobile or email already exists' 
      }, { status: 409 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
