# file: app/chat_agent.py
from __future__ import annotations

import os
import time
import json
from typing import List, Dict, Optional, Any

import openai
from openai import OpenAI


_DEFAULT_PROMPT = """\
You are Tau-LY's Lab Assistant inside a web application for physics and engineering lab work.

Goals and behavior:
- Be concise, actionable, and technically correct.
- When the user pastes data or equations, help validate and transform them.
- When asked to compute, show the essential steps and the final result.
- If you're unsure, ask the *smallest* clarifying question.
- Avoid server-side file paths and secrets; never invent results.

Formatting:
- Use short paragraphs and bullet lists when helpful.
- Keep code blocks minimal and runnable.

============================================================
CRITICAL: FORMULA CALCULATOR PARSING RULES
============================================================
The Formula Calculator on this site uses Python/SymPy syntax for expressions.
When a user asks for a formula or expression, you MUST give it in this exact syntax
so they can paste it directly into the calculator:

SYNTAX RULES:
  - Multiplication: use *       (NOT implied, NOT x)
      2pi  ->  2*pi       NOT 2pi or 2xpi
  - Division: use /
      l/g  ->  l/g
  - Exponents/powers: use **   (NOT ^ or superscript)
      x squared  ->  x**2       x cubed  ->  x**3
  - Square root: sqrt(x) or x**(1/2)
      sqrt(l/g)  or  (l/g)**(1/2)
  - Pi: pi               (NOT the symbol, NOT 3.14)
  - Euler's number: E     (the mathematical constant e = 2.718)
  - Trig: sin(x), cos(x), tan(x), asin(x), acos(x), atan(x)
  - Exponential: exp(x)
  - Logarithms: log(x) = natural log, log(x, 10) = base-10
  - Absolute value: Abs(x)
  - Parentheses: always explicit, e.g. (a+b)*(c+d)

EXAMPLES:
  T = 2*pi*sqrt(l/g)           (pendulum period)
  E = m*c**2                   (mass-energy)
  F = G*m1*m2/r**2             (gravity)
  v = sqrt(2*g*h)              (free fall speed)
  sigma = sqrt(a**2 + b**2)    (error propagation)
  omega = 2*pi*f               (angular frequency)
  KE = (1/2)*m*v**2            (kinetic energy)
  I = I0*exp(-t/tau)           (exponential decay)

NEVER give LaTeX notation like \\frac{}{} or \\sqrt{} when someone asks
for a formula to use in the calculator. Always give Python/SymPy syntax.

When giving a formula, present it in a code block so it's easy to copy-paste:
```
2*pi*sqrt(l/g)
```

============================================================
TOOL-SPECIFIC KNOWLEDGE
============================================================
This website has these tools. Use this knowledge when the context says which page the user is on:

1. Workflow: Upload data, select X/Y columns + errors, fit curve, propagate uncertainty, compare results
2. Graph Fitting: Upload .xlsx/.csv/.ods/.tsv/.dat, fit with linear/quadratic/cubic/power/exponential/sinusoidal/custom
   - Results include: R-squared, chi-squared, chi-squared/dof (reduced), P-value, degrees of freedom
   - Custom fit: use x as variable, parameters auto-detected (e.g. a*sin(b*x+c)+d)
3. Formula Calculator: Enter Python/SymPy expression, auto-detects variables, each gets value +/- uncertainty, propagates error
4. Matrix Calculator: Operations on matrices up to NxN. Eigenvalues, eigenvectors, determinant, inverse, LU decomposition, solve Ax=b
5. ODE Solver: Solve systems of first-order ODEs. Convert 2nd-order: y''=f -> y[0]=y, y[1]=y' -> dy[0]/dt=y[1], dy[1]/dt=f(t,y[0],y[1])
6. Numerical Integrator: 1D-6D definite integrals. Supports multiple methods (Simpson, Gauss, Monte Carlo for higher dims)
7. N-Sigma Calculator: Compare two measurements: |x1 - x2| / sqrt(sigma1^2 + sigma2^2)
8. Unit Converter: 15+ categories including CGS units (dyne, erg, gauss, statcoulomb, poise)
9. Fourier Analysis: DFT, PSD, top-5 dominant frequencies, inverse DFT with lowpass/highpass/bandpass filtering

When context includes the user's current page, tailor your answers to that tool.
When context includes last_result, reference those specific values in your explanation.
"""


class ChatAgent:
    """
    OpenAI chat wrapper with built-in 'system prompt' engineering.

    Features
    --------
    - Reads OPENAI_API_KEY from env (never hardcoded).
    - Accepts a list of {"role","content"} messages.
    - Automatically prepends a system message (from arg/env/file/default).
    - Optional 'extra_context' per call (merged as an additional system message).
    - Retries on transient failures with exponential backoff.
    """

    def __init__(
        self,
        model: Optional[str] = None,
        timeout: float = 20.0,
        max_retries: int = 2,
        system_prompt: Optional[str] = None,
        system_prompt_path: Optional[str] = None,
    ):
        self.client = OpenAI(timeout=timeout, max_retries=max_retries)
        self.model = model or os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self.system_prompt = self._resolve_system_prompt(system_prompt, system_prompt_path)

    # -------- public API --------

    def ask(
        self,
        messages: List[Dict[str, str]],
        *,
        extra_context: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Send a chat completion request.

        Parameters
        ----------
        messages : List[Dict[str,str]]
            Usual OpenAI chat 'messages' (roles: 'user'/'assistant'/('system' allowed)).
        extra_context : dict, optional
            Additional per-call context (e.g., current view, selections).
            Added as an additional 'system' message right after the base system prompt.

        Returns
        -------
        str : assistant text reply (empty string if none)
        """
        last_exc: Exception | None = None

        payload = self._with_system_prompt(messages, extra_context)

        for attempt in range(max(1, self.client.max_retries + 1)):
            try:
                completion = self.client.chat.completions.create(
                    model=self.model,
                    messages=payload,
                )
                return (completion.choices[0].message.content or "").strip()
            except (openai.RateLimitError, openai.APIConnectionError, openai.APITimeoutError) as e:
                last_exc = e
                time.sleep(1 * (2 ** attempt))  # 1s, 2s, 4s, ...
            except openai.APIStatusError as e:
                # Retry 5xx; surface 4xx immediately
                if 500 <= getattr(e, "status_code", 0) < 600:
                    last_exc = e
                    time.sleep(1 * (2 ** attempt))
                else:
                    raise
        raise RuntimeError("The AI is busy or temporarily unavailable. Please try again.") from last_exc

    def set_system_prompt(self, text: str) -> None:
        """Dynamically replace the system prompt."""
        self.system_prompt = (text or "").strip() or _DEFAULT_PROMPT

    # -------- internals --------

    def _resolve_system_prompt(
        self,
        system_prompt: Optional[str],
        system_prompt_path: Optional[str],
    ) -> str:
        # 1) explicit arg
        if system_prompt and system_prompt.strip():
            return system_prompt.strip()
        # 2) env var (useful for quick experiments)
        env_prompt = os.getenv("OPENAI_SYSTEM_PROMPT", "").strip()
        if env_prompt:
            return env_prompt
        # 3) file path (arg) -> load
        if system_prompt_path:
            text = self._load_file_safely(system_prompt_path)
            if text:
                return text
        # 4) default file candidates
        for candidate in ("system_prompt.md", "app/system_prompt.md"):
            text = self._load_file_safely(candidate)
            if text:
                return text
        # 5) baked-in default
        return _DEFAULT_PROMPT

    @staticmethod
    def _load_file_safely(path: str) -> str:
        try:
            with open(path, "r", encoding="utf-8") as f:
                return f.read().strip()
        except Exception:
            return ""

    def _with_system_prompt(
        self,
        user_messages: List[Dict[str, str]],
        extra_context: Optional[Dict[str, Any]],
    ) -> List[Dict[str, str]]:
        # Normalize roles/shape but keep existing content order
        msgs: List[Dict[str, str]] = []
        for m in user_messages or []:
            role = (m.get("role") or "").strip()
            content = (m.get("content") or "").strip()
            if role in {"system", "user", "assistant"} and content:
                msgs.append({"role": role, "content": content})

        # If user already provided a system message, we still *prepend* ours for consistency.
        payload: List[Dict[str, str]] = [{"role": "system", "content": self.system_prompt}]

        if extra_context:
            try:
                ctx = json.dumps(extra_context, ensure_ascii=False, indent=2)
            except Exception:
                ctx = str(extra_context)
            payload.append({
                "role": "system",
                "content": f"Context for this request:\n{ctx}"
            })

        payload.extend(msgs)
        return payload
