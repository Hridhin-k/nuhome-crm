import { CompanyForm } from "@/components/documents/company-form";
import { Notice } from "@/components/app/notice";
import { PageFrame } from "@/components/app/page-frame";
import { PageHeader } from "@/components/app/page-header";
import { AdminCatalogNav } from "@/components/admin/admin-catalog-nav";
import { getCompanySettings } from "@/lib/api/documents";
import { requirePermission } from "@/lib/auth/guards";

export default async function CompanyPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const [, { notice }, company] = await Promise.all([
    requirePermission("admin.manage"),
    searchParams,
    getCompanySettings(),
  ]);

  return (
    <PageFrame width="detail">
      <PageHeader
        title="Company"
        description="Legal name and GSTIN print on tax invoices."
      />
      <AdminCatalogNav current="/company" />
      {notice === "saved" ? <Notice>Company details saved.</Notice> : null}
      <div className="rounded-lg border border-outline-variant bg-card p-4 shadow-card">
        <CompanyForm company={company} />
      </div>
    </PageFrame>
  );
}
