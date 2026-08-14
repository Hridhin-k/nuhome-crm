"use client";

import { logoutAction } from "@/app/(auth)/login/actions";
import {
  FormSheet,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/app/form-sheet";
import { Button } from "@/components/ui/button";

export function AccountSheet({
  name,
  email,
  role,
}: {
  name: string;
  email?: string;
  role: string;
}) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <FormSheet
      title={name}
      description={`${role}${email ? ` · ${email}` : ""}`}
      trigger={
        <span className="flex w-full items-center gap-3 rounded-lg border border-outline-variant bg-card p-4 text-left shadow-card">
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-container-highest text-headline-md text-primary">
            {initials || "N"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-subheading text-on-surface">
              {name}
            </span>
            <span className="mt-0.5 block truncate text-body-sm text-on-surface-variant">
              {email}
            </span>
            <span className="mt-1 inline-flex rounded-full bg-surface-container-low px-2 py-0.5 text-label-caps text-secondary">
              {role}
            </span>
          </span>
        </span>
      }
    >
      <form action={logoutAction} className="flex min-h-0 flex-1 flex-col">
        <FormSheetBody>
          <p className="text-body-sm leading-relaxed text-on-surface-variant">
            Signed in as {role}. Sign out to switch users.
          </p>
        </FormSheetBody>
        <FormSheetFooter>
          <Button type="submit" variant="bordered" className="w-full" size="lg">
            Sign out
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}
