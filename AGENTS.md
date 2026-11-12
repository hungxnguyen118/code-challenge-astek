# Repository instructions for coding agents

Scope: this repository and its subdirectories. This is an initial project baseline introduced on 2026-11-12 after independent review; it is not a record of previously supplied user rules. Explicit user instructions take precedence. Do not claim these rules are enforced by CI: no CI gate has been added yet.

## Read before changing code

1. `docs/challenge-brief.txt` and `docs/REQUIREMENTS.en.md`: deliverables and scope.
2. `docs/ENGINEERING-RULES.en.md`: architecture, patterns and security requirements.
3. `docs/QUALITY-GATES.en.md`: metrics, evidence and completion criteria.
4. `docs/VERIFICATION.en.md` and `docs/RESOURCE-REVIEW.en.md`: known failures; do not assume the baseline is correct.
5. `docs/MANUAL-TEST.en.md`: browser verification steps.
6. `docs/OWASP-TOP10.en.md`: OWASP Top 10:2025 scope, controls, acceptance metrics and evidence status. Reassess affected categories for security-relevant changes; do not claim compliance merely from this checklist.

## Working agreement

- **User environment constraint: use port 3001 for this application. Port 3000 is reserved for the user's unrelated real server. Never start this project on port 3000 or stop/reconfigure a process using it.** Use the npm scripts, which explicitly select 3001. If 3001 is occupied, identify the listener without terminating it; report the conflict rather than taking over another service.
- Read `docs/PLAN.en.md` for the current implementation and remediation plan. Preserve `docs/PLAN.vi.md` as the local historical draft.

- Preserve user changes; inspect `git status` before editing. Keep changes within the user's task. Do not commit, push or publish unless requested.
- Publication constraint from the user: never publish Vietnamese documents (`*.vi.*`), any `INTERVIEW-PREP*` file in any language, or the Vietnamese candidate-brief PDF. Keep these locally. Check reachable commit history as well as the current tree before pushing; `.gitignore` does not remove previously tracked files.
- Treat `resources/` as original challenge evidence. Never overwrite the PDF or input spreadsheets, regenerate them, or change them to make tests pass. Make derived test inputs elsewhere.
- Use official inputs plus independent variants. Do not hard-code filenames, serials, sheet titles or row numbers into production parsing logic.
- Reproduce a reported failure before fixing it. Add a focused regression for behavior-changing parser/security fixes; test expected behavior, not implementation details. Documentation-only changes need link/content/diff checks, not a full build.
- Follow existing patterns; explain a necessary deviation and its tradeoff. Do not introduce a backend, LLM calls, telemetry, storage or dependencies solely to increase perceived sophistication.
- For application changes run applicable focused tests, then `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`. Report failures and blockers faithfully; do not suppress assertions or weaken compiler settings to get green results.
- For UI changes exercise the affected manual cases when a browser is available. Otherwise say exactly which cases remain NOT RUN. Parser tests and HTTP 200 do not verify browser behavior.
- Distinguish automatic extraction from results after manual corrections in every report.
- Finish with changes, validation actually executed, unresolved findings and any limitations. Do not claim "secure", "all layouts supported", "100% accuracy" or "release ready" without scoped evidence meeting the quality gates.

Rules are instructions, not a sandbox. Agents must still inspect evidence and report noncompliance; passing the existing 160 tests does not close known failures.
