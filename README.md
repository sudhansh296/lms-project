

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
