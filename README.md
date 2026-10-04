# IHOPS — Intelligent Hospital Operation System

A full-stack reference implementation of the IHOPS PRD: multi-tenant hospital
operations platform for the Nigerian market, covering Patients, Visits,
Finance, Workforce/Attendance, Subscriptions & Billing, and an internal
IHOPS Super Admin console.

**Stack**

- **Backend:** Node.js, Express, TypeScript, Prisma ORM, SQLite (dev) — schema is Postgres-ready for production
- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, React Router
- **Auth:** JWT (separate signing secrets for tenant staff vs. the internal Super Admin console — so the internal console is unreachable with a tenant token, not just route-hidden)

## Project structure

```
ihops/
  backend/
    prisma/
      schema.prisma       # full data model
      seed.ts             # demo tenant + super admin + sample patient/visit
    src/
      app.ts, index.ts
      config/permissions.ts       # RBAC matrix, hardcoded floors
      middleware/                 # auth, audit log, error handler
      lib/                        # prisma client, jwt, hashing, id generators
      modules/
        auth/          # signup, email verification, login (password + PIN), setup wizard
        patients/      # directory, registration, Excel/CSV import wizard
        visits/        # queue, clinical updates, close-visit + payment capture
        finance/       # dashboard, expenses (PIN-gated), insurance reconciliation, export
        workforce/     # staff directory, attendance kiosk, attendance dashboard
        subscription/  # Paystack checkout + webhook, grace period, admin transfer
        communications/# manual sends + log
        support/       # tenant-side support tickets
        superadmin/    # approval queue, monitoring, customer lookup, analytics, announcements
        dashboard/     # role-aware home screen
      services/        # notification, reminder (AI), paystack adapters (all mockable)
      jobs/scheduler.ts # birthday messages, trial/grace-period sweep
  frontend/
    src/
      api/client.ts               # fetch wrapper (tenant + super admin tokens)
      auth/AuthContext.tsx
      layouts/                    # TenantLayout (role-aware nav), SuperAdminLayout
      pages/
        onboarding/  # Signup, CheckEmail, VerifyEmail, Login, ChangePin, SetupWizard, AccountRestricted
        dashboard/, patients/, visits/, finance/, workforce/, admin/
        superadmin/  # separate login + console pages
```

## Getting started

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env        # defaults work out of the box (SQLite, all integrations mocked)
npx prisma generate
npx prisma migrate dev --name init
npm run seed                 # creates a demo tenant, staff, and a pending Public Hospital application
npm run dev                  # http://localhost:4000
```

Seed credentials:

- **Administrator (email/password):** `admin@gracefamilyclinic.ng` / `Password!23`
- **Staff PIN login:** hospital email `admin@gracefamilyclinic.ng`, Staff ID `IHOPS-0001` through `IHOPS-0004`, PIN `1234`
- **IHOPS Super Admin console:** `superadmin@ihops.africa` / `SuperAdmin!23`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                  # http://localhost:5173, proxies /api to :4000
```

Visit `http://localhost:5173/login` for the hospital app, or
`http://localhost:5173/internal/login` for the IHOPS internal console.
