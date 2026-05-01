# OmniFlow — project guide for Claude Code

This file is the persistent working brief for Claude Code. The `README.md` is the public-facing project doc; CLAUDE.md is the internal one — what to build, how it should look, and how to make calls when the user is not in the loop.

## Project at a glance

OmniFlow is a solo-user personal finance web app. One person tracks expenses, earnings, and investments by hand and sees the whole picture in an admin-style dashboard. Single user, no multi-tenancy, no marketing surface. PWA-first; Capacitor is deferred to a later phase.

For the full stack, schema decisions, and architecture choices, read `README.md` first — those decisions are locked unless the user explicitly revisits them.

> flows in (earnings), flows out (expenses), flows around (investments).

## Brand identity

### Mascot — Volt 

OmniFlow's mascot is **Volt**, a stylized falcon/swift silhouette whose tail-feather doubles as a lightning bolt. Volt should read as **fast, focused, electric** — not cute, not cartoonish. The reference space is modern fintech (Robinhood, Linear, Vercel) executed with personality, not children's-app whimsy.

Volt has presence at the edges of the experience and stays out of dense data UI:

- **Appears in**: favicon / app icon (monochrome silhouette), login screen (oversized, above the form), empty states (Volt + one-liner + CTA), the 404 page, optionally a small loading-state animation.
- **Does not appear in**: the dashboard, transaction tables, charts, settings forms, or anywhere the user is doing real work.

The bird is a brand moment, not a UI element.

### Color system

Yellow is the brand color, but **yellow is an accent, not a background**. A yellow-flooded finance dashboard reads as a warning state, not a brand. Yellow earns its keep on CTAs, active states, the brand mark, and selective highlights — surfaces and chrome stay neutral.

The full palette below is the starting point; values become Tailwind / shadcn tokens during scaffolding. Once tokens exist, components reference tokens, never raw hex.

| Role | Light | Dark | Notes |
|------|-------|------|-------|
| Brand primary (Volt yellow) | `#FACC15` | `#FFE066` | CTAs, active nav, brand mark |
| Brand pressed/hover | `#CA8A04` | `#EAB308` | Hover and pressed states for primary |
| App background | `#FAFAF9` | `#0B0F14` | Warm off-white / blue-tinted near-black |
| Surface (cards, sidebar) | `#FFFFFF` | `#141A21` | Sits on the background |
| Border | `#E7E5E4` | `#1F2832` | Hairline, never heavy |
| Text primary | `#0C0A09` | `#F5F5F4` | |
| Text muted | `#57534E` | `#A8A29E` | Labels, captions, helper text |
| Income (positive) | `#15803D` | `#4ADE80` | Earnings, gains |
| Expense (negative) | `#B91C1C` | `#F87171` | Outflows, losses |
| Investment (neutral) | `#6D28D9` | `#A78BFA` | Holdings, transfers to investments |

Semantic money colors (income / expense / investment) are used in tables, charts, and KPI cards consistently — green is *only* for inflows, red is *only* for outflows. Don't repurpose them for unrelated UI states.

### Typography

- **Body / UI**: Inter (variable). Tabular figures enabled wherever a money value is rendered.
- **Display**: Space Grotesk — wordmark, dashboard KPI numbers, page titles. Confident and modern without trend-chasing.
- **Money**: tabular numerals, decimal-aligned in tables. Currency symbol leads the amount.

### Visual language

- **Corners**: cards `rounded-lg` (8px), inputs/buttons `rounded-md` (6px), badges and the FAB `rounded-full`.
- **Depth**: borders define structure on flat surfaces. Shadows lift only floating elements (popovers, modals, toasts).
- **Density**: comfortable, not cramped. Tables ~14px row padding. Cards 24px internal padding.
- **Iconography**: Lucide only (ships with shadcn/ui). 1.5px stroke, no mixing icon libraries.
- **Motion**: 150ms ease-out is the default — match Volt's energy. Reserve longer animations for layout-level changes (route transitions, sidebar collapse).

## UX principles

OmniFlow is a daily-driver tool. Optimize for **speed and clarity**, not novelty. The user lives inside this app — every keystroke saved compounds.

- **Keyboard-first.** Every primary action has a shortcut. `Cmd/Ctrl+K` opens a global command palette. `Cmd/Ctrl+N` opens new-transaction from anywhere.
- **Quick-add everywhere.** Floating action button on every authenticated route, plus the keyboard shortcut, plus a sidebar entry.
- **Smart filters.** Filter chips (type, category, account, date range) with presets — This Month, Last 30d, YTD, Custom. Filter state lives in the URL so views are bookmarkable.
- **Inline editing** in transaction tables — click a cell to edit. No modal round-trip for small corrections.
- **Optimistic updates** for create / edit / delete via TanStack Query's `onMutate`. Roll back with a toast on error.
- **Skeletons, not spinners.** Skeletons match the final layout shape.
- **Designed empty states.** Volt + one-liner + primary CTA. Never blank.
- **Toasts for confirmation; modals only for destructive or multi-field actions.**
- **Dark mode is first-class.** Both modes designed in lockstep, not retrofitted.
- **Tabular numerals everywhere money appears.** Misaligned digits in a finance app erode trust.

Capabilities to plan for from day one (even if not built in phase 1, the architecture should not block them): command palette, global search across transactions, bulk actions on selected rows, drag-to-reassign category, CSV export, recurring transactions, multi-currency, budgets.

## Engineering guardrails for Claude

When implementing features in this repo:

- Money is `bigint` cents end-to-end. Never introduce `number` (float) for monetary values, anywhere.
- Server data → TanStack Query. UI state → Zustand. Form state → react-hook-form. Don't cross-pollinate; Supabase data never lives in Zustand.
- Zod schemas live next to the feature they describe and are the single source of truth for both forms and query response validation.
- shadcn/ui components live in `src/components/ui/` and are owned — edit them freely. Do not pull in a second component library.
- New visual values (color, spacing, font, radius) go through Tailwind / shadcn tokens. No hex literals in components.
- RLS is on for every Supabase table from migration 001. New tables ship with policies in the same migration that creates them.
- Default to: faster path, fewer clicks, clearer money column. When unsure between two designs, the one with less chrome wins.
- For any decision larger than a single component (new dependency, schema change, new top-level route, new data flow), surface the call to the user before writing code.

## Status

Pre-scaffolding. Next step is the Vite + React + TS + Tailwind + shadcn/ui foundation, Supabase client + initial migration, the admin layout shell with collapsible sidebar, and placeholder routes for Dashboard / Transactions / Investments / Categories / Settings.
