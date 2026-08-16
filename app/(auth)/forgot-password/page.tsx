import { ForgotPasswordForm } from "@/app/(auth)/forgot-password/forgot-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Forgot password"
      description="We email a reset link if that address has a login."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
