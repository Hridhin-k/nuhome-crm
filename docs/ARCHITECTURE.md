# Nuhome CRM — Architecture

Mobile-first sales, quote, order, and fulfillment application.

## 1. Current architecture assessment

The git repository is a **stock Next.js 16 App Router** app (`create-next-app`):

| Area | Status |
| --- | --- |
| Next.js 16 + React 19 + TypeScript + Tailwind 4 | Present |
| App Router | Present (`app/page.tsx` is the default starter) |
| Supabase Auth / Postgres / RLS | **Not in the repo.** `.env.local` points at project `nuhome-crm` (`opilesvytbjwhzyqrrhq`), which currently has **no public tables**. |
| shadcn/ui, domain folders, workflow engine | Absent |
| Fetch architecture rule | Present (`.cursor/rules/fetch-architecture.mdc`) |

Cursor’s default Supabase MCP is **not** this CRM. It is a hotel/vendor marketplace (`nadysurgkroyemxviqfk`) with live data. Schema for Nuhome must only be applied to the `nuhome-crm` project.

Previous CRM experiments are **not** in this working tree. We establish the architecture here rather than adapting a missing app.

## 2. Proposed architecture

### Fetch model

If data is required to render a page, it is fetched on the **server**. Client components receive props. They do not own page data.

```
Browser → Server Component (page / layout) → lib/api/* helpers → Supabase (user session)
```

- Typed helpers in `lib/api/` — pages never hardcode table names or REST URLs.
- Native `fetch` only if talking to HTTP APIs. For Postgres, helpers wrap the Supabase server client (same cache / RSC model).
- Every helper declares cache intent (`no-store` for session, orders, payments; `revalidate` for materials/vendors).
- Parallel `Promise.all` unless B depends on A.
- Session, profile, and role live in `app/(app)/layout.tsx`, not re-fetched on every leaf for chrome.
- Mutations are Server Actions. They call `lib/workflow/*`, never patch status from the client.

### App structure

```
app/
  (auth)/login/
  (app)/                 # authenticated, mobile shell
    layout.tsx           # session + role-aware nav
    page.tsx             # action home
    customers/ quotes/ orders/ payments/
    approvals/ vendors/ deliveries/
lib/
  api/                   # typed read helpers
  auth/                  # session, permissions
  supabase/              # browser / server / proxy clients
  validation/            # shared Zod schemas
  workflow/              # transitions, gates, audit
features/                # domain UI (client islands)
components/ui/           # shadcn
supabase/migrations/
```

### Enforcement layers

1. **UI** represents the workflow (role nav, locked delivery).
2. **Workflow module** validates transitions and permissions.
3. **Postgres** constraints, RPCs, and RLS enforce the same rules if the UI is bypassed.
4. **Audit log** records every business action (insert-only).

## 3. Database schema plan

Normalized Postgres. UUID PKs. `created_at` / `updated_at`. RLS enabled on every table from day one.

See `docs/DATABASE.md` and `supabase/migrations/`.

Core entities: `profiles`, `roles`, `permissions`, `customers`, `leads`, `materials`, `quotes`, `quote_versions`, `quote_items`, `quote_approvals`, `orders`, `payments`, `payment_verifications`, `vendor_orders`, `deliveries`, `audit_logs`, `notifications`, `attachments`.

## 4. Role / permission model

| Role | Primary job |
| --- | --- |
| `sales` | Customers, quotes, send approved quotes, record payments, track own orders |
| `accounts` | Approve/reject quotes, verify payments, see margin |
| `procurement` | Activated orders, vendors, dispatch, GRN |
| `store` | Received items, delivery when gate unlocked |
| `admin` | Users, catalog, all orders, audit (still audited) |

Hard rules (also in RLS / RPCs later):

- Sales cannot approve their own quote or verify payment.
- Rejected quotes cannot be sent to the customer.
- Delivery requires outstanding = 0, calculated **server-side**.

See `docs/ROLES.md`.

## 5. Workflow / state machine

Quotes and orders are separate tables. The **order** is created when an approved quote is sent to the customer. From that point the order owns fulfillment status. Quote versioning stays on `quote_versions`.

See `docs/WORKFLOW.md` and `lib/workflow/state-machine.ts`.

## 6. Implementation phases

| Phase | Scope |
| --- | --- |
| **1** | Architecture, schema, auth (this pass) |
| 2 | Role permissions + full RLS |
| 3 | Customers + leads |
| 4 | Materials + pricing |
| 5 | Quote create + versioning |
| 6 | Accounts quote approval |
| 7 | Payment + verification |
| 8 | Order activation + state machine RPCs |
| 9 | Vendor fulfillment |
| 10 | Delivery payment gate + on hold |
| 11 | Delivery + close |
| 12 | Notifications + audit UI |
| 13 | Mobile UX polish |
| 14 | Performance |
| 15 | Tests + security review |

Do not implement later phases in the same pass as Phase 1.
