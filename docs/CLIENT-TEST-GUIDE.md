# How to test NuHome

This is a walk-through for the people who will use the app. Do the tests in order. Each test tells you who to sign in as, what to tap, and what you should see.

Use a phone or a computer. One person can do every test by signing out and signing in as the next person.

## Sign in

Open the app. The password for every person below is `password123`.

| Who | Email | What they do |
| --- | --- | --- |
| Sales | sales@nuhome.demo | Meets the customer and makes the quote |
| Operations | operations@nuhome.demo | Looks after materials and the office shelf |
| Accounts | accounts@nuhome.demo | Checks the quote and the money |
| Admin | admin@nuhome.demo | Can do the office and accounts work |

To change person: open **More**, tap **Sign out**, then sign in as the next person.

Write the quote number on a piece of paper when the app shows it. You will need it later. It looks like QUOTE-1124.

## Two ways a customer can buy

- Some materials are already at the NuHome office. The customer can pay and take them the same day.
- Some materials are ordered only when a customer wants them. Those go to a vendor and are delivered later.
- One visit can have both. It stays one job and one bill.

---

## Test 1. Put pieces on the office shelf

**Sign in as Operations.**

1. Open **More**, then **Materials**.
2. Find **Cabinet handle**. Note how many it says are at the office. If it says the item is ordered when a customer wants it, the number is 0.
3. Tap **Edit**.
4. In **Quantity at office**, type a number that is 4 more than the number you wrote down. Example: if it said 4, type 8.
5. Save.

**You should see:** the materials list shows the new number, such as “8 pcs at office”.

6. Open **More**, then **Office stock**.

**You should see:** Cabinet handle with that same number on hand.

---

## Test 2. Customer buys only what is on the shelf

**Sign in as Sales.**

1. Open **Quotes**, then **New quote**.
2. Pick any customer, or create a new one. Continue to materials.
3. In the catalogue, find **Cabinet handle**. It should say a number “in office”, such as “8 in office”.
4. Add it twice.

**You should see:** one line, quantity 2, marked **From office**. Two taps add to the same line.

5. Continue to review and save the quote. Write down the quote number.
6. Open that quote.
7. Under **Office stock**, leave the amount as the shelf total.
8. Set **Method** to **Cash**. Leave **Reference** blank.
9. Tap **Take payment and hand over**.

**You should see:**

- The job is closed.
- The line says **Supplied today**.
- There is an invoice. Open it. The line says **Supplied today**.

10. Go back to a new quote and open the catalogue again.

**You should see:** Cabinet handle “in office” is 2 less than before this sale.

---

## Test 3. The customer changes their mind the same day

Stay on the quote from Test 2. This only works on the same day the handover was done.

1. Still signed in as Sales, open that quote.
2. Under **Void today’s handover**, type a reason such as “Customer changed their mind”.
3. Tap **Void handover**.

**You should see:** the job is cancelled, and a message that the quantity is back on the shelf.

4. Start a new quote and check the catalogue.

**You should see:** Cabinet handle “in office” is back to the number from before Test 2.

---

## Test 4. Payment needs a reference

**Sign in as Sales.** Start a new quote. Add 1 Cabinet handle from the office. Save it.

1. On the quote, set **Method** to **UPI**.
2. Leave **Reference** empty.
3. Tap **Take payment and hand over**.

**You should see:** the words “Payment reference is required”. The job stays open.

4. Type any reference, such as `UTR123`, and tap the button again.

**You should see:** the job closes and the line says **Supplied today**.

You can void this one the same way as Test 3 if you want the pieces back on the shelf.

---

## Test 5. They want more than is on the shelf

**Sign in as Sales.** Start a new quote and open the catalogue. Note how many Cabinet handles are “in office”. Call that number N.

1. Add Cabinet handle once.
2. Raise the quantity to N + 1. Use the plus button.

**You should see:** two lines for the same item.

- One line has quantity N and **From office** selected.
- One line has quantity 1 and **Order** selected.

3. On the office line, tap **Order**.

**You should see:** that line is now fully “to order”. Nothing is taken from the shelf.

4. Tap **From office** again.

**You should see:** it goes back to the office, as long as the quantity still fits on the shelf.

5. Add a **Custom line** (something that is not in the catalogue).

**You should see:** the custom line has no From office button. It is always ordered.

Do not save this quote unless you want to. If you save it, cancel it in Test 8 so the shelf is not held.

---

## Test 6. One visit, some now and some later

This is the main mixed visit. Use a fresh quote.

**Sign in as Sales.**

1. New quote. Pick a customer.
2. Add **Cabinet handle** and keep it **From office**. Use quantity 1.
3. Add **Chimney 60cm**. It should say “order”, because none are kept at the office.
4. Add one **Custom line**.
5. Save the quote. Write down the quote number.
6. On the quote, take payment for the shelf lines only. Use **Cash**. The amount should already be the shelf total, not the whole bill.
7. Tap **Take payment and hand over**.

**You should see:**

- The quote is still open. It is not closed.
- Cabinet handle says **Supplied today**.
- Chimney and the custom line say **To order**.
- Open the invoice. One bill. The handle says **Supplied today**. The other lines say **To be delivered**.

8. Tap **Submit to Accounts**.

**Sign in as Accounts.**

9. Open **Approvals**, or open the same quote from **Quotes** if you can see it.
10. Tap **Approve**.

**You should see:** Accounts can approve. There is no button for Accounts to hand over office stock.

**Sign in as Sales.**

11. Open the quote. Tap **Send**.

**You should see:** the customer has been sent the quote. The office line stays supplied. The other lines are still to be ordered.

**Sign in as Operations.**

12. Open **Fulfillment** and open this job.

**You should see:**

- The form to send to a vendor lists the chimney and the custom line only.
- Cabinet handle says it is not sent to a vendor.

You can stop this test here. The rest of this job follows Test 7.

---

## Test 7. Something that must be ordered and delivered

Use the job from Test 6, or start a new quote with only a chimney (nothing from the office). If you start a new one, Sales saves it, submits it, Accounts approves it, and Sales sends it. Then continue here.

**Sign in as Operations.**

1. Open the job in **Fulfillment**.
2. Choose a vendor for each line that still needs one. Save that split.
3. Enter the vendor’s price if the screen asks, then confirm the send.

**Sign in as Accounts** if the app asks Accounts to check the vendor price.

4. Approve or verify that vendor price.
5. Operations confirms the send to the vendor.

**You should see:** the office line is not in that send. Only the lines still to come from a vendor are sent.

6. When you are ready to pretend the goods have arrived, open the job again and mark them received.
7. Record the remaining payment as Sales. Use a method and a reference.
8. **Sign in as Accounts** and verify that payment.

**You should see:** the money for the office part was already counted. Accounts only needs to verify the new payment.

9. When the balance is clear and the goods are in, mark the job delivered and then closed. Use the button the screen offers for the next step. It is on the order.

**You should see:** the job closes. It does not wait on the office lines. Those were already handed over.

---

## Test 8. The customer leaves before paying

**Sign in as Sales.**

1. New quote. Add 1 Cabinet handle **From office**. Save it.
2. Start another new quote and look at the catalogue before you cancel.

**You should see:** “in office” is 1 less, because the saved quote is holding that piece.

3. Open the saved quote. Tap **Cancel job**. Type a reason. Confirm.

**You should see:** the quote is cancelled.

4. Start a new quote and check the catalogue again.

**You should see:** that 1 piece is back. “in office” matches the number from before this quote.

---

## Test 9. The shelf count cannot go below what is already promised

**Sign in as Sales.** Save a quote with 2 Cabinet handles **From office**. Do not hand them over. Leave the quote open.

**Sign in as Operations.**

1. Open **More**, then **Materials**. Edit **Cabinet handle**.
2. Set **Quantity at office** to 0. Save.

**You should see:** a message that this would drop the quantity below what is already reserved. The old number stays.

3. Open **More**, then **Office stock**. Use **Count correction** to subtract a large number, and type a reason. Save.

**You should see:** the same kind of message. The count does not change.

4. Go back to Sales and cancel that quote, as in Test 8, so the pieces are free again.

---

## Test 10. A price below cost is allowed

**Sign in as Sales.** New quote. Add Cabinet handle.

1. Change the price to a very small number, such as 50.
2. Look at the line.

**You should see:** a note that it is below cost. You can still save the quote. The app does not block the sale.

Cancel this quote when you are done so it does not hold a piece.

---

## Test 11. Each person sees the right screens

Do these quickly. Each one should send you away from a screen that person does not use.

| Sign in as | Try to open | What should happen |
| --- | --- | --- |
| Sales | **More**, then **Materials** | Materials does not open for Sales |
| Operations | **New quote** | The walk-in screen does not open for Operations |
| Accounts | A quote that still has office lines to hand over | There is no **Take payment and hand over** button |
| Admin | **More**, then **Materials**, edit Cabinet handle | **Quantity at office** is there. You can type a number and save |

After a handover, open that quote as Sales.

**You should see:** no **Edit draft** link. If you open revise, the screen says the office lines were already handed over and the handover must be voided first.

---

## When you are finished

Tick these. Every box should be ticked before you sign off.

- [ ] Operations can set how many of an item are already at the office
- [ ] Sales sees that number in the catalogue as “in office”
- [ ] Adding the same item twice becomes one line
- [ ] A shelf-only sale takes payment, hands the goods over, closes the job, and shows **Supplied today** on the invoice
- [ ] Cash needs no reference. UPI, card, bank transfer, and cheque need a reference
- [ ] The same person can undo that handover on the same day, and the pieces return to the shelf
- [ ] Asking for more than is on the shelf splits into “from office” and “order”
- [ ] A custom line is always ordered
- [ ] A mixed visit is one quote and one invoice. Office lines are supplied today. The rest says to be delivered
- [ ] Accounts approves the quote. Sales sends it
- [ ] Fulfillment sends only the lines that still need a vendor
- [ ] The job closes when those vendor lines are done. It does not wait again on the office lines
- [ ] Cancelling a quote before handover puts the pieces back
- [ ] Operations cannot set the office quantity below what a saved quote is already holding
- [ ] A price below cost shows a warning and still lets you continue
- [ ] Sales cannot edit materials. Operations cannot start a quote. Accounts cannot hand over the shelf. Admin can set the office quantity
