# Nuhome CRM — Functional and flow gaps

Product review of what the app does today versus what a live showroom needs. This is **not** a code or architecture review.

**Scope of the current product:** one happy path — walk-in → quote → Accounts approve → send → payment verify → vendor → receive → pay balance if needed → deliver → close.

Around that spine, a lot of real shop-floor work is missing, one-way, or only half-built.

---

## 1. What works today

| Stage | Who | What the app supports |
| --- | --- | --- |
| Customer | Sales | Create and edit a profile; phone unique; shared floor book; search name, phone, email, quote number |
| Quote | Sales | Save a draft, submit, or pick up a colleague's walk-in; search by quote number, phone, or date |
| Reports | Admin | Date range, collections, margin, vendor SLA, who is sitting on work, and an audit log |
| Approval | Accounts | Approve, or reject with a reason |
| Revision | Sales | Revise a rejected quote, or withdraw an approved quote before send, then resubmit |
| Send | Sales | Mark sent, public quotation link, WhatsApp share |
| Invoice | Sales / Accounts | Print GST tax invoice (HSN, GST %, GSTIN, bill-to / site) |
| Files | Sales / Store | Measurement sheets, drawings, and photos on a customer, quote, or order |
| Address | Sales | Billing vs site address; customer GSTIN |
| After handover | Sales / Store | Schedule installation; warranty issued on delivery; AMC |
| Cancel | Sales / Procurement / Admin | Cancel a quote or order that will never complete; Accounts can kill a pending quote. Pending payments are dropped. |
| Payment | Sales → Accounts | Record advance / full / nil / another installment while the job is with the vendor; Accounts verifies or rejects with a reason |
| Fulfillment | Procurement | Split lines across vendors, hold qty back, type a partial GRN, close shortage/damage/return |
| Goods in | Procurement / Store | Record received qty; close remainder so the job is not stuck |
| Delivery dates | Procurement / Sales / Store | Expected date on each vendor batch; overdue queue on Home and Fulfillment |
| Delivery gate | System | Unlock if outstanding = 0; otherwise on hold |
| Handover | Store | Collect outstanding cash/UPI, then complete delivery when unlocked |
| Admin | Admin | Users + extra hats, vendors (edit / contacts / inactive), materials (edit sheet), CSV, cover for leave |
| Password | All / Admin | Forgot-password email, change-password on More, admin generate-once reset |
| Live UI | All roles | Dashboards refresh when orders / payments / quotes change |
| Notifications | Next role | Bell when a quote is submitted, payment recorded, order activates, vendor dispatches, job goes on hold, delivery unlocks, goods are handed over, or a job is cancelled |

Hard rules that **are** in place:

- Sales cannot approve their own quote or verify a payment they recorded — including when they also wear an extra hat.
- Extra roles combine permissions (“Sales + Delivery on Saturday”). Cover for leave moves open customers, quotes, and orders to another salesperson.
- Sales work a shared floor book. Payment recording still stays with the assigned salesperson.
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
| **No payment screenshot or receipt** | Payment is amount + method + a text reference. Tax invoices exist on the order; there is still no upload of a UPI screenshot or a simple receipt after verify. |
| **Nil (credit) is a stub** | It activates the order with the full amount still outstanding. The job then goes on hold after goods arrive. There is no credit limit, due date, or “collect later” plan. |
| **No refunds, excess payment, or allocation across jobs** | Overpay, reverse, or split a receipt across two orders is not a flow. |


---

## 4. Fulfillment and delivery

| Gap | Why it matters |
| --- | --- |
| **No proof of delivery beyond a notes box** | No signature, photo, or item-level handover. |
| **No commercial hold or vendor-fail path** | On-hold exists only for unpaid delivery. A dead quote or order can now be cancelled with a reason. There is still no customer postpone or vendor-fail status. |

---

## 5. Who gets told

The bell notifies the **next role** for floor handoffs: quote submitted, payment recorded, order active, vendor dispatched, on hold, delivery unlocked, delivered, and cancelled jobs. Quote approved / returned still go to Sales.

There is still no email, SMS, or WhatsApp ping. If nobody opens the app, the work sits until they do.

---

## 6. Admin and staff operations

Closed. Staff can reset access, edit vendors and materials after create, wear more than one hat, and reassign open sales work. See **What works today**.

---

## 7. Visibility and reporting

Closed. Admin Reports has a date range, collections, margin, vendor SLA, who is sitting on work, and an audit log. Quotes and orders search by quote number, phone, and date. Customers search name, phone, email, or quote number. Sales share a floor book. See **What works today**.

---

## 8. Documents the shop will still do on WhatsApp or paper

Closed. The shop can print a GST tax invoice, keep measurement sheets and drawings on the job, split billing vs site, book installation after handover, and record warranty / AMC. See **What works today**.

---

## 9. Highest-impact holes for a live floor

Closed. Sales can collect a further installment while the job is active or with the vendor, without waiting for GRN or hold. Sales, Procurement, or Admin can cancel a quote or order that will never complete (Accounts can cancel a quote still waiting for approval). Refunds, proof of delivery, and commercial hold remain open above.

See **What works today**.
