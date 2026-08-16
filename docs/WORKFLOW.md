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
      → quote_approved → quote_draft          (correct before send, new version)
      → quote_rejected → quote_draft          (new version)
payment_pending_verification
  → order_active                         (first activation)
  → delivery_unlocked | order_on_hold    (after items received / on-hold repayment)
order_active → sent_to_vendor → vendor_dispatched → items_received
  (more vendor batches can be sent while in sent / dispatched / received)
  sent_to_vendor → items_received          (close remainder without GRN)
items_received
  → delivery_pending_payment
      → delivery_unlocked   (outstanding = 0)
      → order_on_hold       (outstanding > 0)
order_on_hold → payment_pending_verification
delivery_unlocked → delivered → closed
cancelled                          (dead quote or order; not from delivered / closed)
```

Drafts can be saved and edited until submitted. An approved quote can be withdrawn to draft before it is sent; Accounts must approve the new version.

A rejected quote cannot be sent to the customer.

## Separation of duties

- Sales cannot approve/reject quotes or verify/reject payments.
- The quote creator cannot approve that quote.
- The payment recorder cannot verify or reject that payment.
- Store (Delivery) can record payment at handover; they still cannot verify it.
- Sales can record another installment while the order is active or with the vendor. That payment is verified by Accounts; the job stays on the vendor path.
- Sales, Procurement, or Admin can cancel a live quote/order with a reason. Accounts can cancel a quote still waiting for approval.

## Fulfillment

Procurement can split a job across vendors and type received qty. Expected delivery on each batch drives overdue flags on Home and Fulfillment (Asia/Kolkata calendar date). Shortage, damage, return, or cancelled qty is closed with `write_off_order_items` so leftover units do not block the delivery gate.

## Delivery

`complete_delivery` rejects unless:

1. Status is `delivery_unlocked`
2. All order items are fully received or closed (shortage / damage / return)
3. `order_balance().outstanding = 0`
4. Caller has `deliveries.complete`

Outstanding is `quote total − sum(verified payments)`, computed in Postgres.

Warranty starts on delivery (max catalogue months on the order, default 12). Sales or Store then schedule installation and can add an AMC on the closed order.

## Notifications

`audit_logs` insert fans out in-app rows (bell + realtime):

| Event | Who |
| --- | --- |
| Quote submitted | Accounts |
| Quote approved / returned | Sales (quote owner) |
| Payment recorded | Accounts |
| Order activated | Procurement |
| Vendor dispatched | Assigned sales |
| Order on hold | Assigned sales |
| Delivery unlocked | Store / Delivery |
| Order delivered | Assigned sales |
| Order cancelled (vendor stage) | Procurement + assigned sales |
| Pending quote cancelled | Accounts |

The person who took the action is not notified of their own work. There is no email or SMS.
