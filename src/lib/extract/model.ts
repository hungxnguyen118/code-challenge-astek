import type { AssetType, Normalized } from "../types";
import { MODEL_FAMILY_REGEXES } from "../knowledge/modelFamilies";
import { findManufacturer } from "./manufacturer";

export interface FamilyMatch {
  family: string;
  manufacturer: string;
  type: AssetType;
  /** Substring that matched (may be an abbreviation such as "Lat"). */
  match: string;
  index: number;
  prefix: boolean;
}

/**
 * Find the product family in a string. `knownManufacturer` lets ambiguous
 * patterns (a bare "R740" is only a PowerEdge if it's a Dell) take part.
 */
export function findFamily(text: string, knownManufacturer?: string): FamilyMatch | null {
  for (const f of MODEL_FAMILY_REGEXES) {
    if (f.weak && f.manufacturer !== knownManufacturer) continue;
    const m = f.regex.exec(text);
    if (m) {
      return { family: f.family, manufacturer: f.manufacturer, type: f.type, match: m[0], index: m.index, prefix: f.prefix ?? false };
    }
  }
  return null;
}

/**
 * Clean a model name:
 *  - drop the manufacturer prefix ("Dell Latitude 5420" → "Latitude 5420")
 *  - expand family abbreviations ("Lat 5420" → "Latitude 5420", "DL380 Gen10" → "ProLiant DL380 Gen10")
 *  - collapse whitespace
 */
export function normalizeModel(raw: unknown, knownManufacturer?: string): Normalized<string> | null {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).replace(/ /g, " ").replace(/\s+/g, " ").trim();
  if (!s || /^(n\/?a|unknown|inconnu|-+|\?+|none|tbd)$/i.test(s)) return null;

  const brand = findManufacturer(s);
  if (brand && brand.index === 0) s = s.slice(brand.match.length).replace(/^[\s\-–:/]+/, "");
  const manufacturer = knownManufacturer ?? brand?.entry.name;

  const fam = findFamily(s, manufacturer);
  let confidence = 0.7;
  if (fam) {
    confidence = 0.95;
    const before = s.slice(0, fam.index);
    const after = s.slice(fam.index + fam.match.length);
    s = fam.prefix ? `${before}${fam.family} ${fam.match.toUpperCase()}${after}` : `${before}${fam.family}${after}`;
    s = s.replace(/\s+/g, " ").trim();
    // "Latitude5420" → "Latitude 5420"
    s = s.replace(new RegExp(`(${fam.family})(\\d)`), "$1 $2");
  } else if (!/\d/.test(s) && s.length < 4) {
    confidence = 0.4; // "PC", "HP" alone is hardly a model
  }
  if (!s) return null;
  return { value: s, confidence };
}

/** What a model name tells us about the manufacturer and the type of device. */
export function inferFromModel(model: string, knownManufacturer?: string): { manufacturer?: string; type?: AssetType; family?: string } {
  const fam = findFamily(model, knownManufacturer);
  if (!fam) return {};
  return { manufacturer: fam.manufacturer || undefined, type: fam.type, family: fam.family };
}
