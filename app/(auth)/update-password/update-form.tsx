"use client";

import { useActionState } from "react";
import {
  setNewPasswordAction,
  type LoginState,
} from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UpdatePasswordForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    setNewPasswordAction,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="h-11 min-h-11"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm_password">Confirm password</Label>
        <Input
          id="confirm_password"
          name="confirm_password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="h-11 min-h-11"
        />
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full" size="lg">
        {pending ? "Saving…" : "Save password"}
      </Button>
    </form>
  );
}
