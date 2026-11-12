import type { Normalized } from "../types";
import { cellToString, toIsoDate } from "../text";

/** Generic trimmed text; placeholders become null. */
export function normalizeText(raw: unknown): Normalized<string> | null {
  if (raw === null || raw === undefined) return null;
  const s = (raw instanceof Date ? cellToString(raw) : String(raw)).replace(/\s+/g, " ").trim();
  if (!s || /^(n\/?a|-+|\?+|none|null)$/i.test(s)) return null;
  return { value: s, confidence: 0.9 };
}

/**
 * Dates come in every shape: real Excel dates, Excel serial numbers, "2023-04-01",
 * "01/04/2023" (EU) or "04/01/2023" (US), "Apr 2023". Output is ISO `YYYY-MM-DD`.
 * Ambiguous dd/mm vs mm/dd defaults to day-first (European files) with lower confidence.
 */
export function normalizeDate(raw: unknown): Normalized<string> | null {
  if (raw instanceof Date) {
    const iso = toIsoDate(raw);
    return iso ? { value: iso, confidence: 1 } : null;
  }
  if (typeof raw === "number") {
    // Excel serial date (1 = 1900-01-01). Plausible range: 1995..2060
    if (raw > 34700 && raw < 58500) {
      const d = new Date(Date.UTC(1899, 11, 30) + Math.round(raw) * 86400000);
      return { value: toIsoDate(d)!, confidence: 0.8 };
    }
    if (raw >= 1990 && raw <= 2100 && Number.isInteger(raw)) return { value: `${raw}-01-01`, confidence: 0.4 };
    return null;
  }
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;

  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (m) return ymd(+m[1]!, +m[2]!, +m[3]!, 0.95);

  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(s);
  if (m) {
    const a = +m[1]!;
    const b = +m[2]!;
    let y = +m[3]!;
    if (y < 100) y += 2000;
    if (a > 12) return ymd(y, b, a, 0.9); // dd/mm
    if (b > 12) return ymd(y, a, b, 0.9); // mm/dd
    return ymd(y, b, a, 0.6); // ambiguous → assume day-first
  }

  // Month names ("5 May 2023", "May 5, 2023", "avril 2023"). Parsed by hand on purpose: Date.parse
  // is engine-specific, uses the local time zone, and accepts nonsense ("Latitude 5420" → year 5419).
  const named = parseNamedMonth(s);
  if (named) return named;

  m = /^(\d{4})$/.exec(s);
  if (m) return ymd(+m[1]!, 1, 1, 0.4);
  return null;
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, janvier: 1, janv: 1,
  feb: 2, february: 2, fev: 2, fevr: 2, fevrier: 2,
  mar: 3, march: 3, mars: 3,
  apr: 4, april: 4, avr: 4, avril: 4,
  may: 5, mai: 5,
  jun: 6, june: 6, juin: 6,
  jul: 7, july: 7, juil: 7, juillet: 7,
  aug: 8, august: 8, aout: 8,
  sep: 9, sept: 9, september: 9, septembre: 9,
  oct: 10, october: 10, octobre: 10,
  nov: 11, november: 11, novembre: 11,
  dec: 12, december: 12, decembre: 12,
};

function parseNamedMonth(s: string): Normalized<string> | null {
  const t = s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  if (t.length > 40) return null;
  const month = (w: string) => (Object.prototype.hasOwnProperty.call(MONTHS, w) ? MONTHS[w]! : null);
  let m = /^(\d{1,2})(?:er|st|nd|rd|th)? ([a-z]+) (\d{4})$/.exec(t); // 5 May 2023 · 1er avril 2023
  if (m && month(m[2]!)) return ymd(+m[3]!, month(m[2]!)!, +m[1]!, 0.85);
  m = /^([a-z]+) (\d{1,2})(?:st|nd|rd|th)? (\d{4})$/.exec(t); // May 5 2023
  if (m && month(m[1]!)) return ymd(+m[3]!, month(m[1]!)!, +m[2]!, 0.85);
  m = /^([a-z]+) (\d{4})$/.exec(t); // April 2023 → first of the month, lower confidence
  if (m && month(m[1]!)) return ymd(+m[2]!, month(m[1]!)!, 1, 0.6);
  return null;
}

/** Builds an ISO date, rejecting dates that don't exist (31/02, 30/02/2023, 29/02 outside leap years). */
function ymd(y: number, mo: number, d: number, confidence: number): Normalized<string> | null {
  if (y < 1980 || y > 2100 || mo < 1 || mo > 12 || d < 1) return null;
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  if (d > daysInMonth) return null;
  return { value: `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`, confidence };
}

const OS_PATTERNS: Array<[RegExp, (m: RegExpExecArray) => string]> = [
  [/\bwin(?:dows)?\s*(?:server\s*)(\d{4}(?:\s*r2)?)/i, (m) => `Windows Server ${m[1]!.toUpperCase()}`],
  [/\bwin(?:dows)?\s*(7|8\.1|8|10|11)\b(?:\s*(pro|enterprise|entreprise|home|famille|education|ltsc))?/i, (m) => `Windows ${m[1]}${m[2] ? ` ${cap(m[2])}` : ""}`],
  [/\bmac\s*os\s*x?\s*([a-z]+(?:\s[a-z]+)?|\d+(?:\.\d+)?)?/i, (m) => `macOS${m[1] ? ` ${cap(m[1])}` : ""}`],
  [/\b(ubuntu|debian|centos|rhel|red hat|rocky|alma|suse|fedora)\b\s*([\d.]+)?/i, (m) => `${cap(m[1]!)}${m[2] ? ` ${m[2]}` : ""}`],
  [/\b(esxi|vmware esxi)\s*([\d.]+)?/i, (m) => `VMware ESXi${m[2] ? ` ${m[2]}` : ""}`],
  [/\bchrome\s*os\b/i, () => "ChromeOS"],
  [/\b(ios|ipados|android)\s*([\d.]+)?/i, (m) => `${m[1]!.toLowerCase() === "android" ? "Android" : m[1]}${m[2] ? ` ${m[2]}` : ""}`],
  [/\blinux\b/i, () => "Linux"],
];

export function normalizeOs(raw: unknown): Normalized<string> | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  for (const [re, build] of OS_PATTERNS) {
    const m = re.exec(s);
    if (m) return { value: build(m), confidence: 0.95 };
  }
  return { value: s, confidence: 0.5 };
}

export function looksLikeOs(raw: string): boolean {
  return OS_PATTERNS.some(([re]) => re.test(raw));
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

const STATUS_WORDS = /^(in use|active|deployed|in stock|stock|spare|available|retired|disposed|broken|faulty|lost|stolen|repair|in repair|reserved|en service|actif|en stock|disponible|reforme|hs|en panne|perdu|vole|en reparation|assigned|unassigned|decommissioned|pending|ordered|new|used)$/i;

export function looksLikeStatus(raw: string): boolean {
  return STATUS_WORDS.test(raw.normalize("NFD").replace(/[̀-ͯ]/g, "").trim());
}

export function looksLikeEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(raw.trim());
}

/** "LAP-PAR-0042", "SRV-DB01", "PC1234": short, no spaces, letters + digits, often dashes */
export function looksLikeHostname(raw: string): boolean {
  return /^[a-z][a-z0-9]*(?:[-_.][a-z0-9]+)+$/i.test(raw.trim()) && /\d/.test(raw) && raw.length <= 40;
}

/** "John Smith", "Dupont, Marie" */
export function looksLikePersonName(raw: string): boolean {
  return /^[A-ZÀ-Ý][a-zà-ÿ'-]+(?:,?\s+[A-ZÀ-Ý][a-zà-ÿ'-]+){1,2}$/.test(raw.trim());
}
