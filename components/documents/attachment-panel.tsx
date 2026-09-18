import type { AttachmentRow } from "@/lib/api/documents";
import type { AttachmentKind } from "@/lib/validation/documents";

/** File / measurement upload panels are hidden across the app for now. */
export function AttachmentPanel(_props: {
  entityType: "customer" | "quote" | "order" | "vendor_order";
  entityId: string;
  returnTo: string;
  files: AttachmentRow[];
  canUpload: boolean;
  title?: string;
  description?: string;
  defaultKind?: AttachmentKind;
}) {
  return null;
}
