import { tokenize } from "../text";

export type UnitHint = "GB" | "MB" | "TB" | "in" | "cm";

/**
 * Many headers carry the unit the column is written in: "RAM (GB)", "Disk TB",
 * "Mémoire (Mo)", "Screen (cm)". When cells hold bare numbers, that unit is the
 * only thing that makes "16384" or "35.6" unambiguous.
 */
export function unitHintFromHeader(header: string): UnitHint | undefined {
  const tokens = tokenize(header);
  for (const t of tokens) {
    if (t === "gb" || t === "go" || t === "gib") return "GB";
    if (t === "mb" || t === "mo" || t === "mib") return "MB";
    if (t === "tb" || t === "to" || t === "tib") return "TB";
    if (t === "in" || t === "inch" || t === "inches" || t === "pouces" || t === "pouce" || t === "\"") return "in";
    if (t === "cm") return "cm";
  }
  if (/["”″]/.test(header)) return "in";
  return undefined;
}
