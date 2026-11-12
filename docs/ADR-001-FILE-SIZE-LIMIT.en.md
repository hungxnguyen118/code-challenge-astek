# ADR-001: provisional 20 MiB file limit and large-file roadmap

Date: 12 November 2026. Status: **documented current decision; threshold not benchmark-validated**. This records the rationale adopted during review for the existing limit, not evidence of an earlier capacity study. Implementation changes below are planned, not completed.

## Decision and rationale

Keep the current input limit of **20 MiB = 20 × 1024 × 1024 = 20,971,520 bytes per file** while the app uses browser-local, synchronous parsing. The current UI labels this as “20 MB”; documentation uses MiB to state the exact boundary. Files larger than the boundary are rejected; a file exactly at the boundary is not rejected by the size check alone.

This is a provisional resource guardrail for the challenge scope:

- The app holds file bytes, decoded workbook/grid, extracted assets and UI state in memory. Source bytes alone do not describe peak memory usage.
- XLSX is compressed: a small upload can expand substantially. CSV, XLSX, many-sheet workbooks and long-cell inputs have different processing costs at the same byte size.
- Parsing and analysis run on the main thread; excessive work can prevent interaction and feedback.
- A finite, predictable input contract is preferable to accepting arbitrarily large files before resource behavior is measured. It also lets the UI explain how to proceed.

**Why exactly 20 rather than 10 or 50 MiB?** No measurement currently establishes 20 as the optimal or safe cutoff. It is an initial engineering choice balancing a usable input allowance with a bounded file-byte budget. It is not mandated by the challenge, derived from the two official samples, or proof that every smaller file is safe/fast. Revising the number requires the evidence below, not just raising a constant to admit one file.

## Current protection and gaps

| Current behavior | Limit of that protection |
|---|---|
| `MAX_FILE_BYTES` rejects buffers larger than 20 MiB. | Upload code calls `File.arrayBuffer()` first: the full input has already been allocated before this check. |
| Workbook grids are limited to 100,000 rows per sheet and 300 columns; text cells are clipped at 2,000 characters, with notes. | These limits apply after workbook decoding; they are not a decompression quota or a global memory budget. Many sheets can multiply the cost. CSV parsing also occurs before row/column slicing. |
| Actual populated range is used instead of trusting an inflated Excel range. | This addresses sparse/formatting-expanded ranges, not every large or adversarial workbook. |
| Truncation is reported in result notes. | A truncated result is partial, not a successful complete inventory; warnings must remain visible when reviewing/exporting. |

A Web Worker can move work off the UI thread and be terminated on cancellation/timeout. It does **not** itself provide a hard memory cap or guarantee archive-bomb containment. Virtualizing a table reduces rendered rows, not parsing memory. Treat these as distinct problems.

## What users can do today for a larger file

1. Keep the original file and work on a copy. Remove unrelated sheets, embedded images and unnecessary formatting where appropriate.
2. Split the inventory into smaller files, each within 20 MiB; retain headers, units and identifying columns in each part. Partition by sheet or logical group without losing source-row traceability.
3. A flat sheet can be saved as CSV if merged layouts, multiple sheets and workbook-specific semantics are not required. CSV may be **larger**, so check its byte size; it is not a bypass of the limit.
4. Process and export parts separately. The current app has no cross-file merge/reconciliation flow: duplicate detection and summaries operate per uploaded file. Reconcile totals and cross-part duplicates separately before treating the result as one inventory.

Do not silently truncate a large input to make it fit. Do not upload it to an external service without a separate product/privacy decision.

## Next implementation stages

| Stage | Planned work | Acceptance evidence |
|---|---|---|
| 1 — reject early and clarify feedback | Check `File.size` before `arrayBuffer()` for picker and drop paths; retain the ingest check as defense in depth. Show the exact limit, received size and split-file guidance. Ensure sample/other ingestion paths have bounded reads. | Boundary tests at limit−1, limit and limit+1; oversized local files do not reach the byte-loading function; valid retry works. |
| 2 — responsive local processing | Move ingestion **and analysis/reanalysis** to a worker; add cancel, timeout and truthful progress phases. Transfer byte buffers where possible and ignore stale results after a new file/reset. Add table virtualization/pagination separately. | Upload/edit/cancel/new-upload flows stay responsive; terminated jobs do not update results; measured memory/timing and export correctness. |
| 3 — bounded parsing | Process CSV in chunks with bounded header/content samples and incremental extraction. For XLSX, assess parser support for incremental/limited decompression; enforce aggregate rows/cells, sheet counts and decompressed-byte budgets where technically enforceable. A ZIP metadata precheck is not sufficient by itself. | Large CSV/many-sheet/sparse/long-cell/compressed-input cases meet declared budgets; limits stop work during processing, not only after full allocation; partial results clearly identified. |
| 4 — larger local limit, only if justified | Benchmark representative files/devices and choose format/workload limits from evidence. Consider different limits per format instead of one larger universal number. | Record supported envelope, peak memory, latency and failures. Keep 20 MiB until a replacement limit is justified. |
| 5 — optional server processing | If real inventories exceed validated browser capacity, design an explicit opt-in upload workflow with isolated asynchronous jobs, storage quotas, streaming/partitioned processing, cancellation and result download. | Reassess authorization, encryption, retention/deletion, tenant isolation, abuse limits, logs and OWASP controls. This changes the current “nothing is uploaded” promise and requires a separate product decision. |

Do not start by simply increasing the constant to 100 MiB. Workers, streaming and a backend are planned options, not features currently available.

## Measurement and revision criteria

Use the [quality-gate performance procedure](QUALITY-GATES.en.md): production mode, recorded hardware/browser, warm-up plus five runs. Keep the proposed 5,000-asset baseline, and add file-size boundary cases and datasets varying format, populated cells, sheet count, long text and compression. Run controlled stress tests in an isolated test environment, not alongside the user's unrelated server workloads.

Record input bytes, decoded workload, parse/analysis duration, peak memory when measurable (and the measurement method), UI long tasks/freezes, cancellation time, asset/field correctness, truncation messages and retry behavior. If memory cannot be measured reliably, record that limitation rather than asserting memory safety. Establish target-device memory and cancellation budgets before claiming large-file support; these are not yet defined or measured.

Revisit this decision when real user files exceed the limit, benchmarks contradict the supported envelope, parsing architecture changes or hosting is introduced. Every change must update the limit constant, UI labels, validation tests, manual guidance and this decision together.
