import type { Normalized } from "../types";

const PLACEHOLDER = /^(n\/?a|na|none|null|nil|unknown|inconnu|tbd|tbc|todo|pending|missing|not available|no serial|sans|aucun|x+|\?+|-+|0+|1234\d*|test|xxx+|\.+)$/i;

/** True for values people type when they don't know the serial ("N/A", "TBD", "000000"). */
export function isPlaceholderSerial(raw: string): boolean {
  return PLACEHOLDER.test(raw.trim());
}

/**
 * Upper-case, trim, drop "S/N:"-style prefixes and inner spaces.
 * "  s/n: 5cg 1234 xyz " → "5CG1234XYZ"
 */
export function normalizeSerial(raw: unknown): Normalized<string> | null {
  if (raw === null || raw === undefined) return null;
  let s = typeof raw === "number" ? String(raw) : String(raw);
  s = s.replace(/ /g, " ").trim();
  if (!s || isPlaceholderSerial(s)) return null;
  // Prefixes only count when followed by ":"/"#" or a space, so a serial like "SN7X21" is left alone.
  s = s.replace(/^(?:s\/n|serial(?:\s*(?:no|number))?|sn|n°\s*s[eé]rie|service\s*tag)\s*(?:[:#]\s*|\s+)/i, "");
  const compact = s.replace(/\s+/g, "").toUpperCase();
  if (!compact || isPlaceholderSerial(compact)) return null;

  const hasDigit = /\d/.test(compact);
  const hasLetter = /[A-Z]/.test(compact);
  const charsetOk = /^[A-Z0-9\-_/.]+$/.test(compact);
  let confidence = 0.6;
  if (charsetOk && compact.length >= 5 && compact.length <= 25) {
    confidence = hasDigit && hasLetter ? 0.95 : hasDigit ? 0.8 : 0.6;
  } else if (compact.length > 30 || /\s{2,}/.test(s)) {
    confidence = 0.3; // probably a sentence, not a serial
  }
  return { value: compact, confidence };
}

/** How "serial-like" a value looks (used for content-based column detection). */
export function serialLikeness(raw: string): number {
  const s = raw.trim();
  if (!s || isPlaceholderSerial(s)) return 0;
  if (/\s/.test(s)) return 0.1;
  if (!/^[A-Za-z0-9\-_/.]{5,25}$/.test(s)) return 0;
  const hasDigit = /\d/.test(s);
  const hasLetter = /[A-Za-z]/.test(s);
  // Asset tags and hostnames are often PREFIX-1234: serials rarely contain dashes.
  const dashPenalty = /[-_]/.test(s) ? 0.35 : 0;
  if (hasDigit && hasLetter) return 0.9 - dashPenalty;
  if (hasDigit) return 0.45 - dashPenalty / 2;
  return 0.15;
}
