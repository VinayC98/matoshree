# Matoshree Study Lab — Management System

A full-stack management system for operating a study lab, including student management, memberships, seat allocation, payments, scheduled membership expiry, dashboard operations, and audit logging.

> **Current scope:** The application is currently an **admin-only management system**. Students do not yet have login access or the ability to book seats themselves. Student self-service seat booking is planned as a future feature.

---

## Table of Contents

- [Overview](#overview)
- [Current Status](#current-status)
- [Core Features](#core-features)
- [Application Architecture](#application-architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Authentication & Authorization](#authentication--authorization)
- [Student Management](#student-management)
- [Membership Management](#membership-management)
- [Seat Management](#seat-management)
- [Seat Allocation](#seat-allocation)
- [Payments](#payments)
- [Membership Expiry](#membership-expiry)
- [Audit Logging](#audit-logging)
- [Dashboard](#dashboard)
- [API Architecture](#api-architecture)
- [Database Architecture](#database-architecture)
- [Error Handling](#error-handling)
- [Validation](#validation)
- [Scheduled Jobs](#scheduled-jobs)
- [Security](#security)
- [Environment Configuration](#environment-configuration)
- [Local Development](#local-development)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [Linting](#linting)
- [Production Build](#production-build)
- [Deployment](#deployment)
- [Development Workflow](#development-workflow)
- [Current Limitations](#current-limitations)
- [Planned Features](#planned-features)
- [Future Student Booking Architecture](#future-student-booking-architecture)
- [Future Booking Safety](#future-booking-safety)
- [Future Mobile Booking](#future-mobile-booking)
- [Future Lab Presence Verification](#future-lab-presence-verification)
- [Future Check-In](#future-check-in)
- [Future Audit Events](#future-audit-events)
- [Design Principles](#design-principles)
- [Project Goals](#project-goals)
- [License](#license)

---

## Overview

Matoshree Study Lab is a management platform designed to simplify the day-to-day administration of a physical study lab.

The system currently focuses on the **admin side of operations**.

```text
Students
   ↓
Memberships
   ↓
Shifts
   ↓
Seats
   ↓
Seat Allocations
   ↓
Payments
   ↓
Audit Logs
```

The application is designed around the operational requirements of a study-lab environment where:

- students have memberships,
- memberships have validity periods,
- seats are organized within labs,
- students can be assigned to seats,
- shifts determine seat availability,
- fixed seats require special handling,
- payments are tracked,
- expired memberships are processed automatically,
- important administrative actions are auditable.

---

## Current Status

### Implemented

- Admin authentication
- Protected routes
- Admin registration flow
- Student management
- Student details
- Membership management
- Membership renewal
- Membership expiry processing
- Seat map
- Seat allocation
- Fixed-seat handling
- Shift-based seat allocation
- Payment recording
- Payment history
- Audit logs
- Dashboard statistics
- Scheduled membership-expiry processing
- JWT-based authentication
- Prisma database integration
- React Query data management
- Responsive UI
- Form validation
- API error handling
- Route-level error handling
- Production build support

### Not Yet Implemented

- Student login
- Student dashboard
- Student self-service seat booking
- Student mobile seat booking
- Student QR-based lab presence verification
- Student check-in
- Student booking cancellation
- Student booking history
- Real-time student seat availability
- Student-specific booking permissions

These are planned future features.

---

## Core Features

### 1. Admin Authentication

Administrators authenticate through the admin login system.

```text
Admin
  │
  ▼
Login
  │
  ▼
Backend authentication
  │
  ▼
JWT issued
  │
  ▼
Frontend authentication state
  │
  ▼
Protected application
```

Unauthenticated users are redirected to the login page.

### 2. Student Management

Administrators can manage students registered with the study lab.

Student-related operations include:

- View students
- Search students
- View student details
- Manage student information
- View membership information
- View payment information
- View seat-related information

```text
Student
 ├── Memberships
 ├── Payments
 ├── Seat allocations
 └── Audit history
```

### 3. Membership Management

Memberships represent a student's active relationship with the study lab.

Membership information includes:

- Student
- Membership plan
- Start date
- End date
- Active/inactive state
- Shift
- Fixed seat
- Membership-related allocation

Typical flow:

```text
Student
   │
   ▼
Create Membership
   │
   ├── Select Plan
   ├── Select Shift
   ├── Select Seat where applicable
   ├── Set Start Date
   └── Set End Date
   │
   ▼
Active Membership
```

### 4. Membership Renewal

Existing memberships can be renewed through the backend.

### 5. Seat Management

Physical seats are organized within labs and rows.

```text
Lab
 ├── Row 1
 │    ├── Seat 1
 │    ├── Seat 2
 │    └── Seat 3
 │
 ├── Row 2
 │    ├── Seat 4
 │    ├── Seat 5
 │    └── Seat 6
 │
 └── ...
```

Seat states include:

```text
FREE
OCCUPIED
FIXED
```

### 6. Fixed Seats

Fixed seats are treated differently from normal available seats.

Operations include:

- Assigning a fixed seat
- Locking a fixed seat
- Unlocking it when the relevant membership expires
- Preventing normal allocation where appropriate

### 7. Shift-Based Allocation

The system supports multiple shifts, for example:

```text
Morning Shift
Full Day
Evening Shift
```

Availability is considered in relation to:

```text
Seat
+
Date
+
Shift
```

Physical capacity and shift availability are treated separately.

### 8. Seat Allocation

Current administrative flow:

```text
Admin
  │
  ▼
Student
  │
  ▼
Membership
  │
  ▼
Shift
  │
  ▼
Seat
  │
  ▼
Allocation
```

### 9. Payments

Administrators can:

- Record payments
- View payment history
- Associate payments with memberships
- Associate payments with students

### 10. Audit Logging

Important administrative actions are recorded, including:

```text
Student created
Student updated

Membership created
Membership renewed
Membership updated
Membership expired

Seat assigned
Seat unassigned
Seat allocation changed

Payment recorded
```

### 11. Automatic Membership Expiry

```text
Scheduled Job
     │
     ▼
Find active expired memberships
     │
     ▼
Mark memberships inactive
     │
     ▼
Unlock applicable fixed seats
     │
     ▼
Remove invalid future allocations
     │
     ▼
Write audit information
```

---

## Dashboard

The admin dashboard provides an operational overview such as:

```text
Total Students
Active Memberships
Total Seats
Available Today
```

Seat information is grouped by shift:

```text
Today's Seat Overview

Morning Shift
Full Day
Evening Shift
```

The dashboard helps answer:

- How many students are registered?
- How many memberships are active?
- How many physical seats exist?
- How many seats are available?
- Are there operational issues?

---

## Application Architecture

```text
┌───────────────────────────────┐
│        React Frontend         │
│                               │
│ Dashboard                     │
│ Students                      │
│ Memberships                   │
│ Seat Map                      │
│ Payments                      │
│ Audit Logs                    │
│ Authentication                │
└───────────────┬───────────────┘
                │
                │ HTTPS / REST API
                ▼
┌───────────────────────────────┐
│          NestJS API           │
│                               │
│ Auth                          │
│ Admin                         │
│ Students                      │
│ Memberships                   │
│ Allocation                    │
│ Payments                      │
│ Audit                         │
│ Cron                          │
└───────────────┬───────────────┘
                │
                │ Prisma
                ▼
┌───────────────────────────────┐
│          PostgreSQL           │
│                               │
│ Students                      │
│ Memberships                   │
│ Seats                         │
│ Allocations                   │
│ Payments                      │
│ Audit Logs                    │
└───────────────────────────────┘
```

---

## Technology Stack

### Frontend

- React
- TypeScript
- Vite
- React Router
- TanStack React Query
- Axios
- Tailwind CSS
- React Toastify
- ESLint

### Backend

- NestJS
- TypeScript
- Prisma ORM
- PostgreSQL
- Passport
- JWT
- `@nestjs/schedule`
- DTO validation
- ESLint

### Development

- Git
- GitHub
- npm
- VS Code

---

## Project Structure

```text
study-lab/
│
├── be/
│   ├── prisma/
│   │   ├── migrations/
│   │   └── schema.prisma
│   │
│   ├── src/
│   │   ├── admin/
│   │   ├── allocation/
│   │   ├── audit/
│   │   ├── auth/
│   │   ├── config/
│   │   ├── cron/
│   │   ├── membership/
│   │   ├── payment/
│   │   ├── student/
│   │   ├── app.module.ts
│   │   ├── app.controller.ts
│   │   ├── app.service.ts
│   │   └── prisma.service.ts
│   │
│   ├── test/
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── auth/
│   │   ├── audit/
│   │   ├── dashboard/
│   │   ├── layouts/
│   │   ├── membership/
│   │   ├── payments/
│   │   ├── seat-map/
│   │   ├── students/
│   │   └── router/
│   │
│   ├── public/
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
└── README.md
```

---

## Authentication & Authorization

The application currently provides **admin authentication only**.

Authentication uses JWT-based authorization.

```text
Login
  │
  ▼
POST /auth/login
  │
  ▼
Backend validates credentials
  │
  ▼
JWT
  │
  ▼
Frontend
  │
  ▼
Authorization header
  │
  ▼
Protected API
```

Protected frontend routes redirect unauthenticated users to `/login`.

Public authentication routes redirect already authenticated users toward the dashboard.

---

## API Architecture

The backend follows NestJS modular architecture.

Major domains:

```text
AuthModule
AdminModule
StudentModule
MembershipModule
AllocationModule
PaymentModule
AuditModule
CronModule
ConfigModule
```

Each module owns its domain logic.

Example:

```text
MembershipModule
│
├── Controller
├── Service
├── DTOs
└── Prisma operations
```

---

## Data Flow

```text
React UI
   │
   ▼
React Query
   │
   ▼
Axios
   │
   ▼
NestJS Controller
   │
   ▼
DTO Validation
   │
   ▼
NestJS Service
   │
   ▼
Prisma
   │
   ▼
PostgreSQL
```

Response flow:

```text
PostgreSQL
   ↓
Prisma
   ↓
Service
   ↓
Controller
   ↓
Axios
   ↓
React Query
   ↓
React UI
```

---

## Database Architecture

Prisma is used as the ORM between NestJS and PostgreSQL.

The database contains entities associated with:

```text
Students
Memberships
Membership Plans
Shifts
Labs
Seats
Seat Allocations
Payments
Audit Logs
```

Database relationships are maintained through Prisma schema definitions and migrations.

Database changes should be introduced through Prisma migrations rather than manually modifying the production schema.

---

## Error Handling

The frontend handles API failures rather than assuming every request succeeds.

Typical handling includes:

- API failure notifications
- Authentication failure handling
- Invalid form input
- Network/API errors
- Route-level error boundaries
- Loading states
- Mutation states

Authentication failures are handled centrally through the Axios API layer.

---

## Validation

Validation exists at multiple levels.

### Frontend validation

Used for:

- immediate user feedback
- required fields
- email validation
- password validation
- numeric input validation
- form state

### Backend validation

The backend remains authoritative.

A request must still be validated by NestJS even when the frontend already validated it.

The frontend is never treated as a security boundary.

---

## Scheduled Jobs

The backend uses NestJS scheduling for recurring operations.

The membership-expiry flow is:

```text
Cron
 ↓
MembershipExpiryService
 ↓
Find expired memberships
 ↓
Deactivate
 ↓
Unlock applicable seats
 ↓
Clean invalid future allocations
 ↓
Audit
```

The cron schedule should be configurable through application configuration when different environments require different schedules.

---

## Security

Security is treated as a backend responsibility.

Important principles:

- Protected APIs require valid authentication.
- Users should only perform operations allowed by their role.
- Incoming API payloads must be validated.
- Important business rules should be protected at the service/database level.
- Credentials and authentication configuration belong in environment configuration.
- Sensitive values must never be committed to source control.
- Development and production should use separate configuration and database resources.

---

## Environment Configuration

The backend and frontend use environment-based configuration.

Typical configuration categories include:

```text
Application environment
API port
Database connection
JWT configuration
Frontend API URL
CORS configuration
Cron configuration
```

Environment-specific credentials and production configuration values should remain outside source control.

---

## Local Development

### Requirements

Install:

- Node.js
- npm
- PostgreSQL
- Git

Clone the repository:

```bash
git clone <repository-url>
cd study-lab
```

### Backend

```bash
cd be
npm install
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

### Frontend

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Configure the frontend environment with the backend API base URL.

---

## Database Setup

Generate Prisma client:

```bash
npx prisma generate
```

Development migrations:

```bash
npx prisma migrate dev
```

Production migrations:

```bash
npx prisma migrate deploy
```

Do not use development migration commands against the production database.

---

## Running the Application

Backend:

```bash
cd be
npm run start:dev
```

Frontend:

```bash
cd frontend
npm run dev
```

Flow:

```text
Browser
   │
   ▼
React/Vite
   │
   ▼
NestJS
   │
   ▼
PostgreSQL
```

---

## Linting

Backend:

```bash
cd be
npm run lint
```

Frontend:

```bash
cd frontend
npm run lint
```

The project aims for:

```text
0 errors
0 warnings
```

Particular attention is given to:

- TypeScript type safety
- React Hook dependencies
- unused variables
- explicit `any`
- floating promises
- React state/effect issues
- unnecessary renders
- unsafe patterns

---

## Production Build

### Backend

```bash
cd be
npm run build
```

### Frontend

```bash
cd frontend
npm run build
```

The backend must compile successfully and the frontend must produce a successful production build before deployment.

---

## Deployment

Recommended production architecture:

```text
                    Internet
                       │
             ┌─────────┴─────────┐
             │                   │
             ▼                   ▼
        React Frontend       NestJS API
             │                   │
             │                   │
             └────── HTTPS ──────┘
                                 │
                                 ▼
                         Managed PostgreSQL
```

Recommended structure:

```text
Frontend
   │
   ▼
Vercel / Cloudflare Pages
   │
   │ HTTPS
   ▼
NestJS Backend
   │
   ▼
Managed PostgreSQL
```

The backend and database should preferably run in the same region.

The database should be managed rather than manually hosted on the application server.

The backend can initially run the scheduled membership-expiry task within the same NestJS service.

As the application grows:

```text
                 Backend API
                     │
              ┌──────┴──────┐
              │             │
              ▼             ▼
          PostgreSQL     Worker/Cron
```

A dedicated worker becomes useful when multiple backend instances are introduced.

---

## Production Database Considerations

Production PostgreSQL should provide:

- automated backups
- secure access
- persistent storage
- monitoring
- restore capability
- database migrations
- appropriate connection limits

The frontend must never be responsible for database integrity.

---

## Git Workflow

Normal workflow:

```bash
git status
git add -A
git commit -m "describe the change"
git push origin master
```

Avoid force-pushing to the main production branch unless there is a deliberate reason to rewrite history.

Before committing, run the relevant checks:

```bash
npm run lint
npm run build
```

---

## Development Workflow

```text
1. Understand the existing flow
          ↓
2. Identify the correct module/component
          ↓
3. Make the smallest safe change
          ↓
4. Preserve existing behaviour
          ↓
5. Run lint
          ↓
6. Run TypeScript/build
          ↓
7. Test the affected flow
          ↓
8. Review Git diff
          ↓
9. Commit
          ↓
10. Push
```

The project favors incremental changes instead of large rewrites.

---

## Current Limitations

The current version is intentionally focused on administration.

### Student self-service is not available

Students cannot currently:

```text
Login
 ↓
View available seats
 ↓
Select a seat
 ↓
Book a seat
```

Only administrators currently operate the seat allocation functionality.

### No mobile student booking

There is currently no student-facing mobile booking experience.

### No physical-presence verification

There is currently no QR-based or other lab-presence mechanism for restricting bookings to students physically present at the lab.

### No student check-in workflow

Booking and physical check-in are separate future concepts and are not currently implemented as a student self-service flow.

---

## Planned Features

The next major phase is student self-service:

```text
Student Authentication
        ↓
Student Dashboard
        ↓
View Membership
        ↓
View Today's Availability
        ↓
Select Shift
        ↓
View Seat Map
        ↓
Select Available Seat
        ↓
Confirm Booking
        ↓
View Booking
```

Additional planned features:

- Student login
- Student dashboard
- Mobile-first booking UI
- Student booking history
- Booking cancellation
- Lab presence verification
- QR-based lab access
- Student check-in
- No-show handling
- Booking notifications
- Booking conflict handling
- Strong database-level protection against overlapping bookings

---

## Future Student Booking Architecture

Student booking will not create a second independent seat-allocation system.

The existing admin allocation functionality and future student booking functionality should use a common backend booking/seat-allocation domain.

```text
                  ┌───────────────────┐
                  │    Admin UI       │
                  └─────────┬─────────┘
                            │
                  ┌─────────▼─────────┐
                  │   Booking/Seat    │
                  │     Service       │
                  └─────────┬─────────┘
                            │
                  ┌─────────▼─────────┐
                  │    PostgreSQL     │
                  │                   │
                  │ Transactions      │
                  │ Constraints       │
                  │ Integrity         │
                  └─────────▲─────────┘
                            │
                  ┌─────────┴─────────┐
                  │                   │
           ┌──────┴──────┐    ┌───────┴──────┐
           │ Admin       │    │ Student      │
           │ Booking     │    │ Booking      │
           └─────────────┘    └──────────────┘
```

**Admin and Student may have different permissions, but they should not have separate business logic for seat booking.**

---

## Future Booking Safety

The frontend will not be the source of truth for seat availability.

Expected flow:

```text
Student
   │
   ▼
Select Seat
   │
   ▼
POST booking request
   │
   ▼
Backend authentication
   │
   ▼
Membership validation
   │
   ▼
Shift validation
   │
   ▼
Booking rule validation
   │
   ▼
Database transaction
   │
   ▼
Database constraint
   │
   ├───────────────┐
   │               │
   ▼               ▼
Success          Conflict
   │               │
   ▼               ▼
Booking          409 Conflict
created          response
```

This is intended to prevent simultaneous requests from successfully booking the same seat.

Future rules include:

- Only students with valid memberships can book.
- Past dates cannot be booked.
- A student should not have multiple bookings for the same date and shift unless explicitly allowed.
- A physical seat cannot have overlapping bookings.
- Bookings must use valid configured shifts.
- Students can manage only their own bookings.
- Administrators can manage bookings according to their permissions.

---

## Future Mobile Booking

The student interface will be mobile-first.

Example:

```text
┌─────────────────────────────┐
│ Matoshree Study Lab         │
│                             │
│ Today's Seat                │
│                             │
│ Evening Shift               │
│ 14:00 – 20:00               │
│                             │
│ 42 seats available          │
│                             │
│       [ Book a Seat ]       │
└─────────────────────────────┘
```

Seat selection:

```text
Select Seat

A01   A02   A03   A04
 🟢    🟢    🔴    🟢

B01   B02   B03   B04
 🟢    🔴    🟢    🟢

C01   C02   C03   C04
 🟢    🟢    🟢    🔴
```

---

## Future Lab Presence Verification

If bookings must be restricted to students physically at the lab, a short-lived lab-presence mechanism can be used.

Possible flow:

```text
Student Login
     ↓
Scan Lab QR
     ↓
Backend validates temporary QR token
     ↓
Short-lived lab presence
     ↓
Student can book
```

A rotating or short-lived QR approach is preferred over relying only on GPS.

---

## Future Check-In

Booking and attendance remain separate concepts.

```text
CONFIRMED
    │
    ▼
Student arrives
    │
    ▼
CHECKED_IN
```

Potential statuses:

```text
CONFIRMED
CANCELLED
CHECKED_IN
NO_SHOW
COMPLETED
```

This enables future attendance statistics, no-show tracking, operational reporting, seat utilization, and student usage history.

---

## Future Audit Events

Potential booking audit events:

```text
STUDENT_BOOKING_CREATED
STUDENT_BOOKING_CANCELLED
STUDENT_CHECKED_IN

ADMIN_BOOKING_CREATED
ADMIN_BOOKING_UPDATED
ADMIN_BOOKING_CANCELLED
ADMIN_CHECK_IN

BOOKING_REJECTED
SEAT_UNAVAILABLE
INVALID_BOOKING_REQUEST
```

This provides traceability for operational and security-sensitive actions.

---

## Design Principles

### 1. Backend is authoritative

The frontend is responsible for presentation and interaction.

The backend is responsible for:

- authorization
- validation
- business rules
- database integrity
- security

### 2. Database integrity matters

Important business rules should not exist only in React.

```text
Seat appears available in UI
```

does not guarantee:

```text
Seat can be booked
```

The database and backend must make the final decision.

### 3. Preserve existing behaviour

New functionality should integrate with the existing system rather than unnecessarily duplicate or replace working flows.

```text
Existing Admin Flow
       +
Future Student Flow
       ↓
Shared Booking Domain
```

### 4. Type safety

The frontend and backend use TypeScript.

The project avoids unnecessary `any` types and aims to maintain explicit types across application boundaries.

### 5. React performance

The frontend avoids unnecessary:

- state updates
- effects
- renders
- duplicated server state
- manual synchronization

React Query is used for server-state management.

### 6. Small, controlled changes

```text
Understand current flow
        ↓
Identify dependencies
        ↓
Change only what is required
        ↓
Run lint/build
        ↓
Test existing behaviour
```

---

## Project Goals

The long-term goal is to evolve Matoshree Study Lab from an administrative management tool into a complete study-lab operations platform.

```text
                    CURRENT
                       │
                       ▼
              Admin Management
                       │
          ┌────────────┼────────────┐
          │            │            │
          ▼            ▼            ▼
      Students     Memberships    Payments
          │
          ▼
       Seats
          │
          ▼
     Allocations
          │
          ▼
       Auditing
                       │
                       ▼
                 NEXT PHASE
                       │
                       ▼
              Student Authentication
                       │
                       ▼
              Mobile Seat Booking
                       │
                       ▼
              Lab Presence / QR
                       │
                       ▼
                  Check-in
                       │
                       ▼
               Attendance & Usage
```

The final system should provide a reliable bridge between:

```text
Administrative Operations
          +
Student Self-Service
          +
Physical Seat Management
          +
Membership Management
          +
Payments
          +
Attendance
          +
Auditability
```

while keeping business rules centralized, secure, and consistent.

---

## License

Add the project's chosen license here when one has been formally selected.
