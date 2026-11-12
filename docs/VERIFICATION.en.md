# Independent verification — 12 November 2026

Reviewed commit: `dc50863`. Environment: Windows, Node `v24.18.0`, npm `11.16.0`, Asia/Bangkok. Scope: compare the challenge brief with the implementation, run existing checks, probe additional inputs, and prepare [manual testing](MANUAL-TEST.en.md).

Follow-up: official email attachments were subsequently reviewed in [RESOURCE-REVIEW.en.md](RESOURCE-REVIEW.en.md), revealing additional core-field loss. Agent instructions and acceptance targets now live in `AGENTS.md`, [engineering rules](ENGINEERING-RULES.en.md) and [quality gates](QUALITY-GATES.en.md).

## Result

The existing fixture scenarios pass, but the app is **not yet verified for arbitrary layouts**. Additional probes reproduced silent data omission. Prioritize F1 and F2 before a demo with unseen files. This review adds documentation only; the findings below remain unfixed.

| Check executed | Result |
|---|---|
| `npm test` | PASS: 4 files, 160 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS: production build and static prerender |
| `npm run start -- --port 3100`, HTTP GET `/` | PASS: 200, Asset Sheet Parser title present |
| HTTP GET `/samples/no_header.csv` | PASS: 200 |
| Additional in-memory CSV probes through `readWorkbook`, `analyzeWorkbook`, `toCsv` | Four cases executed; findings F1–F3 below |

The tests named `e2e-parse` exercise the parser pipeline, **not browser interactions**. No browser automation or manual browser session was executed in this review. Rendering, download behavior, keyboard navigation and UI corrections still need the manual suite. A clean dependency installation, dependency security audit, real password-protected workbook and large-file performance were not verified. Earlier security claims in README/AUDIT are not new results from this review.

## Findings

### F1 — High: one-row headerless inventories disappear

- Location: `src/lib/parser/pipeline.ts:73`.
- Reproduce: upload `single.csv` containing exactly the line below, without a header.

```csv
Dell,Latitude 5420,ABC12345,16GB,512GB SSD
```

- Expected: one reviewable asset, with manual mapping available if needed.
- Actual, reproduced through the parser: `status: empty`, `tables: []`, zero computers, no notes. Export CSV contains only a BOM (one character).
- Repeating the same line twice also produces zero assets: the emptiness check uses the number of **distinct row signatures**, not populated rows. Duplicate detection never runs on those rows.
- Suggested fix: determine emptiness from populated cells; let table detection handle single-row data. Add regressions for one asset and repeated identical assets without headers.

### F2 — High: a genuinely single-column description inventory disappears

- Locations: `src/lib/parser/tableDetector.ts:46` and `:239`.
- Reproduce: create a one-column CSV or Excel sheet with these cells:

```csv
Description
HP EliteBook 840 G8 / i5 / 16GB / 256GB SSD / 14in
Dell Latitude 5420 / i7 / 32GB / 512GB SSD / 14in
```

- Expected: two computers extracted from the description, with serial numbers missing.
- Actual, reproduced through the parser: `status: no-asset-data`, zero tables, zero assets, no notes. Including the sheet cannot recover data because there is no table.
- Cause: header candidates require at least two filled cells, and single-column blocks without a recognized header are rejected.
- Coverage gap: `04_combined_description.xlsx` has additional Item/Serial columns. It does not cover an actual one-column sheet despite the description-only wording.
- Suggested fix: recognize a known description header and/or sufficiently rich asset descriptions in a one-column block, while retaining rejection of ordinary notes.

### F3 — Medium: malformed CSV is silently accepted

- Location: `src/lib/parser/ingest.ts`, `readDelimited`, around line 195.
- Reproduce: upload the following text (the unmatched quote is intentional):

```csv
Manufacturer,Model,Serial,RAM
Dell,"Latitude 5420,ABC12345,16GB
HP,EliteBook 840 G8,DEF12345,32GB
```

- Expected: a clear CSV structure error or warning that identifies possible merged/lost rows.
- Actual, reproduced through the parser: one computer, no ingest notes, second record absorbed into the quoted field. A field-level warning exists, but does not explain the malformed CSV.
- Cause: `Papa.parse` errors are not inspected before using `parsed.data`.
- Suggested fix: report quote/parse errors with source row information; distinguish fatal malformed records from delimiter-detection warnings that can be harmless for one-column files.

### F4 — Low: header input can disagree with the applied header (code-review finding)

- Location: `src/components/MappingEditor.tsx:25,72`.
- `headerInput` is initialized once. Reset uses the current overridden `table.headerRow` before the new automatic result arrives. Clicking “There is no header” also leaves the draft number in the input.
- Suggested browser reproduction: upload fixture 02; set header to 5; reset to automatic. The detected header should return to 4; check whether the input still says 5. Also test “There is no header”.
- This is inferred from React state handling, not browser-reproduced. Confirm with MT-18 before marking it a confirmed UI defect.

## Requirements and remaining scope

| Brief area | Evidence | Remaining work |
|---|---|---|
| Next.js/React + TypeScript | Build/typecheck pass; strict TS project | None identified in this check |
| XLSX and CSV | Existing pipeline fixture tests pass | Browser upload/drop/error recovery |
| Variable headers, columns, sheets | Existing messy-file fixtures pass | Unseen files; F1/F2 expose layout gaps |
| Eight core fields | Normalizer and fixture assertions pass | Review actual displayed/exported values |
| Review, confidence, corrections | Components inspected; some parser override tests | Interactive mapping, edits, undo, filters |
| Export | Implementation and robustness tests inspected | Actual CSV/JSON downloads and spreadsheet opening |
| README and AI disclosure | Present | Avoid claiming all layouts; the original review found no available plan. A local ignored Vietnamese draft was subsequently found; README now links to the maintained `docs/PLAN.en.md` |

Suggested release gate: resolve F1/F2, handle F3 explicitly, run the P0 manual cases, then test at least two independently prepared inventories. A green existing test suite alone is insufficient evidence that unseen layouts are handled.
