# Implementation and verification plan — Asset Spreadsheet Parser

Updated 12 November 2026. This is the maintained English adaptation of the original Vietnamese planning draft, updated with implemented behavior, official attachments and independent findings. It is not a verbatim translation or a claim that all planned work is complete. The local `PLAN.vi.md` remains a historical pre-implementation draft and is excluded by the existing Git ignore rule.

## 1. Objective and scope

Build a TypeScript/Next.js application that imports messy XLSX/CSV inventories, extracts the eight core fields, and lets users review the result. Support variable headers, column order, combined specifications and multiple sheets without hard-coding the supplied examples.

The principal flow is **Upload → Analyze → Review/correct → Export**. Prioritize accurate extraction, understandable errors and explainable corrections. The original challenge suggests 2–3 hours and a repository submission before noon Friday 13 November; this plan does not imply that all hardening work fits that time budget.

## 2. Environment and constraints

- **Use port 3001**: `npm run dev` or `npm run build` then `npm run start`; open `http://localhost:3001`.
- **Port 3000 is reserved for the user's unrelated real server. Never bind this application to it, stop its listener or modify that service.** Investigate a conflict on 3001 without terminating an unknown process.
- Preserve original files under `resources/`. The two official spreadsheets are now available; the PDF provides employer/interview context, not a requirement to deploy this challenge on AWS.
- Follow [AGENTS.md](../AGENTS.md), [engineering/security rules](ENGINEERING-RULES.en.md), [quality gates](QUALITY-GATES.en.md) and the [OWASP matrix](OWASP-TOP10.en.md).
- Keep parsing local, deterministic and independent of UI. No remote LLM, persistence or backend is part of the implemented scope.

## 3. Stack and organization

Current project uses Next.js 16, React 19, strict TypeScript, Tailwind, SheetJS for workbooks, Papa Parse for delimited files, Vitest and ESLint. `package.json` and the lockfile are authoritative for exact versions. Optional dependencies discussed in the original draft are not assumed installed.

```text
src/app/             page flow and layout
src/components/      upload, sheets, summary, mapping, review table and row drawer
src/lib/parser/      ingest, detection, mapping, extraction, classification, quality
src/lib/extract/     reusable field normalizers and combined-text extraction
src/lib/knowledge/   synonyms, manufacturers and model-family data
src/lib/types.ts     canonical domain types and provenance
src/lib/export.ts    CSV/JSON selection, formatting and downloads
tests/               unit, pipeline and robustness tests; synthetic fixtures
resources/           original official spreadsheets and candidate brief
docs/                rules, plan, verification evidence and manual tests
```

UI calls `readWorkbook(fileName, bytes)` then `analyzeWorkbook(raw, overrides)`. Corrections are immutable overrides and rerun analysis. Do not implement new APIs merely to match names from the historical draft.

## 4. Pipeline design

| Stage | Intended behavior | Verification focus |
|---|---|---|
| Ingest | Check extension/content and size; decode CSV; read workbook cells/merges and preserve source positions. | Corrupt/empty/password/oversized input, malformed CSV, encodings, explicit truncation messages. |
| Sheets | Identify empty, hidden, duplicate and non-asset sheets using contents. | A one-row inventory is not empty. Official Sheet1 (2) contains distinct assets and must remain included. |
| Tables/headers | Detect blocks, shifted or grouped headers and headerless data. | One-column descriptions, repeated headers, two tables, preservation of the first data row. |
| Column mapping | Combine header and content evidence, with explanations and manual overrides. | Composite CPU/RAM/Disk columns must retain all available specifications. |
| Extraction | Normalize mapped values, parse combined text, then infer missing values with provenance. | Preserve model identifiers; avoid overwriting reliable explicit fields with weaker guesses. |
| Classification | Separate computers, peripherals and skipped rows without deleting evidence. | Specific model-family evidence versus generic form-factor words; document NAS/tablet policy. |
| Quality/export | Surface missing/invalid/duplicate values, update summary, export selected assets. | Exact canonical capacities, edited values, skipped/excluded row policy and formula neutralization. |

Heuristic weights and thresholds are tuning parameters, not acceptance criteria. Tests must demonstrate observable correctness across independent inputs. Confidence is an explanation aid, not a calibrated probability of correctness.

## 5. Normalization and data model

Eight core fields: asset type, manufacturer, model, serial number, CPU, RAM, storage and screen size. Bonus fields include asset tag, hostname, assigned user, location, OS, purchase/warranty dates, status and notes.

Use the typed `FieldValueMap` and existing `ExtractedValue` structure with value, raw text, confidence, method and source column. Keep source sheet/row and original row data. Missing values stay absent rather than being invented.

- RAM: normalize `16 gig`, `16GB`, `16384 MB`, modules and French units to GB.
- Storage: retain individual drive sizes/types and exact total GB; use decimal TB conversion. Do not confuse raw disk capacity with usable RAID capacity.
- CPU/model: retain available identifying model/generation tokens, including HP Z2 G5 and Ryzen V1500B.
- Screen: normalize explicit inches/cm; preserve empty/nonapplicable values.
- Serial/brand/type: normalize aliases while preserving identity and flagging placeholders.
- Dates: use calendar-day semantics; disclose the day-first assumption for ambiguous dates.

## 6. Review and correction UX

English interface: upload/drop and samples; loading feedback; fleet summary; sheet tabs; Computers, Other devices and Skipped rows; search/warnings filters; provenance and original-row details.

Allow header/column mapping changes, normalized cell edits, undo and row reclassification. Ensure the displayed header input agrees with the applied result after reset. Explain whether an export includes non-computers and that display filters do not limit the export.

Use actionable error messages and recoverable retries. Do not claim complete UI acceptance from parser tests or an HTTP 200 response.

## 7. Test strategy

1. Preserve existing synthetic fixtures covering clean, shifted, French, headerless, combined, multi-sheet, mixed-unit, merged-header and malformed layouts.
2. Independently annotate official spreadsheets by source file/sheet/row. Add core-field assertions, not just record counts.
3. Add focused regressions reproducing each confirmed failure before changing parser behavior, plus negative examples that prevent overly broad matching.
4. Run focused tests, then tests/typecheck/lint/build for implementation changes.
5. Execute the relevant [manual cases](MANUAL-TEST.en.md), including MT-34–38 for official attachments; record evidence and NOT RUN honestly.
6. Use [quality metrics](QUALITY-GATES.en.md) for field recall/precision, retention, export fidelity and performance. Automatic results and manual workarounds must be reported separately.

## 8. Current evidence

At commit `dc50863`, 160 automated tests, typecheck, lint and production build passed. Parser checks on official files produced 19 computers in XLSX and 14 computers plus 2 peripherals in CSV under current NAS/tablet policy. These counts conceal field errors and are not acceptance sign-off.

Browser/manual execution, full official-field scoring, fresh supply-chain audit, deployment security and performance budgets remain unverified. See [independent verification](VERIFICATION.en.md) and [resource review](RESOURCE-REVIEW.en.md) for evidence.

## 9. Remediation sequence

All items below are **pending** unless marked otherwise in a subsequent evidence report.

| Order | Work | Exit criterion |
|---|---|---|
| 1 | Freeze source-grounded official expectations and regressions for R1/R2, F1/F2. | Tests reproduce missing composite specs, damaged model identity and discarded supported layouts. |
| 2 | Fix composite-column extraction and model-family normalization (R1/R2). | Second-sheet RAM 8/16/64/32 GB, storage 256/512/1000/8000 GB, and Z2 G5 identity preserved automatically. |
| 3 | Fix single-row/repeated-row and single-column table handling (F1/F2). | Assets retained without making ordinary notes into inventories. |
| 4 | Surface malformed CSV errors (F3); improve CPU/type handling (R3/R4). | Unmatched quotes reported; Ryzen V1500B extracted; specific Precision family policy respected. |
| 5 | Verify header reset issue F4; address storage display precision R5. | UI state agrees with applied header; display does not misleadingly lose useful capacity precision. |
| 6 | Execute manual flows and export checks. | P0 cases pass with evidence; open failures have explicit dispositions. |
| 7 | Complete applicable security checks and dependency review. | OWASP controls have scoped evidence; N/A rationale and remaining risks are explicit. |
| 8 | Add CI for tests/typecheck/lint/build and preserve official regressions. | A clean checkout executes the checks; workflows do not publish or alter external services implicitly. |
| 9 | Update README, AI disclosure and demo evidence. | Statements match observed behavior and limitations; submission remains a separate user-authorized action. |

## 10. Security workstream

Apply SEC-01–08 and all applicable [OWASP Top 10:2025 controls](OWASP-TOP10.en.md): local-data privacy, safe rendering/export, untrusted-key handling, malformed-input recovery, resource limits, dependency/build integrity and deployment configuration where relevant.

Post-decompression grid limits do not prove archive-bomb containment. Main-thread parsing and no browser acceptance remain limitations. Do not add login or a backend just to mark otherwise inapplicable categories complete.

## 11. Deferred extensions

The current 20 MiB limit is provisional, not a measured capacity guarantee. Follow [ADR-001](ADR-001-FILE-SIZE-LIMIT.en.md) for rationale, current split-file guidance and staged work: early file-size validation → worker/cancellation → bounded parsing → measured limit revision → optional server jobs only after a separate privacy/product decision. Do not raise the limit without this evidence.

Workers/timeouts and table virtualization may address performance after measurement. Remembered mappings, transposed layouts and additional language/model coverage are future enhancements.

LLM fallback is deferred: it changes privacy, network, validation and operating-cost assumptions and is not required for this challenge. No model/provider or API key is prescribed here. Public deployment is also separate from local acceptance; do not assume authorization to publish resources or start infrastructure.

## 12. Demo and explanation

1. Open `http://localhost:3001`, upload official XLSX and explain header detection.
2. Show why its second sheet is not a duplicate, then inspect composite specs and HP identity after fixes.
3. Upload official CSV; demonstrate combined extraction and peripheral separation.
4. Show a mapping/cell correction, original-row provenance and exported values.
5. Demonstrate a recoverable malformed-file error.
6. Explain heuristic tradeoffs, unresolved limits and how AI-generated code was independently verified.

Do not present a manual workaround as automatic success. The PDF emphasizes engineering judgment and reviewing AI-generated code; concrete findings and regression evidence support that discussion.

## 13. Completion checklist

- [ ] Confirmed data-loss/identity defects fixed with independent regressions.
- [ ] Official unambiguous fields meet documented acceptance metrics.
- [ ] Tests, typecheck, lint and build pass for the reviewed revision.
- [ ] P0 manual flows and downloads pass with recorded browser evidence.
- [ ] Security/dependency gates assessed; unresolved issues disclosed.
- [ ] README and AI disclosure reflect actual behavior and evidence.
- [ ] App scripts and instructions use port 3001; unrelated port 3000 service untouched.
- [ ] Repository publication/submission performed only when explicitly authorized.

## 14. Decisions and remaining boundaries

Implemented choices: browser-local heuristics, English UI, mapping/cell corrections, CSV/JSON export and synthetic regression coverage. User constraint: port 3001. Official resources are now available.

Remaining work is correctness, verification and enforcement, not a fresh scaffold. Deployment, remote AI and expanded storage/authentication are outside the current implementation plan unless requested. Do not carry forward the historical draft's assumptions that no code or samples exist.
