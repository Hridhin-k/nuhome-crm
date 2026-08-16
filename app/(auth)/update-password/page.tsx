import { UpdatePasswordForm } from "@/app/(auth)/update-password/update-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default function UpdatePasswordPage() {
  return (
    <AuthShell
      title="Set a new password"
      description="Choose a password at least 8 characters long."
    >
      <UpdatePasswordForm />
    </AuthShell>
  );
}
