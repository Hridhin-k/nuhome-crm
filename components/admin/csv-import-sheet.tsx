"use client";

import { useActionState, type ReactNode } from "react";
import type { AdminActionState } from "@/app/actions/admin";
import {
  FormSheet,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/app/form-sheet";
import { Download, Upload } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/app/form-error";
import { toCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";

export function CsvImportSheet({
  title,
  description,
  templateName,
  templateHeaders,
  templateRows,
  help,
  action,
}: {
  title: string;
  description: string;
  templateName: string;
  templateHeaders: string[];
  templateRows: string[][];
  help?: ReactNode;
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
    // Excel only reads the file as UTF-8 when it starts with a BOM.
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
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
        <span className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
          <Upload aria-hidden />
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
              className="mt-2 py-1.5"
            />
          </div>
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex w-fit items-center gap-1.5 rounded-md text-body-sm font-medium text-secondary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <Download className="size-4" aria-hidden />
            Download sample CSV
          </button>
          {help ? <div className="text-body-sm text-on-surface-variant">{help}</div> : null}
          {state.error ? (
            <FormError>
              <p className="font-medium">{state.error}</p>
              {state.rowErrors && state.rowErrors.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {state.rowErrors.slice(0, 20).map((item) => (
                    <li key={`${item.row}-${item.message}`}>
                      Row {item.row}: {item.message}
                    </li>
                  ))}
                  {state.rowErrors.length > 20 ? (
                    <li>…and {state.rowErrors.length - 20} more rows</li>
                  ) : null}
                </ul>
              ) : null}
            </FormError>
          ) : null}
          {state.notice ? (
            <p role="status" className="text-body-sm text-on-surface">
              {state.notice}
              {state.skipped ? ` ${state.skipped} skipped (already exist).` : ""}
              {state.failed ? ` ${state.failed} row${state.failed === 1 ? "" : "s"} failed.` : ""}
            </p>
          ) : null}
          {state.credentials && state.credentials.length > 0 ? (
            <div className="rounded-xl border border-outline-variant bg-surface-container-low p-3">
              <p className="text-subheading text-on-surface">
                Generated passwords (download now — they will not be shown again)
              </p>
              <ul className="mt-2 space-y-1 text-body-sm">
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
          {!state.error && state.rowErrors && state.rowErrors.length > 0 ? (
            <FormError>
              <ul className="space-y-1">
                {state.rowErrors.slice(0, 20).map((item) => (
                  <li key={`${item.row}-${item.message}`}>
                    Row {item.row}: {item.message}
                  </li>
                ))}
                {state.rowErrors.length > 20 ? (
                  <li>…and {state.rowErrors.length - 20} more rows</li>
                ) : null}
              </ul>
            </FormError>
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
