import type { AssetFields, FieldKey, FieldValueMap } from "./types";
import { formatStorage } from "./extract/storage";
import { ASSET_TYPE_LABELS } from "./extract/assetType";

/** Display text for a normalised value. */
export function formatValue<K extends FieldKey>(key: K, value: FieldValueMap[K]): string {
  switch (key) {
    case "assetType":
      return ASSET_TYPE_LABELS[value as FieldValueMap["assetType"]];
    case "ramGB":
      return `${value as number} GB`;
    case "storage":
      return formatStorage(value as FieldValueMap["storage"]);
    case "screenInches":
      return `${value as number}"`;
    default:
      return String(value);
  }
}

export function fieldText(fields: AssetFields, key: FieldKey): string {
  const v = fields[key];
  return v ? formatValue(key, v.value as FieldValueMap[typeof key]) : "";
}

export type ConfidenceLevel = "high" | "medium" | "low";

export function confidenceLevel(c: number): ConfidenceLevel {
  if (c >= 0.8) return "high";
  if (c >= 0.5) return "medium";
  return "low";
}

export const pct = (n: number) => `${Math.round(n * 100)}%`;
