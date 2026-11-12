import * as XLSX from "xlsx";
import Papa from "papaparse";
import type { CellValue, RawSheet, RawWorkbook } from "../types";

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const SUPPORTED_EXTENSIONS = ["xlsx", "xlsm", "xls", "ods", "csv", "tsv", "txt"] as const;

/** A user-facing error: `message` is shown as-is, `hint` tells them what to do about it. */
export class IngestError extends Error {
  constructor(
    message: string,
    public readonly hint: string,
    public readonly code: "unsupported" | "too-large" | "empty" | "corrupt" | "password" | "no-sheets",
  ) {
    super(message);
    this.name = "IngestError";
  }
}

function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i + 1).toLowerCase();
}

/**
 * Sniff the real format from the first bytes instead of trusting the extension:
 * people rename .xls to .xlsx, export CSV with an .xls extension, etc.
 */
function sniff(bytes: Uint8Array): "zip" | "ole" | "text" | "binary" {
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return "zip"; // PK.. → xlsx / ods
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) return "ole"; // legacy xls (or encrypted xlsx!)
  const sample = bytes.subarray(0, Math.min(bytes.length, 2048));
  let control = 0;
  for (const b of sample) if (b < 9 || (b > 13 && b < 32)) control++;
  return control / Math.max(sample.length, 1) < 0.02 ? "text" : "binary";
}

export function readWorkbook(fileName: string, data: ArrayBuffer): RawWorkbook {
  const ext = extensionOf(fileName);
  if (!(SUPPORTED_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new IngestError(
      `“.${ext || "?"}” files aren't supported.`,
      "Upload an Excel workbook (.xlsx, .xls, .ods) or a CSV file.",
      "unsupported",
    );
  }
  if (data.byteLength === 0) throw new IngestError("This file is empty.", "Check you picked the right file.", "empty");
  if (data.byteLength > MAX_FILE_BYTES) {
    throw new IngestError(
      `This file is ${(data.byteLength / 1024 / 1024).toFixed(1)} MB; the limit is ${MAX_FILE_BYTES / 1024 / 1024} MB.`,
      "Split it into smaller files or remove unrelated sheets.",
      "too-large",
    );
  }

  const bytes = new Uint8Array(data);
  const kind = sniff(bytes);
  if (kind === "text") return readDelimited(fileName, bytes);
  if (kind === "binary") {
    throw new IngestError(
      "This file doesn't look like a spreadsheet — it may be corrupted.",
      "Open it in Excel and save it again as .xlsx or .csv.",
      "corrupt",
    );
  }
  return readExcel(fileName, bytes, kind === "zip" && ext === "ods" ? "ods" : kind === "ole" ? "xls" : "xlsx");
}

function readExcel(fileName: string, bytes: Uint8Array, fileType: RawWorkbook["fileType"]): RawWorkbook {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(bytes, { type: "array", cellDates: true, cellNF: false, cellStyles: false, dense: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Password-protected .xlsx files are stored in an OLE container (not a zip).
    // A damaged zip can also say "Unsupported ZIP encryption", which is *not* a password.
    if (/password|ecma-376|encrypted file/i.test(msg) && !/zip/i.test(msg)) {
      throw new IngestError(
        "This workbook is password-protected.",
        "Remove the password in Excel (File → Info → Protect Workbook) and upload it again.",
        "password",
      );
    }
    throw new IngestError(
      "We couldn't read this workbook — it looks damaged.",
      "Open it in Excel and use “Save As” to create a fresh copy, or export it to CSV.",
      "corrupt",
    );
  }
  if (wb.SheetNames.length === 0) throw new IngestError("This workbook has no sheets.", "Check you picked the right file.", "no-sheets");

  const sheets: RawSheet[] = wb.SheetNames.map((name, i) => {
    const ws = wb.Sheets[name];
    const hidden = (wb.Workbook?.Sheets?.[i]?.Hidden ?? 0) !== 0;
    if (!ws || !ws["!ref"]) return { name, hidden, grid: [], firstRow: 1, firstCol: 0 };
    const range = XLSX.utils.decode_range(ws["!ref"]);
    const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null, blankrows: true });
    const grid: CellValue[][] = raw.map((row) => row.map(cleanCell));

    // Merged cells: SheetJS only stores the value in the top-left cell. Copy it to the
    // whole merged area so a merged "Hardware" header (or a merged "Location") applies to every column/row it spans.
    for (const m of ws["!merges"] ?? []) {
      const top = grid[m.s.r - range.s.r]?.[m.s.c - range.s.c] ?? null;
      if (top === null) continue;
      for (let r = m.s.r; r <= m.e.r; r++) {
        const row = grid[r - range.s.r];
        if (!row) continue;
        for (let c = m.s.c; c <= m.e.c; c++) if (row[c - range.s.c] === null || row[c - range.s.c] === undefined) row[c - range.s.c] = top;
      }
    }

    // Note: hidden rows/columns are kept on purpose. They are often rows hidden by a filter,
    // and silently dropping real assets is worse than showing one row too many.
    return { name, hidden, grid, firstRow: range.s.r + 1, firstCol: range.s.c };
  });

  return { fileName, fileType, sheets, notes: [] };
}

function cleanCell(v: unknown): CellValue {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean") return v;
  const s = String(v).replace(/ /g, " ").trim();
  if (!s || /^#(N\/A|REF!|VALUE!|DIV\/0!|NAME\?|NULL!|NUM!)$/i.test(s)) return null;
  return s;
}

function decodeText(bytes: Uint8Array, notes: string[]): string {
  // UTF-8 first (with or without BOM); fall back to Windows-1252, which is what Excel on Windows writes.
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    notes.push("The file isn't UTF-8; it was read as Windows-1252 (Western European).");
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

function readDelimited(fileName: string, bytes: Uint8Array): RawWorkbook {
  const notes: string[] = [];
  const text = decodeText(bytes, notes);
  if (!text.trim()) throw new IngestError("This file is empty.", "Check you picked the right file.", "empty");
  const parsed = Papa.parse<string[]>(text, {
    delimiter: "", // auto-detect
    delimitersToGuess: [",", ";", "\t", "|"],
    skipEmptyLines: false,
  });
  const delimiter = parsed.meta.delimiter;
  if (delimiter && delimiter !== ",") notes.push(`Detected “${delimiter === "\t" ? "tab" : delimiter}” as the column separator.`);
  const grid: CellValue[][] = parsed.data.map((row) => row.map((c) => cleanCell(c)));
  const name = fileName.replace(/\.[^.]+$/, "");
  return { fileName, fileType: "csv", sheets: [{ name, hidden: false, grid, firstRow: 1, firstCol: 0 }], notes };
}
