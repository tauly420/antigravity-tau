---
phase: quick
plan: 260405-pjz
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/AutoLab.tsx
  - frontend/src/components/Workflow.tsx
  - frontend/src/components/StatisticsCalculator.tsx
autonomous: true
must_haves:
  truths:
    - "Every data file upload (CSV/Excel) shows a preview table of first N rows"
    - "Excel files with multiple sheets show a sheet selector before preview"
    - "All four upload points (AutoLab, GraphFitting, Workflow, StatisticsCalculator) have consistent preview+sheet behavior"
  artifacts:
    - path: "frontend/src/components/AutoLab.tsx"
      provides: "Sheet selector + DataPreview for multi-sheet Excel"
    - path: "frontend/src/components/Workflow.tsx"
      provides: "DataPreview after data load"
    - path: "frontend/src/components/StatisticsCalculator.tsx"
      provides: "Sheet selector + DataPreview for uploaded files"
  key_links:
    - from: "AutoLab.tsx"
      to: "/api/fitting/parse"
      via: "api.parseFileInfo + api.parseFileData"
      pattern: "parseFileInfo|parseFileData"
    - from: "StatisticsCalculator.tsx"
      to: "DataPreview"
      via: "import and render"
      pattern: "<DataPreview"
---

<objective>
Add consistent data file preview and multi-sheet Excel support to all upload points in the app.

Purpose: Users need to see what data they uploaded before running analysis, and choose which sheet to use for multi-sheet Excel files.
Output: All four data upload components show DataPreview table + sheet selector where applicable.
</objective>

<context>
@frontend/src/components/DataPreview.tsx — Existing reusable preview component (columns + rows table, collapsible)
@frontend/src/components/AutoLab.tsx — Has DataPreview but NO sheet selector for multi-sheet Excel
@frontend/src/components/Workflow.tsx — Has sheet selector but NO DataPreview after loading
@frontend/src/components/StatisticsCalculator.tsx — Client-side parsing, no sheet selector, no preview
@frontend/src/components/GraphFitting.tsx — ALREADY COMPLETE (has both sheet selector + DataPreview)
@frontend/src/services/api.ts — Has parseFileInfo (returns sheet_names + sheets_info) and parseFileData (returns columns + rows)

<interfaces>
From frontend/src/components/DataPreview.tsx:
```typescript
interface DataPreviewProps {
    columns: string[];
    rows: Record<string, any>[];
    maxRows?: number;     // default 10
    defaultOpen?: boolean; // default true
}
```

From frontend/src/services/api.ts:
```typescript
export const parseFileInfo = async (file: File): Promise<{
    sheet_names: string[];
    sheets_info: Record<string, string[]>;
}>
export const parseFileData = async (file: File, sheetName?: string): Promise<{
    columns: string[];
    rows: Record<string, any>[];
    sheet_names: string[];
    row_count: number;
}>
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add sheet selector to AutoLab and DataPreview to Workflow</name>
  <files>frontend/src/components/AutoLab.tsx, frontend/src/components/Workflow.tsx</files>
  <action>
**AutoLab.tsx** — The current `handleFileChange` calls `parseFileData` without checking for multiple sheets. Modify it to follow the same pattern as GraphFitting.tsx:

1. Add state: `sheetNames` (string[]), `selectedSheet` (string)
2. In `handleFileChange`: if file is .xlsx/.xls, call `api.parseFileInfo(f)` first. If >1 sheet, store sheet names and show selector. If 1 sheet, call `parseFileData(f, sheetNames[0])` directly and set previewData.
3. For CSV/TSV/etc (non-Excel), keep current behavior: call `parseFileData(f)` directly.
4. Add a `loadSheet` function that calls `api.parseFileData(file, selectedSheet)` and sets previewData.
5. Render sheet selector UI between the file drop zone and the existing DataPreview — same style as GraphFitting (select dropdown + Load button), only shown when `sheetNames.length > 1`.
6. When sheet is selected and loaded, the existing `<DataPreview>` already renders from `previewData` — no changes needed there.
7. The `file` state variable (File object) is what gets sent to `/api/autolab/run` — that stays unchanged. The sheet selection is just for preview; AutoLab backend parses the file itself.

**Workflow.tsx** — Already has sheet selector + data loading. Missing DataPreview after load.

1. Add `import DataPreview from './DataPreview';` at top.
2. After the sheet info section (around line 417), when `parsedData` exists, render `<DataPreview columns={parsedData.columns} rows={parsedData.rows} />` — same as GraphFitting does at line 261.
  </action>
  <verify>
    <automated>cd "/Users/uri/uri_labtools/try1/uri_labtools/Google antigravity /Tau-ly website/frontend" && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>AutoLab shows sheet selector for multi-sheet Excel + preview. Workflow shows DataPreview after data load. TypeScript compiles clean.</done>
</task>

<task type="auto">
  <name>Task 2: Add sheet selector and DataPreview to StatisticsCalculator</name>
  <files>frontend/src/components/StatisticsCalculator.tsx</files>
  <action>
StatisticsCalculator currently does client-side parsing with papaparse/xlsx and only reads the first sheet of Excel files. It also has no data preview.

1. Add `import DataPreview from './DataPreview';` at top.
2. Add state: `sheetNames` (string[]), `selectedSheetIdx` (number, default 0). Keep the existing client-side parsing approach (it already imports XLSX and Papa).
3. Modify the Excel branch of `handleFileUpload` (around line 190-213):
   - After reading the workbook, store `workbook.SheetNames` in `sheetNames` state and store the workbook itself in a new `workbookRef` (useRef).
   - If only 1 sheet: auto-load it (current behavior).
   - If >1 sheets: show sheet selector, do NOT auto-load yet.
4. Add a `loadSelectedSheet` function: reads `workbookRef.current.Sheets[sheetNames[selectedSheetIdx]]`, converts to JSON, sets `fileData`.
5. Render sheet selector (same style as other components: select + Load button) when `sheetNames.length > 1`, shown after the file upload area.
6. Render `<DataPreview columns={fileData.columns} rows={fileData.rows} defaultOpen={false} />` when `fileData` exists, placed after the file upload / sheet selector section (before the stats results). Use `defaultOpen={false}` since the stats results are the main focus.
  </action>
  <verify>
    <automated>cd "/Users/uri/uri_labtools/try1/uri_labtools/Google antigravity /Tau-ly website/frontend" && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>StatisticsCalculator shows sheet selector for multi-sheet Excel. DataPreview appears after file load. TypeScript compiles clean.</done>
</task>

</tasks>

<verification>
1. `cd frontend && npx tsc --noEmit` — no type errors
2. `cd frontend && npm run build` — builds successfully
3. Manual check: upload a multi-sheet .xlsx in AutoLab — sheet selector appears, preview shows selected sheet data
4. Manual check: upload CSV in Workflow — DataPreview table appears after loading
5. Manual check: upload multi-sheet .xlsx in StatisticsCalculator — sheet selector + preview appear
</verification>

<success_criteria>
All four data upload components (AutoLab, GraphFitting, Workflow, StatisticsCalculator) show:
- A data preview table after file load (using DataPreview component)
- A sheet selector dropdown when Excel file has multiple sheets
Frontend compiles with no TypeScript errors.
</success_criteria>

<output>
After completion, update `.planning/STATE.md` quick tasks table.
</output>
