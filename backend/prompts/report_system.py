"""System prompt builder for AI report generation.

Constructs a detailed system prompt that instructs the LLM to generate
structured physics lab report sections as a JSON object.
"""

INSTRUCTION_TRUNCATE_LIMIT = 3000


def build_results_table_html(analysis_data: dict) -> str:
    """Build an HTML parameter table from analysis_data for the results section.

    Returns empty string if no fit parameters are available.
    """
    if not analysis_data:
        return ""

    fit = analysis_data.get("fit")
    if not fit or not isinstance(fit, dict):
        return ""

    params = fit.get("parameters", [])
    if not params:
        return ""

    rows_html = []
    for p in params:
        name = p.get("name", "?")
        value = p.get("value", "?")
        uncertainty = p.get("uncertainty", "?")
        rounded = p.get("rounded", f"{value} \u00b1 {uncertainty}")
        full = f"{value} \u00b1 {uncertainty}"
        rows_html.append(
            f'<tr><td style="border: 1px solid #ccc; padding: 6px 12px; text-align: left;">{name}</td>'
            f'<td style="border: 1px solid #ccc; padding: 6px 12px; text-align: left;">{rounded}</td>'
            f'<td style="border: 1px solid #ccc; padding: 6px 12px; text-align: left;">{full}</td></tr>'
        )

    # Goodness of fit rows
    gof = fit.get("goodnessOfFit", {}) or {}
    chi2r = gof.get("chiSquaredReduced") or fit.get("reduced_chi_squared")
    if chi2r is not None:
        rows_html.append(
            f'<tr><td style="border: 1px solid #ccc; padding: 6px 12px; text-align: left;">chi^2/dof</td>'
            f'<td style="border: 1px solid #ccc; padding: 6px 12px; text-align: left;">{float(chi2r):.3g}</td>'
            f'<td style="border: 1px solid #ccc; padding: 6px 12px; text-align: left;">{float(chi2r)}</td></tr>'
        )
    pval = gof.get("pValue") or fit.get("p_value")
    if pval is not None:
        pval_rounded = "< 0.001" if float(pval) < 0.001 else f"{float(pval):.3f}"
        rows_html.append(
            f'<tr><td style="border: 1px solid #ccc; padding: 6px 12px; text-align: left;">P-value</td>'
            f'<td style="border: 1px solid #ccc; padding: 6px 12px; text-align: left;">{pval_rounded}</td>'
            f'<td style="border: 1px solid #ccc; padding: 6px 12px; text-align: left;">{float(pval)}</td></tr>'
        )

    th_style = 'border: 1px solid #ccc; padding: 6px 12px; text-align: left; background: #e8f0fe; font-weight: bold;'
    html = (
        '<table style="border-collapse: collapse; width: 100%; margin-bottom: 1em;">'
        f'<thead><tr><th style="{th_style}">Quantity</th>'
        f'<th style="{th_style}">Rounded (val \u00b1 \u03c3)</th>'
        f'<th style="{th_style}">Full Precision (val \u00b1 \u03c3)</th></tr></thead>'
        '<tbody>' + ''.join(rows_html) + '</tbody></table>'
    )
    return html


def _inject_analysis_context(lines: list, analysis_data: dict) -> None:
    """Append analysis results to prompt lines from ReportAnalysisData shape.

    Reads camelCase keys matching the TypeScript interface:
    fit.modelName, fit.parameters[].name/value/uncertainty/rounded,
    fit.goodnessOfFit.chiSquaredReduced/rSquared/pValue,
    formula.expression/value/uncertainty/formatted,
    nsigma.nSigma/verdict/theoreticalValue/theoreticalUncertainty.
    """
    fit = analysis_data.get("fit")
    if fit:
        model_name = fit.get("modelName", "unknown")
        lines.append(f"Fit model: {model_name}")

        params = fit.get("parameters", [])
        if params:
            lines.append("")
            lines.append("ACTUAL MEASURED PARAMETERS (use these exact values, do not make up values):")
            for p in params:
                name = p.get("name", "?")
                value = p.get("value", "?")
                uncertainty = p.get("uncertainty", "?")
                rounded = p.get("rounded", f"{value} \u00b1 {uncertainty}")
                lines.append(f"  {name} = {value} +/- {uncertainty}  (rounded: {rounded})")

        gof = fit.get("goodnessOfFit", {})
        if gof:
            lines.append("")
            lines.append("Goodness of fit:")
            chi2 = gof.get("chiSquaredReduced")
            if chi2 is not None:
                lines.append(f"  Chi-squared reduced: {chi2}")
            r2 = gof.get("rSquared")
            if r2 is not None:
                lines.append(f"  R-squared: {r2}")
            pval = gof.get("pValue")
            if pval is not None:
                lines.append(f"  P-value: {pval}")
            dof = gof.get("dof")
            if dof is not None:
                lines.append(f"  Degrees of freedom: {dof}")

    formula = analysis_data.get("formula")
    if formula:
        lines.append("")
        lines.append("Formula evaluation:")
        lines.append(f"  Expression: {formula.get('expression', '?')}")
        lines.append(f"  Value: {formula.get('value', '?')} +/- {formula.get('uncertainty', '?')}")
        formatted = formula.get("formatted")
        if formatted:
            lines.append(f"  Formatted: {formatted}")

    nsigma = analysis_data.get("nsigma")
    if nsigma:
        lines.append("")
        lines.append("N-sigma comparison:")
        lines.append(f"  N-sigma: {nsigma.get('nSigma', '?')}")
        lines.append(f"  Verdict: {nsigma.get('verdict', '?')}")
        lines.append(f"  Theoretical value: {nsigma.get('theoreticalValue', '?')} +/- {nsigma.get('theoreticalUncertainty', '?')}")

    summary = analysis_data.get("summary")
    if summary:
        lines.append("")
        lines.append(f"AutoLab summary: {summary}")


def build_report_system_prompt(
    context_form: dict,
    instruction_text: str,
    analysis_data: dict,
    answers: list,
    language: str = "he",
) -> str:
    """Build the system prompt for report section generation.

    Args:
        context_form: Dict with keys title, subject, equipment, notes.
        instruction_text: Extracted text from uploaded lab instructions file.
        analysis_data: ReportAnalysisData dict (camelCase keys).
        answers: List of {id, answer} dicts from follow-up questions.
        language: "he" for Hebrew (default) or "en" for English.

    Returns:
        Complete system prompt string for OpenAI chat completion.
    """
    lang_name = "Hebrew" if language == "he" else "English"

    lines = [
        "You are a physics lab report writer for university students at the introductory level (University Physics 1/2).",
        "Write like a careful physics TA: thorough, quantitative, and never hand-wavy.",
        "",
        f"OUTPUT LANGUAGE: Write all prose in {lang_name}.",
        "LaTeX equations must always be in English/Latin notation using KaTeX-compatible syntax.",
        "Use $...$ for inline math and $$...$$ for display math.",
        "KaTeX rules: Use aligned/gathered/cases environments only. Do NOT use align, equation, or split environments. Use \\cdot not \\times. Use \\text{} for text in math mode.",
        "",
        "=== LENGTH AND DEPTH REQUIREMENTS ===",
        "Each prose section MUST be substantive. Word counts (prose only, excluding equations and tables):",
        "  - theory:       400-700 words. Multiple paragraphs. Derive or motivate the relevant equations.",
        "  - method:       250-450 words. Walk through the procedure step by step.",
        "  - results:      150-300 words narrative around the equations and the parameter table.",
        "  - discussion:   500-900 words. THIS IS THE LONGEST SECTION. Multiple paragraphs covering: physical interpretation of every fitted parameter, comparison to expected physics, dominant systematic and statistical errors with rough magnitudes, what chi^2/dof and the n-sigma verdict mean for THIS experiment, limitations, and what would be improved next time.",
        "  - conclusions:  200-350 words. Restate the main quantitative findings with uncertainties and the physical claim they support.",
        "Short, generic sections are NOT acceptable. If you find yourself writing two-sentence paragraphs, expand them.",
        "",
        "=== CRITICAL: DATA INTEGRITY RULES ===",
        "1. NEVER fabricate, invent, or assume numerical results. Only reference values explicitly provided in the ANALYSIS RESULTS section below.",
        "2. If no analysis data is provided, the discussion and conclusions sections MUST state that no experimental data was available and cannot discuss specific results.",
        "3. Your physics knowledge should ONLY be used for: theoretical background, explaining physical laws, interpreting provided results, and identifying potential error sources.",
        "4. Do NOT invent example measurements, parameter values, chi-squared values, or n-sigma comparisons. If a value is not in the data below, do not mention it as if it were measured.",
        "5. For the 'theory' section: use your physics knowledge freely to explain relevant laws and derive formulas.",
        "6. For the 'method' section: describe procedure based ONLY on the provided instructions and equipment context. Do not invent steps.",
        "7. For the 'discussion' section: ONLY discuss results that appear in ANALYSIS RESULTS below. If no results exist, say so explicitly.",
        "8. For the 'conclusions' section: summarize ONLY what was actually measured/found. Do not fabricate findings.",
        "",
        "=== USE THE USER'S ANALYSIS NUMBERS EXPLICITLY ===",
        "When ANALYSIS RESULTS are provided you MUST:",
        " - In 'discussion' AND 'conclusions', cite the actual fitted parameter values with uncertainties at least once each (use rounded form, in inline math, e.g. $k = 50.3 \\pm 1.2\\,\\mathrm{N/m}$).",
        " - Translate every fit parameter into its PHYSICAL meaning for THIS experiment. Examples: a slope of an F vs x fit is the spring constant k; 2a in y = ax^2+bx+c for free fall is the gravitational acceleration g; omega in A sin(omega t + phi) is the angular frequency, T = 2 pi / omega is the period; sigma in a Gaussian is the standard deviation of the distribution.",
        " - If goodness-of-fit numbers exist, comment on them quantitatively: chi^2/dof near 1 means the fit is consistent with the assumed errors; >> 1 means errors are underestimated or the model is wrong; << 1 means errors are overestimated. Compute and reference the actual value the user obtained, do not speak in generalities.",
        " - If an n-sigma comparison exists, state the n-sigma value and interpret it: <= 2 sigma is statistical agreement, 2-3 sigma is mild tension, > 3 sigma is significant disagreement. Connect the verdict to the physics (e.g., 'our measured g is consistent with 9.81 m/s^2 within 1.4 sigma, supporting the free-fall model under gravity').",
        " - If a formula evaluation exists (e.g. T = 2 pi / omega), reproduce the symbolic formula AND the numerical result with uncertainty in the relevant section, and explain how it was derived from the fit.",
        " - Discuss likely error sources tied to the equipment in the context form. Do not list generic errors like 'human error' without saying which step they affect.",
        "",
    ]

    # --- Experiment context ---
    lines.append("=== EXPERIMENT CONTEXT ===")
    if context_form:
        title = context_form.get("title")
        if title:
            lines.append(f"Title: {title}")
        subject = context_form.get("subject")
        if subject:
            lines.append(f"Subject: {subject}")
        equipment = context_form.get("equipment")
        if equipment:
            lines.append(f"Equipment: {equipment}")
        notes = context_form.get("notes")
        if notes:
            lines.append(f"Notes: {notes}")
    else:
        lines.append("No experiment context provided.")
    lines.append("")

    # --- Lab instructions ---
    lines.append("=== LAB INSTRUCTIONS ===")
    if instruction_text and instruction_text.strip():
        if len(instruction_text) > INSTRUCTION_TRUNCATE_LIMIT:
            truncated = instruction_text[:INSTRUCTION_TRUNCATE_LIMIT]
            lines.append(truncated)
            lines.append("(truncated)")
        else:
            lines.append(instruction_text)
    else:
        lines.append("No lab instructions uploaded.")
    lines.append("")

    # --- Analysis results ---
    lines.append("=== ANALYSIS RESULTS ===")
    if analysis_data and (analysis_data.get("fit") or analysis_data.get("formula") or analysis_data.get("nsigma")):
        _inject_analysis_context(lines, analysis_data)
    else:
        lines.append("No analysis data available. The user has not yet run an analysis.")
        lines.append("DO NOT invent any numerical results. The discussion must state that no data analysis was performed yet.")
        lines.append("The conclusions must note that experimental results are pending.")
    lines.append("")

    # --- Follow-up answers ---
    lines.append("=== FOLLOW-UP ANSWERS ===")
    if answers:
        for a in answers:
            q_id = a.get("id", "?")
            answer = a.get("answer", "")
            lines.append(f"  {q_id}: {answer}")
    else:
        lines.append("No follow-up answers provided.")
        lines.append("If any context is missing, state your assumptions explicitly in the text and add a warning to the warnings array.")
    lines.append("")

    # --- Sections to generate ---
    lines.append("=== SECTIONS TO GENERATE ===")
    lines.append("Generate 5 sections for a physics lab report. Each section is multi-paragraph prose unless explicitly told otherwise.")
    lines.append("")
    lines.append("1. theory (400-700 words):")
    lines.append("   - State the physical principles relevant to THIS experiment (not generic physics).")
    lines.append("   - Give the governing equation(s) in display math, define every symbol immediately after.")
    lines.append("   - Show, at minimum, the algebra that connects the fit parameters to the physical quantities of interest (e.g. 'the slope of F vs x is the spring constant k', 'for y = a t^2 + b t + c with constant acceleration, g = 2a').")
    lines.append("   - End with a short paragraph stating the prediction the experiment is testing (the theoretical/expected value), so discussion can refer back to it.")
    lines.append("")
    lines.append("2. method (250-450 words):")
    lines.append("   - Describe the apparatus from the equipment field and instructions.")
    lines.append("   - Walk through the measurement procedure step by step in past tense.")
    lines.append("   - Mention what was varied (independent variable), what was measured (dependent variable), and which uncertainty estimates were used.")
    lines.append("")
    lines.append('3. results (150-300 words narrative; the parameter table is rendered separately and must NOT be reproduced in the text):')
    lines.append('   - Open with a one-sentence summary of what the fit produced.')
    lines.append('   - If formula data exists, present the symbolic formula in display math on its own line, then the evaluated numerical result with uncertainty (e.g. "We computed the period as $$T = \\\\frac{2\\\\pi}{\\\\omega}$$ giving $T = 2.51 \\\\pm 0.03\\\\,\\\\mathrm{s}$.").')
    lines.append('   - If n-sigma data exists, state the n-sigma value and verdict in one sentence.')
    lines.append('   - Do NOT restate every fit parameter or chi-squared - the rendered results table covers that. Reference them inline only when needed for context.')
    lines.append("")
    lines.append("4. discussion (500-900 words, MULTIPLE PARAGRAPHS - this is the heart of the report):")
    lines.append("   Paragraph 1 - Physical interpretation: For EACH fit parameter, state what it means physically in this experiment, with the actual measured value and uncertainty. Connect the fit model back to the physics derived in the theory section.")
    lines.append("   Paragraph 2 - Comparison to theory: Quote the n-sigma value and theoretical value if present. Say explicitly whether the measurement agrees with theory, and at what confidence. If no theoretical value was provided, compare to the expected order of magnitude or known textbook value where reasonable.")
    lines.append("   Paragraph 3 - Goodness of fit: Discuss chi^2/dof and p-value if present. If chi^2/dof >> 1, propose what that suggests (underestimated errors? wrong model? unaccounted systematics?). If chi^2/dof << 1, suggest overestimated errors. R-squared alone is not enough - chi^2/dof is the physically meaningful number when uncertainties are present.")
    lines.append("   Paragraph 4 - Error analysis: List dominant error sources tied to the equipment from the context form, not generic boilerplate. Distinguish statistical vs systematic. Estimate or comment on which dominates.")
    lines.append("   Paragraph 5 - Limitations and improvements: What would you do differently? More data points? Better instrument? Different range?")
    lines.append("")
    lines.append("5. conclusions (200-350 words):")
    lines.append("   - Restate the experimental goal in one sentence.")
    lines.append("   - State the main quantitative finding(s) with units and uncertainties (cite the actual numbers).")
    lines.append("   - State whether the measurement supports or contradicts the theoretical prediction, citing the n-sigma verdict if available.")
    lines.append("   - Close with one sentence of physical takeaway (e.g., 'this confirms that the spring obeys Hooke's law in the tested range').")
    lines.append("")
    lines.append('Respond with a JSON object with this exact structure:')
    lines.append('{"theory": "...", "method": "...", "results": "...", "discussion": "...", "conclusions": "...", "warnings": ["..."]}')
    lines.append('All five string fields are required. The warnings array can be empty.')

    return "\n".join(lines)
