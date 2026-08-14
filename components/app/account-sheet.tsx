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
  return (
    <FormSheet
      title={name}
      description={`${role}${email ? ` · ${email}` : ""}`}
      trigger={
        <span className="block w-full rounded-xl border border-surface-variant bg-surface-container-lowest p-5 text-left">
          <p className="text-label text-on-surface-variant">Account</p>
          <p className="mt-2 text-[18px] font-semibold tracking-[-0.19px] text-on-surface">
            {name}
          </p>
          <p className="mt-1 text-[14px] text-on-surface-variant">{email}</p>
          <p className="mt-1 text-[14px] text-secondary">{role}</p>
        </span>
      }
    >
      <form action={logoutAction} className="flex min-h-0 flex-1 flex-col">
        <FormSheetBody>
          <p className="text-[15px] leading-relaxed text-on-surface-variant">
            Signed in as {role}. Sign out to switch users.
          </p>
        </FormSheetBody>
        <FormSheetFooter>
          <Button type="submit" variant="outline" className="w-full" size="lg">
            Sign out
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}
