export type CsvRow = Record<string, string>;

const HEADER_ALIASES: Record<string, string> = {
  email: "email",
  e_mail: "email",
  full_name: "full_name",
  fullname: "full_name",
  name: "name",
  role: "role",
  phone: "phone",
  mobile: "phone",
  password: "password",
  notes: "notes",
  note: "notes",
  sku: "sku",
  category: "category",
  unit: "unit",
  sell_price: "sell_price",
  selling_price: "sell_price",
  price: "sell_price",
  default_sell_price: "sell_price",
  cost: "cost",
  cost_price: "cost",
  default_cost: "cost",
  office_quantity: "office_quantity",
  office_qty: "office_quantity",
  quantity_at_office: "office_quantity",
  qty_at_office: "office_quantity",
  in_office: "office_quantity",
  office_stock: "office_quantity",
  vendor: "vendors",
  vendors: "vendors",
  suppliers: "vendors",
  spec: "specs",
  specs: "specs",
  specifications: "specs",
  hsn: "hsn_code",
  hsn_code: "hsn_code",
  gst: "gst_rate",
  gst_rate: "gst_rate",
  gst_percent: "gst_rate",
  warranty: "warranty_months",
  warranty_months: "warranty_months",
  description: "description",
  details: "description",
};

export function normalizeCsvHeader(header: string) {
  const key = header.trim().toLowerCase().replace(/[^\w]+/g, "_").replace(/^_|_$/g, "");
  return HEADER_ALIASES[key] ?? key;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

type CsvRecord = { cells: string[]; line: number };

/** `line` is the file line the record starts on, which matches the spreadsheet row. */
function splitCsvRecords(text: string): {
  records: CsvRecord[];
  unclosedQuoteLine: number | null;
} {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const records: CsvRecord[] = [];
  let line = "";
  let quoted = false;
  let lineNumber = 1;
  let recordStart = 1;

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    if (char === '"') {
      line += char;
      if (quoted && normalized[i + 1] === '"') {
        line += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "\n" && !quoted) {
      if (line.trim()) {
        records.push({ cells: splitCsvLine(line), line: recordStart });
      }
      line = "";
      lineNumber += 1;
      recordStart = lineNumber;
    } else {
      if (char === "\n") lineNumber += 1;
      line += char;
    }
  }
  if (quoted) {
    return { records, unclosedQuoteLine: recordStart };
  }
  if (line.trim()) {
    records.push({ cells: splitCsvLine(line), line: recordStart });
  }
  return { records, unclosedQuoteLine: null };
}

function toRows(headers: string[], records: CsvRecord[]) {
  const rows: CsvRow[] = [];
  const lines: number[] = [];
  for (const record of records) {
    if (!record.cells.some((cell) => cell.trim())) continue;
    const row: CsvRow = {};
    headers.forEach((header, index) => {
      if (!header) return;
      row[header] = (record.cells[index] ?? "").trim();
    });
    rows.push(row);
    lines.push(record.line);
  }
  return { rows, lines };
}

export function parseCsv(text: string): {
  headers: string[];
  rows: CsvRow[];
  lines: number[];
} {
  const { records } = splitCsvRecords(text);
  if (records.length === 0) {
    return { headers: [], rows: [], lines: [] };
  }
  const headers = records[0].cells.map(normalizeCsvHeader);
  return { headers, ...toRows(headers, records.slice(1)) };
}

function columnLetter(index: number) {
  let letter = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letter = String.fromCharCode(65 + ((n - 1) % 26)) + letter;
  }
  return letter;
}

/**
 * Like parseCsv, but throws a message naming the row or column when the file
 * is not a clean table. `lines` gives the spreadsheet row of each data row.
 */
export function readCsvTable(
  text: string,
  columns: { required: readonly string[]; allowed: readonly string[] },
) {
  if (text.startsWith("PK\u0003\u0004") || text.includes("\u0000")) {
    throw new Error(
      "This is an Excel file, not a CSV. In Excel choose File → Save As → CSV UTF-8, or in Google Sheets File → Download → CSV, then import that file.",
    );
  }
  const { records, unclosedQuoteLine } = splitCsvRecords(text);
  if (unclosedQuoteLine !== null) {
    throw new Error(
      `Row ${unclosedQuoteLine}: a quote mark (") is opened but never closed. Remove it or close it.`,
    );
  }
  if (records.length === 0) {
    throw new Error("The file is empty");
  }

  const headerLine = records[0].line;
  const headers = records[0].cells.map(normalizeCsvHeader);
  const seen = new Map<string, number>();
  headers.forEach((header, index) => {
    if (!header) return;
    const earlier = seen.get(header);
    if (earlier !== undefined) {
      throw new Error(
        `Column ${header} appears twice, in columns ${columnLetter(earlier)} and ${columnLetter(index)}`,
      );
    }
    seen.set(header, index);
  });
  const unknownIndex = headers.findIndex(
    (header) => header && !columns.allowed.includes(header),
  );
  if (unknownIndex >= 0) {
    throw new Error(
      `Column ${columnLetter(unknownIndex)} (“${records[0].cells[unknownIndex]}”) is not a column this import reads. Use: ${columns.allowed.join(", ")}.`,
    );
  }
  const missing = columns.required.filter((column) => !seen.has(column));
  if (missing.length > 0) {
    throw new Error(
      `Row ${headerLine} must be the column names, and ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} missing. Start from the sample CSV.`,
    );
  }

  let width = headers.length;
  while (width > 0 && !headers[width - 1]) width -= 1;
  for (const record of records.slice(1)) {
    if (!record.cells.some((cell) => cell.trim())) continue;
    let used = record.cells.length;
    while (used > width && !record.cells[used - 1].trim()) used -= 1;
    if (used !== width) {
      throw new Error(
        `Row ${record.line} has ${used} values, but there are ${width} columns. ` +
          (used > width
            ? "A value with a comma, such as 7,400, must be inside quotes. Saving from Excel or Google Sheets does this for you."
            : "A comma may be missing on that row."),
      );
    }
  }

  return { headers, ...toRows(headers, records.slice(1)) };
}

export function toCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const escape = (value: string | number | null | undefined) => {
    const text = value == null ? "" : String(value);
    if (/[",\n]/.test(text)) {
      return `"${text.replaceAll('"', '""')}"`;
    }
    return text;
  };
  return [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))].join(
    "\n",
  );
}
