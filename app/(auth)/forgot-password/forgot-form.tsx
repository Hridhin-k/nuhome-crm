"use client";

import { useActionState } from "react";
import {
  forgotPasswordAction,
  type LoginState,
} from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppLink } from "@/components/app/app-link";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    forgotPasswordAction,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email" className="text-label-caps text-on-surface-variant">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="h-11 min-h-11 text-base"
        />
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.notice ? (
        <p className="text-sm text-on-surface" role="status">
          {state.notice}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full" size="lg">
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <AppLink href="/login" className="text-center text-sm text-on-surface-variant">
        Back to sign in
      </AppLink>
    </form>
  );
}
