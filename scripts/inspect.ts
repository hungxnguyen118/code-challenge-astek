/**
 * Debug helper: print what the parser makes of a file.
 *   npx tsx scripts/inspect.ts tests/fixtures/02_assets_FINAL_v3_USE_THIS_ONE.xlsx
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { readWorkbook, analyzeWorkbook } from "../src/lib/parser";
import { formatStorage } from "../src/lib/extract/storage";
import { fieldLabel } from "../src/lib/extract/registry";

for (const path of process.argv.slice(2)) {
  console.log(`\n================ ${basename(path)}`);
  try {
    const buf = readFileSync(path);
    const raw = readWorkbook(basename(path), buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
    const result = analyzeWorkbook(raw);
    if (result.notes.length) console.log("notes:", result.notes);
    for (const s of result.sheets) {
      console.log(`\n# sheet "${s.name}" — ${s.status}${s.statusReason ? ` (${s.statusReason})` : ""}${s.included ? "" : " [excluded]"}${s.error ? ` ERROR ${s.error}` : ""}`);
      for (const t of s.tables) {
        console.log(`  table ${t.table.id}: header row ${t.table.headerRow ?? "none"} (${t.table.headerConfidence}) — ${t.table.headerReason}; rows ${t.table.firstRow}-${t.table.lastRow}`);
        for (const m of t.mapping) {
          console.log(`    ${m.letter} ${JSON.stringify(m.header).padEnd(28)} → ${(m.target ? fieldLabel(m.target) : "—").padEnd(26)} ${m.confidence.toFixed(2)}  ${m.reasons.join("; ")}`);
        }
        for (const a of t.assets) {
          const f = a.fields;
          const parts = [
            f.assetType?.value,
            f.manufacturer?.value,
            f.model?.value,
            f.serialNumber?.value,
            f.cpu?.value,
            f.ramGB ? `${f.ramGB.value}GB` : undefined,
            f.storage ? formatStorage(f.storage.value) : undefined,
            f.screenInches ? `${f.screenInches.value}"` : undefined,
          ].map((x) => x ?? "·");
          console.log(`    r${a.rowNumber} [${a.kind}${a.kindReason ? `: ${a.kindReason}` : ""}] ${parts.join(" | ")}${a.warnings.length ? `  ⚠ ${a.warnings.map((w) => w.code).join(",")}` : ""}`);
        }
      }
    }
    console.log("\nsummary:", JSON.stringify({ ...result.summary, completeness: undefined }));
  } catch (err) {
    console.log("ERROR:", err instanceof Error ? `${err.name}: ${err.message}` : err);
  }
}
