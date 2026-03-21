# Research Summary: Tau-LY Milestone 2

**Domain:** Physics lab automation -- dark theme, report generation, AI-assisted solvers
**Researched:** 2026-03-20
**Overall confidence:** MEDIUM-HIGH (WebSearch/WebFetch unavailable; recommendations based on training data + detailed codebase analysis)

## Executive Summary

Tau-LY's second milestone adds three capabilities: a dark science theme, PDF/LaTeX report export, and AI-assisted ODE/Integration solvers. The existing codebase is well-positioned for all three -- CSS custom properties support theming, Flask's Jinja2 handles report templating natively, and the ChatAgent pattern transfers directly to solver pages.

The recommended approach adds only two new Python dependencies (WeasyPrint for PDF, matplotlib for static plots) and one small frontend package (DOMPurify for XSS prevention). The dark theme is pure CSS refactoring with no component library. The AI assistants reuse the existing ChatAgent, not a new orchestrator. This minimal-dependency strategy avoids the common trap of over-engineering.

The biggest work item is not a library addition but a migration: ~420 inline `style={{}}` declarations across 15 components must be converted to CSS variable references before dark theming can work. This is the bulk of the theme phase effort.

The most critical finding is a **security prerequisite**: `eval()` in ODE/Integration backends must be replaced with `sympy.sympify()` + `sympy.lambdify()` before AI features are added. AI-generated equations + eval() = remote code execution via prompt injection.

The highest technical risk is PDF math rendering: WeasyPrint can render KaTeX's HTML/CSS output, but KaTeX fonts and CSS must be bundled locally in the template. This needs early prototyping. The highest deployment risk is WeasyPrint's system library dependencies on Railway/nixpacks.

## Key Findings

**Stack:** Add WeasyPrint + matplotlib to backend, DOMPurify to frontend. Dark theme via CSS custom properties (no component library). AI via existing ChatAgent (no new orchestrator).
**Architecture:** Dual-path reports (HTML->PDF via WeasyPrint, .tex source via Jinja2). Extract shared AIChatPanel from AutoLab chat for reuse on ODE/Integration pages. Theme via `[data-theme="dark"]` CSS variable overrides.
**Critical pitfall:** eval() + AI = RCE. Fix before building AI solvers. Also: 420 inline styles block dark theme until migrated.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Security + Foundation** - Remove eval(), fix debug=True, add DOMPurify
   - Addresses: eval() security (6 call sites), Flask debug mode, XSS prevention
   - Avoids: Building AI on insecure foundations (Pitfall #1)
   - Rationale: Hard dependency for AI phase; small scope, high impact

2. **Dark Theme** - Migrate inline styles, implement dark token system, theme Plotly charts
   - Addresses: 420 inline style migrations, CSS dark tokens, Plotly theming, FOUC prevention
   - Avoids: Partial dark mode where charts stay white (Pitfall #3)
   - Rationale: Highest visual impact; all subsequent features inherit polished look

3. **AutoLab Decomposition** - Extract sub-components from 1,141-line god component
   - Addresses: AutoLabResults, AutoLabPlots, AutoLabChat as separate components
   - Avoids: Simultaneous refactor + feature addition (Pitfall #11)
   - Rationale: Clean component boundaries needed for report data contract

4. **PDF + LaTeX Reports** - Report generation from analysis results
   - Addresses: WeasyPrint PDF with KaTeX math, Jinja2 LaTeX source, matplotlib static plots
   - Avoids: Math rendering failures (Pitfall #5) by prototyping early
   - Rationale: Table stakes gap -- biggest missing feature

5. **AI-Assisted ODE Solver** - AI equation setup, method advice, result interpretation
   - Addresses: Shared AIChatPanel, ChatAgent prompt enrichment, context summarization
   - Avoids: Token explosion (Pitfall #9) by summarizing results before sending to AI

6. **AI-Assisted Integration** - Copy ODE pattern to Integration page
   - Addresses: Same AI capabilities for numerical integration
   - Rationale: Near-identical to Phase 5; copy pattern, adjust system prompt

**Phase ordering rationale:**
- Security (eval removal) MUST precede AI phases -- hard dependency
- Dark theme is independent of everything else but should go early so all new UI is dark-first
- AutoLab decomposition MUST precede report generation -- reports need clean data contracts from decomposed components
- ODE AI before Integration AI -- ODE is more complex; Integration is a simpler copy
- Reports could theoretically run in parallel with AI work (different files, different endpoints)

**Research flags for phases:**
- Phase 4 (Reports): Needs prototyping -- KaTeX CSS in WeasyPrint and nixpacks deployment need validation
- Phase 5 (AI ODE): System prompt quality determines usefulness -- may need iteration
- Phases 1, 2, 3, 6: Standard patterns, unlikely to need additional research

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Recommendations sound; WeasyPrint version and nixpacks config unverified |
| Features | HIGH | Feature landscape well-understood from project requirements and competitive analysis |
| Architecture | HIGH | All patterns are extensions of existing codebase patterns |
| Pitfalls | HIGH | Based on direct codebase analysis (inline style counts, eval sites, etc.) |

## Gaps to Address

- WeasyPrint exact version and nixpacks package names need live verification before Phase 4
- KaTeX CSS rendering in WeasyPrint needs a prototype test (does it actually work?)
- matplotlib version compatibility with current Python/numpy should be checked
- OpenAI API may have changed since training cutoff -- verify function-calling docs before Phase 5
- Any new AI-native lab analysis competitors launched in late 2025/early 2026 may be missed
