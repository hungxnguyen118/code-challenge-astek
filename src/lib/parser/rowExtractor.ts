import type {
  Asset,
  AssetFields,
  AssetType,
  AssetWarning,
  CellValue,
  ColumnMapping,
  DataRow,
  DetectedTable,
  ExtractedValue,
  FieldKey,
  FieldValueMap,
} from "../types";
import { cellToString, isBlank } from "../text";
import { FIELDS, normalizeField } from "../extract/registry";
import { parseCombined, combinedRichness, type CombinedParse } from "../extract/combined";
import { inferFromModel } from "../extract/model";
import { findAssetTypeInText } from "../extract/assetType";
import { unitHintFromHeader } from "../extract/unitHint";

/** Fields are processed in this order so later ones can use earlier ones (model needs manufacturer). */
const FIELD_ORDER: FieldKey[] = [
  "manufacturer",
  "model",
  "assetType",
  "serialNumber",
  "cpu",
  "ramGB",
  "storage",
  "screenInches",
  "hostname",
  "assetTag",
  "assignedUser",
  "location",
  "os",
  "purchaseDate",
  "warrantyEnd",
  "status",
  "notes",
];

function set<K extends FieldKey>(fields: AssetFields, key: K, value: ExtractedValue<FieldValueMap[K]>): void {
  (fields as Record<K, ExtractedValue<FieldValueMap[K]>>)[key] = value;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Turn one spreadsheet row into an asset, in three passes:
 *  1. column   – read every mapped column through its field normaliser
 *  2. parsed   – mine free text (description columns, or a Model cell that packs specs) for missing fields
 *  3. inferred – deduce what's still missing (Latitude ⇒ Dell + laptop, sheet "Servers" ⇒ server…)
 * A field nobody could fill stays empty: we never invent values.
 */
export function extractRow(table: DetectedTable, mapping: ColumnMapping[], row: DataRow): Asset {
  const fields: AssetFields = {};
  const warnings: AssetWarning[] = [];
  const byField = new Map<FieldKey, ColumnMapping>();
  const combinedCols: ColumnMapping[] = [];
  for (const m of mapping) {
    if (m.target === "combined") combinedCols.push(m);
    else if (m.target && !byField.has(m.target)) byField.set(m.target, m);
  }

  // Pass 1 — mapped columns
  for (const key of FIELD_ORDER) {
    const m = byField.get(key);
    if (!m) continue;
    const cell: CellValue = row.cells[m.columnIndex] ?? null;
    if (isBlank(cell)) continue;
    const norm = normalizeField(key, cell, {
      unitHint: unitHintFromHeader(m.header),
      manufacturer: fields.manufacturer?.value,
    });
    const raw = cellToString(cell);
    if (!norm) {
      if (key !== "notes" && key !== "serialNumber") {
        warnings.push({ code: "low-confidence", severity: "warning", field: key, message: `Couldn't read “${raw}” as ${FIELDS[key].label}` });
      }
      continue;
    }
    const mappingFactor = m.manual ? 1 : 0.5 + 0.5 * m.confidence;
    set(fields, key, { value: norm.value, raw, confidence: round2(norm.confidence * mappingFactor), method: "column", sourceColumn: m.header });
  }

  // Pass 2 — free text. Description columns first, then a Model cell stuffed with specs.
  const texts: Array<{ text: string; column: string; isModelCell: boolean }> = [];
  for (const m of combinedCols) {
    const t = cellToString(row.cells[m.columnIndex] ?? null);
    if (t) texts.push({ text: t, column: m.header, isModelCell: false });
  }
  const modelCol = byField.get("model");
  if (modelCol) {
    const t = cellToString(row.cells[modelCol.columnIndex] ?? null);
    if (t && combinedRichness(t) >= 2) texts.push({ text: t, column: modelCol.header, isModelCell: true });
  }
  for (const { text, column, isModelCell } of texts) {
    const parsed = parseCombined(text, fields.manufacturer?.value);
    applyParsed(fields, parsed, column, isModelCell);
  }

  // Pass 3 — inference
  infer(fields, table, row, mapping);

  const raw = table.columns.map((c) => ({ header: c.header, value: cellToString(row.cells[c.index] ?? null) }));
  return {
    id: `${table.sheetName}!${row.rowNumber}`,
    sheetName: table.sheetName,
    tableId: table.id,
    rowNumber: row.rowNumber,
    kind: "computer", // decided by the row classifier
    fields,
    warnings,
    raw,
  };
}

function applyParsed(fields: AssetFields, parsed: CombinedParse, column: string, isModelCell: boolean): void {
  const keys = Object.keys(parsed) as Array<keyof CombinedParse>;
  for (const key of keys) {
    const part = parsed[key];
    if (!part) continue;
    const existing = fields[key];
    // A Model cell like "Dell Lat 5420 i7 16GB": replace the whole string with the clean model part.
    const replaceModel = key === "model" && isModelCell && existing?.method === "column";
    if (existing && !replaceModel) continue;
    const value: ExtractedValue<FieldValueMap[typeof key]> = {
      value: part.value,
      raw: part.match.trim(),
      confidence: round2(part.confidence),
      method: "parsed",
      sourceColumn: column,
    };
    set(fields, key, value as never);
  }
}

const HOSTNAME_PREFIXES: Array<[RegExp, AssetType]> = [
  [/^(lap|lt|nb|ltp|nbk|portable|pcp)[-_\d]/i, "laptop"],
  [/^(srv|svr|server|esx|hv|dc\d|sql|db)[-_\d]/i, "server"],
  [/^(vm|vdi)[-_\d]/i, "virtual-machine"],
  [/^(ws|wks|cad)[-_\d]/i, "workstation"],
  [/^(dt|dsk|desk|pc|uc|pcf)[-_\d]/i, "desktop"],
];

function infer(fields: AssetFields, table: DetectedTable, row: DataRow, mapping: ColumnMapping[]): void {
  const model = fields.model?.value;
  if (model) {
    const fromModel = inferFromModel(model, fields.manufacturer?.value);
    if (!fields.manufacturer && fromModel.manufacturer) {
      fields.manufacturer = { value: fromModel.manufacturer, raw: `model “${model}”`, confidence: 0.8, method: "inferred" };
    }
    if (!fields.assetType && fromModel.type) {
      fields.assetType = { value: fromModel.type, raw: `${fromModel.family} is a ${fromModel.type} line`, confidence: 0.8, method: "inferred" };
    }
  }
  if (fields.assetType) return;

  // Type keyword anywhere in the row's unmapped/free text cells (e.g. a "Category" column we didn't map).
  for (const m of mapping) {
    if (m.target && m.target !== "notes" && m.target !== "combined") continue;
    const t = cellToString(row.cells[m.columnIndex] ?? null);
    if (!t || t.length > 120) continue;
    const found = findAssetTypeInText(t);
    if (found) {
      fields.assetType = { value: found.type, raw: `“${found.word}” in column ${m.header}`, confidence: 0.6, method: "inferred" };
      return;
    }
  }
  // A section title above the table ("LAPTOPS") or the sheet name ("Servers").
  for (const [label, where] of [[table.title, "section title"], [table.sheetName, "sheet name"]] as const) {
    const found = label ? findAssetTypeInText(label) : null;
    if (found) {
      fields.assetType = { value: found.type, raw: `${where} “${label}”`, confidence: 0.65, method: "inferred" };
      return;
    }
  }
  const hostname = fields.hostname?.value;
  if (hostname) {
    const hit = HOSTNAME_PREFIXES.find(([re]) => re.test(hostname));
    if (hit) {
      fields.assetType = { value: hit[1], raw: `hostname prefix “${hostname}”`, confidence: 0.5, method: "inferred" };
      return;
    }
  }
  const cpu = fields.cpu?.value ?? "";
  if (/xeon|epyc/i.test(cpu)) {
    fields.assetType = { value: "server", raw: `server-class CPU (${cpu})`, confidence: 0.45, method: "inferred" };
    return;
  }
  if (fields.screenInches && fields.screenInches.value <= 18) {
    fields.assetType = { value: "laptop", raw: `has a built-in ${fields.screenInches.value}" screen`, confidence: 0.4, method: "inferred" };
  }
}

