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
  default_cost: "cost",
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

function splitCsvRecords(text: string): string[][] {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const records: string[][] = [];
  let line = "";
  let quoted = false;

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
        records.push(splitCsvLine(line));
      }
      line = "";
    } else {
      line += char;
    }
  }
  if (line.trim()) {
    records.push(splitCsvLine(line));
  }
  return records;
}

export function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const records = splitCsvRecords(text);
  if (records.length === 0) {
    return { headers: [], rows: [] };
  }
  const headers = records[0].map(normalizeCsvHeader);
  const rows = records
    .slice(1)
    .filter((cells) => cells.some((cell) => cell.trim()))
    .map((cells) => {
      const row: CsvRow = {};
      headers.forEach((header, index) => {
        if (!header) return;
        row[header] = (cells[index] ?? "").trim();
      });
      return row;
    });
  return { headers, rows };
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
