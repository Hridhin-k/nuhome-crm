"use client";

import { Button } from "@/components/ui/button";

export function PrintDocumentButton({
  label = "Print / Save as PDF",
}: {
  label?: string;
}) {
  return (
    <Button type="button" className="w-full print:hidden md:w-auto" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
