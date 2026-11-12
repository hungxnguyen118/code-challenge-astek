import type { Normalized } from "../types";
import { escapeRegExp, normalizeText } from "../text";
import { MANUFACTURERS, type ManufacturerEntry } from "../knowledge/manufacturers";

const SUFFIXES = /\b(inc|incorporated|corp|corporation|co|company|ltd|limited|llc|gmbh|sa|sas|ag|plc|computers?|technologies|technology|group|international)\b/g;

// Longest aliases first so "hewlett packard enterprise" wins over "hewlett packard".
const ALIASES = MANUFACTURERS.flatMap((m) => m.aliases.map((alias) => ({ alias, entry: m }))).sort(
  (a, b) => b.alias.length - a.alias.length,
);

const ALIAS_REGEXES = ALIASES.map(({ alias, entry }) => ({
  entry,
  alias,
  re: new RegExp(`(?<![a-z0-9])${escapeRegExp(alias).replace(/ /g, "[\\s-]*")}(?![a-z0-9])`, "i"),
}));

/** "Hewlett-Packard" → HP, "DELL INC." → Dell, "hpe" → HPE. Unknown brands are title-cased with low confidence. */
export function normalizeManufacturer(raw: unknown): Normalized<string> | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim();
  if (!cleaned || /^(n\/?a|unknown|inconnu|-+|\?+|none)$/i.test(cleaned)) return null;
  const n = normalizeText(cleaned);
  const stripped = n.replace(SUFFIXES, "").replace(/\s+/g, " ").trim();

  const exact = ALIASES.find(({ alias }) => alias === n || alias === stripped);
  if (exact) return { value: exact.entry.name, confidence: 1 };

  const found = findManufacturer(cleaned);
  if (found && found.index === 0) return { value: found.entry.name, confidence: 0.85 };
  if (found) return { value: found.entry.name, confidence: 0.6 };

  // Unknown brand: keep it, but tell the user we don't recognise it.
  if (/^[a-z][a-z0-9 .&-]{1,30}$/i.test(cleaned) && !/\d{3,}/.test(cleaned)) {
    return { value: titleCase(cleaned), confidence: 0.5 };
  }
  return null;
}

/** Find a known manufacturer mentioned anywhere in free text. */
export function findManufacturer(text: string): { entry: ManufacturerEntry; match: string; index: number } | null {
  let best: { entry: ManufacturerEntry; match: string; index: number } | null = null;
  for (const { entry, re, alias } of ALIAS_REGEXES) {
    // Very short aliases ("ms", "hp", "lg") only count as whole words — already enforced by the lookarounds.
    if (alias.length <= 2 && !/^(hp|lg)$/.test(alias)) continue;
    const m = re.exec(text);
    if (m && (best === null || m.index < best.index)) best = { entry, match: m[0], index: m.index };
  }
  return best;
}

export function isPeripheralBrand(name: string): boolean {
  return MANUFACTURERS.some((m) => m.name === name && m.peripheralOnly);
}

function titleCase(s: string): string {
  if (s === s.toUpperCase() && s.length <= 4) return s; // acronyms: "MSI", "AOC"
  return s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}
