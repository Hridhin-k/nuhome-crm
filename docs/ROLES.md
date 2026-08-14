# Roles and permissions

Stored in `roles`, `permissions`, `role_permissions`. `profiles.role` is the assignment.

| Permission | sales | accounts | procurement | store | admin |
| --- | --- | --- | --- | --- | --- |
| customers.read / .write | yes | read | read | read | yes |
| quotes.create / .revise / .submit | yes | — | — | — | yes |
| quotes.approve / .reject | — | yes | — | — | yes |
| quotes.send_to_customer | yes | — | — | — | yes |
| quotes.read_margin | — | yes | — | — | yes |
| payments.record | yes | — | — | yes | yes |
| payments.verify | — | yes | — | — | yes |
| orders.read | own | yes | activated+ | received+ | yes |
| orders.send_to_vendor | — | — | yes | — | yes |
| fulfillment.update | — | — | yes | receive | yes |
| deliveries.complete | — | — | — | if unlocked | yes |
| admin.manage | — | — | — | — | yes |

Sales cannot approve their own quote or verify/reject a payment they recorded, including when they also have a second role — Phase 2 RLS uses the acting permission, not a UI flag.
