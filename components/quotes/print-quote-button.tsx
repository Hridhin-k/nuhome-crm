"use client";

import { Button } from "@/components/ui/button";

export function PrintQuoteButton() {
  return (
    <Button
      type="button"
      className="mt-6 w-full print:hidden"
      onClick={() => window.print()}
    >
      Print / Save as PDF
    </Button>
  );
}
