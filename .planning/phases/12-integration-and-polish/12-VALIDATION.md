---
phase: 12
slug: integration-and-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend only — no frontend test framework configured) |
| **Config file** | `backend/tests/conftest.py` |
| **Quick run command** | `cd backend && python -m pytest tests/ -x -q` |
| **Full suite command** | `cd backend && python -m pytest tests/ -v` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/ -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -v` + manual browser test of both flows
- **Before `/gsd:verify-work`:** Full suite must be green + full E2E manual test
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | UI-04 | manual | Manual: run AutoLab analysis, verify "Generate Report" button appears | N/A | ⬜ pending |
| 12-01-02 | 01 | 1 | UI-04 | manual | Manual: click Generate Report, verify navigation to /report with pre-filled data | N/A | ⬜ pending |
| 12-02-01 | 02 | 1 | UI-04 | manual | Manual: full E2E — AutoLab → Generate Report → context form → AI generation → preview → PDF | N/A | ⬜ pending |
| 12-02-02 | 02 | 1 | D-07 | manual | Manual: run partial analysis (no n-sigma), verify warning banners | N/A | ⬜ pending |
| 12-02-03 | 02 | 1 | D-08 | manual | Manual: trigger AI failure, verify retry + error message | N/A | ⬜ pending |
| 12-xx-xx | xx | 1 | -- | unit | `cd backend && python -m pytest tests/ -x -q` (regression) | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test framework installation needed.

- No frontend test infrastructure exists (no vitest, no jest). This is a project-wide gap, not specific to this phase.
- All UI-04 validation is manual browser testing.
- Backend pytest suite exists and covers regression testing.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Generate Report button appears after AutoLab analysis | UI-04 | No frontend test framework | Run example dataset in AutoLab, verify button renders below results |
| Button navigates to /report with pre-filled data | UI-04 | Browser navigation + React state | Click button, verify report page loads with context form pre-filled |
| Full E2E workflow completes | UI-04 | Multi-page stateful flow | AutoLab → Generate Report → edit context → generate → preview → PDF download |
| Partial analysis shows warning banners | D-07 | Visual UI verification | Run analysis that produces only fit (no n-sigma), verify orange warning banner |
| AI generation retry on failure | D-08 | Requires API failure simulation | Temporarily break API key, verify silent retry then error message |
| Standalone analysis on report page | D-03 | Browser interaction | Navigate directly to /report, use standalone analysis section, verify full flow |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
