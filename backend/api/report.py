"""
Report blueprint - PDF generation and AI content generation endpoints.

Provides:
- /test-pdf: Infrastructure validation endpoint (Phase 8)
- /analyze-context: AI follow-up question generation (Phase 10)
- /generate: AI report section generation (Phase 10)
"""

import json
import os
import traceback

from flask import Blueprint, Response, jsonify, request
from openai import OpenAI

from prompts.report_system import build_report_system_prompt
from prompts.report_followup import build_followup_system_prompt

report_bp = Blueprint('report', __name__)


@report_bp.route('/test-pdf', methods=['GET'])
def test_pdf():
    """Infrastructure spike: generate test PDF with Hebrew + math.
    Per D-02: kept as permanent debug endpoint."""
    try:
        from utils.pdf_renderer import generate_test_pdf
        pdf_bytes = generate_test_pdf()
        return Response(
            pdf_bytes,
            mimetype='application/pdf',
            headers={
                'Content-Disposition': 'inline; filename="test-report.pdf"',
                'Content-Type': 'application/pdf'
            }
        )
    except Exception as e:
        return {"error": str(e), "traceback": traceback.format_exc()}, 500


def _get_openai_client():
    """Create OpenAI client from environment. Returns (client, model_name) or raises."""
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("OPENAI_API_KEY not configured")
    client = OpenAI(api_key=api_key)
    model_name = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    return client, model_name


@report_bp.route('/analyze-context', methods=['POST'])
def analyze_context():
    """Analyze available context and return follow-up questions.

    Accepts JSON with: context_form, instruction_text, analysis_data.
    Returns: {questions: [...], can_generate_without: bool, error: null}
    """
    try:
        body = request.get_json(silent=True)
        if not body:
            return jsonify({"error": "Request body is required"}), 400

        context_form = body.get("context_form", {})
        instruction_text = body.get("instruction_text", "")
        analysis_data = body.get("analysis_data", {})

        client, model_name = _get_openai_client()

        system_prompt = build_followup_system_prompt(
            context_form=context_form,
            instruction_text=instruction_text,
            analysis_data=analysis_data,
        )

        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "Analyze the available context and return follow-up questions."},
            ],
            response_format={"type": "json_object"},
        )

        result = json.loads(response.choices[0].message.content)

        return jsonify({
            "questions": result.get("questions", []),
            "can_generate_without": result.get("can_generate_without", True),
            "error": None,
        })

    except ValueError as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@report_bp.route('/generate', methods=['POST'])
def generate():
    """Generate AI report sections from context and analysis data.

    Accepts JSON with: context_form, instruction_text, analysis_data,
    answers, language (default "he").
    Returns: {sections: {theory, method, discussion, conclusions, warnings}, error: null}
    """
    try:
        body = request.get_json(silent=True)
        if not body:
            return jsonify({"error": "Request body is required"}), 400

        context_form = body.get("context_form", {})
        instruction_text = body.get("instruction_text", "")
        analysis_data = body.get("analysis_data", {})
        answers = body.get("answers", [])
        language = body.get("language", "he")

        client, model_name = _get_openai_client()

        system_prompt = build_report_system_prompt(
            context_form=context_form,
            instruction_text=instruction_text,
            analysis_data=analysis_data,
            answers=answers,
            language=language,
        )

        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "Generate the lab report sections based on the provided context and analysis results."},
            ],
            response_format={"type": "json_object"},
        )

        sections = json.loads(response.choices[0].message.content)

        # Validate required keys
        required_keys = {"theory", "method", "discussion", "conclusions"}
        missing = required_keys - set(sections.keys())
        if missing:
            return jsonify({
                "error": f"AI returned incomplete response. Missing sections: {', '.join(sorted(missing))}"
            }), 500

        return jsonify({
            "sections": {
                "theory": sections["theory"],
                "method": sections["method"],
                "discussion": sections["discussion"],
                "conclusions": sections["conclusions"],
                "warnings": sections.get("warnings", []),
            },
            "error": None,
        })

    except ValueError as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500
