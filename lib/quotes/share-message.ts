import { formatInrExact } from "@/lib/format/money";

export function quoteShareMessage(input: {
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
