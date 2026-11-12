# Quality gates and metrics

Initial proposed targets for this challenge, 2026-11-12. Apply these as the project baseline unless the user changes them. Historical results below are evidence from a specific run, not continuous enforcement. No automated CI or scored ground-truth evaluator has been installed by this documentation change.

## Measurement rules

- Separate **automatic** results from **manually corrected** results. Score automatic output with no overrides.
- Freeze source inputs and expected annotations before tuning. Reference assets by source file/sheet/row. Never derive expected output by copying parser output.
- Annotate the eight core fields from source evidence. Mark absent values separately from ambiguous values; state the interpretation of NAS/tablets and ambiguous dates. Include ambiguous cases in a separate review count, not silently in or out of the denominator.
- Compare canonical values, not formatted labels. For storage compare total GB, individual drive capacity/count and type where present. For models retain identifying numbers/generation; for CPUs do not discard an available model.
- Report numerator and denominator per file and per field. A global average must not hide a failure in one sheet or field. No percentage is valid without the annotation set and scoring procedure.

## Release gates

Security sign-off additionally requires the [OWASP Top 10:2025 gates](OWASP-TOP10.en.md): category applicability, control verification evidence, dependency disposition, injection/privacy tests and failure transparency. A documented category is not a passed control; justified N/A cases must be reported separately.

| Metric | Definition | Target | Evidence at this baseline |
|---|---|---|---|
| Automated checks | Tests, typecheck, lint and production build | All applicable checks pass; no disabled regression to hide defects | 160/160 tests, typecheck/lint/build passed before resource review; no code changed afterward |
| Asset retention | Source computer assets represented in review / annotated source computer assets | 100% for official files and supported-layout regressions | Counts: XLSX 19, CSV 14 under current NAS/tablet classification; independent synthetic single-row case fails |
| Core-field recall | Correct extracted source-present core fields / all annotated source-present unambiguous core fields | 100% on the two official samples before demo | NOT fully scored; known failure: XLSX second sheet RAM 0/4, storage 0/4 automatically |
| Value precision | Correct nonempty core values / all nonempty predicted core values | 100% on annotated official samples; zero invented identifiers | NOT fully scored; HP Z2 G5 model corrupted; Ryzen V1500B missing |
| Classification | Correct row kinds and asset types / annotated rows | All unambiguous official rows correct; ambiguous policy documented | Monitor/keyboard separated; Precision Tower type conflicts with repository family knowledge |
| Unsupported/invalid input transparency | Invalid/truncated cases with explanatory message / cases exercised | 100% of agreed invalid/truncated suite | Malformed CSV issue remains open |
| Export fidelity | Selected source assets and edited values match export; no skipped/excluded asset leakage | 100% of targeted CSV/JSON assertions and manual cases | Browser downloads NOT RUN |
| Regression preservation | Previously passing assertions still passing | No unexplained regressions | Existing suite passed; official-file assertions still need to be added |
| Browser acceptance | P0 manual cases executed and passing / total P0 cases | All P0 pass; no silent data loss | NOT RUN; documented baseline defects block sign-off |
| Security regressions | Applicable SEC controls verified, failing cases tracked | No unresolved high-impact data exposure, execution or silent-loss defect | Earlier robustness suite passed; no new comprehensive security audit claimed |

Zero warnings is **not** a quality metric: the official XLSX second sheet loses specifications with no row warnings. Test count and line coverage are supplementary; neither proves correctness. Heuristic confidence scores are not calibrated probabilities and must not be presented as accuracy.

## Performance measurement (provisional budget)

The 20 MiB limit is not a performance result. [ADR-001](ADR-001-FILE-SIZE-LIMIT.en.md) defines its rationale, gaps, boundary tests and the additional workload/memory evidence required before changing it. Performance or worker improvements alone must not be reported as archive-bomb containment.

For performance changes, benchmark an independently generated 5,000-asset inventory with unique serials and realistic combined descriptions. Record hardware, browser/version, build mode, file bytes, row count and timings. Use production mode, one warm-up and five measured runs; report median and maximum.

- Initial budget: parse + analysis median ≤2 seconds, maximum ≤5 seconds on the recorded development machine.
- Measure UI responsiveness separately; a fast parser benchmark does not prove a responsive main thread. Record long freezes and whether loading/error feedback renders.
- Current status: NOT MEASURED. These thresholds are proposed project budgets, not challenge requirements or existing achievements. Do not add flaky CI timing assertions without a stable runner.

## Completion report template

```text
Scope / commit:
Changed behavior:
Regression reproduced before fix:
Commands executed and outcomes:
Official-input automatic results (field counts + discrepancies):
Manual corrections needed:
Browser cases executed / not run:
Security controls touched and evidence:
Performance (if relevant):
Open defects / limitations:
Release gates met / not met:
```

Next enforcement work: add immutable official-sample expectations and regression tests, then a CI workflow for tests/typecheck/lint/build. Do not label this planned work as already implemented.
