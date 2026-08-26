-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'LIBRARY_OWNER', 'LIBRARY_MANAGER', 'LIBRARY_STAFF', 'STUDENT');

-- CreateEnum
CREATE TYPE "LibraryStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SeatType" AS ENUM ('STANDARD', 'PREMIUM', 'WINDOW', 'CHARGING', 'CABIN', 'PRIVATE', 'CORNER', 'OTHER');

-- CreateEnum
CREATE TYPE "SeatStatus" AS ENUM ('AVAILABLE', 'BOOKED', 'OCCUPIED', 'MAINTENANCE', 'DISABLED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OwnerMembershipLevel" AS ENUM ('STANDARD', 'LEVEL_1', 'LEVEL_2', 'LEVEL_3');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'QUALIFIED', 'REJECTED', 'INVALID');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'BOOKING_REMINDER', 'MEMBERSHIP_EXPIRING', 'MEMBERSHIP_EXPIRED', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'NEW_STUDENT', 'NEW_MEMBERSHIP', 'NEW_BOOKING', 'PAYMENT_RECEIVED', 'LIBRARY_APPROVED', 'LIBRARY_REJECTED', 'LIBRARY_SUSPENDED', 'SUBSCRIPTION_EXPIRING', 'PLATFORM_ALERT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL,
    "profilePhoto" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_owners" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "razorpayAccountId" TEXT,
    "razorpayAccountStatus" TEXT DEFAULT 'PENDING',
    "razorpayStakeholderId" TEXT,
    "razorpayProductId" TEXT,
    "razorpayActivationStatus" TEXT,
    "settlementReady" BOOLEAN NOT NULL DEFAULT false,
    "settlementRequirements" JSONB,
    "settlementActivatedAt" TIMESTAMP(3),
    "bankLast4" TEXT,
    "referralCode" TEXT,
    "referredByOwnerId" TEXT,
    "ownerMembershipLevel" "OwnerMembershipLevel" NOT NULL DEFAULT 'STANDARD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "libraries" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "coverPhotoUrl" TEXT,
    "phone" TEXT,
    "emailContact" TEXT,
    "status" "LibraryStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "rejectionReason" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "area" TEXT,
    "landmark" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "formattedAddress" TEXT,
    "bookingMode" TEXT NOT NULL DEFAULT 'FLEXIBLE',
    "minBookingMins" INTEGER NOT NULL DEFAULT 30,
    "maxBookingMins" INTEGER NOT NULL DEFAULT 480,
    "bookingInterval" INTEGER NOT NULL DEFAULT 15,
    "is24Hours" BOOLEAN NOT NULL DEFAULT false,
    "basePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "libraries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_photos" (
    "id" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "library_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_facilities" (
    "id" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "library_facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_hours" (
    "id" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "openTime" TEXT,
    "closeTime" TEXT,
    "breakStart" TEXT,
    "breakEnd" TEXT,

    CONSTRAINT "library_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_rules" (
    "id" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "library_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seat_layouts" (
    "id" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "canvasWidth" INTEGER NOT NULL DEFAULT 800,
    "canvasHeight" INTEGER NOT NULL DEFAULT 600,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seat_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "layout_objects" (
    "id" TEXT NOT NULL,
    "layoutId" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "label" TEXT,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "color" TEXT,

    CONSTRAINT "layout_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seats" (
    "id" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "seatType" "SeatType" NOT NULL DEFAULT 'STANDARD',
    "status" "SeatStatus" NOT NULL DEFAULT 'AVAILABLE',
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "height" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "extraPrice" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_plans" (
    "id" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "dailyMinutes" INTEGER NOT NULL DEFAULT 60,
    "durationValue" INTEGER NOT NULL DEFAULT 1,
    "durationUnit" TEXT NOT NULL DEFAULT 'MONTH',
    "durationDays" INTEGER NOT NULL DEFAULT 30,
    "pricing_model" TEXT NOT NULL DEFAULT 'LEGACY_PACKAGE',
    "price" DOUBLE PRECISION NOT NULL,
    "monthly_price" DOUBLE PRECISION,
    "timeSelectionMode" TEXT NOT NULL DEFAULT 'FLEXIBLE',
    "fixedStartTime" TEXT,
    "fixedEndTime" TEXT,
    "allowedDays" INTEGER[] DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6]::INTEGER[],
    "benefits" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_memberships" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'PENDING',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "planId" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "dailyStartTime" TEXT,
    "dailyEndTime" TEXT,
    "planNameSnapshot" TEXT,
    "planPriceSnapshot" DOUBLE PRECISION,
    "seatExtraSnapshot" DOUBLE PRECISION,
    "dailyMinutesSnapshot" INTEGER,
    "durationSnapshot" TEXT,
    "monthly_price_snapshot" DOUBLE PRECISION,
    "selected_months" INTEGER,
    "bookingDate" TIMESTAMP(3) NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "bookingRef" TEXT NOT NULL,
    "notes" TEXT,
    "holdExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_occurrences" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'HELD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT,
    "paymentType" TEXT,
    "gatewayOrderId" TEXT,
    "gatewayPaymentId" TEXT,
    "gatewaySignature" TEXT,
    "gatewayTransferId" TEXT,
    "refundId" TEXT,
    "refundAmount" DOUBLE PRECISION,
    "platformFee" DOUBLE PRECISION,
    "ownerAmount" DOUBLE PRECISION,
    "gateway_fee" DOUBLE PRECISION,
    "gateway_fee_gst" DOUBLE PRECISION,
    "processingFee" DOUBLE PRECISION,
    "gstAmount" DOUBLE PRECISION,
    "baseAmount" DOUBLE PRECISION,
    "planPrice" DOUBLE PRECISION,
    "monthly_price" DOUBLE PRECISION,
    "selected_months" INTEGER,
    "seatExtraAmount" DOUBLE PRECISION,
    "settlementStatus" TEXT DEFAULT 'NOT_REQUIRED',
    "transferFailureReason" TEXT,
    "transferAttempts" INTEGER DEFAULT 0,
    "settledAt" TIMESTAMP(3),
    "bookingId" TEXT,
    "membershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_payments" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT,
    "gatewayOrderId" TEXT,
    "gatewayPaymentId" TEXT,
    "gatewaySignature" TEXT,
    "subscriptionId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owner_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "bookingOccurrenceId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "checkInAt" TIMESTAMP(3),
    "checkOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "libraryId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billingCycle" TEXT NOT NULL DEFAULT 'MONTHLY',
    "trialDays" INTEGER NOT NULL DEFAULT 0,
    "maxSeats" INTEGER,
    "maxStudents" INTEGER,
    "maxStaff" INTEGER,
    "maxBranches" INTEGER,
    "features" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_subscriptions" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owner_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "role" "Role",
    "libraryId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_verifications" (
    "id" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "userType" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_referrals" (
    "id" TEXT NOT NULL,
    "referrerOwnerId" TEXT NOT NULL,
    "referredOwnerId" TEXT NOT NULL,
    "referredLibraryId" TEXT,
    "referralCode" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qualifiedAt" TIMESTAMP(3),
    "invalidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owner_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_mobile_idx" ON "users"("mobile");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_mobile_role_key" ON "users"("mobile", "role");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_role_key" ON "users"("email", "role");

-- CreateIndex
CREATE UNIQUE INDEX "library_owners_userId_key" ON "library_owners"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "library_owners_referralCode_key" ON "library_owners"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "library_hours_libraryId_dayOfWeek_key" ON "library_hours"("libraryId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "seat_layouts_libraryId_key" ON "seat_layouts"("libraryId");

-- CreateIndex
CREATE UNIQUE INDEX "seats_libraryId_label_key" ON "seats"("libraryId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "students_userId_key" ON "students"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "students_studentId_key" ON "students"("studentId");

-- CreateIndex
CREATE INDEX "membership_plans_pricing_model_isActive_idx" ON "membership_plans"("pricing_model", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "membership_plans_libraryId_dailyMinutes_pricing_model_key" ON "membership_plans"("libraryId", "dailyMinutes", "pricing_model");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_bookingRef_key" ON "bookings"("bookingRef");

-- CreateIndex
CREATE INDEX "booking_occurrences_seatId_startTime_endTime_idx" ON "booking_occurrences"("seatId", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "booking_occurrences_bookingId_idx" ON "booking_occurrences"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_bookingId_key" ON "payments"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_membershipId_key" ON "payments"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_bookingOccurrenceId_key" ON "attendance"("bookingOccurrenceId");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_libraryId_studentId_key" ON "reviews"("libraryId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "owner_subscriptions_ownerId_key" ON "owner_subscriptions"("ownerId");

-- CreateIndex
CREATE INDEX "otp_verifications_mobile_purpose_userType_idx" ON "otp_verifications"("mobile", "purpose", "userType");

-- CreateIndex
CREATE UNIQUE INDEX "owner_referrals_referredOwnerId_key" ON "owner_referrals"("referredOwnerId");

-- AddForeignKey
ALTER TABLE "library_owners" ADD CONSTRAINT "library_owners_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_owners" ADD CONSTRAINT "library_owners_referredByOwnerId_fkey" FOREIGN KEY ("referredByOwnerId") REFERENCES "library_owners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "libraries" ADD CONSTRAINT "libraries_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "library_owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_photos" ADD CONSTRAINT "library_photos_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "libraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_facilities" ADD CONSTRAINT "library_facilities_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "libraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_hours" ADD CONSTRAINT "library_hours_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "libraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_rules" ADD CONSTRAINT "library_rules_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "libraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_layouts" ADD CONSTRAINT "seat_layouts_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "libraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "layout_objects" ADD CONSTRAINT "layout_objects_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "seat_layouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seats" ADD CONSTRAINT "seats_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "libraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_plans" ADD CONSTRAINT "membership_plans_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "libraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_memberships" ADD CONSTRAINT "student_memberships_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_memberships" ADD CONSTRAINT "student_memberships_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "libraries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_memberships" ADD CONSTRAINT "student_memberships_planId_fkey" FOREIGN KEY ("planId") REFERENCES "membership_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "libraries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "seats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_planId_fkey" FOREIGN KEY ("planId") REFERENCES "membership_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_occurrences" ADD CONSTRAINT "booking_occurrences_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "student_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_payments" ADD CONSTRAINT "owner_payments_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "library_owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_bookingOccurrenceId_fkey" FOREIGN KEY ("bookingOccurrenceId") REFERENCES "booking_occurrences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "libraries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "libraries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_subscriptions" ADD CONSTRAINT "owner_subscriptions_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "library_owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_subscriptions" ADD CONSTRAINT "owner_subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_referrals" ADD CONSTRAINT "owner_referrals_referrerOwnerId_fkey" FOREIGN KEY ("referrerOwnerId") REFERENCES "library_owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_referrals" ADD CONSTRAINT "owner_referrals_referredOwnerId_fkey" FOREIGN KEY ("referredOwnerId") REFERENCES "library_owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

