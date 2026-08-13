# StudyLib — Study Space Booking Platform

A complete, production-ready Library Management & Study Space Booking Platform with three role-based dashboards.

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Database**: PostgreSQL + Prisma 7 (with `@prisma/adapter-pg`)
- **Auth**: Custom JWT (jose) + bcryptjs, stored in httpOnly cookies
- **Payments**: Razorpay
- **Charts**: Recharts 2.x
- **Styling**: Tailwind CSS 4
- **Runtime Proxy**: Next.js `proxy.ts` (replaces middleware in Next 16)

---

## Quick Start

### 1. Prerequisites

- Node.js 18+
- PostgreSQL database running locally or on cloud (Supabase, Neon, Railway, etc.)

### 2. Configure Environment

Edit `.env` with your real values:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/library_platform"
NEXTAUTH_SECRET="your-random-secret-min-32-chars"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Razorpay (get from https://razorpay.com/docs/)
RAZORPAY_KEY_ID="rzp_test_xxxx"
RAZORPAY_KEY_SECRET="xxxx"
NEXT_PUBLIC_RAZORPAY_KEY_ID="rzp_test_xxxx"

# Cloudinary (optional, for photo uploads)
CLOUDINARY_CLOUD_NAME="your_cloud"
CLOUDINARY_API_KEY="xxxx"
CLOUDINARY_API_SECRET="xxxx"

# Super Admin credentials (used by seed script)
SUPER_ADMIN_MOBILE="9999999999"
SUPER_ADMIN_PASSWORD="SuperAdmin@123"
SUPER_ADMIN_NAME="Platform Admin"
```

### 3. Setup Database & Seed

```bash
# Push schema to database
npm run db:push

# Seed with demo data
npm run db:seed
```

### 4. Start Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Demo Credentials

After seeding, use these credentials:

| Role | Mobile | Password |
|------|--------|----------|
| Super Admin | 9999999999 | SuperAdmin@123 |
| Library Owner | 9876543210 | Owner@1234 |
| Student | 9123456789 | Student@1234 |

---

## Three Role Dashboards

### `/admin` — Super Admin
- Platform-wide statistics (live DB data)
- Library approval / rejection / suspension
- Student management across all libraries
- Platform revenue analytics
- Subscription plan management

### `/owner` — Library Owner
- Library profile & settings management
- Visual drag-and-drop seat layout editor
- Membership plan creation
- Booking management with check-in/check-out
- Revenue & analytics dashboards
- Student management

### `/student` — Student (Mobile-first)
- Library discovery with location search
- Real-time seat availability by date/time
- Membership purchase (Razorpay)
- Flexible seat booking
- Booking history & notifications

---

## Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Production server
npm run db:push      # Push Prisma schema to DB
npm run db:seed      # Seed demo data
npm run db:migrate   # Run migrations
npm run db:studio    # Open Prisma Studio
```

---

## Project Structure

```
src/
├── app/
│   ├── admin/          # Super Admin dashboard pages
│   ├── owner/          # Library Owner dashboard pages
│   ├── student/        # Student app pages (mobile-first)
│   ├── login/          # Auth pages
│   ├── register/       # Registration pages
│   └── api/            # Route handlers (REST API)
│       ├── admin/      # Admin-only endpoints
│       ├── owner/      # Owner-only endpoints
│       ├── student/    # Student-only endpoints
│       ├── libraries/  # Public library search endpoints
│       ├── auth/       # Auth endpoints
│       └── payments/   # Razorpay payment endpoints
├── components/ui/      # Shared UI components
├── contexts/           # React contexts (AuthContext)
├── generated/prisma/   # Generated Prisma client
├── lib/
│   ├── auth.ts         # JWT auth utilities
│   ├── prisma.ts       # Prisma client singleton
│   ├── utils.ts        # Shared utilities
│   └── validations.ts  # Zod validation schemas
└── proxy.ts            # Next.js 16 route proxy (auth guard)
```

---

## Architecture Notes

- **Auth**: JWT tokens in httpOnly cookies, verified in `proxy.ts` before routes render
- **Multi-tenancy**: Every library-owned resource has `libraryId` enforced at DB level
- **Role isolation**: API routes verify ownership on every request — no frontend-only guards
- **Seat availability**: Real-time overlap detection using `AND startTime < end AND endTime > start` query
- **Prisma 7**: Uses `@prisma/adapter-pg` driver adapter — configured in `prisma.config.ts`
