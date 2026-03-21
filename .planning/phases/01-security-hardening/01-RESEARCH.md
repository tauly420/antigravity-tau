# Phase 1: Security Hardening - Research

**Researched:** 2026-03-21
**Domain:** Safe mathematical expression evaluation (Python backend)
**Confidence:** HIGH

## Summary

The ODE solver (`backend/api/ode.py`) and Integration solver (`backend/api/integrate.py`) both use Python's `eval()` to convert user-supplied mathematical expression strings into callable functions. This is a critical remote code execution (RCE) vulnerability -- any user can execute arbitrary Python code on the server. Verified empirically: `__import__('os').system('rm -rf /')` executes through the current code path, and `open('/etc/passwd').read()` returns file contents.

The fix requires replacing `eval()` with a two-layer approach: (1) input validation via regex to reject non-mathematical tokens, then (2) SymPy's `sympify()` with `local_dict` for symbolic parsing, followed by `lambdify()` for numerical evaluation. SymPy is already a project dependency (used in `fitting.py`, `autolab.py`, and `calculations.py`), so no new libraries are needed.

The main technical challenge is that ODE expressions use NumPy-style array indexing (`y[0]`, `y[1]`) which requires SymPy's `IndexedBase` for proper symbolic representation. This was verified experimentally -- all 8 ODE presets parse correctly through `sympify` with `IndexedBase('y')` in the `local_dict`.

**Primary recommendation:** Replace all `eval()` calls in `ode.py` and `integrate.py` with a shared `safe_parse_expr()` utility that validates input, then uses `sympify()` + `lambdify()`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | User input in ODE solver is evaluated safely via sympify+lambdify instead of eval() | Three eval() calls in ode.py (lines 32, 109); replace with sympify+IndexedBase+lambdify pattern verified against all 8 ODE presets |
| SEC-02 | User input in Integration solver is evaluated safely via sympify+lambdify instead of eval() | Four eval() calls in integrate.py (lines 64, 194, 225, 236); replace with sympify+lambdify pattern verified against integration expressions |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sympy | >=1.12 (1.14.0 current) | Symbolic math parsing and safe expression evaluation | Already in requirements.txt; sympify+lambdify is the canonical Python approach to safe math evaluation |
| numpy | >=1.24.0 | Numerical evaluation target for lambdify | Already a dependency; lambdify's `modules='numpy'` generates efficient numerical code |

### Supporting
No additional libraries needed. Everything required is already in the project.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| sympify + input validation | Python `ast` module only | ast-based evaluator already exists in `calculations.py` but doesn't support symbolic variables, array indexing, or generating callables for scipy -- would need major extension |
| sympify + input validation | RestrictedPython | Overkill for math-only expressions; adds a new dependency |
| Pre-validation regex | No validation (sympify only) | UNSAFE: both `sympify()` and `parse_expr()` call `eval()` internally -- confirmed experimentally that malicious strings execute even through parse_expr |

## Architecture Patterns

### Recommended Project Structure
```
backend/
  utils/
    calculations.py     # Existing shared math utilities
    safe_eval.py         # NEW: shared safe expression parsing (or add to calculations.py)
  api/
    ode.py              # Modified: uses safe_eval instead of eval()
    integrate.py        # Modified: uses safe_eval instead of eval()
```

### Pattern 1: Two-Layer Safe Expression Evaluation
**What:** Validate input with regex, then parse with sympify + lambdify
**When to use:** Any time user-supplied math strings need to become callable functions

```python
import re
from sympy import sympify, lambdify, symbols, IndexedBase
import numpy as np

# Layer 1: Input validation
_FORBIDDEN_PATTERNS = [
    r'__',          # dunder access
    r'\bimport\b',  # import statements
    r'\beval\b',    # eval/exec
    r'\bexec\b',
    r'\bopen\b',    # file access
    r'\bos\b',      # os module
    r'\bsys\b',     # sys module
    r'\bgetattr\b', # attribute introspection
    r'\bsetattr\b',
    r'\bglobals\b',
    r'\blocals\b',
    r'\bcompile\b',
    r'\bbreakpoint\b',
    r'\blambda\b',  # no lambda definitions
    r'\bclass\b',
    r'\bdef\b',
    r'\bfor\b',
    r'\bwhile\b',
    r'\breturn\b',
]

_ALLOWED_CHARS = re.compile(r'^[a-zA-Z0-9\s\+\-\*/\(\)\[\]\.\,\^\_]+$')

def validate_math_expr(expr_str: str) -> str:
    """Reject non-mathematical input before it reaches sympify."""
    stripped = expr_str.strip()
    if not stripped:
        raise ValueError("Empty expression")
    for pattern in _FORBIDDEN_PATTERNS:
        if re.search(pattern, stripped):
            raise ValueError(f"Expression contains forbidden pattern")
    if not _ALLOWED_CHARS.match(stripped):
        raise ValueError("Expression contains disallowed characters")
    return stripped

# Layer 2: SymPy parsing
_SYMPY_NS = {
    'sin': sympy.sin, 'cos': sympy.cos, 'tan': sympy.tan,
    'asin': sympy.asin, 'acos': sympy.acos, 'atan': sympy.atan,
    'atan2': sympy.atan2,
    'exp': sympy.exp, 'log': sympy.log,
    'sqrt': sympy.sqrt, 'abs': sympy.Abs,
    'pi': sympy.pi, 'e': sympy.E,
    'sinh': sympy.sinh, 'cosh': sympy.cosh, 'tanh': sympy.tanh,
    'sign': sympy.sign, 'floor': sympy.floor, 'ceil': sympy.ceiling,
    'heaviside': sympy.Heaviside,
}
```

### Pattern 2: ODE Expression Parsing with IndexedBase
**What:** Parse ODE system expressions like `y[1], -9.81*sin(y[0])` into a callable `f(t, y)`
**When to use:** ODE solver endpoint

```python
from sympy import IndexedBase, symbols, sympify, lambdify
import numpy as np

def build_safe_ode_func(function_str: str, num_components: int):
    """Build a callable f(t, y) -> np.array from a validated expression string."""
    validated = validate_math_expr(function_str)

    y = IndexedBase('y')
    t = symbols('t')
    local_dict = dict(_SYMPY_NS, y=y, t=t)

    parsed = sympify(validated, locals=local_dict)
    components = list(parsed) if isinstance(parsed, tuple) else [parsed]

    # Create substitution symbols for lambdify (IndexedBase -> plain symbols)
    y_syms = [symbols(f'_y{i}') for i in range(num_components)]
    subs = {y[i]: y_syms[i] for i in range(num_components)}

    funcs = []
    for comp in components:
        comp_sub = comp.subs(subs)
        f = lambdify([t] + y_syms, comp_sub, modules='numpy')
        funcs.append(f)

    def ode_func(t_val, y_val):
        return np.array([f(t_val, *y_val) for f in funcs])

    return ode_func
```

### Pattern 3: Integration Expression Parsing
**What:** Parse single-variable or multi-variable expressions for integration
**When to use:** Integration solver endpoints

```python
def build_safe_integration_func(function_str: str, var_names: list[str]):
    """Build a callable from validated expression string."""
    validated = validate_math_expr(function_str)

    syms = {name: symbols(name) for name in var_names}
    local_dict = dict(_SYMPY_NS, **syms)

    parsed = sympify(validated, locals=local_dict)
    sym_list = [syms[name] for name in var_names]
    f = lambdify(sym_list, parsed, modules='numpy')
    return f
```

### Anti-Patterns to Avoid
- **eval() with "safe" namespace:** The current approach uses `eval(code, _SAFE_NS)` which does NOT prevent code execution. Python's eval can access builtins through object introspection even with a restricted namespace (e.g., `().__class__.__bases__[0].__subclasses__()`).
- **sympify() without input validation:** Both `sympify()` and `parse_expr()` internally call `eval()` as a fallback. Confirmed experimentally that `parse_expr("open('/tmp/file','w').write('pwned')")` creates files on disk.
- **Using `strict=True` as sole defense:** While `sympify(expr, strict=True)` rejects string inputs entirely, it cannot be used with string expressions at all -- it only accepts already-parsed SymPy objects.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Math expression parsing | Custom tokenizer/parser | SymPy sympify + lambdify | Handles operator precedence, function calls, array indexing, symbolic simplification -- all battle-tested |
| Input sanitization | Simple string.replace | Regex forbidden-pattern list + allowed-character whitelist | Attack vectors are numerous and creative; a blacklist alone misses edge cases |
| Numerical evaluation | Custom tree walker for numpy | lambdify with modules='numpy' | Generates efficient vectorized numpy code, handles edge cases (inf, nan) |

**Key insight:** The existing AST-based `parse_num_expr` in `calculations.py` is safe but limited to constant expressions (no variables, no array indexing). Extending it to handle ODE/integration variables would essentially reimplement sympify poorly. Use sympify with pre-validation instead.

## Common Pitfalls

### Pitfall 1: sympify/parse_expr Are NOT Safe for Untrusted Input
**What goes wrong:** Developers assume SymPy's parsing functions are safe because they're "just math parsers." In reality, both `sympify()` and `parse_expr()` call Python's `eval()` internally as a fallback mechanism.
**Why it happens:** The SymPy documentation does not prominently warn about this. The functions are designed for convenience, not security.
**How to avoid:** Always validate input BEFORE passing to sympify. The regex validation layer must reject anything that isn't clearly mathematical.
**Warning signs:** If you find yourself passing user strings directly to sympify without validation, you have an RCE vulnerability.

### Pitfall 2: ODE Array Indexing (y[0], y[1]) Requires IndexedBase
**What goes wrong:** Standard SymPy symbols don't support bracket indexing. Parsing `y[0]` fails unless `y` is an `IndexedBase`.
**Why it happens:** SymPy's `Symbol` type doesn't support `__getitem__`. The `IndexedBase` type does.
**How to avoid:** Always include `IndexedBase('y')` in the local_dict when parsing ODE expressions.
**Warning signs:** `TypeError: 'Symbol' object is not subscriptable`

### Pitfall 3: lambdify Cannot Handle IndexedBase Directly
**What goes wrong:** `lambdify([y[0], y[1]], expr)` produces incorrect code because Indexed symbols don't map cleanly to lambda parameters.
**Why it happens:** lambdify expects plain Symbol arguments.
**How to avoid:** Substitute `y[i]` with plain symbols (`_y0`, `_y1`, etc.) before calling lambdify. Verified this works correctly for all 8 ODE presets.
**Warning signs:** lambdify output produces wrong numerical results or raises `KeyError`.

### Pitfall 4: Comma-Separated ODE Components Parse as Python Tuple
**What goes wrong:** `sympify('y[1], -sin(y[0])')` returns a Python `tuple`, not a SymPy `Tuple`.
**Why it happens:** Python's parser treats comma-separated expressions as tuples.
**How to avoid:** Check `isinstance(parsed, tuple)` and convert to list of components. This is correct behavior -- just handle the type.
**Warning signs:** Single-component ODEs return a SymPy expression, multi-component return a tuple.

### Pitfall 5: Integration Condition Expressions Need Separate Handling
**What goes wrong:** The multi-dimensional integration endpoint accepts a `condition` parameter (e.g., `x**2 + y**2 < 1`) which also uses eval().
**Why it happens:** Comparison operators (`<`, `>`) are valid in conditions but not in standard math expressions.
**How to avoid:** The allowed-character regex must include `<`, `>`, `=` for condition expressions specifically. Parse conditions separately: sympify the comparison, then lambdify with appropriate symbols.
**Warning signs:** Conditions that worked with eval() fail with sympify because comparison operators return SymPy relational objects.

### Pitfall 6: Energy Expression in ODE Also Uses eval()
**What goes wrong:** The ODE endpoint has a secondary eval() call for `energy_expr` (line 109 in ode.py). This is easy to miss since the primary ODE function gets all the attention.
**Why it happens:** The energy computation was added as an optional feature and uses the same eval() pattern.
**How to avoid:** Apply the same safe parsing to `energy_expr_str`. It uses `t` and `y` variables just like the ODE function.
**Warning signs:** Grep for ALL eval() calls, not just the obvious one.

## Code Examples

### Complete Safe ODE Function Builder (verified against all 8 presets)
```python
# Source: Empirically verified 2026-03-21 against all ODE presets in ODESolver.tsx
import re
import sympy
from sympy import sympify, lambdify, symbols, IndexedBase
import numpy as np

_FORBIDDEN = [
    r'__', r'\bimport\b', r'\beval\b', r'\bexec\b', r'\bopen\b',
    r'\bos\b', r'\bsys\b', r'\bgetattr\b', r'\bsetattr\b',
    r'\bglobals\b', r'\blocals\b', r'\bcompile\b', r'\bbreakpoint\b',
    r'\blambda\b', r'\bclass\b', r'\bdef\b', r'\bfor\b', r'\bwhile\b',
    r'\breturn\b', r'\byield\b', r'\braise\b', r'\btry\b', r'\bwith\b',
    r'\bdel\b', r'\bprint\b',
]

_ALLOWED_CHARS = re.compile(r'^[a-zA-Z0-9\s\+\-\*/\(\)\[\]\.\,\^\_]+$')

_SYMPY_MATH = {
    'sin': sympy.sin, 'cos': sympy.cos, 'tan': sympy.tan,
    'asin': sympy.asin, 'acos': sympy.acos, 'atan': sympy.atan,
    'atan2': sympy.atan2, 'arctan2': sympy.atan2,
    'exp': sympy.exp, 'log': sympy.log,
    'log10': lambda x: sympy.log(x, 10),
    'sqrt': sympy.sqrt, 'abs': sympy.Abs,
    'pi': sympy.pi, 'e': sympy.E,
    'sinh': sympy.sinh, 'cosh': sympy.cosh, 'tanh': sympy.tanh,
    'sign': sympy.sign, 'floor': sympy.floor, 'ceil': sympy.ceiling,
    'heaviside': sympy.Heaviside,
}

def validate_math_input(expr_str: str) -> str:
    stripped = expr_str.strip()
    if not stripped:
        raise ValueError("Empty expression")
    for pat in _FORBIDDEN:
        if re.search(pat, stripped):
            raise ValueError("Expression contains forbidden pattern")
    if not _ALLOWED_CHARS.match(stripped):
        raise ValueError("Expression contains disallowed characters")
    return stripped

def safe_build_ode_func(function_str: str, num_components: int):
    validated = validate_math_input(function_str)
    y = IndexedBase('y')
    t = symbols('t')
    local_dict = dict(_SYMPY_MATH, y=y, t=t)

    parsed = sympify(validated, locals=local_dict)
    components = list(parsed) if isinstance(parsed, tuple) else [parsed]

    y_syms = [symbols(f'_y{i}') for i in range(num_components)]
    subs = {y[i]: y_syms[i] for i in range(num_components)}

    funcs = []
    for comp in components:
        comp_sub = comp.subs(subs)
        f = lambdify([t] + y_syms, comp_sub, modules='numpy')
        funcs.append(f)

    def ode_func(t_val, y_val):
        return np.array([f(t_val, *y_val) for f in funcs])

    return ode_func
```

### Integration Function Builder
```python
def safe_build_1d_func(function_str: str):
    validated = validate_math_input(function_str)
    x = symbols('x')
    local_dict = dict(_SYMPY_MATH, x=x)
    parsed = sympify(validated, locals=local_dict)
    return lambdify(x, parsed, modules='numpy')

def safe_build_multi_func(function_str: str, var_names: list):
    validated = validate_math_input(function_str)
    syms = {name: symbols(name) for name in var_names}
    local_dict = dict(_SYMPY_MATH, **syms)
    parsed = sympify(validated, locals=local_dict)
    return lambdify([syms[name] for name in var_names], parsed, modules='numpy')

def safe_build_condition_func(condition_str: str, var_names: list):
    # Conditions need comparison operators
    validated = validate_math_input_with_comparisons(condition_str)
    syms = {name: symbols(name) for name in var_names}
    local_dict = dict(_SYMPY_MATH, **syms)
    # For conditions, sympify produces a relational -- lambdify handles it
    parsed = sympify(validated, locals=local_dict)
    return lambdify([syms[name] for name in var_names], parsed, modules='numpy')
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `eval(f"lambda x: {expr}", safe_globals)` | Input validation + `sympify()` + `lambdify()` | Always was the right approach | Eliminates RCE vulnerability entirely |
| Restricted namespace as security | Regex validation as first defense layer | N/A | Namespace restriction alone is bypassable via `().__class__.__bases__[0].__subclasses__()` |

**Deprecated/outdated:**
- `eval()` with restricted globals: Never was secure; Python's introspection makes namespace restrictions bypassable
- `parse_expr()` as "safe alternative": Also calls eval() internally; confirmed vulnerable

## Open Questions

1. **Condition expressions in multi-dimensional integration**
   - What we know: The `condition` parameter (e.g., `x**2 + y**2 < 1`) uses comparison operators which the standard math regex doesn't allow
   - What's unclear: Whether SymPy's `lambdify` produces correct boolean output from relational expressions for numpy array filtering
   - Recommendation: Extend the allowed-character regex to include `<>!=` for condition-specific validation, and test empirically

2. **Performance impact of sympify + lambdify vs eval**
   - What we know: sympify + lambdify adds parsing overhead on each request
   - What's unclear: Whether the overhead is significant for real-time ODE solving
   - Recommendation: The parsing happens once per request, not per evaluation step. The lambdified function runs at numpy speed during integration. Impact should be negligible. Consider caching lambdified functions with `lru_cache` if profiling shows issues.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (needs install -- not in requirements.txt currently) |
| Config file | none -- see Wave 0 |
| Quick run command | `cd backend && python -m pytest tests/ -x -q` |
| Full suite command | `cd backend && python -m pytest tests/ -v` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | ODE safe parsing: all 8 presets produce correct numerical output | unit | `python -m pytest tests/test_safe_eval.py::test_ode_presets -x` | No -- Wave 0 |
| SEC-01 | ODE rejects malicious input with clear error | unit | `python -m pytest tests/test_safe_eval.py::test_ode_rejects_malicious -x` | No -- Wave 0 |
| SEC-01 | ODE energy_expr also uses safe parsing | unit | `python -m pytest tests/test_safe_eval.py::test_ode_energy_safe -x` | No -- Wave 0 |
| SEC-02 | Integration 1D safe parsing: standard expressions evaluate correctly | unit | `python -m pytest tests/test_safe_eval.py::test_integration_1d -x` | No -- Wave 0 |
| SEC-02 | Integration multi-dim safe parsing: standard expressions evaluate correctly | unit | `python -m pytest tests/test_safe_eval.py::test_integration_multi -x` | No -- Wave 0 |
| SEC-02 | Integration rejects malicious input with clear error | unit | `python -m pytest tests/test_safe_eval.py::test_integration_rejects_malicious -x` | No -- Wave 0 |
| SEC-02 | Integration condition expressions parse safely | unit | `python -m pytest tests/test_safe_eval.py::test_integration_condition_safe -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/test_safe_eval.py -x -q`
- **Per wave merge:** `cd backend && python -m pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_safe_eval.py` -- covers SEC-01 and SEC-02 (safe parsing + malicious rejection)
- [ ] `backend/tests/conftest.py` -- Flask test client fixture if integration tests needed
- [ ] pytest install: `pip install pytest` and add to `requirements.txt`

## Sources

### Primary (HIGH confidence)
- **Empirical testing** (2026-03-21) -- Verified all claims by running code against SymPy 1.14.0:
  - `sympify()` executes `__import__('os').system()` -- confirmed RCE
  - `parse_expr()` executes `open().write()` -- confirmed file creation
  - `sympify(strict=True)` blocks strings but cannot be used for expression parsing
  - All 8 ODE presets parse and evaluate correctly via sympify+IndexedBase+lambdify
  - Input validation regex blocks all tested attack vectors while passing all math expressions
- **Project source code** -- `backend/api/ode.py`, `backend/api/integrate.py`, `backend/api/fitting.py`, `backend/api/autolab.py`, `backend/utils/calculations.py`

### Secondary (MEDIUM confidence)
- SymPy documentation on sympify: https://docs.sympy.org/latest/modules/core.html#sympy.core.sympify.sympify
- SymPy documentation on lambdify: https://docs.sympy.org/latest/modules/utilities/lambdify.html

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- SymPy already in project, approach verified empirically
- Architecture: HIGH -- Pattern verified against all existing presets, fits existing code structure
- Pitfalls: HIGH -- All pitfalls discovered and verified through hands-on testing

**Research date:** 2026-03-21
**Valid until:** Indefinite (security patterns don't expire; SymPy API is stable)

## Inventory of eval() Calls to Replace

Complete list of dangerous eval() calls in the codebase (only backend/api/ode.py and backend/api/integrate.py are in scope for this phase):

| File | Line | Expression Pattern | Variables Used |
|------|------|--------------------|----------------|
| `backend/api/ode.py` | 32 | `eval(f"lambda t, y: np.array([{function_str}])", _SAFE_NS)` | t, y (array) |
| `backend/api/ode.py` | 109 | `eval(f"lambda t, y: ({energy_expr_str})", _SAFE_NS)` | t, y (array) |
| `backend/api/integrate.py` | 64 | `eval(f"lambda x: {function_str}", safe_globals)` | x |
| `backend/api/integrate.py` | 194 | `eval(f"lambda {var_str}: {function_str}", safe_globals)` | x, y, z, w, v, u |
| `backend/api/integrate.py` | 225 | `eval(f"lambda sample: {function_str}", safe_globals)` after var replacement | sample[i] |
| `backend/api/integrate.py` | 236 | `eval(f"lambda sample: {condition_str}", safe_globals)` after var replacement | sample[i] |

Note: `backend/utils/calculations.py` uses a safe AST-based evaluator (`parse_num_expr`) -- this is NOT vulnerable and is NOT in scope.
