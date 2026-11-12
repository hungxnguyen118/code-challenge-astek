import type { Normalized } from "../types";

interface CpuPattern {
  re: RegExp;
  build: (m: RegExpExecArray) => string;
  confidence: number;
}

const up = (s: string | undefined) => (s ? s.toUpperCase() : "");

/**
 * Ordered from most to least specific. Each pattern produces a short canonical
 * label: "Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz" → "Intel Core i5-8250U".
 */
const PATTERNS: CpuPattern[] = [
  {
    // Intel Core Ultra 7 155H
    re: /core\s*(?:\(tm\)\s*)?ultra\s*([3579])(?:\s*[- ]?\s*(\d{3}[a-z]{0,2}))?/i,
    build: (m) => `Intel Core Ultra ${m[1]}${m[2] ? ` ${up(m[2])}` : ""}`,
    confidence: 0.95,
  },
  {
    // Intel Core i7-1185G7, i5 8250U, Core i7, "i7"
    re: /(?<![a-z0-9])(?:intel\s*(?:\(r\)\s*)?)?(?:core\s*(?:\(tm\)\s*)?)?(i[3579])(?:\s*[- ]\s*|)(\d{3,5}[a-z]{0,2}\d?)?(?![a-z0-9])/i,
    build: (m) => `Intel Core ${m[1]!.toLowerCase()}${m[2] ? `-${up(m[2])}` : ""}`,
    confidence: 0.9,
  },
  {
    // Xeon Gold 6230, Xeon E5-2620 v4, Xeon Silver 4210R, Xeon W-2245
    re: /xeon\s*(?:\(r\)\s*)?(?:cpu\s*)?((?:platinum|gold|silver|bronze)\s*\d{4}[a-z]{0,2}|[ew]\d?\s*-?\s*\d{4}[a-z]?(?:\s*v\d)?|w-?\d{4}[a-z]?|d-?\d{4}[a-z]?)?/i,
    build: (m) => `Intel Xeon${m[1] ? ` ${tidyXeon(m[1])}` : ""}`,
    confidence: 0.9,
  },
  {
    // AMD Ryzen 7 PRO 5850U, Ryzen 5 4650U, Threadripper
    re: /ryzen\s*(?:threadripper\s*)?(?:ai\s*)?([3579])\s*(pro\s*)?(\d{3,4}[a-z]{0,3})?/i,
    build: (m) => `AMD Ryzen ${m[1]}${m[2] ? " PRO" : ""}${m[3] ? ` ${up(m[3])}` : ""}`,
    confidence: 0.9,
  },
  {
    re: /epyc\s*(\d{4}[a-z]?)?/i,
    build: (m) => `AMD EPYC${m[1] ? ` ${up(m[1])}` : ""}`,
    confidence: 0.9,
  },
  {
    // Apple M1 / M2 Pro / M3 Max — require "apple" or an explicit Pro/Max/Ultra suffix, or the cell being just "M2"
    re: /(?:apple\s*(?:silicon\s*)?)(m[1-5])(?:\s*(pro|max|ultra))?|^\s*(m[1-5])(?:\s*(pro|max|ultra))?\s*$/i,
    build: (m) => `Apple ${up(m[1] ?? m[3])}${m[2] ?? m[4] ? ` ${capitalize(m[2] ?? m[4] ?? "")}` : ""}`,
    confidence: 0.9,
  },
  {
    re: /(celeron|pentium|atom)\s*(?:\(r\)\s*)?(?:silver|gold)?\s*([a-z]?\d{3,5}[a-z]?)?/i,
    build: (m) => `Intel ${capitalize(m[1]!)}${m[2] ? ` ${up(m[2])}` : ""}`,
    confidence: 0.85,
  },
  {
    re: /snapdragon\s*(x\s*(?:elite|plus)|[0-9a-z]+(?:\s*gen\s*\d)?)?/i,
    build: (m) => `Qualcomm Snapdragon${m[1] ? ` ${capitalize(m[1])}` : ""}`,
    confidence: 0.85,
  },
  {
    re: /\b(amd)\s*(a\d{1,2}|athlon|opteron|fx)\s*([- ]?\d{3,4}[a-z]?)?/i,
    build: (m) => `AMD ${capitalize(m[2]!)}${m[3] ? ` ${up(m[3].replace(/^[- ]/, ""))}` : ""}`,
    confidence: 0.8,
  },
];

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function tidyXeon(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/^(platinum|gold|silver|bronze)/i, (x) => capitalize(x))
    .replace(/^([ew])(\d?)\s*-?\s*(\d{4})/i, (_x, a: string, b: string, c: string) => `${a.toUpperCase()}${b}-${c}`)
    .replace(/\s*v(\d)$/i, " v$1")
    .trim();
}

/** Normalise a CPU description to a short canonical label. */
export function normalizeCpu(raw: unknown): Normalized<string> | null {
  if (typeof raw !== "string") return null;
  const s = raw.replace(/ /g, " ").trim();
  if (!s) return null;
  for (const p of PATTERNS) {
    const m = p.re.exec(s);
    if (m && m[0].trim()) return { value: p.build(m), confidence: p.confidence };
  }
  // "2.4 GHz", "Intel 2.6GHz" — something processor-ish but no model
  const ghz = /(\d(?:[.,]\d{1,2})?)\s*ghz/i.exec(s);
  if (ghz) return { value: s, confidence: 0.5 };
  if (/\b(intel|amd|arm|qualcomm|processor|cpu)\b/i.test(s)) return { value: s, confidence: 0.45 };
  return null;
}

/** Find a CPU mention inside free text; returns the matched substring too. */
export function findCpu(text: string): { value: string; match: string; confidence: number } | null {
  for (const p of PATTERNS) {
    const m = p.re.exec(text);
    if (m && m[0].trim()) return { value: p.build(m), match: m[0], confidence: p.confidence };
  }
  return null;
}
