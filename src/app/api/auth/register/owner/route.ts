import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import prisma from '@/lib/prisma'
import { hashPassword, createToken, createAuditLog } from '@/lib/auth'
import { ownerRegisterSchema } from '@/lib/validations'

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
    } = parsed.data

    const existing = await prisma.user.findUnique({ where: { mobile } })
    if (existing) {
      return Response.json({ error: 'Mobile number already registered' }, { status: 409 })
    }

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

    const passwordHash = await hashPassword(password)
    const trialEnd = new Date(Date.now() + freePlan.trialDays * 24 * 60 * 60 * 1000)

    const user = await prisma.user.create({
      data: {
        mobile,
        name,
        email: email || null,
        passwordHash,
        role: 'LIBRARY_OWNER',
        libraryOwner: {
          create: {
            libraries: {
              create: {
                name: libraryName,
                description,
                phone: libraryPhone,
                emailContact: libraryEmail || null,
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
          include: { libraries: true },
        },
      },
    })

    // Notify super admins about new library registration
    const superAdmins = await prisma.user.findMany({ where: { role: 'SUPER_ADMIN' } })
    if (superAdmins.length > 0) {
      await prisma.notification.createMany({
        data: superAdmins.map((admin: { id: string }) => ({
          userId: admin.id,
          type: 'NEW_STUDENT' as const, // reusing, will use PLATFORM_ALERT
          title: 'New Library Registration',
          message: `${libraryName} has been registered and is pending verification.`,
          data: { libraryId: user.libraryOwner!.libraries[0].id },
        })),
      })
    }

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
      libraryId: user.libraryOwner!.libraries[0].id,
      action: 'LIBRARY_CREATED',
      entityType: 'Library',
      entityId: user.libraryOwner!.libraries[0].id,
    })

    return Response.json({ user: sessionUser }, { status: 201 })
  } catch (error) {
    console.error('Owner register error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
