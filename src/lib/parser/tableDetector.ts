import type { CellValue, DataRow, DetectedColumn, DetectedTable, RawSheet, TableOverride } from "../types";
import { cellToString, columnLetter, isBlank, isNumericLike, normalizeText } from "../text";
import { isHeaderKeyword } from "./headerMatch";

const HEADER_SCAN_ROWS = 25;
const MAX_SAMPLES = 50;

interface RowStats {
  nonEmpty: number;
  keywordHits: number;
  textRatio: number;
  uniqueRatio: number;
  hasAdjacentDuplicates: boolean;
}

function rowStats(row: CellValue[] | undefined): RowStats {
  const cells = (row ?? []).filter((c) => !isBlank(c));
  const n = cells.length;
  if (n === 0) return { nonEmpty: 0, keywordHits: 0, textRatio: 0, uniqueRatio: 0, hasAdjacentDuplicates: false };
  let hits = 0;
  let text = 0;
  for (const c of cells) {
    // Labels are short text without numbers ("RAM (GB)" yes, "512GB SSD" or "5CG1234XYZ" no).
    if (typeof c !== "string" || isNumericLike(c) || /\d{2,}/.test(c)) continue;
    if (c.length <= 40) text++;
    if (isHeaderKeyword(c)) hits++;
  }
  const strings = cells.map((c) => normalizeText(cellToString(c)));
  const unique = new Set(strings).size;
  let adjacentDup = false;
  const r = row ?? [];
  for (let i = 1; i < r.length; i++) if (!isBlank(r[i] ?? null) && r[i] === r[i - 1]) adjacentDup = true;
  return { nonEmpty: n, keywordHits: hits, textRatio: text / n, uniqueRatio: unique / n, hasAdjacentDuplicates: adjacentDup };
}

/**
 * Score a row as a header candidate. Signals:
 *  - many cells match known column names (strongest signal)
 *  - mostly short text (headers are rarely numbers or dates)
 *  - all-distinct values
 *  - followed by rows of similar width (a table actually hangs below it)
 *  - a lone cell ("IT Inventory 2024") is a title, not a header
 */
function headerScore(grid: CellValue[][], idx: number, end: number, widest: number): { score: number; stats: RowStats } {
  const stats = rowStats(grid[idx]);
  if (stats.nonEmpty < 2) return { score: -Infinity, stats };
  let support = 0;
  let checked = 0;
  for (let j = idx + 1; j <= end && checked < 5; j++) {
    const s = rowStats(grid[j]);
    if (s.nonEmpty === 0) continue;
    checked++;
    if (s.nonEmpty >= Math.max(2, stats.nonEmpty * 0.4)) support++;
  }
  const supportRatio = checked ? support / checked : 0;
  const score =
    2 * (stats.keywordHits / stats.nonEmpty) +
    0.3 * Math.min(stats.keywordHits, 6) +
    stats.textRatio +
    0.5 * stats.uniqueRatio +
    1.5 * supportRatio +
    0.5 * Math.min(1, stats.nonEmpty / Math.max(widest, 1));
  return { score, stats };
}

/** Split a sheet into blocks of rows separated by 2+ empty rows. */
function findBlocks(grid: CellValue[][]): Array<[number, number]> {
  const blocks: Array<[number, number]> = [];
  let start = -1;
  let blanks = 0;
  for (let i = 0; i < grid.length; i++) {
    const empty = (grid[i] ?? []).every((c) => isBlank(c));
    if (empty) {
      blanks++;
      if (start !== -1 && blanks >= 2) {
        blocks.push([start, i - blanks]);
        start = -1;
      }
      continue;
    }
    if (start === -1) start = i;
    blanks = 0;
  }
  if (start !== -1) {
    let end = grid.length - 1;
    while (end > start && (grid[end] ?? []).every((c) => isBlank(c))) end--;
    blocks.push([start, end]);
  }
  return blocks;
}

interface HeaderPick {
  /** grid indexes of header rows (1 or 2 rows), empty when there's no header */
  rows: number[];
  confidence: number;
  reason: string;
}

function pickHeader(grid: CellValue[][], start: number, end: number): HeaderPick {
  let widest = 0;
  for (let i = start; i <= end; i++) widest = Math.max(widest, rowStats(grid[i]).nonEmpty);

  let best: { idx: number; score: number; stats: RowStats } | null = null;
  for (let i = start; i <= Math.min(end, start + HEADER_SCAN_ROWS); i++) {
    const { score, stats } = headerScore(grid, i, end, widest);
    if (score > (best?.score ?? -Infinity)) best = { idx: i, score, stats };
  }
  if (!best) return { rows: [], confidence: 0, reason: "no row with at least two filled cells" };

  const { stats, idx } = best;
  let confidence: number;
  let reason: string;
  if (stats.keywordHits >= 2) {
    confidence = Math.min(1, 0.6 + 0.1 * stats.keywordHits);
    reason = `${stats.keywordHits} of ${stats.nonEmpty} cells are known column names`;
  } else if (stats.keywordHits === 1 && stats.textRatio >= 0.9 && stats.nonEmpty >= 3) {
    confidence = 0.55;
    reason = "row of labels above the data (1 known column name)";
  } else if (stats.textRatio === 1 && stats.uniqueRatio === 1 && stats.nonEmpty >= 3 && stats.nonEmpty >= widest * 0.6 && idx === firstFilled(grid, start, end, 3)) {
    // Unfamiliar vocabulary (another language?) but it *looks* like a header: all distinct short labels on top.
    confidence = 0.4;
    reason = "first row is all distinct labels, but none are familiar column names";
  } else {
    return { rows: [], confidence: 0.6, reason: "no row looks like a header — columns were identified from their content" };
  }

  // Two-row headers: a merged group row above ("Hardware" spanning CPU/RAM/Disk) or below.
  const above = idx - 1 >= start ? rowStats(grid[idx - 1]) : null;
  if (above && above.hasAdjacentDuplicates && above.textRatio === 1 && above.nonEmpty >= 2) {
    return { rows: [idx - 1, idx], confidence, reason: `${reason}; two-row header (grouped titles above)` };
  }
  const below = idx + 1 <= end ? rowStats(grid[idx + 1]) : null;
  if (below && stats.hasAdjacentDuplicates && below.textRatio >= 0.9 && below.keywordHits >= 1) {
    return { rows: [idx, idx + 1], confidence, reason: `${reason}; two-row header (grouped titles)` };
  }
  return { rows: [idx], confidence, reason };
}

function firstFilled(grid: CellValue[][], start: number, end: number, minCells: number): number {
  for (let i = start; i <= end; i++) if (rowStats(grid[i]).nonEmpty >= minCells) return i;
  return -1;
}

function headerText(grid: CellValue[][], headerRows: number[], col: number): string {
  const parts: string[] = [];
  for (const r of headerRows) {
    const t = cellToString(grid[r]?.[col] ?? null);
    if (t && !parts.includes(t)) parts.push(t);
  }
  return parts.join(" / ");
}

/** A data row that repeats the header (common when tables are copy-pasted together). */
export function isRepeatedHeader(cells: CellValue[], headers: string[]): boolean {
  let same = 0;
  let filled = 0;
  cells.forEach((c, i) => {
    if (isBlank(c)) return;
    filled++;
    const h = headers[i];
    if (h && normalizeText(cellToString(c)) === normalizeText(h.split(" / ").pop() ?? h)) same++;
  });
  return filled >= 2 && same / filled >= 0.6;
}

/**
 * Find the tables in a sheet: split into blocks, find each block's header row
 * (or decide there is none), and detect a *second* header inside a block, which
 * means two tables were stacked without a blank line between them.
 */
export function detectTables(sheet: RawSheet, sheetIndex: number, overrides: Record<string, TableOverride> = {}): DetectedTable[] {
  const { grid } = sheet;
  const tables: DetectedTable[] = [];
  const blocks = findBlocks(grid);

  blocks.forEach(([bStart, bEnd], blockIndex) => {
    let segStart = bStart;
    let part = 0;
    while (segStart <= bEnd) {
      const id = `${sheetIndex}.${blockIndex}.${part}`;
      const override = overrides[id];
      let pick: HeaderPick;
      if (override?.headerRow === "none") {
        pick = { rows: [], confidence: 1, reason: "you said this table has no header row" };
      } else if (typeof override?.headerRow === "number") {
        const gi = override.headerRow - sheet.firstRow;
        pick =
          gi >= segStart && gi <= bEnd
            ? { rows: [gi], confidence: 1, reason: `header row set by you (row ${override.headerRow})` }
            : pickHeader(grid, segStart, bEnd);
      } else {
        pick = pickHeader(grid, segStart, bEnd);
      }

      // Rows before the header within the segment (titles, notes) are ignored.
      const dataStart = pick.rows.length ? pick.rows[pick.rows.length - 1]! + 1 : segStart;
      const headerRowCells = pick.rows.length ? (grid[pick.rows[pick.rows.length - 1]!] ?? []) : [];

      // Look for a second, different header further down → split the block.
      let segEnd = bEnd;
      for (let i = dataStart + 1; i <= bEnd; i++) {
        const s = rowStats(grid[i]);
        if (s.keywordHits >= 3 && s.keywordHits / s.nonEmpty >= 0.5 && s.textRatio >= 0.9) {
          const sameAsCurrent = isRepeatedHeader(grid[i] ?? [], headerRowCells.map((c) => cellToString(c)));
          if (!sameAsCurrent) {
            segEnd = i - 1;
            break;
          }
        }
      }

      const table = buildTable(sheet, id, pick, dataStart, segEnd);
      if (table && (table.rows.length > 0 || pick.rows.length > 0)) tables.push(table);
      segStart = segEnd + 1;
      part++;
    }
  });
  return tables;
}

function buildTable(sheet: RawSheet, id: string, pick: HeaderPick, dataStart: number, dataEnd: number): DetectedTable | null {
  const { grid } = sheet;
  const rows: DataRow[] = [];
  let width = 0;
  for (let i = dataStart; i <= dataEnd; i++) {
    const cells = grid[i] ?? [];
    if (cells.every((c) => isBlank(c))) continue;
    rows.push({ rowNumber: sheet.firstRow + i, cells });
    for (let c = cells.length - 1; c >= 0; c--) {
      if (!isBlank(cells[c] ?? null)) {
        width = Math.max(width, c + 1);
        break;
      }
    }
  }
  for (const r of pick.rows) width = Math.max(width, (grid[r] ?? []).length);
  if (width === 0) return null;
  // A block made only of single-cell lines (a title, a note) is not a table.
  if (pick.rows.length === 0 && !rows.some((r) => r.cells.filter((c) => !isBlank(c)).length >= 2)) return null;

  const columns: DetectedColumn[] = [];
  for (let c = 0; c < width; c++) {
    const letter = columnLetter(sheet.firstCol + c);
    const header = pick.rows.length ? headerText(grid, pick.rows, c) : "";
    const samples: string[] = [];
    for (const r of rows) {
      const v = r.cells[c] ?? null;
      if (!isBlank(v)) samples.push(cellToString(v));
      if (samples.length >= MAX_SAMPLES) break;
    }
    if (!header && samples.length === 0) continue; // fully empty column
    columns.push({ index: c, letter, header: header || `Column ${letter}`, samples });
  }

  // Section title: the nearest single-cell line within 3 rows above the header.
  let title: string | undefined;
  const top = pick.rows[0] ?? dataStart;
  for (let i = top - 1; i >= Math.max(0, top - 3); i--) {
    const cells = (grid[i] ?? []).filter((c) => !isBlank(c));
    // Skip lines like "Last updated: 03/2024" — titles rarely contain numbers.
    if (cells.length === 1 && typeof cells[0] === "string" && cells[0].length <= 60 && !/\d{2,}/.test(cells[0])) {
      title = cells[0];
      break;
    }
    if (cells.length > 1) break;
  }

  const headerRow = pick.rows.length ? sheet.firstRow + pick.rows[pick.rows.length - 1]! : null;
  const firstRow = pick.rows.length ? sheet.firstRow + pick.rows[0]! : (rows[0]?.rowNumber ?? sheet.firstRow);
  return {
    id,
    sheetName: sheet.name,
    headerRow,
    headerConfidence: pick.confidence,
    headerReason: pick.reason,
    title,
    columns,
    rows,
    firstRow,
    lastRow: rows[rows.length - 1]?.rowNumber ?? firstRow,
  };
}
