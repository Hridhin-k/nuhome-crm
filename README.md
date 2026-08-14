# Nuhome CRM

Mobile-first sales, quote, order, and fulfillment app.

Stack: Next.js App Router, TypeScript, Supabase (Postgres, Auth, RLS), Tailwind, shadcn/ui.

## Setup

1. Copy `.env.example` to `.env.local` and fill in the **nuhome-crm** Supabase URL and publishable key.
2. Apply migrations to that project only:

```bash
supabase link --project-ref opilesvytbjwhzyqrrhq
supabase db query --linked -f supabase/migrations/20260813120000_phase1_schema_auth.sql
```

3. Seed one demo user per role (or create users in the Auth dashboard — new users default to `sales`):

```bash
npx supabase db query --linked -f supabase/seed.sql
```

4. `npm run dev` and open `/login`.

| Email | Role | Password |
| --- | --- | --- |
| sales@nuhome.demo | sales | password123 |
| accounts@nuhome.demo | accounts | password123 |
| procurement@nuhome.demo | procurement | password123 |
| store@nuhome.demo | store | password123 |
| admin@nuhome.demo | admin | password123 |

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Scripts

```bash
npm run dev
npm run typecheck
npm run lint
npm run test
```
