"use client";

import { useActionState, useState } from "react";
import {
  createStaffAction,
  resetStaffPasswordAction,
  updateStaffAction,
  type AdminActionState,
} from "@/app/actions/admin";
import {
  FormSheet,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/app/form-sheet";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { roleLabel } from "@/lib/auth/nav";
import { APP_ROLES, type AppRole } from "@/lib/workflow/types";
import { FormError } from "@/components/app/form-error";
import { NativeSelect } from "@/components/ui/native-select";

const STAFF_ROLES: AppRole[] = ["sales", "accounts", "operations", "admin"];

export function CreateStaffForm() {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    createStaffAction,
    {},
  );

  return (
    <FormSheet
      title="Add user"
      description="Creates a login. Extra hats (Also cover) add Saturday permissions without changing the primary role. Share the password with them directly."
      trigger={
        <span className={cn(buttonVariants(), "w-full")}>
          Add user
        </span>
      }
    >
      <form action={action} className="flex min-h-0 flex-1 flex-col">
        <FormSheetBody className="flex flex-col gap-3">
          <StaffFields />
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              minLength={8}
              required
              className="mt-2 h-11 min-h-11"
            />
          </div>
          {state.error ? (
            <FormError>
              {state.error}
            </FormError>
          ) : null}
        </FormSheetBody>
        <FormSheetFooter>
          <Button type="submit" disabled={pending} size="lg" className="w-full">
            {pending ? "Saving…" : "Create user"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}

export function EditStaffForm({
  user,
}: {
  user: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    role: AppRole;
    roles: AppRole[];
    is_active: boolean;
  };
}) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    updateStaffAction,
    {},
  );
  const [resetState, resetAction, resetPending] = useActionState<
    AdminActionState,
    FormData
  >(resetStaffPasswordAction, {});
  const extras = user.roles.filter((role) => role !== user.role);

  return (
    <FormSheet
      title="Edit user"
      description={user.email ?? "Update name, roles, or access."}
      triggerClassName="w-auto"
      trigger={
        <span className={buttonVariants({ variant: "outline", size: "sm" })}>
          Edit
        </span>
      }
    >
      <form action={action} className="flex min-h-0 flex-1 flex-col">
        <input type="hidden" name="user_id" value={user.id} />
        <FormSheetBody className="flex flex-col gap-3">
          <StaffFields
            defaultName={user.full_name}
            defaultEmail={user.email ?? ""}
            defaultPhone={user.phone ?? ""}
            defaultRole={user.role}
            extraRoles={extras}
            emailLocked
          />
          <div>
            <Label htmlFor={`status-${user.id}`}>Status</Label>
            <NativeSelect
              id={`status-${user.id}`}
              name="is_active"
              defaultValue={user.is_active ? "true" : "false"}
              wrapperClassName="mt-2"
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </NativeSelect>
          </div>
          {state.error ? (
            <FormError>
              {state.error}
            </FormError>
          ) : null}
        </FormSheetBody>
        <FormSheetFooter>
          <Button type="submit" disabled={pending} size="lg" className="w-full">
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </FormSheetFooter>
      </form>
      <form action={resetAction} className="border-t border-surface-variant px-5 py-4">
        <input type="hidden" name="user_id" value={user.id} />
        <input type="hidden" name="email" value={user.email ?? ""} />
        {resetState.credentials?.[0] ? (
          <p className="mb-3 rounded-xl bg-surface-container-low px-3 py-2.5 text-body-sm">
            New password for {resetState.credentials[0].email}:{" "}
            <span className="font-mono font-semibold">
              {resetState.credentials[0].password}
            </span>
          </p>
        ) : null}
        {resetState.error ? (
          <FormError className="mb-2">{resetState.error}</FormError>
        ) : null}
        <Button
          type="submit"
          variant="outline"
          disabled={resetPending}
          className="w-full"
        >
          {resetPending ? "Resetting…" : "Generate new password"}
        </Button>
      </form>
    </FormSheet>
  );
}

function StaffFields({
  defaultName = "",
  defaultEmail = "",
  defaultPhone = "",
  defaultRole = "sales",
  extraRoles = [],
  emailLocked = false,
}: {
  defaultName?: string;
  defaultEmail?: string;
  defaultPhone?: string;
  defaultRole?: AppRole;
  extraRoles?: AppRole[];
  emailLocked?: boolean;
}) {
  const [primary, setPrimary] = useState<AppRole>(defaultRole);
  const roleOptions = Array.from(new Set<AppRole>([...STAFF_ROLES, defaultRole]));

  return (
    <>
      <div>
        <Label htmlFor="full_name">Full name</Label>
        <Input
          id="full_name"
          name="full_name"
          required
          defaultValue={defaultName}
          className="mt-2 h-11 min-h-11"
        />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required={!emailLocked}
          defaultValue={defaultEmail}
          readOnly={emailLocked}
          className="mt-2 h-11 min-h-11"
        />
      </div>
      <div>
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={defaultPhone}
          className="mt-2 h-11 min-h-11"
        />
      </div>
      <div>
        <Label htmlFor="role">Primary role</Label>
        <NativeSelect
          id="role"
          name="role"
          value={primary}
          onChange={(e) => setPrimary(e.target.value as AppRole)}
          wrapperClassName="mt-2"
        >
          {roleOptions.map((role) => (
            <option key={role} value={role}>
              {roleLabel(role)}
            </option>
          ))}
        </NativeSelect>
      </div>
      <fieldset>
        <legend className="text-sm font-medium">Also cover</legend>
        <p className="mt-1 text-xs text-on-surface-variant">
          Extra hats for Saturdays — permissions are combined.
        </p>
        <ul className="mt-2 flex flex-col gap-2">
          {APP_ROLES.filter((role) => role !== primary).map((role) => (
            <li key={role} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="extra_roles"
                value={role}
                defaultChecked={extraRoles.includes(role)}
              />
              {roleLabel(role)}
            </li>
          ))}
        </ul>
      </fieldset>
    </>
  );
}
