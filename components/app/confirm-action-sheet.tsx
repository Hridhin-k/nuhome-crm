"use client";

import {
  FormSheet,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/app/form-sheet";
import { SubmitButton } from "@/components/app/submit-button";

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
        <span className="inline-flex h-12 min-h-12 w-full items-center justify-center rounded-lg bg-primary px-6 text-[15px] font-medium text-on-primary transition-transform active:scale-[0.98] motion-reduce:transition-none">
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
          <SubmitButton
            idleLabel={confirmLabel}
            pendingLabel={`${confirmLabel.replace(/\.?$/, "")}…`}
            size="lg"
            className="w-full"
          />
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}
