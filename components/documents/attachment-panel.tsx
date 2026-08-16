"use client";

import { useActionState } from "react";
import {
  deleteAttachmentAction,
  uploadAttachmentAction,
  type DocumentActionState,
} from "@/app/actions/documents";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { AttachmentRow } from "@/lib/api/documents";
import type { AttachmentKind } from "@/lib/validation/documents";

const KIND_LABEL: Record<AttachmentKind, string> = {
  measurement: "Measurement",
  drawing: "Drawing",
  photo: "Photo",
  file: "Other",
};

export function AttachmentPanel({
  entityType,
  entityId,
  returnTo,
  files,
  canUpload,
}: {
  entityType: "customer" | "quote" | "order";
  entityId: string;
  returnTo: string;
  files: AttachmentRow[];
  canUpload: boolean;
}) {
  const [state, action, pending] = useActionState<DocumentActionState, FormData>(
    uploadAttachmentAction,
    {},
  );

  return (
    <section className="rounded-2xl border border-outline-variant bg-card p-4 shadow-card">
      <h2 className="text-subheading text-on-surface">Files</h2>
      <p className="mt-1 text-body-sm text-on-surface-variant">
        Measurement sheets, drawings, and photos that used to live on WhatsApp.
      </p>

      {files.length === 0 ? (
        <p className="mt-3 text-sm text-on-surface-variant">No files yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-surface-variant">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex min-w-0 items-center justify-between gap-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-body-md text-on-surface">
                  {file.file_name ?? "File"}
                </p>
                <p className="text-body-sm text-on-surface-variant">
                  {KIND_LABEL[(file.kind as AttachmentKind) ?? "file"] ?? file.kind}
                  {" · "}
                  {new Date(file.created_at).toLocaleDateString("en-IN")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {file.url ? (
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary underline underline-offset-2"
                  >
                    Open
                  </a>
                ) : null}
                {canUpload ? (
                  <form action={deleteAttachmentAction}>
                    <input type="hidden" name="id" value={file.id} />
                    <input type="hidden" name="return_to" value={returnTo} />
                    <button
                      type="submit"
                      className="text-sm text-destructive"
                      aria-label={`Remove ${file.file_name ?? "file"}`}
                    >
                      Remove
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canUpload ? (
        <form action={action} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="entity_type" value={entityType} />
          <input type="hidden" name="entity_id" value={entityId} />
          <input type="hidden" name="return_to" value={returnTo} />
          <div>
            <Label htmlFor={`kind-${entityId}`}>Type</Label>
            <select
              id={`kind-${entityId}`}
              name="kind"
              defaultValue="measurement"
              className="mt-2 h-11 w-full rounded-lg border border-outline-variant bg-surface px-3"
            >
              <option value="measurement">Measurement sheet</option>
              <option value="drawing">Drawing</option>
              <option value="photo">Photo</option>
              <option value="file">Other file</option>
            </select>
          </div>
          <div>
            <Label htmlFor={`file-${entityId}`}>PDF or image</Label>
            <input
              id={`file-${entityId}`}
              name="file"
              type="file"
              required
              accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
              className="mt-2 w-full text-sm"
            />
          </div>
          {state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
          <Button type="submit" variant="bordered" disabled={pending}>
            {pending ? "Uploading…" : "Upload file"}
          </Button>
        </form>
      ) : null}
    </section>
  );
}
