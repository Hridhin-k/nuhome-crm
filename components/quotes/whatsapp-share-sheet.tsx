"use client";

import { useState, useTransition } from "react";
import { logWhatsAppShareAction } from "@/app/actions/workflow";
import {
  FormSheet,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/app/form-sheet";
import { Button } from "@/components/ui/button";
import { formatInrExact } from "@/lib/format/money";
import { isLocalSiteUrl } from "@/lib/site-url-shared";

function normalizeWhatsAppPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function buildWhatsAppMessage(input: {
  customerName: string;
  quoteNumber: string;
  versionNumber: number;
  total: number;
  quoteUrl: string;
}) {
  const firstName = input.customerName.split(" ")[0] || input.customerName;
  return `Hi ${firstName},

Please find your approved quotation ${input.quoteNumber} (Version ${input.versionNumber}) for ${formatInrExact(input.total)}.

${input.quoteUrl}

We look forward to serving you.

Thank you.
— Nuhome`;
}

export function WhatsAppShareSheet({
  quoteId,
  customerName,
  customerPhone,
  quoteNumber,
  versionNumber,
  total,
  quoteUrl,
}: {
  quoteId: string;
  customerName: string;
  customerPhone?: string | null;
  quoteNumber: string;
  versionNumber: number;
  total: number;
  quoteUrl: string;
}) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const localDevLink = isLocalSiteUrl(quoteUrl);
  const message = buildWhatsAppMessage({
    customerName,
    quoteNumber,
    versionNumber,
    total,
    quoteUrl,
  });

  function openWhatsApp() {
    setError(undefined);
    startTransition(async () => {
      const result = await logWhatsAppShareAction(quoteId);
      if (result.error) {
        setError(result.error);
        return;
      }
      const text = encodeURIComponent(message);
      const href = customerPhone
        ? `https://wa.me/${normalizeWhatsAppPhone(customerPhone)}?text=${text}`
        : `https://wa.me/?text=${text}`;
      window.open(href, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <FormSheet
      title="Send via WhatsApp"
      description="Review the message before opening WhatsApp."
      trigger={
        <span className="inline-flex h-12 min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-[#25D366]/30 bg-[#25D366]/10 px-6 text-[15px] font-medium text-[#128C7E]">
          <span aria-hidden>💬</span>
          Send via WhatsApp
        </span>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <FormSheetBody className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-on-surface-variant">Customer</dt>
              <dd className="font-medium">{customerName}</dd>
            </div>
            <div>
              <dt className="text-on-surface-variant">Quote</dt>
              <dd className="font-medium">{quoteNumber}</dd>
            </div>
            <div>
              <dt className="text-on-surface-variant">Version</dt>
              <dd className="font-medium">v{versionNumber}</dd>
            </div>
            <div>
              <dt className="text-on-surface-variant">Total</dt>
              <dd className="font-semibold">{formatInrExact(total)}</dd>
            </div>
          </dl>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Message preview
            </p>
            <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-surface-variant bg-surface p-4 text-sm leading-relaxed text-on-surface">
              {message}
            </pre>
          </div>

          {localDevLink ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-on-surface">
              This link uses <strong>localhost</strong> and will not work for
              customers on WhatsApp. Set{" "}
              <code className="text-xs">NEXT_PUBLIC_CUSTOMER_APP_URL</code> to
              your live site (e.g. https://nuhome-crm.vercel.app) and restart
              the dev server.
            </p>
          ) : null}

          {!customerPhone ? (
            <p className="text-sm text-on-surface-variant">
              No phone number on file — WhatsApp will open so you can choose a
              contact.
            </p>
          ) : null}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </FormSheetBody>
        <FormSheetFooter>
          <Button
            type="button"
            size="lg"
            className="w-full bg-[#25D366] text-white hover:bg-[#1da851]"
            disabled={pending}
            onClick={openWhatsApp}
          >
            {pending ? "Opening WhatsApp…" : "Open WhatsApp"}
          </Button>
        </FormSheetFooter>
      </div>
    </FormSheet>
  );
}
