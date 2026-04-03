---
phase: 15
slug: autolab-fixes-and-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-03
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.0+ (backend) |
| **Config file** | None (default pytest discovery) |
| **Quick run command** | `cd backend && python -m pytest tests/ -x` |
| **Full suite command** | `cd backend && python -m pytest tests/ -v` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/ -x`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -v`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | FIX-01 | smoke | `curl -sf https://RAILWAY_URL/api/report/test-pdf > /dev/null` | N/A (manual on Railway) | ⬜ pending |
| 15-01-02 | 01 | 1 | FIX-01 | unit | `cd backend && python -c "from utils.pdf_renderer import generate_test_pdf; pdf = generate_test_pdf(); assert len(pdf) > 1000"` | N/A (inline) | ⬜ pending |
| 15-02-01 | 02 | 1 | FIX-02 | grep | `grep -r 'primary-btn\|small-btn' frontend/src/components/` returns no results | N/A (grep check) | ⬜ pending |
| 15-02-02 | 02 | 1 | FIX-02 | grep | `grep -rn "background.*white\|background.*#" frontend/src/components/*.tsx` on button elements | N/A (grep check) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PDF export returns 200 on Railway | FIX-01 | Requires Railway deployment | Deploy, hit /api/report/test-pdf, verify 200 + valid PDF bytes |
| Both PDF export types work on Railway | FIX-01 | Requires Railway deployment | Run analysis, try results-only PDF and full report PDF |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
