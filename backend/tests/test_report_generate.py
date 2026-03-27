"""Tests for report generation prompt builders and endpoints.

TDD RED phase: tests written before implementation.
"""

import os
import sys
import pytest

# Ensure backend is on sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from prompts.report_system import build_report_system_prompt
from prompts.report_followup import build_followup_system_prompt


# ---------------------------------------------------------------------------
# Shared fixture data
# ---------------------------------------------------------------------------

SAMPLE_ANALYSIS_DATA = {
    "fit": {
        "modelName": "linear",
        "parameters": [
            {"name": "k", "value": 49.8, "uncertainty": 0.5, "rounded": "49.8 +/- 0.5", "latex": "k"},
            {"name": "b", "value": 0.12, "uncertainty": 0.03, "rounded": "0.12 +/- 0.03", "latex": "b"},
        ],
        "goodnessOfFit": {"chiSquaredReduced": 1.2, "rSquared": 0.998, "pValue": 0.31, "dof": 8},
    },
    "formula": {
        "expression": "k",
        "value": 49.8,
        "uncertainty": 0.5,
        "formatted": "49.8 +/- 0.5",
        "latex": "k",
    },
    "nsigma": {
        "nSigma": 0.4,
        "verdict": "Agreement within 1 sigma",
        "theoreticalValue": 50.0,
        "theoreticalUncertainty": 2.0,
    },
    "summary": "Linear fit to force vs displacement data.",
    "instructions": "Measure spring constant",
    "filename": "hookes_law.xlsx",
}

SAMPLE_CONTEXT_FORM = {
    "title": "Hooke's Law Experiment",
    "subject": "Mechanics",
    "equipment": "Spring, masses, ruler",
    "notes": "Used 5 different masses",
}


# ---------------------------------------------------------------------------
# Tests for build_report_system_prompt
# ---------------------------------------------------------------------------


class TestBuildReportSystemPrompt:
    """Tests for the report system prompt builder."""

    def test_system_prompt_contains_json(self):
        result = build_report_system_prompt(
            context_form=SAMPLE_CONTEXT_FORM,
            instruction_text="Measure spring constant",
            analysis_data=SAMPLE_ANALYSIS_DATA,
            answers=[],
            language="he",
        )
        assert "JSON" in result

    def test_system_prompt_hebrew_directive(self):
        result = build_report_system_prompt(
            context_form=SAMPLE_CONTEXT_FORM,
            instruction_text="",
            analysis_data=SAMPLE_ANALYSIS_DATA,
            answers=[],
            language="he",
        )
        assert "Write all prose in Hebrew" in result

    def test_system_prompt_english_directive(self):
        result = build_report_system_prompt(
            context_form=SAMPLE_CONTEXT_FORM,
            instruction_text="",
            analysis_data=SAMPLE_ANALYSIS_DATA,
            answers=[],
            language="en",
        )
        assert "Write all prose in English" in result

    def test_system_prompt_injects_parameters(self):
        result = build_report_system_prompt(
            context_form=SAMPLE_CONTEXT_FORM,
            instruction_text="",
            analysis_data=SAMPLE_ANALYSIS_DATA,
            answers=[],
            language="he",
        )
        assert "k = 49.8" in result

    def test_system_prompt_katex_instructions(self):
        result = build_report_system_prompt(
            context_form=SAMPLE_CONTEXT_FORM,
            instruction_text="",
            analysis_data=SAMPLE_ANALYSIS_DATA,
            answers=[],
            language="he",
        )
        assert "$...$" in result or "inline math" in result.lower()

    def test_system_prompt_includes_chi_squared(self):
        result = build_report_system_prompt(
            context_form=SAMPLE_CONTEXT_FORM,
            instruction_text="",
            analysis_data=SAMPLE_ANALYSIS_DATA,
            answers=[],
            language="he",
        )
        assert "1.2" in result  # chiSquaredReduced value

    def test_system_prompt_includes_nsigma(self):
        result = build_report_system_prompt(
            context_form=SAMPLE_CONTEXT_FORM,
            instruction_text="",
            analysis_data=SAMPLE_ANALYSIS_DATA,
            answers=[],
            language="he",
        )
        assert "0.4" in result  # nSigma value

    def test_system_prompt_truncates_long_instructions(self):
        long_text = "A" * 5000
        result = build_report_system_prompt(
            context_form=SAMPLE_CONTEXT_FORM,
            instruction_text=long_text,
            analysis_data=SAMPLE_ANALYSIS_DATA,
            answers=[],
            language="he",
        )
        assert "(truncated)" in result
        # Should not contain full 5000 chars of instructions
        assert len(long_text) > result.count("A")

    def test_system_prompt_includes_answers(self):
        answers = [{"id": "q1", "answer": "We used 50g increments"}]
        result = build_report_system_prompt(
            context_form=SAMPLE_CONTEXT_FORM,
            instruction_text="",
            analysis_data=SAMPLE_ANALYSIS_DATA,
            answers=answers,
            language="he",
        )
        assert "50g increments" in result

    def test_system_prompt_handles_missing_analysis_data(self):
        """Prompt builder should not crash with minimal/empty analysis data."""
        result = build_report_system_prompt(
            context_form={},
            instruction_text="",
            analysis_data={},
            answers=[],
            language="he",
        )
        assert "JSON" in result  # Still a valid prompt


# ---------------------------------------------------------------------------
# Tests for build_followup_system_prompt
# ---------------------------------------------------------------------------


class TestBuildFollowupSystemPrompt:
    """Tests for the follow-up question prompt builder."""

    def test_followup_prompt_contains_json(self):
        result = build_followup_system_prompt(
            context_form=SAMPLE_CONTEXT_FORM,
            instruction_text="Measure spring constant",
            analysis_data=SAMPLE_ANALYSIS_DATA,
        )
        assert "JSON" in result

    def test_followup_prompt_summarizes_context(self):
        result = build_followup_system_prompt(
            context_form=SAMPLE_CONTEXT_FORM,
            instruction_text="",
            analysis_data=SAMPLE_ANALYSIS_DATA,
        )
        assert "Hooke" in result

    def test_followup_prompt_includes_analysis_summary(self):
        result = build_followup_system_prompt(
            context_form=SAMPLE_CONTEXT_FORM,
            instruction_text="Some instructions here",
            analysis_data=SAMPLE_ANALYSIS_DATA,
        )
        assert "linear" in result.lower()
