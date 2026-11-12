# Coding Challenge – Asset Spreadsheet Parser

> Source: `note.txt`. This is a step-by-step version to follow while building.

## 1. Deadline & deliverables

| Item | Detail |
|---|---|
| **Deadline** | **12:00 PM, Friday 13 November** (tomorrow) |
| **What to submit** | A link to your Git repository (GitHub, GitLab, …) |
| **Interview** | Live demo of the app + walk through your technical decisions |
| **Suggested time** | About 2–3 hours in total. They care more about how you think than how many hours you spend |
| **AI tools** | Allowed, both as a coding assistant and as an LLM inside the app. **You must explain in the README where and how you used them**, and be ready to explain any code in the repo |

## 2. The problem

IT managers keep inventories of computers in messy spreadsheets:
- Headers don't start on row 1 (for example, on row 4)
- One column has several names ("RAM", "Memory", "Mem (GB)"…)
- Several values in one cell: `Dell Lat 5420 i7 16GB`
- Extra or junk sheets such as `Sheet1 (2)`

**No two files look the same.** The app has to understand them anyway.

## 3. Mandatory requirements

Build a **web application with TypeScript + Next.js and/or React** where a user can:

- [ ] **Upload** a spreadsheet: at least **.xlsx** and **.csv**
- [ ] **Automatically extract** the asset information, **whatever the layout**:
  - column names, column order, header position, number of sheets and how data is written can all change
- [ ] **Review** the results in a clean, structured view

### Fields to extract (whenever the file has them)

| # | Field | Example |
|---|---|---|
| 1 | Asset type | laptop, desktop, server… |
| 2 | Manufacturer | Dell, HP, Lenovo |
| 3 | Model | Latitude 5420, EliteBook 840 G8 |
| 4 | Serial number | 5CG1234XYZ |
| 5 | CPU | i7-1185G7 |
| 6 | RAM | 16 GB |
| 7 | Storage | 256 GB SSD |
| 8 | Screen size | 14" |

Any other useful field (location, assigned user, purchase date, warranty, OS…) is a **bonus**.

> ⚠️ During the presentation they will **test with files you have never seen**. Don't hard-code for the 2 sample files.
> Official samples are now available in `resources/sample_assets_1.xlsx` and `resources/sample_assets_2.csv`. The accompanying candidate PDF describes role/interview context. See [attachment review](RESOURCE-REVIEW.en.md) for actual parser results and outstanding defects.

## 4. Optional ideas (pick 1–2 and do them well)

"One idea done thoughtfully beats ten done halfway."

- Smart column detection: fuzzy matching, heuristics, an LLM, or a mix
- **Confidence score** for each value, so the user knows what to double-check
- A **"Fix the mapping"** screen for when the app guesses a column wrong
- Parsing combined fields: `HP EliteBook 840 G8 / i5 / 16GB / 256GB SSD / 14in`
- Normalising values: `16 gig`, `16GB`, `16384 MB` → `16 GB`
- Spotting rows that aren't computers (monitors, keyboards…)
- Duplicate detection, data quality warnings, fleet summary dashboard
- Export to clean CSV/JSON

## 5. How you will be assessed

1. **Handling formats it has never seen** ← most important
2. **Code quality, structure and TypeScript usage**
3. **UX, especially when things go wrong** (bad file, empty sheet, no header found, unreadable value…)
4. **How clearly you explain your reasoning** in the README and the presentation

## 6. Suggested plan (~3 hours)

| Step | Work | Time |
|---|---|---|
| 1 | Set up Next.js + TypeScript, upload page (drag & drop, .xlsx/.csv) | 20' |
| 2 | Read the file with `xlsx` (SheetJS) / `papaparse`, go through **every sheet** | 20' |
| 3 | **Find the header row**: score the first ~20 rows (how many cells are text, how many match known keywords) | 30' |
| 4 | **Map columns → fields**: synonym dictionary + fuzzy matching + data-based checks (e.g. a column full of `\d+ ?GB` → RAM/Storage) | 40' |
| 5 | **Parse combined fields and normalise** (RAM/Storage → GB, screen → inches, manufacturer names) using regex | 30' |
| 6 | Results table + confidence + per-sheet tabs + error states | 30' |
| 7 | (Bonus) Fix mapping / export CSV/JSON / filter non-computer rows | remaining time |
| 8 | **README**: how to run, architecture, approach, trade-offs, limits, **where AI was used** | 20' |

## 7. Pre-submission checklist

- [ ] `npm install && npm run dev` runs on a clean machine
- [ ] Upload .xlsx works; upload .csv works
- [ ] Tested with a file where the header is not on row 1, columns are renamed/reordered, and there are several sheets
- [ ] Wrong file type / empty file / unreadable file → a clear error message, no crash
- [ ] TypeScript strict mode, no stray `any`
- [ ] Parsing logic is separate from the UI (easy to test; a few unit tests if possible)
- [ ] README is complete, including the **AI usage** section
- [ ] Repo pushed, link sent **before 12:00 PM Friday 13/11**
- [ ] Demo scenario prepared + you can explain every technical decision
