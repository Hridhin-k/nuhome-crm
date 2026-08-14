import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-8 w-48 bg-surface-container" />
      <Skeleton className="h-4 w-72 bg-surface-container" />
      <Skeleton className="mt-4 h-36 w-full rounded-xl bg-surface-container" />
      <div className="mt-2 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-36 w-full rounded-xl bg-surface-container" />
        <Skeleton className="h-36 w-full rounded-xl bg-surface-container" />
        <Skeleton className="h-36 w-full rounded-xl bg-surface-container" />
      </div>
    </div>
  );
}
