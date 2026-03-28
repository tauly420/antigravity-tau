"""System prompt builder for AI report generation.

Constructs a detailed system prompt that instructs the LLM to generate
structured physics lab report sections as a JSON object.
"""

INSTRUCTION_TRUNCATE_LIMIT = 3000


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
                rounded = p.get("rounded", f"{value} +/- {uncertainty}")
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
        "",
        f"OUTPUT LANGUAGE: Write all prose in {lang_name}.",
        "LaTeX equations must always be in English/Latin notation using KaTeX-compatible syntax.",
        "Use $...$ for inline math and $$...$$ for display math.",
        "KaTeX rules: Use aligned/gathered/cases environments only. Do NOT use align, equation, or split environments. Use \\cdot not \\times. Use \\text{} for text in math mode.",
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
    lines.append("Generate 4 sections for a physics lab report:")
    lines.append("1. theory - Theoretical background: relevant physics laws, key formulas in LaTeX. Level: explain laws without full derivations unless user requested them in notes.")
    lines.append("2. method - Measurement method: describe equipment and procedure based on instructions and context.")
    lines.append("3. discussion - Discussion: interpret the ACTUAL results above, compare measured vs theoretical values, analyze sources of error, reference the chi-squared and n-sigma values.")
    lines.append("4. conclusions - Conclusions: summarize main findings, state measured values with uncertainties.")
    lines.append("")
    lines.append('Respond with a JSON object with this exact structure:')
    lines.append('{"theory": "...", "method": "...", "discussion": "...", "conclusions": "...", "warnings": ["..."]}')

    return "\n".join(lines)
