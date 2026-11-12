import type { AssetType, StorageValue } from "../types";
import { parseLooseNumber, round } from "../text";
import { findCpu } from "./cpu";
import { findManufacturer } from "./manufacturer";
import { findFamily, normalizeModel } from "./model";
import { findAssetTypeInText } from "./assetType";
import { normalizeStorage } from "./storage";
import { normalizeOs } from "./misc";

export interface ParsedPart<T> {
  value: T;
  confidence: number;
  /** The substring of the input the value came from. */
  match: string;
}

export interface CombinedParse {
  manufacturer?: ParsedPart<string>;
  model?: ParsedPart<string>;
  assetType?: ParsedPart<AssetType>;
  cpu?: ParsedPart<string>;
  ramGB?: ParsedPart<number>;
  storage?: ParsedPart<StorageValue>;
  screenInches?: ParsedPart<number>;
  os?: ParsedPart<string>;
}

const SEP = " ¦ ";

/**
 * Pull as many fields as possible out of one free-text cell.
 *
 * Strategy: extract the *least ambiguous* things first and blank them out of the
 * string ("masking"), so later, fuzzier steps don't trip over them:
 *   storage (has SSD/HDD/TB) → RAM (remaining GB) → screen (inch marks) → CPU →
 *   OS → manufacturer → model family → leftover segment next to the brand = model.
 *
 * "HP EliteBook 840 G8 / i5 / 16GB / 256GB SSD / 14in"
 *   → HP · EliteBook 840 G8 · Intel Core i5 · 16 GB · 256 GB SSD · 14" · laptop
 */
export function parseCombined(text: string, knownManufacturer?: string): CombinedParse {
  const out: CombinedParse = {};
  let rest = ` ${text.replace(/ /g, " ").replace(/\s+/g, " ")} `;
  const mask = (m: string) => {
    rest = rest.replace(m, SEP);
  };

  // 1. Storage: numbers attached to a drive type, or anything in TB.
  const storageMatches: string[] = [];
  const storageRe =
    /(?<![\d.,])(?:\d{1,3}\s*[x×]\s*)?\d{1,7}(?:[.,]\d{1,4})?\s*(?:tb|to|gb|go|g|t)?\s*(?:sas\s*|sata\s*)?(?:pcie\s*)?(?:nvme\s*)?(?:m\.2\s*)?(?:ssd|hdd|nvme|emmc|sshd|flash)\b|(?:ssd|hdd|nvme)\s*:?\s*\d{1,7}(?:[.,]\d{1,4})?\s*(?:tb|to|gb|go)\b|(?<![\d.,])(?:\d{1,3}\s*[x×]\s*)?\d{1,7}(?:[.,]\d{1,4})?\s*(?:tb|to)\b/gi;
  for (const m of rest.matchAll(storageRe)) storageMatches.push(m[0]);
  if (storageMatches.length > 0) {
    const st = normalizeStorage(storageMatches.join(" + ").replace(/(ssd|hdd|nvme)\s*:?\s*(\d)/gi, "$2 $1"));
    if (st) {
      out.storage = { value: st.value, confidence: st.confidence * 0.9, match: storageMatches.join(" + ") };
      storageMatches.forEach(mask);
    }
  }

  // 2a. RAM written as modules: "2x8GB", "2 x 8 Go", "8+8GB", "8GB + 8GB" → total.
  const modules = /(?<![\d.,])(\d{1,2})\s*[x×*]\s*(\d{1,4})\s*(?:gb|go|g)\b|(?<![\d.,])(\d{1,4})\s*(?:gb|go|g)?\s*\+\s*(\d{1,4})\s*(?:gb|go|g)\b/i.exec(rest);
  if (modules) {
    const total = modules[1] ? Number(modules[1]) * Number(modules[2]) : Number(modules[3]) + Number(modules[4]);
    if (total > 0 && total <= 2048) {
      out.ramGB = { value: total, confidence: 0.85, match: modules[0] };
      mask(modules[0]);
    }
  }

  // 2b. RAM: remaining "<n> GB" values. If two remain and no storage yet, the bigger one is storage.
  const gbRe = /(?<![\d.,])(\d{1,7}(?:[.,]\d{1,4})?)\s*(?:gb|go|g|gig|gigs)\b(?:\s*(?:of\s*)?(?:ram|ddr\d\w*|lpddr\d\w*|memory|m[eé]moire|mem))?|(?:ram|memory|m[eé]moire|mem)\s*:?\s*(\d{1,7})\s*(?:gb|go|g)?\b/gi;
  const gbs = [...rest.matchAll(gbRe)].map((m) => ({ text: m[0], n: parseLooseNumber(m[1] ?? m[2] ?? "") ?? 0 }));
  if (gbs.length > 0) {
    const sorted = [...gbs].sort((a, b) => a.n - b.n);
    const ram = out.ramGB ? null : (gbs.find((g) => /ram|ddr|mem|m[eé]moire/i.test(g.text)) ?? sorted[0]!);
    if (ram && ram.n > 0 && ram.n <= 2048) {
      out.ramGB = { value: ram.n, confidence: /ram|ddr|mem/i.test(ram.text) ? 0.9 : 0.75, match: ram.text };
      mask(ram.text);
    }
    const biggest = sorted[sorted.length - 1]!;
    if (!out.storage && biggest !== ram && biggest.n >= 64) {
      out.storage = { value: { totalGB: biggest.n, drives: [{ sizeGB: biggest.n, type: null }] }, confidence: 0.6, match: biggest.text };
      mask(biggest.text);
    }
  }

  // 3. Screen size: explicit inch marks, or cm.
  const screen = /(?<![\d.,])(\d{1,2}(?:[.,]\d)?)\s*(?:"|''|”|″|-?\s*in(?:ch(?:es)?)?\b|\s*pouces?\b)|(?<![\d.,])(\d{2}(?:[.,]\d)?)\s*cm\b/i.exec(rest);
  if (screen) {
    const inches = screen[1] ? parseLooseNumber(screen[1]) : (parseLooseNumber(screen[2]!) ?? 0) / 2.54;
    if (inches && inches >= 7 && inches <= 49) {
      out.screenInches = { value: round(inches, 1), confidence: 0.85, match: screen[0] };
      mask(screen[0]);
    }
  }

  // 4. CPU.
  const cpu = findCpu(rest);
  if (cpu) {
    out.cpu = { value: cpu.value, confidence: cpu.confidence * 0.9, match: cpu.match };
    mask(cpu.match);
  }

  // 5. OS.
  const os = /\b(?:win(?:dows)?\s*(?:server\s*)?(?:7|10|11|\d{4})(?:\s*(?:pro|enterprise))?|mac\s*os(?:\s*x)?|ubuntu(?:\s*[\d.]+)?|esxi(?:\s*[\d.]+)?|chrome\s*os)\b/i.exec(rest);
  if (os) {
    const n = normalizeOs(os[0]);
    if (n) out.os = { value: n.value, confidence: 0.8, match: os[0] };
    mask(os[0]);
  }

  // 6. Manufacturer.
  const brand = findManufacturer(rest);
  let manufacturer = knownManufacturer;
  if (brand) {
    out.manufacturer = { value: brand.entry.name, confidence: 0.85, match: brand.match };
    manufacturer = brand.entry.name;
  }

  const family = findFamily(rest, manufacturer);

  // 6b. Apple silicon written without "Apple" ("MBP 14 M1 Pro"): only meaningful once we know it's an Apple device.
  if (!out.cpu && (manufacturer ?? family?.manufacturer) === "Apple") {
    const m = /(?<![a-z0-9])(m[1-5])(?:\s+(pro|max|ultra))?(?![a-z0-9])/i.exec(rest);
    if (m) {
      const tier = m[2] ? ` ${m[2][0]!.toUpperCase()}${m[2].slice(1).toLowerCase()}` : "";
      out.cpu = { value: `Apple ${m[1]!.toUpperCase()}${tier}`, confidence: 0.8, match: m[0] };
      mask(m[0]);
    }
  }

  // 7. Model: the separator-delimited segment that holds the product family, else the one after the brand.
  const segments = rest.split(/\s*(?:¦|\/|\||;|,(?=\s)|\s-\s|\(|\))\s*/).map((s) => s.trim()).filter(Boolean);
  let modelSegment: string | undefined;
  if (family) modelSegment = segments.find((s) => findFamily(s, manufacturer)?.family === family.family);
  if (!modelSegment && brand) {
    const seg = segments.find((s) => s.toLowerCase().includes(brand.match.toLowerCase()));
    if (seg && seg.length > brand.match.length + 1) modelSegment = seg;
  }
  if (modelSegment) {
    // Remove a type word glued to the model ("Laptop Dell Latitude 5420")
    const cleaned = modelSegment.replace(/^(?:laptop|notebook|desktop|server|serveur|pc portable|portable|workstation)\s+/i, "");
    const model = normalizeModel(cleaned, manufacturer);
    if (model && model.value.length >= 2) {
      out.model = { value: model.value, confidence: model.confidence * (family ? 0.9 : 0.6), match: modelSegment };
    }
  }

  // 8. Asset type: explicit keyword in the text, else what the product family implies.
  const typeWord = findAssetTypeInText(text);
  if (typeWord) out.assetType = { value: typeWord.type, confidence: 0.8, match: typeWord.word };
  else if (family) out.assetType = { value: family.type, confidence: 0.7, match: family.match };
  return out;
}

/**
 * Number of distinct fields found in a text, not counting the asset type (which a bare
 * model name already implies). "ThinkPad T480" → 1, "Dell Lat 5420 i7 16GB" → 4.
 */
export function combinedRichness(text: string): number {
  if (text.length < 6) return 0;
  return Object.keys(parseCombined(text)).filter((k) => k !== "assetType").length;
}
