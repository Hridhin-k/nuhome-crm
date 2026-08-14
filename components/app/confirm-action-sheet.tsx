"use client";

import {
  FormSheet,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/app/form-sheet";
import { Button } from "@/components/ui/button";

export function ConfirmActionSheet({
  title,
  description,
  triggerLabel,
  confirmLabel,
  action,
  details,
}: {
  title: string;
  description: string;
  triggerLabel: string;
  confirmLabel: string;
  action: (formData: FormData) => void | Promise<void>;
  details?: string;
}) {
  return (
    <FormSheet
      title={title}
      description={description}
      trigger={
        <span className="inline-flex h-12 min-h-12 w-full items-center justify-center rounded-lg bg-primary px-6 text-[15px] font-medium text-on-primary">
          {triggerLabel}
        </span>
      }
    >
      <form action={action} className="flex min-h-0 flex-1 flex-col">
        <FormSheetBody>
          <p className="text-[15px] leading-relaxed text-on-surface-variant">
            {details ?? "Confirm this step to continue the order."}
          </p>
        </FormSheetBody>
        <FormSheetFooter>
          <Button type="submit" size="lg" className="w-full">
            {confirmLabel}
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}
