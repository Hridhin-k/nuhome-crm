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

`quotes.current_version_id` points at the active version.

`revise_quote` updates the current version in place while the quote is still a draft. After rejection or approval (before send) it inserts a new `quote_versions` row (v2, v3…) and returns the quote to `quote_draft`. Sent quotes cannot be revised.

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

## Fulfillment quantities

`order_items` and `vendor_order_items` track `quantity_received` and `quantity_written_off`. Pending is generated as `quantity - received - written_off`.

- `send_order_to_vendor` can send a subset / partial qty; further sends are allowed while the job is with vendors.
- `record_items_received` types qty against one vendor batch. The batch stays `dispatched` until received + written off covers it. The order does not jump to `items_received` until every line is accounted.
- `write_off_order_items` closes shortage / damage / return / cancelled qty so the job is not stuck.

## Delivery gate (database)

A delivery insert is allowed only if:

1. Order exists and is in `delivery_unlocked`
2. Required items received or written off
3. Outstanding = 0
4. Latest required payments are `verified`
5. Actor has `deliveries.complete`

Phase 1 creates the tables and helper functions. Phase 2–11 attach RLS/RPC enforcement.
