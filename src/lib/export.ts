import Papa from "papaparse";
import type { Asset, ParseResult } from "./types";
import { ALL_FIELDS, CORE_FIELDS } from "./types";
import { fieldText } from "./format";
import { includedAssets } from "./parser/pipeline";

export interface ExportOptions {
  includeNonComputers: boolean;
}

function selectAssets(result: ParseResult, opts: ExportOptions): Asset[] {
  return includedAssets(result).filter((a) => a.kind === "computer" || (opts.includeNonComputers && a.kind === "non-computer"));
}

/**
 * Flat, clean CSV: one row per asset, normalised values, plus provenance columns
 * (sheet, row) so every line can be traced back to the original file.
 * Numbers are split from units (ram_gb, storage_total_gb) so the CSV is directly usable in Excel/BI.
 */
export function toCsv(result: ParseResult, opts: ExportOptions): string {
  const rows = selectAssets(result, opts).map((a) => {
    const f = a.fields;
    const minConfidence = Math.min(...CORE_FIELDS.map((k) => f[k]?.confidence ?? 1));
    return {
      sheet: a.sheetName,
      row: a.rowNumber,
      kind: a.kind,
      asset_type: f.assetType?.value ?? "",
      manufacturer: f.manufacturer?.value ?? "",
      model: f.model?.value ?? "",
      serial_number: f.serialNumber?.value ?? "",
      cpu: f.cpu?.value ?? "",
      ram_gb: f.ramGB?.value ?? "",
      storage_total_gb: f.storage?.value.totalGB ?? "",
      storage: fieldText(f, "storage"),
      screen_inches: f.screenInches?.value ?? "",
      hostname: f.hostname?.value ?? "",
      asset_tag: f.assetTag?.value ?? "",
      assigned_user: f.assignedUser?.value ?? "",
      location: f.location?.value ?? "",
      os: f.os?.value ?? "",
      purchase_date: f.purchaseDate?.value ?? "",
      warranty_end: f.warrantyEnd?.value ?? "",
      status: f.status?.value ?? "",
      notes: f.notes?.value ?? "",
      min_confidence: Math.round(minConfidence * 100) / 100,
      warnings: a.warnings.map((w) => w.message).join(" | "),
    };
  });
  // BOM so Excel opens UTF-8 (accents!) correctly.
  return "﻿" + Papa.unparse(rows, { escapeFormulae: FORMULA_TRIGGER });
}

/**
 * CSV / formula injection guard (OWASP). The input file was written by someone else; a cell like
 * `=HYPERLINK("http://evil","Click")` or `+cmd|'/C calc'!A0` would run as a formula when *our*
 * export is opened in Excel. Text cells matching this get a leading `'`, which Excel/LibreOffice
 * treat as "this is text". Papa never applies it to real numbers, so `ram_gb` stays numeric.
 *
 * Wider than Papa's built-in `escapeFormulae: true` (`/^[=+\-@\t\r].*$/`), which misses a leading
 * space (" =1+1", which Excel still evaluates), multi-line cells (`.` doesn't match "\n"), and
 * full-width ＝＋－＠.
 */
export const FORMULA_TRIGGER = /^[\s 　]*[=+\-@＝＋－＠]|^[\t\r\n]/;

/** Full-fidelity JSON: every value with its raw text, method, confidence and source column. */
export function toJson(result: ParseResult, opts: ExportOptions): string {
  const assets = selectAssets(result, opts).map((a) => ({
    id: a.id,
    sheet: a.sheetName,
    row: a.rowNumber,
    kind: a.kind,
    fields: Object.fromEntries(ALL_FIELDS.filter((k) => a.fields[k]).map((k) => [k, a.fields[k]])),
    warnings: a.warnings,
  }));
  return JSON.stringify(
    {
      source: result.fileName,
      generatedAt: new Date().toISOString(),
      summary: result.summary,
      duplicates: result.duplicates,
      sheets: result.sheets.map((s) => ({
        name: s.name,
        status: s.status,
        included: s.included,
        tables: s.tables.map((t) => ({
          headerRow: t.table.headerRow,
          mapping: t.mapping.map((m) => ({ column: m.letter, header: m.header, field: m.target, confidence: m.confidence })),
        })),
      })),
      assets,
    },
    null,
    2,
  );
}

export function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
