"use client";

import { useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toggleMaterialAction } from "@/app/actions/admin";

function ToggleSubmit({ active }: { active: boolean }) {
  const { pending } = useFormStatus();

  useEffect(() => {
    if (pending && typeof window !== "undefined") {
      window.dispatchEvent(new Event("nuhome:action-pending"));
    }
  }, [pending]);

  return (
    <button
      type="submit"
      disabled={pending}
      className="h-9 rounded-lg border border-border px-3 text-[13px] font-medium text-on-surface disabled:opacity-50"
    >
      {pending ? (active ? "Hiding…" : "Restoring…") : active ? "Hide" : "Restore"}
    </button>
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
