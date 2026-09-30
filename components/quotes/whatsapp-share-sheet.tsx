"use client";

import { useState, useTransition } from "react";
import { logWhatsAppShareAction } from "@/app/actions/workflow";
import {
  FormSheet,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/app/form-sheet";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatInrExact } from "@/lib/format/money";
import { isLocalSiteUrl } from "@/lib/site-url-shared";
import { cn } from "@/lib/utils";
import { FormError } from "@/components/app/form-error";

function normalizeWhatsAppPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

type ShareDocument = "quote" | "invoice";

function buildWhatsAppMessage(input: {
  document: ShareDocument;
  customerName: string;
  quoteNumber: string;
  versionNumber: number;
  total: number;
  url: string;
}) {
  const firstName = input.customerName.split(" ")[0] || input.customerName;
  const intro =
    input.document === "invoice"
      ? `Please find your bill for quotation ${input.quoteNumber}, total ${formatInrExact(input.total)}. You can open, print, or save it as a PDF.`
      : `Please find your approved quotation ${input.quoteNumber} (Version ${input.versionNumber}) for ${formatInrExact(input.total)}. You can open, print, or save it as a PDF.`;
  return `Hi ${firstName},

${intro}

${input.url}

We look forward to serving you.

Thank you.
— Nuhome`;
}

export function WhatsAppShareSheet({
  quoteId,
  document = "quote",
  customerName,
  customerPhone,
  quoteNumber,
  versionNumber,
  total,
  quoteUrl,
  triggerLabel,
  triggerClassName,
}: {
  quoteId: string;
  document?: ShareDocument;
  customerName: string;
  customerPhone?: string | null;
  quoteNumber: string;
  versionNumber: number;
  total: number;
  /** Link to the quotation, or to the bill when document is "invoice". */
  quoteUrl: string;
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const localDevLink = isLocalSiteUrl(quoteUrl);
  const isInvoice = document === "invoice";
  const message = buildWhatsAppMessage({
    document,
    customerName,
    quoteNumber,
    versionNumber,
    total,
    url: quoteUrl,
  });

  function openWhatsApp() {
    setError(undefined);
    startTransition(async () => {
      const result = await logWhatsAppShareAction(quoteId, document);
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
      title={isInvoice ? "Send bill on WhatsApp" : "Send quotation on WhatsApp"}
      description="Review the message before opening WhatsApp."
      trigger={
        <span
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "w-full justify-center text-center",
            triggerClassName,
          )}
        >
          {triggerLabel ?? (isInvoice ? "WhatsApp bill" : "WhatsApp quotation")}
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
            <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-outline-variant bg-surface-container-low p-3 font-sans text-body-sm text-on-surface">
              {message}
            </pre>
          </div>

          {localDevLink ? (
            <p className="rounded-xl border border-warning/30 bg-warning-container px-3 py-2.5 text-body-sm text-on-surface">
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
            <FormError>
              {error}
            </FormError>
          ) : null}
        </FormSheetBody>
        <FormSheetFooter>
          <Button
            type="button"
            size="lg"
            className="w-full justify-center text-center bg-[#25D366] text-white hover:bg-[#1da851]"
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
