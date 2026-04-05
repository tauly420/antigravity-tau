---
phase: quick
plan: 260405-na0
subsystem: report-generation
tags: [results-section, html-table, docx, prompt]
dependency_graph:
  requires: []
  provides: [results-section-generation, html-parameter-table, docx-html-table-rendering]
  affects: [report-export-pdf, report-export-docx, ai-report-generation]
tech_stack:
  added: []
  patterns: [html-table-injection, HTMLParser-for-docx]
key_files:
  created: []
  modified:
    - backend/prompts/report_system.py
    - backend/api/report.py
    - backend/utils/docx_renderer.py
decisions:
  - HTML parameter table built server-side (not AI-generated) for data integrity
  - HTMLParser used instead of regex for robust table extraction in DOCX renderer
  - Fallback to existing _add_results_section when no HTML table in content
metrics:
  duration: 3min
  completed: "2026-04-05"
---

# Quick Task 260405-na0: Add Results Section to Lab Report with HTML Parameter Table

Results section added to AI report pipeline: HTML parameter table injected at top from analysis_data, AI writes formula/nsigma prose, DOCX renders HTML table as native Word table with blue header.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add build_results_table_html + update prompt schema | 09ce02b | backend/prompts/report_system.py |
| 2 | Update report.py required_keys + HTML table injection | 42c4420 | backend/api/report.py |
| 3 | Add HTML table parsing to DOCX renderer | 75e25bb | backend/utils/docx_renderer.py |

## Deviations from Plan

None - plan executed exactly as written.

## Key Changes

1. **build_results_table_html** (report_system.py): Module-level function extracts fit parameters from analysis_data, builds HTML table with Quantity/Rounded/Full Precision columns plus chi-squared and P-value rows. Returns empty string when no data.

2. **Prompt schema** (report_system.py): Now requests 5 sections (added results). Results instruction tells AI to write formula/nsigma prose only, not restate parameters. Discussion updated to not restate values.

3. **report.py generate endpoint**: required_keys includes "results", HTML table injected at top of AI results content before returning response.

4. **DOCX renderer** (docx_renderer.py): _HTMLTableParser class parses HTML tables via html.parser. _add_html_table_to_doc creates Word table with bold blue header (DDEEFF shading). generate_docx detects HTML table prefix in results content, renders as native Word table + prose, falls back to existing behavior otherwise.

## Known Stubs

None.
