# Manual test guide — Asset Sheet Parser

Baseline: `dc50863`, 12 November 2026. Read [verification findings](VERIFICATION.en.md) first. All browser cases below start as **NOT RUN**; automated parser results must not be copied into the manual result column.

## Setup and recording results

1. Install dependencies with `npm install` if needed. Run `npm run dev`; open `http://localhost:3001`. For a production check use `npm run build`, then `npm run start`; both scripts use port 3001. Port 3000 belongs to the user's unrelated real server: do not use it or stop its process. If 3001 is occupied, investigate without terminating another service.
2. Record commit, OS, browser/version, screen size, timezone, date and tester. Use Chrome or Edge first, then repeat the P0 flow in another available browser.
3. Files are in `tests/fixtures/`. Use **Upload another file** before each independent case to clear edits, sheet inclusion and filters. Keep original fixtures unchanged; save variations separately.
4. Open DevTools Console and Network. Use the plain `/` URL except when testing sample links. Refreshing a sample URL reloads the sample; refreshing `/` returns to upload.
5. For every case record PASS / FAIL / BLOCKED, actual counts/values, screenshot or exported file, and bug ID. “Known failure” is still FAIL against the expected behavior.

P0 = required demo/release flow; P1 = full regression; P2 = extended robustness/usability. Row numbers below are **source spreadsheet rows**, not visible table positions. Dates/warranty warnings depend on the execution date; do not assume a fixed count of all warnings.

## Quick smoke test (about 10–15 minutes)

Run MT-01, 02, 03, 05, 14, 16, 19, 21 and 22. For unseen-file readiness also run MT-27 and MT-28: both are known failures at this baseline.

## Upload, extraction and layouts

For each fixture: upload it, inspect the fleet summary, select the relevant sheet, then click the source row for details and compare with **Original row in the file**.

| ID / priority | Input and actions | Expected result |
|---|---|---|
| MT-01 / P0 | Open `/`; click upload and select `01_clean.csv`. | Review appears, no uncaught console error; 5 computers. Row 2: Dell, Latitude 5420, serial 5CG1234XYZ, Intel Core i7-1185G7, 16 GB RAM, 512 GB SSD, 14-inch screen, laptop. |
| MT-02 / P0 | Upload `02_assets_FINAL_v3_USE_THIS_ONE.xlsx` by drag/drop. | Header row 4 on Sheet1; 7 computers in fleet. Row 5: Latitude 5420, Intel Core i7, 16 GB; CPU marked extracted from text. Row 6 RAM 16 GB; row 7 RAM 8 GB; row 9 manufacturer HP. |
| MT-03 / P0 | In MT-02 inspect all three row-kind tabs and sheet tabs. | Sheet1 row 10 is Other devices; row 14 is Skipped rows. Sheet1 (2) has copy badge and is excluded. Notes has no assets. Row 9 warns about placeholder serial. One duplicate serial group: 5CG1234XYZ, rows 5 and 12. |
| MT-04 / P1 | On Sheet1 (2), click Include it anyway; then Exclude this sheet. | Fleet computers changes 7 → 13 → 7. Exports include/exclude copy rows accordingly; original data remains viewable. |
| MT-05 / P0 | Upload `04_combined_description.xlsx`; inspect Inventory row 2. | HP, EliteBook 840 G8, laptop, 5CD2345ABC, Intel Core i5, 16 GB RAM, 256 GB SSD, 14-inch screen. Row 7 keyboard is Other devices. Item column ignored. This fixture has more than one column; also run MT-28. |
| MT-06 / P1 | Upload `03_french_semicolon.csv`. | Notes identify Windows-1252 and semicolon separator; accents readable. Row 4: 32 GB, 1 TB NVMe, 14-inch. Row 2 purchase date 2022-03-15 (check JSON if UI formatting differs). Row 6 is Other devices. |
| MT-07 / P1 | Upload `05_multi_sheet.xlsx`; inspect Laptops, Servers, Old lookup, Empty. | Fleet: 3 laptops + 3 servers. Laptops row 3: 32 GB, 1 TB, 14-inch. Old lookup marked hidden and excluded; Empty marked empty. Servers row 2 warranty expired at baseline date. |
| MT-08 / P0 | Upload `06_no_header.csv`. | No header row found; mapping editor opens; 5 computers. Source row 1 retained: Dell, serial 5CG1234XYZ, 16 GB, 512 GB SSD. |
| MT-09 / P1 | Upload `07_mixed_units.xlsx`; inspect Fleet. | RAM at rows 2,3,4,5,7: 16,16,16,8,8 GB. Row 3 screen 14-inch; row 7 screen 15.6-inch. Row 6 RAM 2400 flagged as suspicious. |
| MT-10 / P1 | Upload `08_peripherals_and_totals.xlsx`. | 2 computers, 4 other devices, 1 skipped row. Qty and Price ignored; totals never become computers or exported assets. |
| MT-11 / P1 | Upload `09_merged_two_row_header.xlsx`. | Effective header row 2; 3 computers; Inventory row 5 type workstation. Grouped header labels retained in mapping. |
| MT-12 / P1 | Upload `10_two_tables_one_sheet.xlsx`. | Two independently mapped tables; header rows 2 and 8. Second section SERVERS; IT row 9 Dell server, 128 GB RAM. |
| MT-13 / P1 | Upload `11_weird_column_names.xlsx`, then `16_german_headers.xlsx`. | First: Proc→CPU, Disk Size→Storage, S/N→Serial, Mfr→Manufacturer, Memmory→RAM, Form Factor→Type, Display→Screen. Second: header row 1, 4 computers; Inventar row 2 Dell laptop, 5CG1234XYZ, 16 GB, 512 GB SSD, 14-inch. |

## Review and corrections

| ID / priority | Input and actions | Expected result |
|---|---|---|
| MT-14 / P0 | Fixture 02: hover row 5 CPU, click row; inspect source/provenance; close with X, Escape, then outside click in separate attempts. | Provenance identifies parsed value/source column; original row intact. Each close action works. Details do not accidentally edit data. |
| MT-15 / P1 | Fixture 02: search `5CG1234XYZ`, clear; toggle only rows with warnings; inspect Other devices and Skipped rows. | Serial search returns rows 5 and 12 in Computers. Clear restores rows; warnings filter shows rows with warning/error severity. Fleet totals do not change with display filters. Clear filter before other cases. |
| MT-16 / P0 | Fixture 01: open row 2; change RAM to `32 gig`, press Enter; close/reopen; export CSV and JSON; click undo. Repeat an edit by blurring the input. | RAM becomes 32 GB, marked edited by you; exports contain 32 and JSON method manual. Undo restores 16 GB. Enter and blur each persist edits. Original row remains 16GB. |
| MT-17 / P1 | Fixture 01 row 2: clear RAM and blur; undo. Enter `banana` and blur; undo again. | Clearing removes extracted RAM and affects completeness; undo restores it. Invalid text gives an explanatory warning and retains original parsed value; it must not become a numeric RAM value. |
| MT-18 / P1 | Fixture 02: Fix the mapping; set header 5 and Apply; Reset to automatic. Then There is no header; reset again. Try `0`, `-1`, `abc`, `9999`. | Automatic header returns to 4; input and applied header agree. No header retains rows as data. Invalid/out-of-range values must not crash or silently appear applied; note any unclear feedback. Header changes reset column overrides. **Potential UI issue F4:** input may retain old header. |
| MT-19 / P0 | Fixture 01: Fix the mapping; set Serial Number column to Ignore this column; then restore Auto or Reset to automatic. | Serial values disappear and missing-serial warnings appear; restore recovers source serials. Mapping explains confidence/reason. Do not use RAM as the ignore test: free-text inference may recover values from other columns. |
| MT-20 / P1 | Fixture 08: move one computer with Not a computer; close drawer; locate it under Other devices; move back with It's a computer. | Fleet changes 2 computers/4 others → 1/5 → 2/4; default export count follows computer count. Also move skipped TOTAL into Computers and back to Other devices to verify manual override; reload fixture afterward because no UI action restores skipped classification. |

## Export and errors

For files exceeding the current 20 MiB limit, follow [large-file guidance](ADR-001-FILE-SIZE-LIMIT.en.md): reduce/split a copy and process parts independently. There is no automatic cross-file duplicate detection or aggregation. MT-23 validates rejection, not proof that every file below the limit is safe or responsive.

| ID / priority | Input and actions | Expected result |
|---|---|---|
| MT-21 / P0 | Fixture 08: Export CSV and JSON with include non-computers off, then on. Open CSV in text editor and Excel/LibreOffice; inspect JSON. Apply a search and export again. | Off: 2 asset records; on: 6. Skipped total absent. CSV has headers, sheet/row provenance and numeric capacity fields; JSON has assets, value/method/confidence and warnings. Search does not limit export. JSON summary is the fleet summary, so computers remains 2 even when assets includes other devices. |
| MT-22 / P0 | Upload `14_corrupt.xlsx`; retry with fixture 01. Drop `15_not_a_spreadsheet.pdf` (picker may hide it); retry. Upload `13_empty.xlsx`. | Corrupt/unsupported files show useful error and recovery action; valid retry succeeds. Empty workbook shows empty sheet and zero computers without crashing. Distinguish this from zero-byte input, which should show an empty-file error. |
| MT-23 / P1 | Create a zero-byte `empty.csv`, then a file `large.csv` larger than 20 MiB; upload separately. | Clear empty/size error, no review of partial data; retry succeeds. Size limit is 20×1024×1024 bytes. Create these outside fixtures; no need for a valid large CSV since size validation runs first. |
| MT-24 / P1 | Upload `12_duplicates.csv`; inspect serial warnings and export. | One duplicate group despite case/dash differences. N/A and TBD are missing/placeholder serials, not valid IDs. Row 6 has missing serial. Duplicates remain separate assets; no silent deduplication. |
| MT-25 / P1 | Click each of the four sample cards, using Upload another file between them. Open `/?sample=no_header.csv`, then `/?sample=missing.csv`. | All bundled samples load. Direct no-header link works; nonexistent sample gives a recoverable error. Return to `/` for remaining cases. |
| MT-26 / P1 | Edit fixture 01 and include a copy in fixture 02 in separate runs. Use Upload another file, load fixture 01; refresh `/`. Inspect Network during local upload. | New upload has no previous edits/inclusion state. Refresh `/` returns to upload. Local file data is not sent in HTTP requests; initial app assets and sample GET requests are expected. |

## Additional inputs and known failures

Use a text editor to save each CSV exactly as shown in the linked finding. These cases intentionally test beyond the bundled fixtures.

| ID / priority | Input and actions | Expected result / baseline finding |
|---|---|---|
| MT-27 / P0 | Upload the one-line CSV in F1; repeat with the same data line twice and no header. | One asset, then two reviewable assets with duplicate warning. **Known FAIL F1:** both currently appear empty. |
| MT-28 / P0 | Upload the one-column Description CSV in F2; also save equivalent `.xlsx`. | Two computers, specs extracted, missing serial warnings. **Known FAIL F2:** parser CSV probe returns zero tables/assets. XLSX browser case remains to be run. |
| MT-29 / P1 | Upload malformed CSV from F3. | A structure error/warning explains unmatched quote and unreliable row boundaries. **Known FAIL F3:** currently produces one computer without a CSV-structure warning. |
| MT-30 / P1 | Copy fixture 01 in a spreadsheet editor; reorder columns, rename RAM→Memory and Manufacturer→Make, insert three title/blank rows above header, save as new XLSX. | Still 5 computers and same eight core values; header row 4; original row provenance shifted by 3. Compare assets by serial, not table order. |
| MT-31 / P2 | Fixture 01 row 2: edit Notes to `=1+1`; export CSV/JSON. Repeat with `<b>test</b>`. | CSV formula-like text prefixed with apostrophe when inspected as raw text; spreadsheet must not calculate it. JSON preserves literal note. HTML-looking text displays as text, no formatting/execution. Use only these harmless payloads. |
| MT-32 / P2 | Test 390px mobile viewport and desktop; keyboard-only upload, sheet tabs, mapping and drawer. | Content remains reachable via scrolling; controls usable; focus visible. Record inability to open rows by keyboard, missing field labels or focus escaping dialog as accessibility issues rather than assuming support. |
| MT-33 / P2 | Prepare a valid encrypted XLSX in Excel, and a separate valid ~5,000-row inventory with unique serials. | Password file gives clear unsupported-password guidance. Large inventory preserves counts; record load time, responsiveness and browser memory. Set an acceptable performance target with the team; do not mark PASS just because parsing eventually completes. |

## Official email attachments (added after initial verification)

Run these before sign-off, in addition to the synthetic cases. See [resource review](RESOURCE-REVIEW.en.md). All browser results remain NOT RUN; known parser failures below must not be marked PASS.

| ID / priority | Input and actions | Expected result / baseline finding |
|---|---|---|
| MT-34 / P0 | Upload `resources/sample_assets_1.xlsx`; inspect both sheets and export. | 19 computers, Assets header 4, Sheet1 (2) header 3; TOTAL skipped. All 4 second-sheet machines included because their serials differ from Assets. |
| MT-35 / P0 | Inspect Sheet1 (2), rows 4–7 automatically; then map CPU / RAM / Disk to Description (multi-field) and export. | RAM 8/16/64/32 GB and storage totals 256/512/1000/8000 GB. Known R1: automatic extraction misses all; manual mapping recovers them in pipeline tests. Record automatic failure separately from workaround success. |
| MT-36 / P0 | Inspect Sheet1 (2), row 6 model. | Model retains Z2 and G5 from source. Known R2: becomes Z Workstation Tower Workstation; mapping workaround does not fix it. |
| MT-37 / P0 | Upload `resources/sample_assets_2.csv`; inspect IT-0005, IT-0011, IT-0014 and IT-0006. | 14 computers/2 peripherals under current NAS/tablet policy. Monitor and keyboard under Other devices. NAS CPU retains Ryzen V1500B (known R3: missing). Precision follows workstation family policy (known R4: desktop). |
| MT-38 / P1 | Export official XLSX and CSV; inspect Assets row 12 and IT-0008 respectively in raw CSV/JSON. | Storage totals 7680 GB (4×1920) and 23040 GB (6×3840); no loss due to formatted 1.9/3.8 TB labels. Note display precision issue R5 separately. |

## Test execution sheet

Copy this row for each case. Attach export files for MT-16/21/31 and screenshots for failures.

| Case | Build/commit | Browser | Status | Actual result / evidence | Bug ID | Tester / date |
|---|---|---|---|---|---|---|
| MT-01 | | | NOT RUN | | | |

A bug report should include input file, exact steps, expected vs actual result, source row/sheet, console error if any, screenshot and exported artifact. Do not publish inventories containing real employee or device identifiers; synthetic fixtures are sufficient for this suite.

Release sign-off: all P0 cases PASS, no unexplained data loss, all remaining failures recorded with an owner and an explicit decision. At this baseline, F1/F2 prevent that sign-off.
