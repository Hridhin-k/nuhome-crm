import { LoginForm } from "@/app/(auth)/login/login-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <AuthShell
      title="Sign in"
      description="Quotes, payments, and fulfillment — on your phone first."
    >
      <LoginForm next={next} />
    </AuthShell>
  );
}
