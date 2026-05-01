# ⚡ OmniFlow — Personal Finance, Built Solo

<p align="center">
  <img src="./assets/banner.png" alt="OmniFlow — flows in, flows out, flows around" width="820"/>
</p>

<p align="center">
  <strong>flows in</strong> (earnings) &nbsp;·&nbsp; <strong>flows out</strong> (expenses) &nbsp;·&nbsp; <strong>flows around</strong> (investments)
</p>

A personal finance web app for tracking expenses, earnings, and investments — built solo, for a single user.

OmniFlow is an admin-style dashboard that gives one person a full picture of their money in one place: cash flow, category breakdowns, account balances, and investment positions. It is web-first and PWA-ready, with the option to wrap it in Capacitor for native iOS/Android later if needed.

> Clean, modern, memorable.

## Goals

- **Single-user, self-hosted-style.** No multi-tenancy, no team features, no marketing surface. Just a clean, fast tool for one person's finances.
- **Web-first, mobile-ready.** Ships as a PWA (installable on phone, offline-capable home-screen app). Code is structured to avoid web-only APIs so Capacitor can wrap it later with minimal rework.
- **Correct by construction.** Money math is exact (no floats), schemas are validated at runtime, and the database has Row-Level Security enabled from the first migration.
- **Scales with the project.** Folder structure, type definitions, and state boundaries are set up so adding new features (recurring transactions, budgets, multi-currency, imports) doesn't require rewrites.

## Tech stack

### Core
- **React 18 + TypeScript** — UI framework and type safety from day one.
- **Vite** — fast dev server, fast builds, first-class TS support.
- **Tailwind CSS** — utility-first styling, pairs with the component library below.
- **shadcn/ui** — copy-paste component primitives (sidebar, cards, dialogs, tables, dropdowns, date pickers, toasts) built on Radix + Tailwind. Components live in the repo, so they are owned and customizable.

### State & data
- **TanStack Query (React Query)** — server state: anything from Supabase. Handles caching, refetching, optimistic updates, stale-while-revalidate.
- **Zustand** — client-only UI state: sidebar collapsed/expanded, modals open, active filters. Never used for server data.
- **react-hook-form + zod** — form handling and runtime schema validation. Zod schemas double as the source of truth for Supabase response shapes.

### Backend
- **Supabase** — Postgres database, authentication, Row-Level Security. Single-user but RLS is enabled from migration 001 as a hardening default.

### Visualization
- **Recharts** — primary charting library (bar charts, pie charts, line charts).
- **Tremor** *(optional, evaluate during dashboard build)* — finance/admin-tuned components built on Recharts. May replace hand-built KPI cards if it speeds delivery without lock-in.

### Routing & navigation
- **React Router v6** — client-side routing. Admin layout shell wraps all authenticated routes; the login route lives outside the shell.

### Mobile (deferred)
- **Capacitor** — *not in phase 1*. The app ships as a PWA first. Capacitor is reserved for if/when biometric auth, native push notifications, or App Store distribution become required.

## Architecture decisions

### UI shell
- **Admin layout**: collapsible left sidebar + main content area on the right.
- Sidebar collapses to icons-only and expands to show labels.
- Sidebar sections: Dashboard, Transactions, Investments, Categories, Settings.
- Section changes swap the content area only — no full page reloads.
- **Login** is a separate full-screen route outside the admin shell. Successful auth redirects to Dashboard.

### State boundaries
- **Server state** (transactions, categories, accounts, user profile) → TanStack Query.
- **UI state** (sidebar open/closed, modal visibility, table filters, theme) → Zustand.
- **Form state** → react-hook-form, validated with zod schemas defined alongside the model.

### Money handling
- All monetary amounts stored as **`bigint` cents** in Postgres (e.g. `4299` for $42.99).
- Never use JavaScript `number` (float) for money math.
- Display formatting happens at the UI boundary, not in storage.

### Database schema (initial design)
- **`accounts`** — checking, savings, credit, brokerage, etc. Every transaction belongs to an account.
- **`categories`** — user-defined, CRUD-managed, color/icon optional.
- **`transactions`** — `type` (expense / earning / investment), `amount_cents` (bigint), `currency`, `account_id`, `category_id`, `date`, `description`, `deleted_at` (soft delete for audit trail).
- **`currency` column** included from day one even though only one currency is used initially — avoids painful migration later.
- **Row-Level Security policies** enabled on every table from migration 001.

### Code organization principles
- Feature-based folder structure (not type-based) — code for "transactions" lives together regardless of whether it's a component, hook, or query.
- Zod schemas live next to the feature they describe and are imported by both forms and query layer.
- No web-only APIs (`window.localStorage` direct access, etc.) without an abstraction — keeps Capacitor migration cheap.

## Project structure *(provisional — finalized during scaffolding)*

```
src/
  app/              # router, providers, root layout
  features/         # feature modules (transactions, categories, accounts, ...)
    <feature>/
      components/
      hooks/
      schemas.ts    # zod schemas
      queries.ts    # TanStack Query hooks
  components/ui/    # shadcn/ui primitives
  lib/              # supabase client, formatters, utilities
  stores/           # Zustand stores (UI state only)
  types/            # shared TypeScript types
supabase/
  migrations/       # SQL migrations
```

## Features

*To be documented after first scaffolding pass.*

## Installation

*To be documented after first scaffolding pass.*

## Status

Pre-scaffolding. The next step is to set up the Vite + React + TS + Tailwind + shadcn/ui foundation, configure Supabase, write the initial migration, and stand up the admin layout shell with placeholder routes.
