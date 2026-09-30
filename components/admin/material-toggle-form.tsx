"use client";

import { useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toggleMaterialAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";

function ToggleSubmit({ active }: { active: boolean }) {
  const { pending } = useFormStatus();

  useEffect(() => {
    if (pending && typeof window !== "undefined") {
      window.dispatchEvent(new Event("nuhome:action-pending"));
    }
  }, [pending]);

  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? (active ? "Hiding…" : "Restoring…") : active ? "Hide" : "Restore"}
    </Button>
  );
}

export function MaterialToggleForm({
  id,
  active,
}: {
  id: string;
  active: boolean;
}) {
  return (
    <form action={toggleMaterialAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="is_active" value={active ? "false" : "true"} />
      <ToggleSubmit active={active} />
    </form>
  );
}
