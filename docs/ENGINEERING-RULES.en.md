# Engineering and security rules

Initial project-specific baseline, 2026-11-12. These are requirements for future changes, not certification of the current implementation or a claim of compliance with an external security standard. Known deviations are recorded in the verification reports.

## Architecture and patterns

| ID | Rule | Review evidence |
|---|---|---|
| ENG-01 | Keep parsing in `src/lib`, independent of React, DOM, network and browser storage. Pass the analysis date explicitly in deterministic tests. | Pipeline imports and repeatable tests. |
| ENG-02 | Preserve the pipeline: ingest → table/header detection → mapping → extraction → classification → quality. Keep UI orchestration in components/page. | Change placed in the responsible stage; no duplicated parsing rules in UI. |
| ENG-03 | Preserve strict TypeScript and `noUncheckedIndexedAccess`. Model untrusted data as unknown and narrow it; avoid `any`, unchecked casts and non-null assertions introduced solely to silence errors. | Typecheck and review of boundaries. |
| ENG-04 | Store synonyms/families in knowledge data; keep normalizers small and reusable. Match broad patterns, not sample-specific values. | Independent positive and negative examples. |
| ENG-05 | Preserve source sheet, row, original text and extraction method. Never invent an absent value or discard a nonempty asset row as "empty" without evidence. Missing and invalid values must be distinguishable through warnings/provenance. | Source-to-output comparison; one-row and description-only regressions. |
| ENG-06 | Keep canonical units: RAM GB using binary MB conversion; disk TB=1000 GB; screen inches; calendar dates normalized without timezone shifts. Do not round canonical storage totals for display. | Unit/date assertions and exported raw totals. |
| ENG-07 | Corrections are immutable overrides of source data. Reanalysis must preserve valid edits; header changes invalidate affected column mappings. Derived UI state must agree with the applied result. | Edit/undo/reset/remap manual cases. |
| ENG-08 | Support combined specifications beyond Model/Description when content warrants it. Prefer explicit field data; surface conflicting interpretations rather than silently losing specifications. | Official XLSX second-sheet RAM/storage assertions. |
| ENG-09 | Preserve model identifiers and generation numbers. Type inference should prefer specific evidence over generic form-factor words; ambiguity must be visible. | HP Z2 G5 and Precision Tower regressions. |
| ENG-10 | Duplicate sheet detection must use contents, not names. Duplicate serials remain reviewable rows. Keep peripherals and skipped rows traceable; do not export skipped rows as assets by default. | Official Sheet1 (2) inclusion and export tests. |

## Security requirements

Agents must also apply the [OWASP Top 10:2025 acceptance matrix](OWASP-TOP10.en.md). It maps all ten categories to this architecture, measurable project gates and explicit evidence gaps. It does not certify the current application.

Threat boundary: file bytes, filenames, sheet names, cell contents, URL parameters and user edits are untrusted. A local-only application still processes attacker-controlled files and produces spreadsheets that other applications open.

The rationale and revision process for file/resource limits are recorded in [ADR-001](ADR-001-FILE-SIZE-LIMIT.en.md). Agents changing those limits must update validation, user guidance and measured evidence together; the current 20 MiB value is provisional.

| ID | Required control | Evidence required for affected changes |
|---|---|---|
| SEC-01 | Keep inventories local by default. No file data, serials or assigned users in remote requests, telemetry or logs. Never add credentials to source. A remote extraction feature requires an explicit user requirement and a documented data flow. | Network inspection; no new external data sink. |
| SEC-02 | Validate format, size and parse errors. Preserve documented limits (20 MiB, 100,000 rows, 300 columns, 2,000 cell characters) unless intentionally revised. Truncation must be visible; malformed CSV cannot silently merge records. | Oversize/corrupt/quote/truncation tests. |
| SEC-03 | Render untrusted strings as text. Do not use raw HTML sinks, `eval`, `new Function` or execute spreadsheet formulas/macros. | Sink review and harmless literal-markup browser case. |
| SEC-04 | Neutralize formula-like text in CSV exports, including leading whitespace/control characters and existing full-width trigger coverage. Preserve numeric capacities as numbers. Treat JSON as data. | Export regression tests plus raw CSV inspection. |
| SEC-05 | Bound regex work and input traversal. Do not trust declared spreadsheet ranges or arbitrarily large multipliers. Decompression occurs before current grid limits: do not claim zip bombs are contained without testing/containment. | Hostile-input timing tests; document unmitigated resource limits. |
| SEC-06 | Use own-property lookups, Map or prototype-less dictionaries for untrusted keys. Do not merge untrusted objects into application configuration. | `__proto__`, `constructor` and sheet-name regression cases. |
| SEC-07 | Fail with actionable errors, preserve other readable sheets where possible, and keep app recovery available. Catching an error must not silently label lost data as successful. | Error/retry and per-sheet failure tests. |
| SEC-08 | Review dependency changes, source URLs and lockfile changes. Do not run automatic force upgrades as an audit fix. An audit command's result is evidence only for its date and scope. | Dependency rationale; fresh audit for dependency changes; disclose exceptions. |

Security fixes must add a regression at the appropriate boundary. Documentation of a control does not prove the implementation satisfies it. No certification, penetration-test completion or zero-risk claim is implied.
