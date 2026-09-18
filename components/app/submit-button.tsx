"use client";

import { useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";

function signalActionPending() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("nuhome:action-pending"));
}

export function SubmitButton({
  idleLabel,
  pendingLabel,
  ...props
}: Omit<ComponentProps<typeof Button>, "type"> & {
  idleLabel: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  useEffect(() => {
    if (pending) signalActionPending();
  }, [pending]);

  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? pendingLabel : idleLabel}
    </Button>
  );
}

/** Call from client mutations (useActionState / useTransition) when work starts. */
export function markActionPending() {
  signalActionPending();
}
