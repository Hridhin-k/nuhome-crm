"use client";

import { useActionState } from "react";
import type { AdminActionState } from "@/app/actions/admin";
import {
  FormSheet,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/app/form-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toCsv } from "@/lib/csv";

export function CsvImportSheet({
  title,
  description,
  templateName,
  templateHeaders,
  templateRows,
  action,
}: {
  title: string;
  description: string;
  templateName: string;
  templateHeaders: string[];
  templateRows: string[][];
  action: (
    prev: AdminActionState,
    formData: FormData,
  ) => Promise<AdminActionState>;
}) {
  const [state, formAction, pending] = useActionState<AdminActionState, FormData>(
    action,
    {},
  );

  function downloadTemplate() {
    const csv = toCsv(templateHeaders, templateRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = templateName;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadCredentials() {
    if (!state.credentials?.length) return;
    const csv = toCsv(
      ["email", "password"],
      state.credentials.map((row) => [row.email, row.password]),
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "nuhome-new-logins.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <FormSheet
      title={title}
      description={description}
      trigger={
        <span className="inline-flex h-11 min-h-11 items-center rounded-lg border border-outline-variant bg-surface-container-lowest px-4 text-[13px] font-semibold tracking-[0.05em] text-primary uppercase">
          Import CSV
        </span>
      }
    >
      <form action={formAction} className="flex min-h-0 flex-1 flex-col">
        <FormSheetBody className="flex flex-col gap-4">
          <div>
            <Label htmlFor="file">CSV file</Label>
            <Input
              id="file"
              name="file"
              type="file"
              accept=".csv,text/csv"
              required
              className="mt-2 h-11 min-h-11 pt-2"
            />
          </div>
          <button
            type="button"
            onClick={downloadTemplate}
            className="text-left text-sm text-secondary underline-offset-4 hover:underline"
          >
            Download sample CSV
          </button>
          {state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
          {state.notice ? (
            <p className="text-sm text-on-surface">
              {state.notice}
              {state.skipped ? ` ${state.skipped} skipped (already exist).` : ""}
              {state.failed ? ` ${state.failed} row${state.failed === 1 ? "" : "s"} failed.` : ""}
            </p>
          ) : null}
          {state.credentials && state.credentials.length > 0 ? (
            <div className="rounded-lg border border-surface-variant bg-surface p-3">
              <p className="text-sm font-medium">
                Generated passwords (download now — they will not be shown again)
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {state.credentials.map((row) => (
                  <li key={row.email}>
                    {row.email} · {row.password}
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={downloadCredentials}
              >
                Download logins CSV
              </Button>
            </div>
          ) : null}
          {state.rowErrors && state.rowErrors.length > 0 ? (
            <ul className="space-y-1 text-sm text-destructive">
              {state.rowErrors.slice(0, 12).map((item) => (
                <li key={`${item.row}-${item.message}`}>
                  Row {item.row}: {item.message}
                </li>
              ))}
            </ul>
          ) : null}
        </FormSheetBody>
        <FormSheetFooter>
          <Button type="submit" disabled={pending} size="lg" className="w-full">
            {pending ? "Importing…" : "Import"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}
