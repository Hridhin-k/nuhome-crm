# Roles and permissions

Stored in `roles`, `permissions`, `role_permissions`. `profiles.role` is the primary assignment. Extra hats live in `profile_roles` and are unioned into `has_permission` — so one person can be Sales + Delivery on Saturday. The UI combines those screens (overflow to More) and the Home inbox merges both queues.

Sales cannot approve their own quote or verify/reject a payment they recorded, including when they also have a second role — Phase 2 RLS uses the acting permission, not a UI flag.

Any salesperson can see the shared floor book (all customers, quotes, and sales jobs) and pick up a walk-in. Recording payment still requires being the assigned salesperson on the order. Who sent the quote becomes `assigned_sales_id`.

Any salesperson can see the shared floor book (all customers, quotes, and sales jobs) and pick up a walk-in. Recording payment still requires being the assigned salesperson on the order. Who sends the quote becomes `assigned_sales_id`.

Admin **Cover for leave** on Users moves open customers, quotes, and orders from one salesperson to another (`reassign_sales_cover`). A single order can be moved with **Reassign** on the order page.

| Permission | sales | accounts | procurement | store | admin |
| --- | --- | --- | --- | --- | --- |
| customers.read / .write | yes | read | read | read | yes |
| quotes.create / .revise / .submit | yes | — | — | — | yes |
| quotes.approve / .reject | — | yes | — | — | yes |
| quotes.send_to_customer | yes | — | — | — | yes |
| quotes.read_margin | — | yes | — | — | yes |
| payments.record | yes | — | — | yes | yes |
| payments.verify | — | yes | — | — | yes |
| orders.read | floor | yes | activated+ | received+ | yes |
| orders.send_to_vendor | — | — | yes | — | yes |
| fulfillment.update | — | — | yes | receive | yes |
| deliveries.complete | — | — | — | if unlocked | yes |
| admin.manage | — | — | — | — | yes |

