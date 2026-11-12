import type { MappingTarget } from "../types";
import { jaroWinkler, normalizeText } from "../text";
import { HEADER_VOCABULARY, IGNORED_HEADER_WORDS } from "../knowledge/synonyms";

export interface HeaderMatch {
  target: MappingTarget;
  score: number;
  reason: string;
}

// "to"/"in" are deliberately absent: they are units ("To" = French TB) but also words ("Assigned to").
const UNIT_TOKENS = new Set(["gb", "go", "gib", "mb", "mo", "mib", "tb", "tib", "inch", "inches", "cm", "ghz", "mhz"]);
const TARGETS = Object.keys(HEADER_VOCABULARY) as MappingTarget[];

/** Header text without units/noise: "RAM (GB)" → "ram", "Écran (pouces)" → "ecran pouces". */
export function cleanHeader(header: string): string {
  return normalizeText(header)
    .split(" ")
    .filter((t) => t && !UNIT_TOKENS.has(t))
    .join(" ");
}

function containsPhrase(haystack: string, phrase: string): boolean {
  return ` ${haystack} `.includes(` ${phrase} `);
}

/**
 * Score how well a header names a given target (0..1), with a human-readable reason.
 *
 *   exact synonym          1.0    "Serial Number"
 *   contains synonym       0.7–0.95 depending on how much of the header it covers ("Laptop Serial No")
 *   weak synonym           0.6 / 0.4 ("Name")
 *   typo-tolerant match    0.65   "Memmory", "Seriall" (Jaro-Winkler ≥ 0.9)
 *   veto word present      × 0.25 ("RAM slots", "Monitor serial")
 */
export function scoreHeader(header: string, target: MappingTarget): HeaderMatch {
  const h = cleanHeader(header);
  const vocab = HEADER_VOCABULARY[target];
  if (!h) return { target, score: 0, reason: "" };

  let score = 0;
  let reason = "";
  for (const phrase of vocab.strong) {
    if (h === phrase) return veto({ target, score: 1, reason: `header “${header}” is a known name for this field` }, h, vocab.veto);
    if (containsPhrase(h, phrase)) {
      const s = 0.7 + 0.25 * (phrase.length / h.length);
      if (s > score) {
        score = s;
        reason = `header “${header}” contains “${phrase}”`;
      }
    }
  }
  for (const phrase of vocab.weak ?? []) {
    const s = h === phrase ? 0.6 : containsPhrase(h, phrase) ? 0.4 : 0;
    if (s > score) {
      score = s;
      reason = `header “${header}” loosely suggests this field (“${phrase}”)`;
    }
  }
  if (score < 0.65) {
    // Typo tolerance: compare whole header and each token with single-word synonyms.
    const tokens = h.split(" ").filter((t) => t.length >= 4);
    for (const phrase of vocab.strong) {
      if (phrase.length < 4) continue;
      // Whole-header comparison only between strings of similar length ("Memmory" vs "memory", not "Device" vs "device type").
      const whole = Math.abs(h.length - phrase.length) <= 2 ? jaroWinkler(h, phrase) : 0;
      const best = Math.max(whole, ...(phrase.includes(" ") ? [] : tokens.map((t) => jaroWinkler(t, phrase))));
      if (best >= 0.9 && 0.65 > score) {
        score = 0.65;
        reason = `header “${header}” looks like a typo of “${phrase}”`;
      }
    }
  }
  return veto({ target, score, reason }, h, vocab.veto);
}

function veto(m: HeaderMatch, h: string, words: string[] | undefined): HeaderMatch {
  const v = words?.find((w) => containsPhrase(h, w));
  if (!v || m.score === 0) return m;
  return { ...m, score: m.score * 0.25, reason: `${m.reason}, but “${v}” suggests it's something else` };
}

/** Best target for a header, used by header-row detection. */
const bestCache = new Map<string, HeaderMatch | null>();

export function bestHeaderMatch(header: string): HeaderMatch | null {
  const cached = bestCache.get(header);
  if (cached !== undefined) return cached;
  let best: HeaderMatch | null = null;
  for (const t of TARGETS) {
    const m = scoreHeader(header, t);
    if (m.score > 0 && (!best || m.score > best.score)) best = m;
  }
  if (bestCache.size > 5000) bestCache.clear();
  bestCache.set(header, best);
  return best;
}

/** "Qty", "Price", "IP address"… — known columns that are not asset fields. */
export function isIgnoredHeader(header: string): boolean {
  const h = cleanHeader(header);
  if (!h) return false;
  return IGNORED_HEADER_WORDS.some((w) => h === w || containsPhrase(h, w));
}

/** Does this cell look like a column title (any known field or a known non-asset column)? */
export function isHeaderKeyword(text: string): boolean {
  if (text.length > 40) return false;
  const best = bestHeaderMatch(text);
  return (best !== null && best.score >= 0.7) || isIgnoredHeader(text);
}
