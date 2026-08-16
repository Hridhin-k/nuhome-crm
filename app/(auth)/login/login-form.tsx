"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {next ? <input type="hidden" name="next" value={next} /> : null}

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

      <div className="flex flex-col gap-2">
        <Label htmlFor="password" className="text-label-caps text-on-surface-variant">
          Password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          className="h-11 min-h-11 text-base"
        />
      </div>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full" size="lg">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <a
        href="/forgot-password"
        className="text-center text-sm text-on-surface-variant"
      >
        Forgot password?
      </a>
    </form>
  );
}
