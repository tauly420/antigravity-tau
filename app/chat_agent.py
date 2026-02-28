# file: app/chat_agent.py
from __future__ import annotations

import os
import time
import json
from typing import List, Dict, Optional, Any

# ============================================================
# PROVIDER SELECTION
# ============================================================
# Set CHAT_PROVIDER env var to "openai" or "gemini" (default: gemini)
# Gemini: set GEMINI_API_KEY
# OpenAI: set OPENAI_API_KEY
_PROVIDER = os.getenv("CHAT_PROVIDER", "gemini").lower()

# --- Gemini SDK ---
if _PROVIDER == "gemini":
    from google import genai

# --- OpenAI SDK (kept for easy switching) ---
# if _PROVIDER == "openai":
#     import openai
#     from openai import OpenAI


_DEFAULT_PROMPT = """\
You are Tau-LY's Lab Assistant inside a web application for physics and engineering lab work.

Goals and behavior:
- Be concise, actionable, and technically correct.
- When the user pastes data or equations, help validate and transform them.
- When asked to compute, show the essential steps and the final result.
- If you're unsure, ask the *smallest* clarifying question.
- Avoid server-side file paths and secrets; never invent results.

============================================================
FORMATTING RULES
============================================================
- Use short paragraphs and bullet lists when helpful.
- Keep code blocks minimal and runnable.
- For math and formulas, use LaTeX notation with dollar signs:
  Inline math: $\\chi^2$, $\\sigma$, $T = 2\\pi\\sqrt{\\frac{l}{g}}$
  Display math: $$F = G\\frac{m_1 m_2}{r^2}$$
- The chat UI renders LaTeX, so ALWAYS use LaTeX for equations.

============================================================
N-SIGMA INTERPRETATION
============================================================
When discussing N-sigma results:
- N-sigma <= 1: excellent agreement
- N-sigma <= 2: good agreement
- N-sigma <= 3: acceptable agreement (within 3 sigma)
- N-sigma > 3: possible disagreement, needs investigation
A result of 3 sigma or under generally indicates the measurements are consistent.

============================================================
FORMULA DISPLAY RULES
============================================================
When showing formulas and equations:
1. ALWAYS show them in LaTeX format for proper rendering in the chat.
2. If the user is on the Workflow or Formula Calculator page (check the context),
   ALSO provide a copy-pasteable version in Python/SymPy calculator syntax
   in a code block, so they can paste it directly into the calculator.

Example response when user is on Workflow/Formula Calculator page:
  "The pendulum period formula is:
   $$T = 2\\pi\\sqrt{\\frac{l}{g}}$$
   For the calculator, use:
   ```
   2*pi*sqrt(l/g)
   ```"

If the user is NOT on Workflow/Formula Calculator, just show the LaTeX.

============================================================
CALCULATOR SYNTAX (Python/SymPy)
============================================================
When providing calculator-ready expressions:
  - Multiplication: use *       (NOT implied)
  - Exponents/powers: use **   (NOT ^)
  - Square root: sqrt(x) or x**(1/2)
  - Constants:
      pi   = π ≈ 3.14159  (lowercase)
      E    = Euler's number e ≈ 2.71828  (UPPERCASE E only!)
      NOTE: lowercase 'e' is treated as a regular variable, NOT Euler's number
  - Trig: sin(x), cos(x), tan(x), asin(x), acos(x), atan(x)
  - Exponential: exp(x)   (this uses Euler's number automatically)
  - Logarithms: log(x) = natural log, log(x, 10) = base-10
  - Absolute value: Abs(x)
  - Parentheses: always explicit

============================================================
TOOL-SPECIFIC KNOWLEDGE
============================================================
1. Workflow: Upload data, select X/Y columns + errors, fit curve, propagate uncertainty, compare results
2. Graph Fitting: Upload .xlsx/.csv/.ods/.tsv/.dat, fit with various models or custom expressions
   - Results include: chi-squared, chi-squared reduced (chi-squared/dof), P-value, degrees of freedom
   - Custom fit: use x as variable, parameters auto-detected (e.g. a*sin(b*x+c)+d)
3. Formula Calculator: Enter Python/SymPy expression, auto-detects variables, propagates error
4. Matrix Calculator: Eigenvalues, eigenvectors, determinant, inverse, LU, solve Ax=b
5. ODE Solver: Systems of first-order ODEs
6. Numerical Integrator: 1D-6D definite integrals
7. N-Sigma Calculator: Compare two measurements - result <= 3 sigma means agreement
8. Unit Converter: 15+ categories including CGS units
9. Fourier Analysis: DFT, PSD, dominant frequencies, inverse DFT with filtering

When context includes the user's current page, tailor your answers to that tool.
When context includes last_result, reference those specific values in your explanation.
"""


class ChatAgent:
    """
    AI chat wrapper supporting Gemini (default) and OpenAI.

    Set CHAT_PROVIDER=gemini or CHAT_PROVIDER=openai to switch.
    """

    def __init__(
        self,
        model: Optional[str] = None,
        timeout: float = 20.0,
        max_retries: int = 2,
        system_prompt: Optional[str] = None,
        system_prompt_path: Optional[str] = None,
    ):
        self.max_retries = max_retries
        self.system_prompt = self._resolve_system_prompt(system_prompt, system_prompt_path)
        self.provider = _PROVIDER

        if self.provider == "gemini":
            api_key = os.getenv("GEMINI_API_KEY", "")
            if not api_key:
                raise RuntimeError("GEMINI_API_KEY not set")
            self.client = genai.Client(api_key=api_key)
            self.model = model or os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
        else:
            # OpenAI fallback
            import openai as _openai
            from openai import OpenAI as _OpenAI
            self._openai_module = _openai
            self.client = _OpenAI(timeout=timeout, max_retries=max_retries)
            self.model = model or os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    # -------- public API --------

    def ask(
        self,
        messages: List[Dict[str, str]],
        *,
        extra_context: Optional[Dict[str, Any]] = None,
    ) -> str:
        if self.provider == "gemini":
            return self._ask_gemini(messages, extra_context)
        else:
            return self._ask_openai(messages, extra_context)

    def set_system_prompt(self, text: str) -> None:
        """Dynamically replace the system prompt."""
        self.system_prompt = (text or "").strip() or _DEFAULT_PROMPT

    # -------- Gemini implementation --------

    def _ask_gemini(
        self,
        messages: List[Dict[str, str]],
        extra_context: Optional[Dict[str, Any]],
    ) -> str:
        # Build the system instruction with optional context
        system_instruction = self.system_prompt
        if extra_context:
            try:
                ctx = json.dumps(extra_context, ensure_ascii=False, indent=2)
            except Exception:
                ctx = str(extra_context)
            system_instruction += f"\n\nContext for this request:\n{ctx}"

        # Convert OpenAI-style messages to Gemini format
        contents = []
        for m in messages or []:
            role = (m.get("role") or "").strip()
            content = (m.get("content") or "").strip()
            if not content:
                continue
            # Gemini uses "user" and "model" (not "assistant")
            if role == "assistant":
                role = "model"
            elif role == "system":
                # Fold system messages into the system instruction
                system_instruction += f"\n\n{content}"
                continue
            elif role != "user":
                continue
            contents.append({"role": role, "parts": [{"text": content}]})

        last_exc: Exception | None = None
        for attempt in range(max(1, self.max_retries + 1)):
            try:
                response = self.client.models.generate_content(
                    model=self.model,
                    contents=contents,
                    config={"system_instruction": system_instruction},
                )
                return (response.text or "").strip()
            except Exception as e:
                last_exc = e
                err_str = str(e).lower()
                # Retry on rate limits and server errors
                if "rate" in err_str or "429" in err_str or "500" in err_str or "503" in err_str:
                    time.sleep(1 * (2 ** attempt))
                else:
                    raise
        raise RuntimeError("The AI is busy or temporarily unavailable. Please try again.") from last_exc

    # -------- OpenAI implementation (kept for easy switching) --------

    def _ask_openai(
        self,
        messages: List[Dict[str, str]],
        extra_context: Optional[Dict[str, Any]],
    ) -> str:
        payload = self._with_system_prompt_openai(messages, extra_context)
        last_exc: Exception | None = None
        _openai = self._openai_module

        for attempt in range(max(1, self.max_retries + 1)):
            try:
                completion = self.client.chat.completions.create(
                    model=self.model,
                    messages=payload,
                )
                return (completion.choices[0].message.content or "").strip()
            except (_openai.RateLimitError, _openai.APIConnectionError, _openai.APITimeoutError) as e:
                last_exc = e
                time.sleep(1 * (2 ** attempt))
            except _openai.APIStatusError as e:
                if 500 <= getattr(e, "status_code", 0) < 600:
                    last_exc = e
                    time.sleep(1 * (2 ** attempt))
                else:
                    raise
        raise RuntimeError("The AI is busy or temporarily unavailable. Please try again.") from last_exc

    def _with_system_prompt_openai(
        self,
        user_messages: List[Dict[str, str]],
        extra_context: Optional[Dict[str, Any]],
    ) -> List[Dict[str, str]]:
        msgs: List[Dict[str, str]] = []
        for m in user_messages or []:
            role = (m.get("role") or "").strip()
            content = (m.get("content") or "").strip()
            if role in {"system", "user", "assistant"} and content:
                msgs.append({"role": role, "content": content})

        payload: List[Dict[str, str]] = [{"role": "system", "content": self.system_prompt}]
        if extra_context:
            try:
                ctx = json.dumps(extra_context, ensure_ascii=False, indent=2)
            except Exception:
                ctx = str(extra_context)
            payload.append({"role": "system", "content": f"Context for this request:\n{ctx}"})

        payload.extend(msgs)
        return payload

    # -------- shared internals --------

    def _resolve_system_prompt(
        self,
        system_prompt: Optional[str],
        system_prompt_path: Optional[str],
    ) -> str:
        if system_prompt and system_prompt.strip():
            return system_prompt.strip()
        env_prompt = os.getenv("SYSTEM_PROMPT", "").strip()
        if env_prompt:
            return env_prompt
        if system_prompt_path:
            text = self._load_file_safely(system_prompt_path)
            if text:
                return text
        for candidate in ("system_prompt.md", "app/system_prompt.md"):
            text = self._load_file_safely(candidate)
            if text:
                return text
        return _DEFAULT_PROMPT

    @staticmethod
    def _load_file_safely(path: str) -> str:
        try:
            with open(path, "r", encoding="utf-8") as f:
                return f.read().strip()
        except Exception:
            return ""
