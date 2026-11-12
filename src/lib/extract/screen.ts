import type { Normalized } from "../types";
import { parseLooseNumber, round } from "../text";
import type { UnitHint } from "./unitHint";

const NUM = "(\\d{1,3}(?:[.,]\\d{1,2})?)";

/**
 * Normalise a screen size to inches.
 * "14" · '14"' · "14in" · "14 inch" · "14''" · "15,6 pouces" · "35.6 cm" · "15.6 FHD" → number
 */
export function normalizeScreen(raw: unknown, hint?: UnitHint): Normalized<number> | null {
  if (typeof raw === "number") return bare(raw, hint);
  if (typeof raw !== "string") return null;
  const s = raw.toLowerCase().replace(/ /g, " ").trim();
  if (!s) return null;

  const cm = new RegExp(`${NUM}\\s*cm\\b`).exec(s);
  if (cm) return sane((parseLooseNumber(cm[1]!) ?? 0) / 2.54, 0.9);

  const inch = new RegExp(`${NUM}\\s*(?:"|''|”|″|′′|-?\\s*in\\b|-?\\s*inch(?:es)?\\b|\\s*pouces?\\b|\\s*po\\b|\\s*zoll\\b)`).exec(s);
  if (inch) return sane(parseLooseNumber(inch[1]!) ?? 0, 0.95);

  const n = parseLooseNumber(s);
  if (n !== null) return bare(n, hint);

  // "15.6 FHD", "14 WUXGA" – number followed by a resolution keyword
  const res = new RegExp(`^${NUM}\\s*(?:fhd|uhd|qhd|hd|wuxga|wqxga|4k|oled|ips|retina|touch)`).exec(s);
  if (res) return sane(parseLooseNumber(res[1]!) ?? 0, 0.75);
  return null;
}

function bare(n: number, hint?: UnitHint): Normalized<number> | null {
  if (hint === "cm") return sane(n / 2.54, 0.85);
  return sane(n, hint === "in" ? 0.9 : 0.65);
}

function sane(inches: number, confidence: number): Normalized<number> | null {
  if (!Number.isFinite(inches) || inches <= 0) return null;
  const value = round(inches, 1);
  if (value < 5 || value > 100) return { value, confidence: 0.15 };
  return { value, confidence };
}
