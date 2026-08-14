"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";

export function SubmitButton({
  idleLabel,
  pendingLabel,
  ...props
}: Omit<ComponentProps<typeof Button>, "type"> & {
  idleLabel: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? pendingLabel : idleLabel}
    </Button>
  );
}
