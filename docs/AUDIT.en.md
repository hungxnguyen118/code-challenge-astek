# Robustness & security audit

> Goal: find the bugs **before** a reviewer does. Every finding records **how it was found → measured result → why it matters → fix → how the fix was verified**.
> Every finding is locked down by a regression test in `tests/unit/robustness.test.ts` (plus `combined.test.ts` for F7), so none can silently come back.

**Outcome:** 7 real defects found and fixed (4 high), 1 accepted risk with rationale, 2 check categories with no findings. Tests: 123 → **160**, all passing; `tsc`, `eslint` and `next build` clean.

---

## 1. Method: what was probed, and why

Ground rule: **an uploaded file was written by someone else, so it is untrusted input.** Any cell can be absurdly long, contain odd characters or formulas, or be named like a JavaScript built-in. Eight probes, each aimed at one class of defect:

| # | Technique | Looks for | Why this technique |
|---|---|---|---|
| M1 | **Grep for dangerous sinks**: `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, `href={…}` | XSS | A single place that renders raw HTML from file data is enough. The set of sinks is finite, so grep is fast and complete. |
| M2 | **Grep objects used as maps with keys taken from the file** (`Record<string,…>`, `{}`, `obj[key]`), then **try the keys `__proto__`, `constructor`, `toString`** | Prototype pollution / wrong lookups | `{}` inherits from `Object.prototype`, so `obj["constructor"]` *always* returns a function. Sheet names and brands come from the file. |
| M3 | **Run the same file in 6 time zones** (`$env:TZ`, UTC−11 to UTC+14) | Off-by-one dates | Dates are a classic bug source. The dev machine is UTC+7; reviewers may be elsewhere. Note: on Windows Git Bash, `TZ=Asia/…` is silently rewritten as a path, so PowerShell had to be used. Without checking, the probe would have *looked* like it tested something. |
| M4 | **Workbook declaring a huge range** (`<dimension ref="A1:Z1048576">`), measuring time and memory | Freeze / out of memory | Excel writes this whenever someone formats a whole column, which is extremely common in the wild. |
| M5 | **Hostile strings (ReDoS)**: 16 long patterns (2,000–30,000 characters of digits, spaces, repeats) through the *whole* pipeline, each under a `timeout`. On a hang: **measure growth vs length** (1k → 2k → 4k), then **CPU-profile** (`node --cpu-prof`) to name the exact regex | Catastrophic backtracking | All extraction is regex-based; one bad regex plus one long cell freezes the browser tab. The profiler names the culprit instead of guessing. |
| M6 | **Edge values through the normalisers** (impossible dates, non-dates, `2x8GB`…) | Accepting wrong data | The app's rule is "never invent values"; a plausible wrong date is worse than an empty one. |
| M7 | **Export cells starting with `=`, `+`, `-`, `@`** | CSV / formula injection | The export is opened in Excel, and its content was authored by a third party. |
| M8 | **Fuzzing**: 800 random workbooks (mixed numbers, broken dates, emoji, zero-width characters, `__proto__`…, random shapes) through pipeline + random overrides + export. **`npm audit`** for dependencies | Unforeseen crashes; known CVEs | Fuzzing finds combinations nobody writes by hand. The seed is fixed, so runs are reproducible. |

Probe scripts lived in a throw-away `.probe/` folder (deleted); the cases worth keeping became permanent tests.

---

## 2. Findings

| # | Severity | Issue | Status |
|---|---|---|---|
| F1 | **High** | CSV injection in the export | ✅ fixed |
| F2 | **High** | Excel dates shifted by one day east of UTC (Vietnam, Australia…) | ✅ fixed |
| F3 | **High** | Huge declared sheet range: 39 s, 964 MB | ✅ fixed |
| F4 | **High** | ReDoS: one all-digit cell hangs the parser for > 15 s | ✅ fixed |
| F5 | Medium | Sheets named `__proto__` / `constructor` break the "included" state | ✅ fixed |
| F6 | Medium | Impossible dates accepted; `"Latitude 5420"` parsed as year 5419 | ✅ fixed |
| F7 | Medium | `2x8GB` / `8+8GB` in a description column gave 8 GB of RAM instead of 16 | ✅ fixed (pre-existing; caught by a new test) |
| R1 | Low | `npm audit`: 7 moderate advisories (`minimatch`) in lint tooling | ⚠️ accepted, see rationale |
| — | — | XSS (M1) | ✔ nothing found |
| — | — | Fuzz crashes (M8) | ✔ 0 / 800 |

---

### F1: CSV / formula injection in the export · High

- **Probe (M7):** a CSV containing `=HYPERLINK("http://evil","x")`, `+cmd|' /C calc'!A0` and `@SUM(1+1)`, exported with `toCsv`.
- **Result:** the cells were written verbatim.
  ```
  t,2,computer,,,"=HYPERLINK(""http://evil"",""x"")",ABC123,…,+cmd|' /C calc'!A0
  ```
- **Why it matters:** when the export is opened in Excel, cells starting with `=` `+` `-` `@` **run as formulas**. That allows phishing links, data exfiltration through `HYPERLINK`/`WEBSERVICE`, and command execution via DDE on older Excel. The *input* file comes from a third party, so the app would become the carrier. (OWASP: *CSV Injection*.)
- **Fix** (`src/lib/export.ts`): Papa Parse's `escapeFormulae` option with our own `FORMULA_TRIGGER` regex. Matching *text* cells get a leading `'`, which Excel and LibreOffice read as "this is text".
  - **Why not the built-in `escapeFormulae: true`?** Reading Papa 5.7.1's source, its default rule is `/^[=+\-@\t\r].*$/`. It misses (1) a leading space (`" =1+1"`, which Excel still evaluates), (2) multi-line cells (`.` doesn't match `\n`, so `$` never reaches the end), and (3) full-width `＝＋－＠`.
  - **Trade-off:** legitimate text starting with `-`/`+` (e.g. `+33…` phone numbers) gains a `'`. This is the standard OWASP trade-off. Real numbers (`ram_gb`) are untouched because Papa skips `number` values.
- **Verified:** the export now contains `"'=HYPERLINK(…)"`, `"'+cmd…"`, `"'@SUM(1+1)"`. Tests: `F1 · CSV / formula injection` (3 tests, including the cases Papa misses and a check that numeric columns stay numeric).

### F2: dates shifted by one day depending on time zone · High

- **Probe (M3):** write a `2023-04-01` date cell to xlsx, read and normalise it, in 6 time zones.
- **Result:** on the UTC+7 dev machine: **`2023-03-31`**. Correct in UTC, so a CI runner in UTC would never have caught it.
- **Why:** SheetJS builds `Date`s from **local** calendar parts (Apr 1 00:00 in Vietnam = Mar 31 17:00 UTC), while everything downstream reads **UTC** parts (`getUTCDate`). Every user east of UTC (Asia, Australia) would get wrong purchase and warranty dates, and wrong "warranty expired" warnings.
- **Fix** (`src/lib/parser/ingest.ts`, `cleanCell`): at ingest, re-anchor the same calendar date/time at UTC with `Date.UTC(v.getFullYear(), v.getMonth(), v.getDate(), …)`. From there on the pipeline is UTC-only and independent of the user's machine.
- **Verified:** `2023-04-01` in all 6 zones (UTC, Ho Chi Minh, Sydney, Kiritimati +14, Los Angeles, Pago Pago −11). Test: `F2` loops over the 6 zones by setting `process.env.TZ` inside the test (Node re-reads it on assignment).

### F3: huge declared range, 39 s and 964 MB · High

- **Probe (M4):** a workbook with 2 data rows but `<dimension ref="A1:Z1048576">`.
- **Result:** `readWorkbook` took **39,381 ms and 964 MB** and built a 1,048,576-row grid. In a browser tab: freeze or crash.
- **Why:** the code trusted `!ref` (the *declared* range) and called `sheet_to_json(..., { defval: null, blankrows: true })`, allocating an array for each of the million rows. Excel declares such ranges whenever a whole column is formatted.
- **Fix** (`ingest.ts`):
  1. `usedRange(ws)` computes the **real** bounding box by scanning only cells that *hold a value*. That is O(cells), independent of the declared range, and is passed as `range` to `sheet_to_json`.
  2. Safety limits: `MAX_ROWS = 100,000`, `MAX_COLS = 300`, `MAX_CELL_CHARS = 2,000`. Anything beyond is clipped **and reported to the user** through `notes` (shown in the UI), never silently. Applied to both xlsx and CSV.
  3. Merged ranges are clamped to the read range.
- **Verified:** same file: **15 ms**, 12 MB, 2-row grid, 1 computer found. Test: `F3` builds a small workbook and patches the `<dimension>` tag inside the zip. Having SheetJS *write* a 1M-row range itself takes about 20 s, and the first version of the test timed out on exactly that.

### F4: ReDoS, one all-digit cell hangs for > 15 s · High

- **Probe (M5):** 16 hostile strings, each in 8 columns × 3 rows, full pipeline, `timeout 15s`. Two timed out: `"1" × 20,000` and `"14" × 8,000 + '"'`.
- **Narrowing it down:**
  1. Timing each normaliser in isolation: none was slow, so the problem was elsewhere.
  2. Growth vs length: 1,000 chars → 580 ms; 2,000 → 2,689 ms; 4,000 → 8,465 ms. Doubling the length multiplies time by 3–4: **super-linear**.
  3. `node --cpu-prof`: **4,727 of 5,128 ms** inside a single regex, the storage matcher in `combined.ts`:
     `(?:\d+\s*[x×]\s*)?\d+(?:[.,]\d+)?\s*(?:tb|…)?…(?:ssd|hdd|…)`
- **Why:** on a run of n digits with no unit after it, the engine tries every way to split the run into `\d+` (multiplier) + `\d+` (number) + `[.,]\d+`, and retries from **every start position** inside the run. That is O(n²) or worse; one long description cell freezes the tab.
- **Fix (two layers):**
  1. **Root cause:** bounded digit runs `\d{1,7}`, `[.,]\d{1,4}`, multiplier `\d{1,3}` (no hardware spec needs more than 7 digits), plus a **`(?<![\d.,])`** lookbehind so a match can only start at the *beginning* of a number, never mid-run. Applied in `combined.ts`, `ram.ts` and `storage.ts`. The lookbehind also fixes a correctness bug: `1234567GB` could previously match its tail `234567GB`.
  2. **Defence in depth:** `MAX_CELL_CHARS = 2,000` at ingest (F3) bounds every cell for *every* regex, including future ones.
- **Verified:** the 20,000-digit cell now takes **80 ms** (was > 15 s); all 16 patterns finish in < 400 ms. All previous tests still pass, so the bounds lose no real values. Tests: `F4` (6 hostile strings at < 1.5 s each, plus a test asserting real values still parse).

### F5: `__proto__` / `constructor` keys · Medium

- **Probe (M2):** grep found lookups keyed by file data (`overrides.sheetInclusion[sheet.name]`, `byManufacturer[brand]`…); then a workbook with sheets named `__proto__` and `constructor`.
- **Result:** `included` for sheet `constructor` was `function Object() { [native code] }` and for `__proto__` it was `[object Object]`, instead of `true`/`false`.
- **Why:** `{}` inherits from `Object.prototype`. Looking up `obj["constructor"]` when the user made no choice returns the `Object` function, so every `?? default` is bypassed; writing `obj["__proto__"] = …` can even swap the prototype. Sheet and brand names are fully controlled by the file.
- **Fix** (`src/lib/text.ts`): `ownValue(record, key)` reads *own* properties only (`hasOwnProperty`), and `countBy()` counts into a **prototype-less** object (`Object.create(null)`). Used in `pipeline.ts`, `quality.ts`, `AssetDrawer.tsx` and `MappingEditor.tsx`. Row ids (`Sheet!12`) and table ids (`0.1.0`) can't collide with built-ins, but use `ownValue` anyway for consistency.
- **Verified:** sheets `__proto__`, `constructor` and `toString` are all `included: true` and count 3 computers; turning off only `constructor` turns off only that sheet. Test: `F5`.
  - *Lesson:* the first version of this test failed because the test itself wrote `{ __proto__: row(...) }`. In an object literal that **sets the prototype** instead of creating a key, which is the very trap under test. It now passes `[name, rows]` entries.

### F6: impossible dates and non-dates · Medium

- **Probe (M6):** edge values through `normalizeDate`.
- **Before:**

  | Input | Old result | Should be |
  |---|---|---|
  | `31/02/2023` | `2023-02-31` | not a date |
  | `2023-02-30` | `2023-02-30` | not a date |
  | `Latitude 5420` | `5419-12-31` | not a date |
  | `Dell 2019` | `2018-12-31` | not a date |
  | `1` | `2000-12-31` | not a date |
  | `12.5` | `2001-12-04` | not a date |

- **Why:** (1) `ymd()` only checked `day ≤ 31`, not per month. (2) The `Date.parse()` fallback is **lenient and engine-specific**, and works in local time (hence the `-12-31`, an F2-style shift). A plausible wrong date breaks "never invent values" and the warranty warnings.
- **Fix** (`src/lib/extract/misc.ts`): `ymd()` checks the real length of the month with `new Date(Date.UTC(y, mo, 0)).getUTCDate()`, so leap years are correct. **`Date.parse` is gone**, replaced by a hand-written `parseNamedMonth()` that accepts only unambiguous shapes: `5 May 2023`, `May 5, 2023`, `1er avril 2023`, `avril 2023` (EN + FR month names).
- **Verified:** every junk value above → `null`; `29/02/2024` is valid and `29/02/2023` → `null`; named-month dates still parse. Test: `F6` (12 cases).

### F7: RAM written as modules in a description column · Medium

- **Found by:** the F4 regression test asserting `"… 2x8GB …"` → 16 GB failed with 8. Stashing the regex fix still gave 8, so the bug was **pre-existing**, not caused by F4.
- **Why:** the standalone RAM normaliser understands `2x8GB` and `8+8GB`, but the free-text parser (`combined.ts`) only took the number right before "GB". `2x8GB` is very common in asset lists, and wrong RAM means wrong upgrade reports.
- **Fix:** a step 2a in `parseCombined` recognises `N x M GB` and `M + M GB`, totals them and masks them like every other step.
- **Verified:** `2x8GB`, `2 x 8 Go`, `8+8GB` and `8GB + 8GB` all give 16; the `04_combined_description` fixture output is unchanged. Tests in `combined.test.ts`.

### R1: `npm audit`, 7 moderate advisories · Accepted risk

- **Result:** `npm audit --omit=dev` → **0 vulnerabilities** in runtime dependencies (SheetJS, Papa Parse, React, Next). The 7 advisories are a single `minimatch` DoS (`>=7 <11.0.1`) deep inside `typescript-eslint`, pulled in by `eslint-config-next`.
- **Why accepted:** it is lint tooling, never shipped in the app, and exploitable only by a developer feeding a malicious glob to their own linter. `npm audit fix` can't resolve it because `eslint-config-next` pins the version, and forcing it via `overrides` risks breaking ESLint. It will clear when Next updates.
- **Already in place:** SheetJS is installed from the official CDN at 0.20.3, because the npm release (0.18.5) has known prototype pollution (CVE-2023-30533) and ReDoS (CVE-2024-22363) issues.

### No findings

- **XSS (M1):** no `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function` or data-driven `href`. React escapes every string it renders.
- **Fuzzing (M8):** 800 random workbooks × (pipeline + random overrides + CSV/JSON export): **0 crashes**. A reduced version (100 iterations, fixed seed) is kept as a permanent test.
- **React keys:** all unique (row ids `Sheet!row`, numeric table ids, de-duplicated notes).

---

## 3. Not done (known limits)

- **Zip bombs:** a 20 MB `.xlsx` can decompress to far more. The row/column/character limits (F3) bound everything *after* decompression, but not SheetJS's unzip step itself. Remedy: parse in a **Web Worker** with a timeout, so the worst case kills the worker, not the tab.
- **Main thread:** a large but legitimate file (close to 100k rows) still blocks the UI for a few seconds. Same remedy.
- **Confidence calibration:** confidence scores are heuristics, not yet measured against labelled data.

## 4. Re-running the audit

```bash
npx vitest run tests/unit/robustness.test.ts     # all audit regression tests
npm audit --omit=dev                              # runtime dependency advisories
```
New regex? Use bounded digit runs (`\d{1,7}`) and the `(?<![\d.,])` lookbehind, and add a hostile string to `F4`.
New lookup keyed by file data? Use `ownValue()` / `countBy()`, or a `Map`.
