import type { Asset, ExtractedValue, FieldKey, FieldValueMap, Overrides, ParseResult, RawSheet, RawWorkbook, SheetResult, TableResult } from "../types";
import { CORE_FIELDS } from "../types";
import { cellToString, isBlank, ownValue } from "../text";
import { normalizeField } from "../extract/registry";
import { detectTables } from "./tableDetector";
import { mapColumns } from "./columnMapper";
import { extractRow } from "./rowExtractor";
import { classifyRow } from "./rowClassifier";
import { checkAsset, findDuplicates, summarize } from "./quality";

/**
 * The whole analysis, as a pure function of (workbook, user overrides).
 *
 * Because it's pure and fast (no I/O, no LLM), the UI simply calls it again
 * whenever the user changes a mapping, a header row or a cell — no special
 * "partial re-run" logic is needed and the result is always consistent.
 */
export function analyzeWorkbook(wb: RawWorkbook, overrides: Overrides = {}, today: Date = new Date()): ParseResult {
  const signatures: Array<{ name: string; rows: Set<string> }> = [];
  const sheets: SheetResult[] = wb.sheets.map((sheet, index) => {
    try {
      return analyzeSheet(sheet, index, overrides, signatures);
    } catch (err) {
      // One broken sheet must not take the whole file down.
      return {
        name: sheet.name,
        index,
        hidden: sheet.hidden,
        status: "no-asset-data",
        included: false,
        tables: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  const included = sheets.filter((s) => s.included).flatMap((s) => s.tables.flatMap((t) => t.assets));
  for (const a of included) checkAsset(a, today);
  const duplicates = findDuplicates(included.filter((a) => a.kind === "computer"));
  // Assets of excluded sheets still get their own warnings, for display.
  for (const s of sheets) if (!s.included) for (const t of s.tables) for (const a of t.assets) checkAsset(a, today);

  return {
    fileName: wb.fileName,
    fileType: wb.fileType,
    notes: wb.notes,
    sheets,
    summary: summarize(included, duplicates),
    duplicates,
  };
}

function rowSignature(sheet: RawSheet): Set<string> {
  const set = new Set<string>();
  for (const row of sheet.grid) {
    const s = row.filter((c) => !isBlank(c)).map((c) => cellToString(c)).join("\u0001");
    if (s) set.add(s);
  }
  return set;
}

/** Share of rows of `a` that also appear in `b`. */
function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0) return 0;
  let common = 0;
  for (const r of a) if (b.has(r)) common++;
  return common / a.size;
}

function analyzeSheet(sheet: RawSheet, index: number, overrides: Overrides, signatures: Array<{ name: string; rows: Set<string> }>): SheetResult {
  const base = { name: sheet.name, index, hidden: sheet.hidden };
  const sig = rowSignature(sheet);
  if (sig.size < 2) {
    return { ...base, status: "empty", statusReason: sig.size === 0 ? "sheet is empty" : "only one line of content", included: false, tables: [] };
  }

  // "Sheet1 (2)": a copy (or near-copy) of an earlier sheet. Shown, but not counted twice.
  const dupOf = signatures.find((s) => s.rows.size >= 2 && overlap(sig, s.rows) >= 0.9 && overlap(s.rows, sig) >= 0.5);
  signatures.push({ name: sheet.name, rows: sig });

  const tables: TableResult[] = detectTables(sheet, index, overrides.tables).map((table) => {
    const mapping = mapColumns(table, ownValue(overrides.tables, table.id));
    const assets = table.rows.map((row) => {
      const asset = extractRow(table, mapping, row);
      applyCellEdits(asset, ownValue(overrides.cellEdits, asset.id));
      const { kind, reason } = classifyRow(asset, row, table);
      asset.kind = kind;
      asset.kindReason = reason;
      const forced = ownValue(overrides.rowKinds, asset.id);
      if (forced && forced !== kind) {
        asset.kind = forced;
        asset.kindReason = "moved by you";
      }
      return asset;
    });
    return { table, mapping, assets };
  });

  const hasAssets = tables.some((t) => t.assets.some((a) => a.kind !== "skipped"));
  const mappedCore = tables.some((t) => t.mapping.some((m) => m.target && (CORE_FIELDS as readonly string[]).includes(m.target)));
  const userChoice = ownValue(overrides.sheetInclusion, sheet.name);

  if (dupOf) {
    const exact = overlap(sig, dupOf.rows) === 1 && sig.size === dupOf.rows.size;
    return {
      ...base,
      status: "duplicate",
      statusReason: exact ? `identical to “${dupOf.name}”` : `${Math.round(overlap(sig, dupOf.rows) * 100)}% of its rows are also in “${dupOf.name}”`,
      duplicateOf: dupOf.name,
      included: userChoice ?? false,
      tables,
    };
  }
  if (!hasAssets || (!mappedCore && !tables.some((t) => t.assets.some((a) => a.kind === "computer")))) {
    return { ...base, status: "no-asset-data", statusReason: "no computer data recognised on this sheet", included: userChoice ?? false, tables };
  }
  return { ...base, status: "parsed", included: userChoice ?? true, tables };
}

function applyCellEdits(asset: Asset, edits: Partial<Record<FieldKey, string>> | undefined): void {
  if (!edits) return;
  for (const [key, text] of Object.entries(edits) as Array<[FieldKey, string]>) {
    if (!text.trim()) {
      delete asset.fields[key];
      continue;
    }
    const norm = normalizeField(key, text, { manufacturer: asset.fields.manufacturer?.value });
    if (!norm) {
      asset.warnings.push({ code: "low-confidence", severity: "warning", field: key, message: `Your edit “${text}” isn't a valid value for this field` });
      continue;
    }
    const value: ExtractedValue<FieldValueMap[typeof key]> = { value: norm.value, raw: text, confidence: 1, method: "manual" };
    (asset.fields as Record<FieldKey, ExtractedValue<unknown>>)[key] = value;
  }
}

/** All assets of included sheets. */
export function includedAssets(result: ParseResult): Asset[] {
  return result.sheets.filter((s) => s.included).flatMap((s) => s.tables.flatMap((t) => t.assets));
}
