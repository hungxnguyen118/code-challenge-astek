/**
 * Regression tests for the issues found in the robustness / security audit (docs/AUDIT.en.md).
 * Each block names the finding it locks down.
 */
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { analyzeWorkbook, readWorkbook } from "@/lib/parser";
import { MAX_CELL_CHARS } from "@/lib/parser/ingest";
import { normalizeDate } from "@/lib/extract/misc";
import { toCsv, FORMULA_TRIGGER } from "@/lib/export";
import type { CellValue, RawWorkbook } from "@/lib/types";

const csvBytes = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;
const xlsxBytes = (sheets: Record<string, unknown[][]> | Array<[string, unknown[][]]>) => {
  const wb = XLSX.utils.book_new();
  for (const [name, aoa] of Array.isArray(sheets) ? sheets : Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa, { cellDates: true }), name);
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
};

// Minimal typing of the zip helper bundled with SheetJS.
interface ZipEntry { content: Uint8Array }
interface Zip { FullPaths: string[]; FileIndex: ZipEntry[] }
interface Cfb { read(d: Uint8Array, o: { type: "array" }): Zip; write(z: Zip, o: { type: "array"; fileType: "zip" }): ArrayBuffer }
function withDimension(bytes: ArrayBuffer, ref: string): ArrayBuffer {
  const CFB = (XLSX as unknown as { CFB: Cfb }).CFB;
  const zip = CFB.read(new Uint8Array(bytes), { type: "array" });
  const entry = zip.FileIndex[zip.FullPaths.findIndex((p) => p.endsWith("xl/worksheets/sheet1.xml"))]!;
  const xml = new TextDecoder().decode(entry.content).replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="${ref}"/>`);
  expect(xml).toContain(ref);
  entry.content = new TextEncoder().encode(xml);
  return CFB.write(zip, { type: "array", fileType: "zip" });
}
const allAssets = (r: ReturnType<typeof analyzeWorkbook>) => r.sheets.flatMap((s) => s.tables.flatMap((t) => t.assets));
const timed = <T>(f: () => T): [T, number] => {
  const t = performance.now();
  const v = f();
  return [v, performance.now() - t];
};

describe("F1 · CSV / formula injection in the export", () => {
  const csv = [
    "Model,Serial,Notes,Location",
    `"=HYPERLINK(""http://evil"",""x"")",ABC123,"+cmd|' /C calc'!A0","@SUM(1+1)"`,
    `Latitude 5420,DEF456," =1+1","-2+3"`,
  ].join("\n");
  const out = toCsv(analyzeWorkbook(readWorkbook("t.csv", csvBytes(csv))), { includeNonComputers: true });
  const rows = Papa.parse<string[]>(out.replace(/^﻿/, "")).data;
  const cells = rows.slice(1).flat();

  it("prefixes every formula-looking text cell with an apostrophe", () => {
    for (const bad of [`=HYPERLINK("http://evil","x")`, "+cmd|' /C calc'!A0", "@SUM(1+1)", "-2+3"]) {
      expect(cells).toContain(`'${bad}`);
      expect(cells).not.toContain(bad);
    }
  });
  it("catches what Papa's built-in rule misses: leading space, multi-line, full-width", () => {
    for (const s of [" =1+1", "=A1\nB", "＝1+1", "\t=1"]) expect(FORMULA_TRIGGER.test(s)).toBe(true);
    for (const s of ["Latitude 5420", "16 GB", "a=b", "N-1234"]) expect(FORMULA_TRIGGER.test(s)).toBe(false);
  });
  it("leaves numbers numeric", () => {
    const header = rows[0]!;
    const ram = rows.slice(1).map((r) => r[header.indexOf("ram_gb")]);
    expect(ram.every((v) => v === "" || /^\d+(\.\d+)?$/.test(v!))).toBe(true);
  });
});

describe("F2 · Excel dates don't shift with the user's time zone", () => {
  it.each(["UTC", "Asia/Ho_Chi_Minh", "Australia/Sydney", "Pacific/Kiritimati", "America/Los_Angeles", "Pacific/Pago_Pago"])("%s", (tz) => {
    const before = process.env.TZ;
    process.env.TZ = tz; // Node re-reads TZ on assignment
    try {
      const bytes = xlsxBytes({ S: [["Serial", "Model", "Purchase date"], ["ABC12345", "Latitude 5420", new Date(2023, 3, 1)]] });
      const asset = allAssets(analyzeWorkbook(readWorkbook("t.xlsx", bytes)))[0]!;
      expect(asset.fields.purchaseDate?.value).toBe("2023-04-01");
    } finally {
      process.env.TZ = before;
    }
  });
});

describe("F3 · declared sheet range much bigger than the data", () => {
  it("reads only the used cells (was ~40 s and ~1 GB)", () => {
    // Build a small workbook, then patch its <dimension> tag the way Excel writes it when a whole
    // column is formatted. (Asking SheetJS to *write* a 1M-row range would itself take ~20 s.)
    const bytes = withDimension(xlsxBytes({ S: [["Serial", "Model", "RAM"], ["X1Y2Z3", "Latitude 5420", "16GB"]] }), "A1:Z1048576");
    const [raw, ms] = timed(() => readWorkbook("t.xlsx", bytes));
    expect(raw.sheets[0]!.grid).toHaveLength(2);
    expect(ms).toBeLessThan(2000);
  });
  it("clips absurdly long cells and says so", () => {
    const raw = readWorkbook("t.csv", csvBytes(`Notes,Serial\n"${"x".repeat(MAX_CELL_CHARS + 500)}",ABC123\n`));
    expect(String(raw.sheets[0]!.grid[1]![0]).length).toBe(MAX_CELL_CHARS + 1);
    expect(raw.notes.join(" ")).toMatch(/shortened/);
  });
});

describe("F4 · no catastrophic regex backtracking (ReDoS)", () => {
  const nasty = ["1".repeat(2000), "14".repeat(1000) + '"', "1 ".repeat(1000), "9".repeat(1999) + "GB SSD", "2x".repeat(1000) + "8GB", "1.".repeat(1000) + "TB"];
  it.each(nasty.map((s, i) => [i, s] as const))("hostile cell #%i through the whole pipeline", (_i, s) => {
    const cell = `"${s}"`;
    const csv = "Description,Serial,RAM,Storage,CPU,Screen,Model\n" + Array(3).fill(Array(7).fill(cell).join(",")).join("\n");
    const [, ms] = timed(() => analyzeWorkbook(readWorkbook("t.csv", csvBytes(csv))));
    expect(ms).toBeLessThan(1500); // was > 15 s for #0 and #1
  });
  it("bounded digit runs still read real values", () => {
    const csv = "Description,Serial\n\"Dell Latitude 5420 i7 2x8GB 1,5 TB HDD + 512GB SSD 14in\",ABC12345\n";
    const a = allAssets(analyzeWorkbook(readWorkbook("t.csv", csvBytes(csv))))[0]!;
    expect(a.fields.ramGB?.value).toBe(16);
    expect(a.fields.storage?.value.totalGB).toBe(2012);
  });
});

describe("F5 · keys coming from the file can't hit Object.prototype", () => {
  it("sheets named __proto__ / constructor / toString behave like any sheet", () => {
    const row = (sn: string) => [["Serial", "Model"], [sn, "Latitude 5420"]];
    // Entries, not an object literal: `{ __proto__: … }` sets the prototype instead of a key — the very trap under test.
    const bytes = xlsxBytes([["__proto__", row("AAA11111")], ["constructor", row("BBB22222")], ["toString", row("CCC33333")]]);
    const r = analyzeWorkbook(readWorkbook("t.xlsx", bytes), { sheetInclusion: {} });
    expect(r.sheets.map((s) => s.included)).toEqual([true, true, true]);
    expect(r.summary.computers).toBe(3);
    const off = analyzeWorkbook(readWorkbook("t.xlsx", bytes), { sheetInclusion: { constructor: false } });
    expect(off.sheets.map((s) => s.included)).toEqual([true, false, true]);
  });
  it("brand counts are plain numbers whatever the brand is called", () => {
    const r = analyzeWorkbook(readWorkbook("t.csv", csvBytes("Manufacturer,Model,Serial,Type\nconstructor,X1,AAA111,laptop\ntoString,X2,BBB222,laptop\n")));
    for (const v of Object.values(r.summary.byManufacturer)) expect(typeof v).toBe("number");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe("F6 · dates: reject impossible or non-dates, no Date.parse guessing", () => {
  it.each([
    ["31/02/2023", null],
    ["2023-02-30", null],
    ["29/02/2023", null],
    ["29/02/2024", "2024-02-29"],
    ["Latitude 5420", null],
    ["Dell 2019", null],
    ["May 5", null],
    ["12.5", null],
    ["5 May 2023", "2023-05-05"],
    ["May 5, 2023", "2023-05-05"],
    ["1er avril 2023", "2023-04-01"],
    ["avril 2023", "2023-04-01"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeDate(input)?.value ?? null).toBe(expected);
  });
});

describe("Fuzz · random messy workbooks never crash the pipeline", () => {
  let seed = 42;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pick = <T>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]!;
  const POOL: CellValue[] = [null, "", "RAM", "Serial", "Model", "Type", "Laptop", "Monitor", "TOTAL", "16GB", "2x8GB", "512GB SSD", "1TB", "i7-1185G7", 'MBP 14" M1 Pro', "DL380 Gen10", "HP", "N/A", "abc-123-xyz", 0, -1, 1e308, 2400, 14, 45000, true, new Date(Date.UTC(2023, 3, 1)), "constructor", "__proto__", "=1+1", "​ABC", "😀", "1".repeat(300), "15,6 pouces", "2023-02-31"];

  it("100 random workbooks × (plain + random overrides) + export", () => {
    for (let it = 0; it < 100; it++) {
      const sheets = Array.from({ length: 1 + Math.floor(rnd() * 3) }, (_, si) => ({
        name: pick(["Sheet1", "Sheet1 (2)", "Servers", "constructor", "__proto__"]) + si,
        hidden: rnd() < 0.2,
        grid: Array.from({ length: Math.floor(rnd() * 30) }, () => Array.from({ length: Math.floor(rnd() * 10) }, () => pick(POOL))),
        firstRow: 1 + Math.floor(rnd() * 5),
        firstCol: Math.floor(rnd() * 3),
      }));
      const wb: RawWorkbook = { fileName: "f.xlsx", fileType: "xlsx", sheets, notes: [] };
      const r = analyzeWorkbook(wb);
      const t = r.sheets.flatMap((s) => s.tables)[0];
      const a = allAssets(r)[0];
      const r2 = analyzeWorkbook(wb, {
        sheetInclusion: Object.fromEntries(sheets.map((s) => [s.name, rnd() < 0.5])),
        tables: t ? { [t.table.id]: { headerRow: rnd() < 0.5 ? "none" : 999, columns: { 0: pick(["ramGB", "serialNumber", "combined", null] as const) } } } : {},
        cellEdits: a ? { [a.id]: { ramGB: pick(["32", "", "abc"]), serialNumber: "X" } } : {},
        rowKinds: a ? { [a.id]: "non-computer" } : {},
      });
      expect(() => toCsv(r2, { includeNonComputers: true })).not.toThrow();
    }
  }, 30_000);
});
