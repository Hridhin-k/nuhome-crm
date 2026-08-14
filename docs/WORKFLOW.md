# Workflow and state machine

Single source of truth:

- Postgres: `public.workflow_transitions` + RPCs in `supabase/migrations/20260813180100_workflow_rpcs_rls.sql`
- TypeScript: `lib/workflow/transitions.ts` (must stay in sync)

UI and Server Actions call `lib/workflow/service.ts`. They never update `quotes.status` or `orders.status` directly. A trigger rejects status changes unless the RPC set `nuhome.allow_status`.

## Statuses

```
quote_draft
  → quote_pending_accounts
      → quote_approved → quote_sent_to_customer → payment_pending_verification
      → quote_rejected → quote_draft (new version)
payment_pending_verification
  → order_active                         (first activation)
  → delivery_unlocked | order_on_hold    (after items received / on-hold repayment)
order_active → sent_to_vendor → vendor_dispatched → items_received
  → delivery_pending_payment
      → delivery_unlocked   (outstanding = 0)
      → order_on_hold       (outstanding > 0)
order_on_hold → payment_pending_verification
delivery_unlocked → delivered → closed
```

A rejected quote cannot be sent to the customer.

## Separation of duties

- Sales cannot approve/reject quotes or verify payments.
- The quote creator cannot approve that quote.
- The payment recorder cannot verify that payment.

## Delivery

`complete_delivery` rejects unless:

1. Status is `delivery_unlocked`
2. All order items are fully received
3. `order_balance().outstanding = 0`
4. Caller has `deliveries.complete`

Outstanding is `quote total − sum(verified payments)`, computed in Postgres.
