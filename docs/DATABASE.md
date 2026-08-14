# Database schema

Applied only to the **nuhome-crm** Supabase project (`opilesvytbjwhzyqrrhq`).

## Conventions

- UUID primary keys (`gen_random_uuid()`)
- Foreign keys with explicit names
- `created_at timestamptz not null default now()`
- `updated_at` via trigger
- Enums for statuses (no free-text lifecycle)
- RLS on every table
- Financial totals stored on quote versions; **outstanding is computed**, never trusted from the client

## Entity map

```
auth.users
    └── profiles (role → roles)
roles ← role_permissions → permissions

customers ← leads
customers ← quotes ← quote_versions ← quote_items → materials
                 └── quote_approvals
quotes ← orders ← payments ← payment_verifications
       └── order_items
orders ← vendor_orders ← vendor_order_items → vendors
orders ← deliveries ← delivery_items
* ← audit_logs
* ← attachments
* ← notifications
```

## Quote versioning

`quotes.current_version_id` points at the active version. Previous versions are never overwritten.

`revise_quote` inserts a new `quote_versions` row (v1, v2, v3…) with a full financial snapshot: subtotal, discount, tax, total, margin, notes, status, rejection reason, rejected_by.

## Enforcement

- Status updates outside RPCs fail (`enforce_workflow_status`).
- Workflow mutations are `SECURITY DEFINER` RPCs.
- Authenticated clients cannot INSERT/UPDATE/DELETE quotes, orders, payments, deliveries, or audit logs.
- `complete_delivery` recalculates outstanding in Postgres and rejects if the gate fails.

## Payment math (server)

```
outstanding = current_quote_total − sum(verified payment amounts)
```

`nil` is a recorded payment of amount 0 (credit terms). It still requires Accounts verification before activation.

## Delivery gate (database)

A delivery insert is allowed only if:

1. Order exists and is in `delivery_unlocked`
2. Required items received
3. Outstanding = 0
4. Latest required payments are `verified`
5. Actor has `deliveries.complete`

Phase 1 creates the tables and helper functions. Phase 2–11 attach RLS/RPC enforcement.
