"use client";

import { useActionState } from "react";
import {
  saveInstallationAction,
  type DocumentActionState,
} from "@/app/actions/documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function InstallationForm({
  orderId,
  installation,
}: {
  orderId: string;
  installation: {
    scheduled_on: string;
    notes: string | null;
    status: string;
  } | null;
}) {
  const [state, action, pending] = useActionState<DocumentActionState, FormData>(
    saveInstallationAction,
    {},
  );
  const scheduledOn = installation?.scheduled_on?.slice(0, 10) ?? "";
  const done = installation?.status === "done";

  return (
    <section className="rounded-lg border border-outline-variant bg-card p-4 shadow-card">
      <h2 className="text-subheading text-on-surface">Installation</h2>
      <p className="mt-1 text-body-sm text-on-surface-variant">
        Book the carpenter after goods are handed over.
      </p>
      {done ? (
        <p className="mt-3 text-sm text-success">
          Installation marked done
          {installation?.scheduled_on
            ? ` · ${new Date(installation.scheduled_on).toLocaleDateString("en-IN")}`
            : ""}
        </p>
      ) : null}
      <form action={action} className="mt-4 flex flex-col gap-3">
        <input type="hidden" name="order_id" value={orderId} />
        <div>
          <Label htmlFor="scheduled_on">Site date</Label>
          <Input
            id="scheduled_on"
            name="scheduled_on"
            type="date"
            required
            defaultValue={scheduledOn}
            className="mt-2 h-11"
          />
        </div>
        <div>
          <Label htmlFor="install-notes">Notes</Label>
          <Textarea
            id="install-notes"
            name="notes"
            rows={2}
            defaultValue={installation?.notes ?? ""}
            className="mt-2"
            placeholder="Floor, time window, team…"
          />
        </div>
        {state.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="submit"
            name="status"
            value="scheduled"
            disabled={pending}
            variant={done ? "bordered" : "default"}
            className="flex-1"
          >
            {pending ? "Saving…" : installation ? "Update date" : "Schedule"}
          </Button>
          {installation && !done ? (
            <Button
              type="submit"
              name="status"
              value="done"
              disabled={pending}
              variant="bordered"
              className="flex-1"
            >
              Mark done
            </Button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
