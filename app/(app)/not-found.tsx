import { AppLink } from "@/components/app/app-link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-headline-md text-on-surface">Not found</h1>
      <p className="mt-2 text-body-sm text-on-surface-variant">
        That record isn’t available, or you don’t have access.
      </p>
      <AppLink href="/home" className={`${buttonVariants({ variant: "outline" })} mt-5`}>
        Back home
      </AppLink>
    </div>
  );
}
