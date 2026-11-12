# Official attachment review — 12 November 2026

Inputs: `resources/sample_assets_1.xlsx`, `resources/sample_assets_2.csv`, and the two-page `Candidate Brief – Full-stack Developer.pdf`. Originals were read without modification. Parser runs used commit `dc50863`, no application edits. Browser tests remain NOT RUN.

## PDF context

The PDF describes an Australian startup building an IT Asset Disposition platform: collection, data erasure, reuse/resale and electronics disposal. It describes the role and interview process, rather than adding parser acceptance criteria. Node/TypeScript, React/Next.js and AWS/Lambda are role skills; the PDF does not require deploying this challenge to AWS.

It explicitly emphasizes reviewing, verifying and debugging AI-generated code, understanding architecture, ownership through testing, and explaining decisions. Round 1 is a 2–3 hour practical challenge with a solution discussion; round 2 is a discussion with developers/CTO, not primarily conventional live coding. This supports presenting concrete verification evidence and unresolved limitations, rather than only demonstrating green self-generated fixtures.

## Executed checks

```powershell
npx tsx scripts/inspect.ts resources/sample_assets_1.xlsx resources/sample_assets_2.csv
```

Also inspected all XLSX source cells using SheetJS, examined canonical parsed fields, and reran XLSX analysis with column C of the second sheet manually mapped to `combined`. The latter proves a parser workaround, not a completed UI test.

| File | Automatic result | Important interpretation |
|---|---|---|
| sample_assets_1.xlsx | 19 computers, 1 skipped TOTAL, 0 duplicate serial groups | Assets has 15 machines, header row 4. Sheet1 (2) has 4 additional distinct machines, header row 3. It must not be discarded merely because of its name. |
| sample_assets_2.csv | 14 computers, 2 other devices | Monitor IT-0005 and keyboard IT-0011 excluded from computer count. Current policy includes Surface Pro tablet and Synology NAS as computers; NAS is classified server. |

These counts do not mean all fields are correct.

## New findings

| ID / priority | Source | Expected vs actual | Cause / next action |
|---|---|---|---|
| R1 / High | XLSX Sheet1 (2), rows 4–7, CPU / RAM / Disk | RAM expected 8,16,64,32 GB; storage expected 256,512,1000,8000 GB. All eight fields are absent automatically, without row warnings. | Column mapped only to CPU. Combined extraction runs for combined/Model columns, not this CPU column. Detect composite columns or mine remaining specifications without overwriting explicit values. |
| R2 / High | XLSX Sheet1 (2), row 6 | `HP Z2 G5 Tower Workstation` becomes `Z Workstation Tower Workstation`, losing Z2 G5. | Family replacement consumes model identifiers. Preserve identity when normalizing family names. |
| R3 / Medium | CSV IT-0014, row 15 | `Ryzen V1500B` present in source; CPU missing. | CPU grammar does not recognize this series. Add generalized coverage and negative examples. |
| R4 / Medium | CSV IT-0006, row 7 | Precision 3660 Tower classified desktop; repository Precision family is workstation. | Generic `tower` keyword wins over specific family evidence. Decide precedence explicitly and test it. This expectation follows existing repository taxonomy. |
| R5 / Low | XLSX Assets row 12; CSV IT-0008 row 9 | Display rounds 1.92 TB to 1.9 and 3.84 TB to 3.8. Canonical totals are correct: 7680 GB and 23040 GB. | Display precision can mislead; inspect CSV total/JSON drive sizes. Distinguish cosmetic precision from actual capacity loss. |

Manual mapping workaround for R1: select Sheet1 (2) → Fix the mapping → CPU / RAM / Disk → Description (multi-field). Pipeline verification recovers all four RAM/storage pairs listed above. It does not fix R2 and does not count as automatic-extraction success.

Other observations: `N/A`/`-` screens on desktops/servers cause low-confidence warnings; Cost Centre is ignored as a bonus field; some models retain generic trailing words. No complete field-by-field accuracy percentage has been calculated. Prioritize core-field loss and identity corruption first.

## Suggested demo after fixes

1. Upload the official XLSX, explain header row 4 and the additional nonduplicate sheet.
2. Verify the second sheet's composite specifications and the HP model identity.
3. Upload the official CSV, inspect combined fields and peripheral separation.
4. Demonstrate one correction and its exported result.
5. Explain the pipeline, confidence limitations, security boundaries and the independent bugs found during AI-code review.

See `QUALITY-GATES.en.md` for explicit acceptance measurements. These inputs are examples, not proof that unseen formats work.
