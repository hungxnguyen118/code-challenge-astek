import type { CellValue, FieldKey, FieldValueMap, Normalized } from "../types";
import { cellToString } from "../text";
import { normalizeRam, MEMORY_SPEEDS_MHZ } from "./ram";
import { normalizeStorage } from "./storage";
import { normalizeScreen } from "./screen";
import { normalizeCpu } from "./cpu";
import { normalizeManufacturer, findManufacturer } from "./manufacturer";
import { findFamily, normalizeModel } from "./model";
import { normalizeSerial, serialLikeness } from "./serial";
import { normalizeAssetType } from "./assetType";
import {
  looksLikeEmail,
  looksLikeHostname,
  looksLikeOs,
  looksLikePersonName,
  looksLikeStatus,
  normalizeDate,
  normalizeOs,
  normalizeText,
} from "./misc";
import type { UnitHint } from "./unitHint";

export interface NormalizeContext {
  unitHint?: UnitHint;
  manufacturer?: string;
}

export interface FieldSpec<K extends FieldKey> {
  label: string;
  /** Turn a raw cell into a typed value (or null if it doesn't look like this field at all). */
  normalize: (raw: CellValue, ctx: NormalizeContext) => Normalized<FieldValueMap[K]> | null;
  /**
   * How much a single cell *looks like* this field (0..1), independently of the header.
   * Used for content-based column detection, so it must be stricter than `normalize`.
   */
  contentScore: (raw: CellValue) => number;
}

type Registry = { [K in FieldKey]: FieldSpec<K> };

const str = (raw: CellValue) => (typeof raw === "string" ? raw : cellToString(raw));
const asText = (raw: CellValue): CellValue => (raw instanceof Date || typeof raw === "number" ? cellToString(raw) : raw);

export const FIELDS: Registry = {
  assetType: {
    label: "Type",
    normalize: (raw) => normalizeAssetType(str(raw)),
    contentScore: (raw) => (normalizeAssetType(str(raw))?.confidence === 1 ? 1 : 0),
  },
  manufacturer: {
    label: "Manufacturer",
    normalize: (raw) => normalizeManufacturer(str(raw)),
    contentScore: (raw) => {
      const n = normalizeManufacturer(str(raw));
      return n && n.confidence >= 0.85 && str(raw).length <= 30 ? 1 : 0;
    },
  },
  model: {
    label: "Model",
    normalize: (raw, ctx) => normalizeModel(asText(raw), ctx.manufacturer),
    contentScore: (raw) => {
      const s = str(raw);
      if (!s || s.length > 60) return 0;
      if (findFamily(s)) return 0.9;
      // Model numbers mix letters and digits and contain a space or are short ("T14 Gen 2", "840 G8", "A2338")
      if (/[a-z]/i.test(s) && /\d/.test(s) && s.length <= 30 && !/@/.test(s)) return 0.35;
      return 0;
    },
  },
  serialNumber: {
    label: "Serial number",
    normalize: (raw) => normalizeSerial(asText(raw)),
    contentScore: (raw) => serialLikeness(str(raw)),
  },
  cpu: {
    label: "CPU",
    normalize: (raw) => normalizeCpu(str(raw)),
    contentScore: (raw) => {
      const n = normalizeCpu(str(raw));
      return n && n.confidence >= 0.8 && str(raw).length < 80 ? 1 : 0;
    },
  },
  ramGB: {
    label: "RAM",
    normalize: (raw, ctx) => normalizeRam(raw, ctx.unitHint),
    contentScore: (raw) => {
      if (typeof raw === "number") return MEMORY_SPEEDS_MHZ.has(raw) ? 0 : [2, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 256, 512].includes(raw) ? 0.6 : 0.1;
      const s = str(raw);
      if (s.length > 25) return 0;
      const n = normalizeRam(s);
      if (!n) return 0;
      // "16GB" is RAM-ish, "512GB" much less so (more likely storage)
      if (/[a-z]/i.test(s)) return n.value <= 256 ? 0.95 : 0.3;
      return n.value <= 256 ? 0.5 : 0.1;
    },
  },
  storage: {
    label: "Storage",
    normalize: (raw, ctx) => normalizeStorage(raw, ctx.unitHint),
    contentScore: (raw) => {
      if (typeof raw === "number") return raw >= 64 && raw <= 16000 ? 0.4 : 0;
      const s = str(raw);
      if (s.length > 40) return 0;
      if (/ssd|hdd|nvme|emmc|tb\b|to\b/i.test(s) && normalizeStorage(s)) return 1;
      const n = normalizeStorage(s);
      return n && n.value.totalGB >= 64 ? 0.5 : 0;
    },
  },
  screenInches: {
    label: "Screen",
    normalize: (raw, ctx) => normalizeScreen(raw, ctx.unitHint),
    contentScore: (raw) => {
      if (typeof raw === "number") return raw >= 10 && raw <= 34 && (Number.isInteger(raw * 2) || [13.3, 15.6, 17.3, 14.1, 13.5, 13.4, 16.1].includes(raw)) ? 0.45 : 0;
      const s = str(raw);
      if (s.length > 20) return 0;
      const n = normalizeScreen(s);
      if (!n) return 0;
      return /["”″]|''|in\b|inch|pouce|cm\b/i.test(s) ? 1 : 0.4;
    },
  },
  hostname: {
    label: "Hostname",
    normalize: (raw) => normalizeText(asText(raw)),
    contentScore: (raw) => (looksLikeHostname(str(raw)) ? 0.6 : 0),
  },
  assetTag: {
    label: "Asset tag",
    normalize: (raw) => normalizeText(asText(raw)),
    // Hard to tell from other IDs by content alone, so this mostly rules out free text.
    contentScore: (raw) => {
      const s = str(raw);
      return s.length > 0 && s.length <= 20 && !/\s/.test(s) && /\d/.test(s) ? 0.4 : 0;
    },
  },
  assignedUser: {
    label: "Assigned to",
    normalize: (raw) => normalizeText(asText(raw)),
    contentScore: (raw) => (looksLikeEmail(str(raw)) ? 0.8 : looksLikePersonName(str(raw)) ? 0.4 : 0),
  },
  location: {
    label: "Location",
    normalize: (raw) => normalizeText(asText(raw)),
    // Place names: short, mostly letters. Rules out specs and IDs.
    contentScore: (raw) => {
      const s = str(raw);
      return /^[\p{L}][\p{L}' .\-/,]{1,39}(?:\s?\d{1,3})?$/u.test(s) && !findManufacturer(s) ? 0.35 : 0;
    },
  },
  os: {
    label: "OS",
    normalize: (raw) => normalizeOs(str(raw)),
    contentScore: (raw) => (looksLikeOs(str(raw)) && str(raw).length < 50 ? 1 : 0),
  },
  purchaseDate: {
    label: "Purchased",
    normalize: (raw) => normalizeDate(raw),
    contentScore: (raw) => (raw instanceof Date ? 0.6 : typeof raw === "string" && normalizeDate(raw) && raw.length <= 12 ? 0.5 : 0),
  },
  warrantyEnd: {
    label: "Warranty end",
    normalize: (raw) => normalizeDate(raw),
    contentScore: (raw) => (raw instanceof Date ? 0.55 : typeof raw === "string" && normalizeDate(raw) && raw.length <= 12 ? 0.45 : 0),
  },
  status: {
    label: "Status",
    normalize: (raw) => normalizeText(asText(raw)),
    contentScore: (raw) => (looksLikeStatus(str(raw)) ? 1 : 0),
  },
  notes: {
    label: "Notes",
    normalize: (raw) => normalizeText(asText(raw)),
    contentScore: (raw) => (str(raw).split(" ").length >= 5 && !findManufacturer(str(raw)) ? 0.4 : 0),
  },
};

export function fieldLabel(key: FieldKey | "combined"): string {
  return key === "combined" ? "Description (multi-field)" : FIELDS[key].label;
}

/** Generic, type-safe normalisation entry point. */
export function normalizeField<K extends FieldKey>(key: K, raw: CellValue, ctx: NormalizeContext = {}): Normalized<FieldValueMap[K]> | null {
  return (FIELDS[key] as FieldSpec<K>).normalize(raw, ctx);
}
