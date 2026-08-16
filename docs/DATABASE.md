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
            └── profile_roles (extra hats)
roles ← role_permissions → permissions

customers ← leads
customers ← quotes ← quote_versions ← quote_items → materials
                 └── quote_approvals
quotes ← orders ← payments ← payment_verifications
       └── order_items
orders ← vendor_orders ← vendor_order_items → vendors
                                              └── vendor_contacts
orders ← deliveries ← delivery_items
orders ← installations
orders ← warranties
company_settings
* ← audit_logs
* ← attachments (kind: measurement / drawing / photo / file)
* ← notifications
```

## Quote versioning

`quotes.current_version_id` points at the active version.

`revise_quote` updates the current version in place while the quote is still a draft. After rejection or approval (before send) it inserts a new `quote_versions` row (v2, v3…) and returns the quote to `quote_draft`. Sent quotes cannot be revised.

## Enforcement

- Status updates outside RPCs fail (`enforce_workflow_status`).
- Workflow mutations are `SECURITY DEFINER` RPCs.
- Authenticated clients cannot INSERT/UPDATE/DELETE quotes, orders, payments, deliveries, or audit logs.
- `complete_delivery` recalculates outstanding in Postgres and rejects if the gate fails. It also opens a product warranty from the catalogue term.

## Shop documents

- `company_settings` is a singleton (GSTIN, legal name) printed on tax invoices. Admin updates it from More → Company.
- Customers store `gstin`, `billing_address`, and `site_address`. `address` stays in sync with billing.
- Materials store `hsn_code`, `gst_rate` (default 18), and `warranty_months` (default 12). Quote lines snapshot HSN / GST; sell price is GST-exclusive.
- `orders.invoice_number` is issued by `ensure_tax_invoice` on first print (`INV-1001`…).
- `attachments` files live in the private `attachments` storage bucket. Staff who can see the job can upload measurement sheets, drawings, photos, or other files.
- After handover, Sales or Store book an `installations` row and can add an AMC on `warranties`. Warranty is inserted on `complete_delivery`.

## Payment math (server)

```
outstanding = current_quote_total − sum(verified payment amounts)
```

`nil` is a recorded payment of amount 0 (credit terms). It still requires Accounts verification before activation.

Further installments while the order is `order_active`, with a vendor, or in transit do not change the fulfillment status. Only first terms (`quote_sent_to_customer`) and hold repayment (`order_on_hold`) move the order to `payment_pending_verification`.

## Fulfillment quantities

`order_items` and `vendor_order_items` track `quantity_received` and `quantity_written_off`. Pending is generated as `quantity - received - written_off`.

- `send_order_to_vendor` can send a subset / partial qty; further sends are allowed while the job is with vendors.
- `record_items_received` types qty against one vendor batch. The batch stays `dispatched` until received + written off covers it. The order does not jump to `items_received` until every line is accounted.
- `write_off_order_items` closes shortage / damage / return / cancelled qty so the job is not stuck.

## Notifications

Inserts into `audit_logs` trigger `notify_from_audit`, which writes `notifications` for the next role. Sales approval/return still call `notify_user` from those RPCs. Clients cannot call `notify_user` / `notify_role`.

## Delivery gate (database)

A delivery insert is allowed only if:

1. Order exists and is in `delivery_unlocked`
2. Required items received or written off
3. Outstanding = 0
4. Latest required payments are `verified`
5. Actor has `deliveries.complete`

## Staff ops

- `profile_roles` is the hat list. `has_permission` unions every active hat. `profiles.role` remains the primary label.
- Changing `profiles.role` also upserts that role into `profile_roles`. Extra hats are set with `admin_set_profile_roles`.
- `vendor_contacts` are extra people on a vendor (phone/email besides the main row).
- `reassign_sales_cover(from, to)` moves open customers, drafts/unsent quotes, and open orders. Cancelled, delivered, and closed jobs stay put. `reassign_order_sales` moves one live job.
- `cancel_job(quote_id, reason)` sets the quote and its order (if any) to `cancelled` and rejects pending payments.
- Sales floor book: `has_role('sales')` can select all customers, quotes, and orders. `send_quote_to_customer` assigns the sending salesperson.

Phase 1 creates the tables and helper functions. Later migrations attach RLS/RPC enforcement, floor-book visibility, and shop documents (GST invoice, files, installation, warranty).
