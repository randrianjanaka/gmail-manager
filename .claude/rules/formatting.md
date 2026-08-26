# Formatting Rules

> **No formatter and no linter exist in this repo.** `pnpm lint` is declared but broken —
> eslint is installed nowhere. Nothing mechanical will catch a style drift, so matching the
> surrounding file is the only enforcement there is.

## Python — `gmail-manager-backend/`

| Aspect | Convention |
|--------|-----------|
| Indentation | 4 spaces |
| Quotes | Double (`"..."`), including f-strings |
| Docstrings | `"""..."""`, third-person indicative (`Fetches…`, `Returns…`, `Lists…`) — **never** the PEP 257 imperative |
| Modules, functions, variables | `snake_case` |
| Classes | `PascalCase` |
| Constants | `UPPER_SNAKE_CASE` (`SCOPES`, `TOKEN_FILE` in `config.py`) |
| Private helpers | leading underscore (`_get_gmail_service`, `_get_labels`) |
| Imports | Relative one level for first-party (`from .config import …`); `tests/` use absolute `from src.…`. **stdlib and third-party are interleaved, not blocked** — `typing` sits below `fastapi` (`main.py:5`) and below `pydantic` (`schemas.py:2`). Match the file, do not reorder |

- Docstring style is not a preference here, it is unanimous: **0 of 39 docstrings** use the
  imperative. Writing `Fetch the labels` instead of `Fetches the labels` writes against the
  file.
- **Type hints are partial and that is the house style**: 16 of 31 `def` in
  `gmail_service.py` carry a return annotation. Annotate what you add; do not sweep the
  file to annotate the rest.
- **Logging, never `print` — inside `src/`.** `logging.info/warning/error` with f-strings.
  Two documented exceptions: `run_tests.py` runs as the container entrypoint *before*
  `main.py:18` calls `logging.basicConfig`, so its four `print` calls are the only output
  that reaches the docker log; and `main.py:370` still uses `traceback.print_exc()` where
  its siblings (`:401`, `:413`) use `logging.error(…, exc_info=True)` — do not copy that one.
- Pydantic models live in `schemas.py` only. Endpoint signatures type their body against
  one of them; they do not declare inline dicts.

## TypeScript / React — `gmail-manager-frontend/`

| Aspect | Convention |
|--------|-----------|
| Indentation | 2 spaces |
| Semicolons | **Mixed — match the file, never normalise** (see below) |
| Quotes | Single in TS/JS, double inside JSX attributes (`className="…"`) |
| Files | `kebab-case.tsx` — `email-content-modal.tsx`, `pagination-controls.tsx` |
| Business components | `export default function PascalCase` |
| shadcn/ui components | bare `function PascalCase()` re-exported by a trailing `export { … }` block (55 of the 57 files); `data-slot` attribute preserved |
| Props | `interface <Component>Props`, declared just above the component |
| Client components | `'use client'` on line 1 |

⚠️ **Semicolons are the trap.** 403 lines end with `;` across 13 files — `app/page.tsx`
alone has 200, `filter-modal.tsx` 63, `filters-page.tsx` 38, and `contexts/task-context.tsx`
terminates every statement. The semicolon-free files are `components/ui/*`, `middleware.ts`,
`hooks/*`, `lib/utils.ts`, `theme-toggle.tsx` and `filters-panel.tsx`. Reading one file and
generalising produces a 200-line pure-reformat diff in `page.tsx`. Look at the file you are
in.

- **Styling is Tailwind utility classes only.** No CSS module, no styled-components, and no
  inline `style` in any business component. Seven `style={{` sites exist, all inside
  `components/ui/`: `chart.tsx`, `sidebar.tsx` and `sonner.tsx` inject CSS custom
  properties, `progress.tsx` sets the indicator transform. Do not add one outside `ui/`.
- **Class composition goes through `cn()`** (`lib/utils.ts` = `twMerge(clsx(...))`).
  Never concatenate class strings by hand.
- **Icons: `lucide-react` exclusively.**
- Colors come from the semantic tokens (`bg-muted`, `text-foreground`, `border-border`)
  defined in `app/globals.css` — never a raw hex. Two places carry raw palette colors: the
  metric-card icon accents in `dashboard.tsx:128,134` (`text-blue-500`, `text-green-500`)
  and the upstream shadcn destructive reds in `ui/toast.tsx:80`. Do not add a third.

## When Modifying Existing Code

**Match the file you are editing.** Never reformat outside your change scope, and never
"fix" a style inconsistency during an unrelated change — flag it instead. With no linter
in the pipeline, a reformat is indistinguishable from a behaviour change in review.
