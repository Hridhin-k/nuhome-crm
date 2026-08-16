import { requirePermission } from "@/lib/auth/guards";
import { loadReportExport, parseExportKind } from "@/lib/reports/load-export";
import { reportExportToCsv, withExcelBom } from "@/lib/reports/csv-export";
import { defaultDateRange, parseYmd } from "@/lib/search";

export const dynamic = "force-dynamic";

function csvResponse(filename: string, csv: string) {
  return new Response(withExcelBom(csv), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  await requirePermission("admin.manage");
  const url = new URL(request.url);
  const kind = parseExportKind(url.searchParams.get("kind"));
  if (!kind) {
    return new Response("Unknown export", { status: 400 });
  }
  const fallback = defaultDateRange();
  const from = parseYmd(url.searchParams.get("from") ?? undefined) ?? fallback.from;
  const to = parseYmd(url.searchParams.get("to") ?? undefined) ?? fallback.to;
  const payload = await loadReportExport(kind, {
    from,
    to,
    action: url.searchParams.get("action") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
  });
  const file = reportExportToCsv(payload);
  return csvResponse(file.filename, file.csv);
}
