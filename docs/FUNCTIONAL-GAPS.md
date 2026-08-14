# Nuhome CRM — Functional and flow gaps

Product review of what the app does today versus what a live showroom needs. This is **not** a code or architecture review.

**Scope of the current product:** one happy path — walk-in → quote → Accounts approve → send → payment verify → vendor → receive → pay balance if needed → deliver → close.

Around that spine, a lot of real shop-floor work is missing, one-way, or only half-built.

---

## 1. What works today

| Stage | Who | What the app supports |
| --- | --- | --- |
| Customer | Sales | Create and edit a profile; phone numbers must be unique |
| Quote | Sales | Save a draft, submit to Accounts, or correct an approved quote before send |
| Approval | Accounts | Approve, or reject with a reason |
| Revision | Sales | Revise a rejected quote, or withdraw an approved quote before send, then resubmit |
| Send | Sales | Mark sent, public quotation link, WhatsApp share |
| Payment | Sales → Accounts | Record advance / full / nil; Accounts verifies or rejects with a reason |
| Fulfillment | Procurement | Split lines across vendors, hold qty back, type a partial GRN, close shortage/damage/return |
| Goods in | Procurement / Store | Record received qty; close remainder so the job is not stuck |
| Delivery dates | Procurement / Sales / Store | Expected date on each vendor batch; overdue queue on Home and Fulfillment |
| Delivery gate | System | Unlock if outstanding = 0; otherwise on hold |
| Handover | Store | Collect outstanding cash/UPI, then complete delivery when unlocked |
| Admin | Admin | Users + roles, vendors, materials, CSV import |
| Live UI | All roles | Dashboards refresh when orders / payments / quotes change |

Hard rules that **are** in place:

- Sales cannot approve their own quote or verify a payment they recorded.
- Accounts can reject a pending payment; Sales then records a corrected one.
- A rejected quote cannot be sent to the customer.
- Delivery requires outstanding = 0 (computed on the server).

---

## 2. Quote and customer

| Gap | Why it matters |
| --- | --- |
| **Customer cannot accept or reject in the app** | The public quotation is view-only. “Sent to customer” is a staff click, not a customer decision. No expiry, reminder, or follow-up. |
| **Leads are unused** | Everyone is a customer. No source, assignment, or conversion flow. |

---

## 3. Money

| Gap | Why it matters |
| --- | --- |
| **Balance cannot be collected during fulfillment** | Extra payment is only allowed when the quote is just sent, a payment is pending/rejected, or the order is on hold / delivery-check. While the job is active, with the vendor, or in transit, Sales cannot log another installment. |
| **No proof, receipt, or invoice** | Payment is amount + method + a text reference. No screenshot, GST invoice, or customer receipt after verify. |
| **Nil (credit) is a stub** | It activates the order with the full amount still outstanding. The job then goes on hold after goods arrive. There is no credit limit, due date, or “collect later” plan. |
| **No refunds, excess payment, or allocation across jobs** | Overpay, reverse, or split a receipt across two orders is not a flow. |


---

## 4. Fulfillment and delivery

| Gap | Why it matters |
| --- | --- |
| **No proof of delivery beyond a notes box** | No signature, photo, or item-level handover. |
| **Nothing can be cancelled or put on commercial hold** | No cancel quote, cancel order, customer postpone, or vendor fail. On-hold exists only for unpaid delivery. |

---

## 5. Who gets told

Notifications fire only for **quote approved** and **quote returned**.

| Role | Not notified when |
| --- | --- |
| Accounts | A quote is submitted, or a payment is recorded |
| Procurement | An order becomes active |
| Store / Delivery | Delivery is unlocked |
| Sales | A job goes on hold, is dispatched, or is delivered |

Dashboards can refresh live, but people still have to be looking at the screen.

---

## 6. Admin and staff operations

| Gap | Why it matters |
| --- | --- |
| **No forgot-password, change-password, or admin reset** | Admin sets a password at create time and must share it out of band. CSV-generated passwords are shown once. |
| **Vendors are add-only** | No edit, deactivate, or extra contacts after create. |
| **Materials are barely maintainable** | Add, CSV upsert by SKU, or hide. No edit sheet for a single item. |
| **One role per person** | No “Sales + Store on Saturday.” |
| **No reassignment** | Jobs stay with the creator / assigned salesperson. Cover for leave is not a flow. |

---

## 7. Visibility and reporting

| Gap | Why it matters |
| --- | --- |
| **Reports are open-queue counts, not a business report** | No date range, collections, margin, aging, vendor SLA, or “who is sitting on work.” |
| **Lists are thin** | Orders and quotes have no search by quote number, phone, or date. Customer search is name/phone only. |
| **Sales is siloed** | They mainly see customers and quotes they created. A shared floor book (“any salesperson can pick up this walk-in”) is not the model. |
| **Audit is per-record only** | A timeline on the quote/order exists. There is no admin report for “who changed this role / verified this payment.” |

---

## 8. Documents the shop will still do on WhatsApp or paper

These are not in the product at all:

- GST / HSN and a real tax invoice
- Measurement sheets and drawings
- File attachments
- Site address vs billing address
- Installation scheduling after delivery
- Warranty / AMC

---

## 9. Highest-impact holes for a live floor

If only a few gaps are closed first, these unblock real operations:

1. **Collect balance while the order is with the vendor** — customer pays in installments without waiting for GRN / hold.
2. **Notify the next role that work arrived** — submit, payment recorded, order active, delivery unlocked, on hold.
3. **Cancel a dead job** — quote or order that will never complete.

The core state machine is there. The gaps are everything around **exceptions**, **money after activation**, and **day-2 operations**.
