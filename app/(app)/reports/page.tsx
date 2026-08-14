import { InboxList } from "@/components/app/inbox-list";
import { OperationsPipeline } from "@/components/app/operations-pipeline";
import { PageFrame } from "@/components/app/page-frame";
import { PageHeader } from "@/components/app/page-header";
import { getOperationsSnapshot } from "@/lib/api/dashboard";
import { requirePermission } from "@/lib/auth/guards";

export default async function ReportsPage() {
  const [, snapshot] = await Promise.all([
    requirePermission("admin.manage"),
    getOperationsSnapshot(),
  ]);

  return (
    <PageFrame>
      <PageHeader
        title="Reports"
        hideTitleOnMobile
        description="Share of open work at each stage. Open a bar to act."
      />
      <OperationsPipeline
        stages={snapshot.stages}
        open={snapshot.open}
        customers={snapshot.customers}
        delivered={snapshot.delivered}
      />
      <div className="mt-5">
        <InboxList items={snapshot.queues} />
      </div>
    </PageFrame>
  );
}
