---
phase: 2
slug: theme-token-system
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — CSS-only phase, no unit tests applicable |
| **Config file** | none |
| **Quick run command** | `grep -n '#[0-9a-fA-F]\{3,8\}\b' frontend/src/styles/global.css \| grep -v ':root' \| grep -v 'data-theme'` |
| **Full suite command** | Quick run + visual inspection of all pages in dark mode |
| **Estimated runtime** | ~2 seconds (grep) + manual visual check |

---

## Sampling Rate

- **After every task commit:** Run quick grep command + visual check of affected section
- **After every plan wave:** Navigate all pages in dark mode, verify no visual artifacts
- **Before `/gsd:verify-work`:** Full grep must return zero results; all pages visually correct in dark mode
- **Max feedback latency:** 2 seconds (grep)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | THEME-01 | grep | `grep -c 'data-theme="dark"' frontend/src/styles/global.css` (must be >= 1) | N/A | pending |
| 02-01-02 | 01 | 1 | THEME-01 | grep | `grep -c 'data-theme="light"' frontend/src/styles/global.css` (optional — `:root` serves as light) | N/A | pending |
| 02-02-01 | 02 | 2 | THEME-01 | grep | `grep -n '#[0-9a-fA-F]\{3,8\}\b' frontend/src/styles/global.css \| grep -v ':root' \| grep -v 'data-theme'` (must be empty or theme-invariant only) | N/A | pending |
| 02-02-02 | 02 | 2 | THEME-01 | grep | `grep -c 'data-theme' frontend/src/App.tsx` (must be >= 1) | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework needed for CSS-only theming work.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dark theme renders correctly across all pages | THEME-01 | Visual verification of colors, contrast, readability | Open each page in browser with dark theme, verify backgrounds/text/borders match scientific instrument aesthetic |
| Header gradient appears darkened in dark mode | THEME-01 | Visual verification | Compare header in dark mode — should use deeper red tones |
| Layered surfaces show visible depth | THEME-01 | Visual verification | Verify cards appear lighter than page background, elevated panels lighter than cards |
| No flash of light background on load | THEME-01 | Visual/timing check | Hard-refresh the page, watch for white flash before dark theme applies |
| Token naming documented in CSS comments | THEME-01 | Content review | Read CSS comments in global.css, verify categories are labeled |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
