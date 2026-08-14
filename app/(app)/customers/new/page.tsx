import { CustomerForm } from "@/components/customers/customer-form";
import { PageHeader } from "@/components/app/page-header";
import { requirePermission } from "@/lib/auth/guards";

export default async function NewCustomerPage() {
  await requirePermission("customers.write");
  return (
    <div>
      <PageHeader
        title="New customer"
        description="Keep it to name and phone if you’re on the floor."
      />
      <CustomerForm defaultOpen />
    </div>
  );
}
