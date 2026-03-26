# Tau-LY

## What This Is

Tau-LY is a web application for physics and engineering lab work automation. It provides a suite of analysis tools — curve fitting, ODE solving, integration, formula evaluation, unit conversion, matrix operations, Fourier analysis, and an AI-driven "AutoLab" that orchestrates full analysis workflows from plain language instructions. Built for students and researchers who want to go from raw data to results with minimal friction.

## Core Value

AutoLab: upload a data file, describe what you want in plain language, and get a complete physics analysis (fit, parameters, uncertainties, comparison to theory) — no manual tool selection required.

## Requirements

### Validated

- ✓ AutoLab AI-driven end-to-end analysis (file upload + natural language → fit + formula + comparison) — existing
- ✓ Graph fitting with multiple models (linear, quadratic, cubic, power, exponential, sinusoidal, custom) — existing
- ✓ Formula calculator with uncertainty propagation — existing
- ✓ N-sigma comparison to theoretical values — existing
- ✓ ODE solver (numerical integration of differential equations) — existing
- ✓ Numerical integration calculator — existing
- ✓ Matrix operations — existing
- ✓ Unit converter — existing
- ✓ Fourier analysis — existing
- ✓ Statistics calculator — existing
- ✓ Constants reference — existing
- ✓ Sidebar AI chat assistant (context-aware, available on every page) — existing
- ✓ Post-analysis chat in AutoLab — existing
- ✓ Example datasets for AutoLab (Hooke's Law, Oscillation, Free Fall) — existing

### Active

- [ ] AI-powered academic lab report generation from AutoLab results
- ✓ Upload lab instruction files (PDF/Word, Hebrew or English) as context source — Validated in Phase 9: Report Data Contract and File Parsing
- [ ] Free-text context input with AI gap-filling for missing experiment info
- [ ] AI-generated theoretical background, measurement planning, and physics discussion sections
- [ ] Hebrew RTL body text with English math/equations in PDF output
- [ ] In-app report preview with section editing before PDF export
- [ ] Backend PDF generation with academic formatting (numbered sections, LaTeX equations, figure captions)
- [ ] Embedded analysis plots (fit, residuals) in generated reports

### Deferred (from v1.0)

- [ ] Modern dark science theme with polished UI overhaul
- [ ] Top tab bar navigation replacing current tool switching
- [ ] AutoLab results layout overhaul — reduce scrolling, surface key info
- [ ] AI assistance on ODE solver page (equation setup, method advice, result interpretation)
- [ ] AI assistance on Integration page (equation setup, method advice, result interpretation)
- ✓ Fix critical security: remove eval() on user input in ODE/Integration backends — Validated in Phase 1: Security Hardening
- [ ] Fix critical security: disable Flask debug=True in production

### Out of Scope

- Mobile-native app — web-first, responsive improvements only
- User accounts / authentication — stateless tool, no login needed
- Real-time collaboration — single-user tool
- Database / persistent storage — analyses are ephemeral by design
- AI on every tool page — focus AI expansion on ODE/Integration first, expand later

## Current Milestone: v2.0 AI-Powered Academic Lab Report Export

**Goal:** Generate publication-ready academic lab reports from AutoLab analysis results, with AI-written theoretical background and discussion, Hebrew RTL support, and in-app preview/editing.

**Target features:**
- Upload lab instruction files (PDF/Word, Hebrew or English) as primary context source
- Free-text context input (lab subject, equipment, notes) with AI gap-filling for missing info
- AI-generated theoretical background section based on experiment context
- AI-generated measurement planning section based on uploaded instructions and equipment
- Results section pulling from AutoLab analysis (parameters, fits, uncertainties) with embedded plots and captions
- AI-generated physics discussion interpreting the results
- Hebrew RTL body text with English math/equations (standard Israeli academic format)
- In-app preview with section editing before final PDF export
- Backend PDF generation (best engine for academic quality + Hebrew RTL)
- AutoLab-first, with hooks for future expansion to standalone tools

## Context

- **Existing codebase**: React 19 + Vite 7 + TypeScript frontend, Python Flask backend with SciPy/SymPy/NumPy
- **Deployment**: Railway via nixpacks (Python 3 + Node 23)
- **AI providers**: OpenAI (GPT-4o-mini for AutoLab) and OpenAI/Gemini for sidebar chat
- **Current state**: Fully functional analysis suite. Security hardening complete. Theme token system in place but style migration incomplete.
- **Existing PDF export**: Basic feature exists — needs complete revamp for academic-quality output
- **Codebase concerns**: AutoLab.tsx is 1,141 lines (god component), AnalysisContext uses `any` throughout, Flask debug=True leaks to production
- **Phase 1 complete**: eval() removed from ODE/Integration backends — replaced with sympify+lambdify, 40 tests passing
- **Phase 9 complete**: ReportAnalysisData contract defined, Python normalizer built, PDF/DOCX file parser and upload endpoint added, upload UI on ReportBeta page
- **Codebase map**: Available in `.planning/codebase/` (7 documents)

## Constraints

- **Tech stack**: Must stay React + Flask — no framework migration
- **AI provider**: OpenAI for AutoLab function-calling (Gemini supported only for sidebar chat)
- **Deployment**: Railway via nixpacks — no Docker migration
- **Budget**: Minimize unnecessary OpenAI API calls — rate limit AI endpoints

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Dark science theme | User preference for modern pro-instrument dashboard aesthetic | Deferred to future milestone |
| Top tab bar navigation | User prefers horizontal tabs over sidebar/dashboard hub | Deferred to future milestone |
| Both PDF + LaTeX export | User wants ready-to-submit reports AND customizable source | Superseded by v2.0 AI report |
| Full AI on ODE/Integration | User wants equation setup, method advice, and result interpretation | Deferred to future milestone |
| Fix worst security issues only | eval() and debug=True are critical; defer XSS/rate limiting | eval() fixed (Phase 1); debug=True deferred |
| Defer new analysis tools | User hasn't decided on specific new tools yet — revisit later | Deferred |
| AI-powered lab report export | User wants full academic reports (theory, planning, results, discussion) generated by AI | v2.0 milestone |
| Hebrew RTL in reports | Standard Israeli academic format — Hebrew body, English math | v2.0 milestone |
| Upload lab instructions | Primary context source for report generation — PDF/Word, Hebrew or English | v2.0 milestone |
| In-app report preview+edit | User wants to review and tweak before final PDF download | v2.0 milestone |
| AutoLab-first report scope | Start with AutoLab results, expand to standalone tools later | v2.0 milestone |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-26 — Phase 9 complete*
