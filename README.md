# Boss Sports & Fitness Platform

A unified self-service booking and management system for **Boss Sports & Fitness** (Tournament-grade Pickleball Arena & Elite Strength Gym).

---

## 📁 Project Architecture & Clean Folder Structure

```
Boss sports and Fitness/
├── docs/                   # Product & Engineering Documentation
│   ├── prd.md              # Requirements, user roles & business rules
│   ├── design.md           # UI/UX design, visual identity & IA
│   ├── phases.md           # Delivery phases (Phase 0 -> Phase 5)
│   ├── rules.md            # Atomic conflict & security rules
│   ├── memory.md           # Business context & tech stack decisions
│   └── security-audit.md   # Pre-release audit checklist
│
├── frontend/               # Next.js App Router & Tailwind CSS UI
│   ├── src/
│   │   ├── app/            # Next.js routes, layout & global styles
│   │   └── components/     # Header (with sport switcher), Hero, Ticker, Booking Demo, Amenities, Footer
│   ├── public/             # Static assets
│   ├── tailwind.config.ts  # Sports palettes (Optic Volt Lime for Pickleball & Blaze Orange for Gym)
│   ├── tsconfig.json       # Frontend TypeScript configuration
│   └── package.json        # Frontend dependencies (Next 14, React 18, Framer Motion, Lucide)
│
├── backend/                # Database Models & Service Layer
│   ├── prisma/
│   │   └── schema.prisma   # PostgreSQL schema (Courts, Bookings, SlotHolds, GymPlans, Members, Payments, AuditLogs)
│   ├── src/
│   │   └── services/       # Atomic booking conflict checks & business logic
│   ├── tsconfig.json       # Backend TypeScript configuration
│   └── package.json        # Backend dependencies & Prisma scripts
│
├── package.json            # Root workspace orchestration scripts
└── .gitignore              # Repository ignore rules
```

---

## 🚀 Quick Start

### Frontend (Website & UI)
```bash
npm run dev
# Or from the frontend directory:
cd frontend && npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Backend (Database & Prisma)
```bash
cd backend
npm install
npm run db:generate
```

