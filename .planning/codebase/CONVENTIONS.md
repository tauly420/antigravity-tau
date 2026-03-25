# Code Conventions

## Naming Conventions
- **React components**: PascalCase filenames and function names (e.g., `AutoLab.tsx`, `GraphFitting.tsx`)
- **Python constants**: SCREAMING_SNAKE_CASE (e.g., `SYSTEM_PROMPT`, `MAX_CONTENT_LENGTH`)
- **Flask blueprints**: `{module}_bp` naming pattern (e.g., `autolab_bp`, `fitting_bp`)
- **Python functions/variables**: snake_case throughout
- **TypeScript variables/functions**: camelCase

## TypeScript Patterns
- Strict mode enabled via `tsconfig.app.json`
- `AnalysisContext.tsx` uses `any` type extensively — not a pattern to follow
- Interface/type definitions co-located with components rather than in a dedicated `types/` folder
- No external state management library (Redux, Zustand, etc.)

## React Patterns
- All components are function components (no class components)
- Hooks used: `useState`, `useEffect`, `useRef`, `useContext`
- Global state shared via `AnalysisContext.tsx` (React Context API)
- No component library — all UI is custom with `global.css`

## Python Patterns
- Flask blueprint structure: each feature area gets its own blueprint in `backend/api/`
- Error handling: always wrapped in `try/except`, returns `{"error": "message"}` with 400/500 status
- Success responses include `"error": null` field alongside data
- Blueprints registered in `backend/app.py` with URL prefix `/api/{module}`

## API Conventions
- Endpoint pattern: `/api/{module}/{action}` (e.g., `/api/autolab/run`, `/api/fitting/fit`)
- File uploads: `multipart/form-data` POST
- Data payloads: `application/json` POST
- Response shape: `{ data: ..., error: null }` on success; `{ error: "message" }` on failure
- All API calls centralized in `frontend/src/services/api.ts`

## Styling
- Single `global.css` file for all styles (no CSS modules, no styled-components)
- CSS custom properties (design tokens) used for colors and spacing
- Mix of inline styles and class-based styles across components
- No utility-first CSS framework (no Tailwind)
