export async function sendResendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "Email is not configured. Add RESEND_API_KEY (and optional RESEND_FROM_EMAIL) in Vercel env, then redeploy.",
    );
  }
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() || "Nuhome <quotes@nuhome.in>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  });
  const body = (await response.json().catch(() => null)) as
    | { message?: string; name?: string }
    | null;
  if (!response.ok) {
    throw new Error(
      body?.message ||
        "Resend rejected the message. Check RESEND_FROM_EMAIL is a verified domain.",
    );
  }
}
