# Testing

## Test Coverage
**Zero project-owned test files exist.** The only `.test.ts` files found are inside `node_modules/zod`.

## Test Frameworks
- None configured. No Jest, Vitest, or pytest setup found in `package.json` or `backend/`.

## Test Location
- `backend/tests/` directory exists but is completely empty.
- No `__tests__/` or `*.spec.*` files anywhere in the project source.

## Test Patterns
N/A — no tests written yet.

## CI/CD
- No `.github/` directory → no GitHub Actions or automated test runs.
- Deployment is via Railway (nixpacks), but no pre-deploy test step configured.

## Gaps
- **Frontend**: No unit tests, no component tests, no E2E tests.
- **Backend**: No unit tests, no integration tests, no API tests.
- **AI logic**: AutoLab orchestrator and Chat agent have zero test coverage.
- **Utilities**: `calculations.py`, `format.ts` utility functions untested.
- All fitting models (linear, quadratic, sinusoidal, etc.) untested against known inputs.
- The `backend/tests/` placeholder suggests testing was planned but never started.
