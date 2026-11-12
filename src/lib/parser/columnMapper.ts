import type { ColumnMapping, DetectedColumn, DetectedTable, MappingTarget, TableOverride } from "../types";
import { ALL_FIELDS } from "../types";
import { FIELDS, fieldLabel } from "../extract/registry";
import { combinedRichness } from "../extract/combined";
import { isIgnoredHeader, scoreHeader } from "./headerMatch";

const TARGETS: MappingTarget[] = [...ALL_FIELDS, "combined"];
/** Targets that may legitimately be fed by several columns. */
const MULTI_COLUMN_TARGETS = new Set<MappingTarget>(["combined", "notes"]);

export const MIN_MAPPING_SCORE = 0.35;
const HEADER_WEIGHT = 0.55;
const CONTENT_WEIGHT = 0.45;

export interface ColumnScore {
  target: MappingTarget;
  score: number;
  header: number;
  content: number;
  reasons: string[];
}

/** Share of sample values that look like `target`, plus a description for the UI. */
function contentScore(col: DetectedColumn, target: MappingTarget): { score: number; reason: string } {
  const samples = col.samples;
  if (samples.length === 0) return { score: 0, reason: "" };
  let total = 0;
  let matches = 0;
  for (const s of samples) {
    // Description cells: 3+ fields ("Dell Lat 5420 i7 16GB") is clearly multi-field; brand + model alone only half counts.
    const v = target === "combined" ? richnessScore(combinedRichness(s)) : FIELDS[target].contentScore(numericOrText(s));
    total += v;
    if (v >= 0.5) matches++;
  }
  let score = total / samples.length;

  if (target === "serialNumber") {
    // Serials are unique. A column where values repeat is something else (model, location…).
    const unique = new Set(samples.map((s) => s.toUpperCase())).size / samples.length;
    if (unique < 0.8) score *= 0.4;
  }
  if (target === "assetType" || target === "manufacturer" || target === "status") {
    // Categorical: few distinct values. A unique-per-row column is unlikely to be a category.
    const unique = new Set(samples.map((s) => s.toLowerCase())).size;
    if (samples.length >= 8 && unique / samples.length > 0.8) score *= 0.5;
  }
  const label = target === "combined" ? "multi-field descriptions" : fieldLabel(target);
  return { score, reason: matches > 0 ? `${matches}/${samples.length} values look like ${label}` : "" };
}

function richnessScore(r: number): number {
  return r >= 3 ? 1 : r === 2 ? 0.5 : 0;
}

/** 1, 2, 3, 4… — a row-number column ("#", "Item", "No") carries no asset information. */
export function isSequentialIndex(samples: string[]): boolean {
  if (samples.length < 3) return false;
  const nums = samples.map(Number);
  if (nums.some((n) => !Number.isInteger(n))) return false;
  let steps = 0;
  for (let i = 1; i < nums.length; i++) if (nums[i]! - nums[i - 1]! === 1) steps++;
  return steps / (nums.length - 1) >= 0.8;
}

/** Samples are strings; give numeric-looking ones back their number type so numeric detectors work. */
function numericOrText(s: string): string | number {
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : s;
}

/**
 * Score every (column, target) pair:
 *    score = 0.55 × header evidence + 0.45 × content evidence
 * Adjustments:
 *  - no header row → content only
 *  - header names a field but the content contradicts it → header evidence × 0.7
 *  - header is a known non-asset column ("Qty", "Price") → content evidence × 0.3
 */
export function scoreColumn(col: DetectedColumn, hasHeader: boolean): ColumnScore[] {
  const ignored = hasHeader && isIgnoredHeader(col.header);
  if (isSequentialIndex(col.samples)) {
    return TARGETS.map((target) => ({ target, score: 0, header: 0, content: 0, reasons: ["row numbers (1, 2, 3…)"] }));
  }
  return TARGETS.map((target) => {
    const h = hasHeader ? scoreHeader(col.header, target) : { score: 0, reason: "" };
    const c = contentScore(col, target);
    let headerPart = h.score;
    // Header says X but the values don't look like X at all: trust the header less.
    // A "description" column must actually contain descriptions, so it is penalised harder.
    if (h.score > 0 && col.samples.length >= 3 && c.score < 0.1) headerPart *= target === "combined" ? 0.4 : 0.7;
    const contentPart = ignored ? c.score * 0.3 : c.score;
    const score = hasHeader ? HEADER_WEIGHT * headerPart + CONTENT_WEIGHT * contentPart : contentPart * 0.9;
    const reasons = [h.reason, c.reason].filter(Boolean);
    return { target, score, header: h.score, content: c.score, reasons };
  }).sort((a, b) => b.score - a.score);
}

/**
 * Assign columns to fields. Greedy on the global ranking of (column, target) scores:
 * the most certain pairs are fixed first, and each field gets at most one column
 * (except free-text targets). This resolves conflicts such as two numeric GB
 * columns competing for RAM: the better-scoring one wins, the other falls back to
 * its next-best target (Storage).
 */
export function mapColumns(table: DetectedTable, override?: TableOverride): ColumnMapping[] {
  const hasHeader = table.headerRow !== null;
  const scores = new Map<number, ColumnScore[]>();
  for (const col of table.columns) scores.set(col.index, scoreColumn(col, hasHeader));

  const manual = override?.columns ?? {};
  const assigned = new Map<number, ColumnMapping>();
  const taken = new Set<MappingTarget>();

  // 1. User choices always win.
  for (const col of table.columns) {
    if (!(col.index in manual)) continue;
    const target = manual[col.index] ?? null;
    assigned.set(col.index, {
      columnIndex: col.index,
      header: col.header,
      letter: col.letter,
      target,
      confidence: 1,
      reasons: [target ? "set by you" : "ignored by you"],
      manual: true,
    });
    if (target && !MULTI_COLUMN_TARGETS.has(target)) taken.add(target);
  }

  // 2. Greedy assignment of the rest.
  const pairs = [...scores.entries()]
    .filter(([idx]) => !assigned.has(idx))
    .flatMap(([idx, list]) => list.map((s) => ({ idx, ...s })))
    .filter((p) => p.score >= MIN_MAPPING_SCORE)
    .sort((a, b) => b.score - a.score);

  for (const p of pairs) {
    if (assigned.has(p.idx)) continue;
    if (taken.has(p.target) && !MULTI_COLUMN_TARGETS.has(p.target)) continue;
    const col = table.columns.find((c) => c.index === p.idx)!;
    const list = scores.get(p.idx)!;
    const runnerUp = list.find((s) => s.target !== p.target);
    // Ambiguity penalty: if the runner-up is close, we're less sure.
    const margin = runnerUp ? p.score - runnerUp.score : p.score;
    const confidence = Math.min(1, p.score / 0.8) * (margin < 0.08 ? 0.75 : 1);
    assigned.set(p.idx, {
      columnIndex: p.idx,
      header: col.header,
      letter: col.letter,
      target: p.target,
      confidence: Math.round(confidence * 100) / 100,
      reasons: p.reasons.length ? p.reasons : ["best guess from the values"],
      manual: false,
      alternative: runnerUp && runnerUp.score >= MIN_MAPPING_SCORE * 0.8 ? { target: runnerUp.target, score: runnerUp.score } : undefined,
    });
    if (!MULTI_COLUMN_TARGETS.has(p.target)) taken.add(p.target);
  }

  // 3. Everything else is left unmapped, with the reason.
  return table.columns.map((col) => {
    const m = assigned.get(col.index);
    if (m) return m;
    const best = scores.get(col.index)?.[0];
    const reason =
      col.samples.length === 0
        ? "column is empty"
        : isSequentialIndex(col.samples)
          ? "row numbers (1, 2, 3…)"
        : hasHeader && isIgnoredHeader(col.header)
          ? "not an asset field (e.g. price, quantity, network info)"
          : best && best.score >= MIN_MAPPING_SCORE
            ? `would be ${fieldLabel(best.target)}, but a better column was already chosen for it`
            : "no confident match";
    return {
      columnIndex: col.index,
      header: col.header,
      letter: col.letter,
      target: null,
      confidence: 0,
      reasons: [reason],
      manual: false,
      alternative: best && best.score > 0.2 ? { target: best.target, score: best.score } : undefined,
    };
  });
}
