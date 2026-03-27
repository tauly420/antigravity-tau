"""System prompt builder for follow-up question analysis.

Constructs a prompt that instructs the LLM to analyze available context
and identify 1-3 critical missing pieces of information before generating
a full report.
"""


def build_followup_system_prompt(
    context_form: dict,
    instruction_text: str,
    analysis_data: dict,
) -> str:
    """Build the system prompt for context analysis / follow-up questions.

    Args:
        context_form: Dict with keys title, subject, equipment, notes.
        instruction_text: Extracted text from uploaded lab instructions file.
        analysis_data: ReportAnalysisData dict (camelCase keys).

    Returns:
        Complete system prompt string for OpenAI chat completion.
    """
    lines = [
        "You analyze available context for a physics lab report and identify 1-3 critical missing pieces of information.",
        "",
        "Available context:",
    ]

    # Context form fields
    title = context_form.get("title", "") if context_form else ""
    subject = context_form.get("subject", "") if context_form else ""
    equipment = context_form.get("equipment", "") if context_form else ""
    notes = context_form.get("notes", "") if context_form else ""

    lines.append(f"- Title: {title or 'not provided'}")
    lines.append(f"- Subject: {subject or 'not provided'}")
    lines.append(f"- Equipment: {equipment or 'not provided'}")
    lines.append(f"- Notes: {notes or 'not provided'}")

    # Instruction text summary
    if instruction_text and instruction_text.strip():
        lines.append(f"- Instruction file: provided ({len(instruction_text)} chars)")
    else:
        lines.append("- Instruction file: not uploaded")

    # Analysis data summary
    if analysis_data:
        fit = analysis_data.get("fit")
        if fit:
            model_name = fit.get("modelName", "unknown")
            lines.append(f"- Analysis data: provided with {model_name} fit")
        else:
            lines.append("- Analysis data: provided (no fit data)")
    else:
        lines.append("- Analysis data: not available")

    lines.append("")
    lines.append("Return 0-3 follow-up questions. Return 0 questions if you have enough context to write a good report.")
    lines.append("")
    lines.append("Respond with a JSON object:")
    lines.append('{"questions": [{"id": "q1", "question": "...", "hint": "..."}], "can_generate_without": true|false}')

    return "\n".join(lines)
