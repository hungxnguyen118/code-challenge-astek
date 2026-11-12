import type { CellValue } from "./types";

/** Lower-case, strip accents and punctuation, collapse whitespace. "Numéro de série" → "numero de serie" */
export function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_\-./\\()[\]{}#:;,'"’`|*?!+=&°º]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(input: string): string[] {
  const n = normalizeText(input);
  return n ? n.split(" ") : [];
}

/** Text shown to users / fed to regex-based extractors. */
export function cellToString(value: CellValue): string {
  if (value === null) return "";
  if (value instanceof Date) return toIsoDate(value) ?? "";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(+value.toFixed(6));
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return value.trim();
}

export function isBlank(value: CellValue): boolean {
  return value === null || (typeof value === "string" && value.trim() === "");
}

export function toIsoDate(d: Date): string | null {
  if (Number.isNaN(d.getTime())) return null;
  // Use UTC parts: SheetJS creates dates at UTC midnight.
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Parse a number written the European or US way: "15,6" → 15.6, "1,024" → 1024, "1 024,5" → 1024.5.
 */
export function parseLooseNumber(input: string): number | null {
  let s = input.trim().replace(/\s/g, "");
  if (!/^-?[\d.,]+$/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // Both present: the last one is the decimal separator.
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma > -1) {
    // Only commas: "1,024" (thousands) vs "15,6" (decimal).
    s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** True for numbers and numeric-looking strings. */
export function isNumericLike(value: CellValue): boolean {
  if (typeof value === "number") return true;
  if (typeof value !== "string") return false;
  return parseLooseNumber(value) !== null;
}

/** 0 → A, 25 → Z, 26 → AA */
export function columnLetter(index: number): string {
  let n = index;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

/** Jaro-Winkler similarity (0..1). Used to tolerate typos in headers ("Memmory", "Seriall"). */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  const la = a.length;
  const lb = b.length;
  if (la === 0 || lb === 0) return 0;
  const matchDistance = Math.max(0, Math.floor(Math.max(la, lb) / 2) - 1);
  const aMatches = new Array<boolean>(la).fill(false);
  const bMatches = new Array<boolean>(lb).fill(false);
  let matches = 0;
  for (let i = 0; i < la; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, lb);
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let k = 0;
  let transpositions = 0;
  for (let i = 0; i < la; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  const m = matches;
  const jaro = (m / la + m / lb + (m - transpositions / 2) / m) / 3;
  let prefix = 0;
  for (let i = 0; i < Math.min(4, la, lb); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function round(n: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** Escape a literal for use inside a RegExp. */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
