# Feature Landscape

**Domain:** Physics / Engineering Lab Data Analysis & Automation
**Researched:** 2026-03-20
**Confidence:** MEDIUM-HIGH (based on codebase analysis + training data; web search unavailable)

## Competitive Landscape

Tau-LY competes in a space spanning from heavyweight desktop apps to lightweight web tools:

| Tier | Products | Strengths | Weaknesses |
|------|----------|-----------|------------|
| **Pro desktop** | OriginPro, Igor Pro, MATLAB | Deep analysis, publication-quality plots, scripting | Expensive ($500-5000/yr), steep learning curve, no AI |
| **Educational desktop** | Logger Pro (Vernier), PASCO Capstone, Tracker | Hardware integration, guided workflows | Tied to vendor hardware, limited analysis depth |
| **Open-source desktop** | SciDAVis, QtiPlot, gnuplot | Free, scriptable | Dated UX, no AI, poor onboarding |
| **Python ecosystem** | Jupyter + SciPy/matplotlib, Google Colab | Infinite flexibility, free | Requires coding, no guided workflow |
| **Web tools (emerging)** | Desmos (graphing only), various homework helpers | Accessible, no install | Shallow analysis, no file upload, no uncertainty propagation |

**Tau-LY's niche:** A zero-install web tool that combines the depth of OriginPro-style analysis with the accessibility of a guided UI and AI orchestration. No competitor currently offers AI-driven end-to-end lab analysis in the browser.

---

## Table Stakes

Features users expect from any serious physics analysis tool. Missing any of these makes Tau-LY feel incomplete.

| Feature | Why Expected | Complexity | Status | Notes |
|---------|--------------|------------|--------|-------|
| Curve fitting with uncertainty on parameters | Every lab report needs fit parameters with errors | Med | DONE | Via AutoLab and GraphFitting |
| Chi-squared / goodness-of-fit metrics | Standard in all physics fitting tools | Low | DONE | chi2/dof, P-value, R-squared shown |
| Uncertainty propagation | Core physics lab requirement | Med | DONE | Via FormulaCalculator and AutoLab |
| Multiple data file formats (CSV, Excel, TSV) | Users have data in various formats | Low | DONE | parse_file handles CSV/Excel |
| Interactive plots with zoom/pan | Every competitor has this | Low | DONE | Plotly.js |
| Residual plots | Standard diagnostic in every fitting tool | Low | DONE | Shown below fit plots |
| **Export results to PDF** | Lab reports must be submitted as documents | High | **MISSING** | **Critical gap -- every competitor has print/export** |
| **Export plots as images** (PNG/SVG) | Users paste plots into reports | Low | **MISSING** | Plotly has built-in toolbar but no one-click "export all" |
| **Dark mode** | Every modern dev/science tool has it. Reduces eye strain in lab. | Med | **MISSING** | Entire CSS system needs refactoring (420 inline styles) |
| Error bars on plots | Physics data without error bars is incomplete | Low | DONE | Plotly renders error bars |
| Custom fit functions | Beyond linear/quadratic -- users have arbitrary models | Med | DONE | Custom fit with user-defined expression |
| Monospaced numbers in data tables | Scientific data must align on decimal points | Low | MISSING | Add JetBrains Mono for numeric cells |

## Differentiators

Features that set Tau-LY apart. Not expected, but create competitive advantage.

| Feature | Value Proposition | Complexity | Status | Notes |
|---------|-------------------|------------|--------|-------|
| AI-driven end-to-end analysis (AutoLab) | No other tool does "upload + describe = full analysis" | Already built | DONE | Core differentiator. Unique in the market. |
| Natural language instructions | No coding, no menu-diving -- just say what you want | Already built | DONE | Via AutoLab |
| **LaTeX report generation** | Export as editable .tex source -- students paste into lab reports | High | PLANNED | Huge differentiator; no web competitor does this |
| AI post-analysis chat | "Why is my chi-squared so high?" answered in context | Already built | DONE | Unique feature |
| **AI-assisted ODE/Integration setup** | "I have a spring-mass system" -> equation + method + solution | Med | PLANNED | No competitor offers AI guidance on numerical methods |
| **Dark science theme** (instrument dashboard aesthetic) | Modern, professional feel -- signals "serious tool" | Med | PLANNED | Most competitors look dated |
| One-click example datasets | Zero-friction onboarding -- user sees value in 5 seconds | Low | DONE | 3 examples exist |
| N-sigma comparison to theory | Automated "does my result agree with theory?" | Low | DONE | Color-coded, unique in web tools |
| **One-click full report from AutoLab** | After analysis, single button generates complete report | Med | PLANNED | Combines all result data into report template |

## Anti-Features

Features to explicitly NOT build. These would dilute focus or move away from core value.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| User accounts / login | Adds complexity, privacy concerns. Stateless is a feature. | Keep ephemeral. |
| Real-time collaboration | Massive effort with no clear user need | Single-user with export/share |
| Component library adoption for theming | Rewriting 15+ components for Mantine/MUI just for dark mode | Use CSS custom properties |
| Full LaTeX compilation on server | TeX Live = 4GB+. Cannot deploy on Railway. | Generate .tex source; users compile locally |
| Client-side PDF generation | jsPDF/html2canvas cannot render LaTeX math. Blurry, large files. | Server-side WeasyPrint |
| AI on every tool page simultaneously | Spreading AI thin leads to poor prompts | AI on ODE + Integration first, expand later |
| Custom theme builder / color picker | Niche, nobody asked for it | Ship one well-designed dark theme |
| Hardware integration (DAQ, sensors) | Requires drivers, vendor partnerships | Accept file uploads from any source |
| Mobile-first design | Physics analysis on a phone is impractical | Responsive down to tablet; desktop-first |

## Feature Dependencies

```
Inline style migration  ->  Dark theme tokens
Dark theme tokens       ->  Theme-aware Plotly charts
Dark theme tokens       ->  All new UI inherits theming

eval() removal          ->  AI equation setup (SECURITY PREREQUISITE)

matplotlib setup        ->  PDF report with plots
matplotlib setup        ->  LaTeX export with figures
Jinja2 templates        ->  PDF report generation
Jinja2 templates        ->  LaTeX source export
WeasyPrint + KaTeX CSS  ->  PDF with rendered math
AutoLab decomposition   ->  Clean report data contract

AutoLab chat pattern    ->  Shared AIChatPanel component
AIChatPanel             ->  ODE AI assistant
AIChatPanel             ->  Integration AI assistant
```

**Critical path:** eval() removal -> AI solvers. Inline style migration -> dark theme. AutoLab decomposition -> reports.

## MVP Recommendation for This Milestone

**Prioritize (in order):**

1. **Dark science theme** -- Highest visual impact. Transforms perceived quality of the entire app. Do first so all subsequent features inherit the polished look. Requires inline style migration as prerequisite work.

2. **PDF report export from AutoLab** -- Table stakes gap. Without it, users screenshot results and paste into Word. This is the single biggest gap making Tau-LY feel like a toy.

3. **LaTeX source export** -- Strong differentiator built on same infrastructure as PDF. Physics students submit LaTeX reports -- going from "upload data" to "download .tex" is unique.

4. **AI-assisted ODE solver** -- Extends core AI differentiator. Medium complexity since ChatAgent already exists.

5. **AI-assisted Integration** -- Copy ODE pattern. Almost identical work.

**Defer:**

- Batch analysis: High complexity, lower immediate demand
- Shareable links: Requires URL state serialization design
- Model comparison (AIC/BIC): Valuable but niche
- Result history browser: Context already stores history; add UI later
- Drag-and-drop upload: Low impact, sprinkle in during polish

## Sources

- Competitive landscape from training data (OriginPro 2024, MATLAB R2024b, Vernier Logger Pro 3, etc.)
- Project context from .planning/PROJECT.md and .planning/codebase/
- Confidence: MEDIUM-HIGH -- competitive landscape is stable, but any new AI-native lab tools launched in late 2025/early 2026 may be missed
