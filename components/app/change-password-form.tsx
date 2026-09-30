"use client";

import { useActionState } from "react";
import {
  changePasswordAction,
  type LoginState,
} from "@/app/(auth)/login/actions";
import {
  FormSheet,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/app/form-sheet";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/app/form-error";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    changePasswordAction,
    {},
  );

  return (
    <FormSheet
      title="Change password"
      description="Enter your current password, then a new one (8+ characters)."
      trigger={
        <span className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}>
          Change password
        </span>
      }
    >
      <form action={action} className="flex min-h-0 flex-1 flex-col">
        <FormSheetBody className="flex flex-col gap-3">
          <Label htmlFor="current_password">Current password</Label>
          <Input
            id="current_password"
            name="current_password"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            className="h-11 min-h-11"
          />
          <Label htmlFor="new_password">New password</Label>
          <Input
            id="new_password"
            name="new_password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="h-11 min-h-11"
          />
          <Label htmlFor="confirm_password">Confirm new password</Label>
          <Input
            id="confirm_password"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="h-11 min-h-11"
          />
          {state.error ? (
            <FormError>{state.error}</FormError>
          ) : null}
          {state.notice ? (
            <p className="text-sm text-on-surface">{state.notice}</p>
          ) : null}
        </FormSheetBody>
        <FormSheetFooter>
          <Button type="submit" disabled={pending} size="lg" className="w-full">
            {pending ? "Saving…" : "Update password"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}
