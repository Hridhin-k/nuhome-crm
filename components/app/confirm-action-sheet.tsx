"use client";

import {
  FormSheet,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/app/form-sheet";
import { SubmitButton } from "@/components/app/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ConfirmActionSheet({
  title,
  description,
  triggerLabel,
  confirmLabel,
  action,
  details,
  triggerClassName,
  onSubmit,
}: {
  title: string;
  description: string;
  triggerLabel: string;
  confirmLabel: string;
  action: (formData: FormData) => void | Promise<void>;
  details?: string;
  triggerClassName?: string;
  onSubmit?: () => void;
}) {
  return (
    <FormSheet
      title={title}
      description={description}
      trigger={
        <span
          className={cn(
            buttonVariants({ size: "lg" }),
            "w-full justify-center text-center",
            triggerClassName,
          )}
        >
          {triggerLabel}
        </span>
      }
    >
      <form
        action={action}
        onSubmit={onSubmit}
        className="flex min-h-0 flex-1 flex-col"
      >
        <FormSheetBody>
          <p className="text-body-sm leading-snug text-on-surface-variant">
            {details ?? "Confirm this step to continue the order."}
          </p>
        </FormSheetBody>
        <FormSheetFooter>
          <SubmitButton
            idleLabel={confirmLabel}
            pendingLabel={`${confirmLabel.replace(/\.?$/, "")}…`}
            size="lg"
            className="w-full justify-center text-center"
          />
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}
