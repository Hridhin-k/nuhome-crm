"use client";

import { useState, useTransition } from "react";
import { sendQuoteEmailAction } from "@/app/actions/workflow";
import {
  FormSheet,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/app/form-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { quoteShareMessage } from "@/lib/quotes/share-message";

export function EmailShareSheet({
  quoteId,
  customerName,
  customerEmail,
  quoteNumber,
  versionNumber,
  total,
  quoteUrl,
}: {
  quoteId: string;
  customerName: string;
  customerEmail?: string | null;
  quoteNumber: string;
  versionNumber: number;
  total: number;
  quoteUrl: string;
}) {
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [pending, start] = useTransition();
  const message = quoteShareMessage({
    customerName,
    quoteNumber,
    versionNumber,
    total,
    quoteUrl,
  });

  return (
    <FormSheet
      title="Send via email"
      trigger={
        <span className="inline-flex h-11 min-h-11 w-full items-center justify-center rounded-lg border border-outline-variant px-4 text-subheading">
          Email
        </span>
      }
    >
      <form
        className="flex min-h-0 flex-1 flex-col"
        action={(formData) => {
          setError(undefined);
          setNotice(undefined);
          start(async () => {
            const result = await sendQuoteEmailAction(formData);
            if (result.error) setError(result.error);
            else setNotice("Email sent.");
          });
        }}
      >
        <FormSheetBody className="space-y-3">
          <input type="hidden" name="quote_id" value={quoteId} />
          <input type="hidden" name="message" value={message} />
          <Input
            name="email"
            type="email"
            required
            defaultValue={customerEmail ?? ""}
            placeholder="Customer email"
            className="h-11 min-h-11"
          />
          <pre className="whitespace-pre-wrap rounded-lg border border-surface-variant p-3 text-sm">
            {message}
          </pre>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {notice ? <p className="text-sm text-primary">{notice}</p> : null}
        </FormSheetBody>
        <FormSheetFooter>
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? "Sending…" : "Send email"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}
