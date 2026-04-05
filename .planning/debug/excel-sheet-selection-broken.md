---
status: awaiting_human_verify
trigger: "Excel sheet selection UI lets user pick sheets but doesn't load the selected sheet. Loading full Excel sheets also causes a black screen crash."
created: 2026-04-05T00:00:00Z
updated: 2026-04-05T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Two issues: (1) backend /fitting/parse returns ALL rows, no limit; (2) StatisticsCalculator sheet_to_json returns ALL rows; (3) Sheet dropdown requires explicit "Load" button click but users expect auto-load on change
test: Code reading confirmed all three
expecting: N/A - root cause confirmed
next_action: Apply fixes: add max_rows param to backend, limit client-side parsing, auto-load on sheet change

## Symptoms

expected: When user selects a sheet from dropdown, preview updates to show selected sheet data (first ~15 rows)
actual: Sheet dropdown appears but selecting different sheet doesn't update preview; large Excel files cause blank screen
errors: React crash from loading 1000+ rows into state
reproduction: Upload multi-sheet Excel file; change sheet selection; or upload large Excel file
started: Commit b6dc720 (quick task 260405-pjz)

## Eliminated

## Evidence

- timestamp: 2026-04-05T00:10:00Z
  checked: backend/api/fitting.py parse_file endpoint
  found: Returns ALL rows from parsed sheet (lines 86-94). No max_rows parameter. 1000+ row files send entire dataset.
  implication: Large files cause massive JSON payload, React state bloat, potential black screen crash.

- timestamp: 2026-04-05T00:11:00Z
  checked: StatisticsCalculator.tsx loadSheetFromWorkbook
  found: XLSX.utils.sheet_to_json returns ALL rows with no limit. Entire sheet stored in fileData state.
  implication: Client-side parsing also loads everything. Combined with DataPreview rendering, causes crash on large sheets.

- timestamp: 2026-04-05T00:12:00Z
  checked: AutoLab.tsx and StatisticsCalculator.tsx sheet selector UI
  found: Both use a dropdown + separate "Load" button pattern. Dropdown change only updates state, doesn't trigger data load.
  implication: Users expect dropdown change to load sheet automatically. The "Load" button is not intuitive.

## Resolution

root_cause: Three compounding issues — (1) backend parse endpoint returns ALL rows with no limit, (2) StatisticsCalculator client-side XLSX parsing loads ALL rows, (3) sheet dropdown change doesn't auto-load the selected sheet. Large files crash React, and even when they don't crash, changing sheets has no visible effect without clicking a non-obvious "Load" button.
fix: (1) Add max_rows param to backend parse, default 15 for preview. (2) Limit client-side sheet_to_json to 15 rows. (3) Auto-load sheet on dropdown change (remove "Load" button). (4) GraphFitting also affected - same fixes.
verification: TypeScript compiles clean, frontend builds successfully. Needs manual test with multi-sheet Excel file.
files_changed: [backend/api/fitting.py, frontend/src/services/api.ts, frontend/src/components/AutoLab.tsx, frontend/src/components/StatisticsCalculator.tsx, frontend/src/components/GraphFitting.tsx, frontend/src/components/Workflow.tsx]
