import type { Normalized } from "../types";
import { parseLooseNumber } from "../text";
import type { UnitHint } from "./unitHint";

/** Typical DIMM speeds: a "RAM" value of 2400 is almost certainly MHz, not GB. */
export const MEMORY_SPEEDS_MHZ = new Set([800, 1066, 1333, 1600, 1866, 2133, 2400, 2666, 2933, 3200, 3600, 4266, 4800, 5200, 5600, 6000, 6400, 7500]);

const GB = "(?:gb|gib|go|g|gig|gigs|giga|gigabytes?|gbytes?)";
const MB = "(?:mb|mib|mo|megabytes?)";
const TB = "(?:tb|tib|to|terabytes?)";
// Bounded digit runs + "not inside a number" lookbehind keep matching linear even on a
// 2 000-digit cell; `\d+` here took seconds (catastrophic backtracking, see docs/AUDIT).
const NUM = "(?<![\\d.,])(\\d{1,7}(?:[.,]\\d{1,4})?)";

/**
 * Normalise a RAM value to a number of GB.
 *
 * "16" · "16GB" · "16 gig" · "16 Go" · "16384 MB" · "16 GB DDR4" · "2x8GB" · "8+8 GB" → 16
 *
 * Bare numbers are accepted with lower confidence, unless the header carried a
 * unit hint ("RAM (GB)", "Memory MB").
 */
export function normalizeRam(raw: unknown, hint?: UnitHint): Normalized<number> | null {
  if (typeof raw === "number") return fromBareNumber(raw, hint);
  if (typeof raw !== "string") return null;
  const s = raw.toLowerCase().replace(/ /g, " ").trim();
  if (!s) return null;

  // A cell that talks about disks is not RAM ("256GB SSD").
  if (/\b(ssd|hdd|nvme|emmc|disk|disque|sata|m\.2)\b/.test(s)) return null;

  // "2x8GB", "2 x 8 GB", "4*16GB"
  const multi = new RegExp(`(?<![\\d.,])(\\d{1,3})\\s*[x×*]\\s*${NUM}\\s*${GB}\\b`).exec(s);
  if (multi) return result(Number(multi[1]) * (parseLooseNumber(multi[2]!) ?? 0), 0.95);

  // "8+8 GB", "8GB + 8GB"
  const plus = new RegExp(`${NUM}\\s*(?:${GB})?\\s*\\+\\s*${NUM}\\s*${GB}\\b`).exec(s);
  if (plus) return result((parseLooseNumber(plus[1]!) ?? 0) + (parseLooseNumber(plus[2]!) ?? 0), 0.9);

  const tb = new RegExp(`${NUM}\\s*${TB}\\b`).exec(s);
  if (tb) return result((parseLooseNumber(tb[1]!) ?? 0) * 1024, 0.85);

  const gb = new RegExp(`${NUM}\\s*${GB}\\b`).exec(s);
  if (gb) return result(parseLooseNumber(gb[1]!) ?? 0, 0.95);

  const mb = new RegExp(`${NUM}\\s*${MB}\\b`).exec(s);
  if (mb) return result((parseLooseNumber(mb[1]!) ?? 0) / 1024, 0.9);

  const n = parseLooseNumber(s);
  if (n !== null) return fromBareNumber(n, hint);

  // "16 DDR4", "RAM: 16"
  const lead = /(?:^|[^\d.])(\d{1,4})(?:\s*(?:ddr\d|lpddr\d))/.exec(s);
  if (lead) return result(Number(lead[1]), 0.7);
  return null;
}

function fromBareNumber(n: number, hint?: UnitHint): Normalized<number> | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  if (hint === "MB") return result(n / 1024, 0.9);
  if (hint === "TB") return result(n * 1024, 0.85);
  if (hint === "GB") return result(n, 0.9);
  if (MEMORY_SPEEDS_MHZ.has(n)) return result(n, 0.2); // probably MHz – keep but flag
  // 1024 or more with no unit: very likely MB (4096, 8192, 16384…)
  if (n >= 1024 && n % 256 === 0) return result(n / 1024, 0.7);
  if (n >= 1 && n <= 1024) return result(n, isCommonSize(n) ? 0.75 : 0.5);
  if (n > 0 && n < 1) return result(n, 0.3);
  return null;
}

function isCommonSize(n: number): boolean {
  return [1, 2, 3, 4, 6, 8, 12, 16, 18, 24, 32, 36, 48, 64, 96, 128, 192, 256, 384, 512, 768, 1024].includes(n);
}

function result(gb: number, confidence: number): Normalized<number> | null {
  if (!Number.isFinite(gb) || gb <= 0) return null;
  const value = gb >= 1 ? Math.round(gb * 10) / 10 : Math.round(gb * 100) / 100;
  // Absurd values stay low-confidence so the UI flags them.
  const sane = value >= 0.5 && value <= 4096;
  return { value, confidence: sane ? confidence : Math.min(confidence, 0.25) };
}
