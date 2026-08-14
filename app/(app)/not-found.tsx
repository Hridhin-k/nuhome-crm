import { AppLink } from "@/components/app/app-link";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="mt-2 text-sm text-on-surface-variant">
        That record isn’t available, or you don’t have access.
      </p>
      <AppLink href="/home" className="mt-4 inline-block text-sm underline">
        Back home
      </AppLink>
    </div>
  );
}
