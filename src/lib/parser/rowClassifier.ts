import type { Asset, DataRow, DetectedTable, RowKind } from "../types";
import { CORE_FIELDS } from "../types";
import { cellToString, isBlank } from "../text";
import { isComputerType, ASSET_TYPE_LABELS } from "../extract/assetType";
import { isPeripheralBrand } from "../extract/manufacturer";
import { isRepeatedHeader } from "./tableDetector";

const TOTAL_ROW = /^\s*(sub[\s-]?total|grand\s*total|total|totals|sous[\s-]?total|totaux?|sum|somme|count|nombre)\b/i;

/**
 * Decide whether a row is a computer, a non-computer device, or not an asset at all.
 * Nothing is deleted: non-computers and skipped rows stay visible in their own tabs,
 * and the user can move a row back if we got it wrong.
 */
export function classifyRow(asset: Asset, row: DataRow, table: DetectedTable): { kind: RowKind; reason?: string } {
  const filled = row.cells.filter((c) => !isBlank(c));
  const texts = filled.map((c) => cellToString(c));

  if (texts.some((t) => TOTAL_ROW.test(t)) && !asset.fields.serialNumber) return { kind: "skipped", reason: "looks like a total/summary row" };
  if (table.headerRow !== null && isRepeatedHeader(row.cells, table.columns.map((c) => c.header))) {
    return { kind: "skipped", reason: "repeats the header row" };
  }
  if (filled.length === 1 && !asset.fields.serialNumber && !asset.fields.model) {
    return { kind: "skipped", reason: "single-cell line (title, note or section label)" };
  }
  // A type on its own ("Laptop" in a lookup table) does not make an asset.
  const coreFound = CORE_FIELDS.filter((k) => k !== "assetType" && asset.fields[k] !== undefined).length;
  const idFound = asset.fields.hostname || asset.fields.assetTag;
  if (coreFound === 0 && !idFound) return { kind: "skipped", reason: "no asset information found in this row" };

  const type = asset.fields.assetType?.value;
  if (type && !isComputerType(type) && type !== "other") {
    return { kind: "non-computer", reason: `${ASSET_TYPE_LABELS[type]} — not a computer` };
  }
  const brand = asset.fields.manufacturer?.value;
  if (!type && brand && isPeripheralBrand(brand)) return { kind: "non-computer", reason: `${brand} makes peripherals, not computers` };
  return { kind: "computer" };
}
