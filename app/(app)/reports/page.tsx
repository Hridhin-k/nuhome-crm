import { OperationsPipeline } from "@/components/app/operations-pipeline";
import { PageHeader } from "@/components/app/page-header";
import { QueueCard } from "@/components/app/queue-card";
import { getOperationsSnapshot } from "@/lib/api/dashboard";
import { requirePermission } from "@/lib/auth/guards";

export default async function ReportsPage() {
  await requirePermission("admin.manage");
  const snapshot = await getOperationsSnapshot();

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Share of open work at each stage. Open a bar to act."
      />
      <OperationsPipeline
        stages={snapshot.stages}
        open={snapshot.open}
        customers={snapshot.customers}
        delivered={snapshot.delivered}
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {snapshot.queues.map((card) => (
          <QueueCard key={card.title} {...card} />
        ))}
      </div>
    </div>
  );
}
