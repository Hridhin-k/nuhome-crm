import { ConvertLeadButton, LeadForm } from "@/components/leads/lead-form";
import { Notice } from "@/components/app/notice";
import { PageFrame } from "@/components/app/page-frame";
import { PageHeader } from "@/components/app/page-header";
import { listLeads } from "@/lib/api/leads";
import { rel } from "@/lib/api/rel";
import { requirePermission } from "@/lib/auth/guards";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const [, { notice }, leads] = await Promise.all([
    requirePermission("leads.manage"),
    searchParams,
    listLeads(),
  ]);

  return (
    <PageFrame>
      <PageHeader
        title="Leads"
        description="Meeting and follow-up book. Convert a lead when they become a customer."
        action={<LeadForm />}
      />
      {notice === "saved" ? <Notice>Lead saved.</Notice> : null}
      <ul className="flex flex-col gap-3">
        {leads.map((lead) => {
          const owner = rel(lead.profiles);
          return (
            <li
              key={lead.id}
              className="rounded-lg border border-outline-variant bg-card p-4 shadow-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-subheading">{lead.name ?? "Lead"}</p>
                  <p className="mt-1 text-body-sm text-on-surface-variant">
                    {[lead.firm, lead.place, lead.phone, lead.follow_up_on, owner?.full_name]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {lead.remarks ? (
                    <p className="mt-2 text-sm">{lead.remarks}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <LeadForm
                    lead={{
                      id: lead.id,
                      name: lead.name,
                      phone: lead.phone,
                      firm: lead.firm,
                      place: lead.place,
                      remarks: lead.remarks,
                      follow_up_on: lead.follow_up_on,
                      source: lead.source,
                    }}
                  />
                  {!lead.customer_id ? <ConvertLeadButton leadId={lead.id} /> : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </PageFrame>
  );
}
