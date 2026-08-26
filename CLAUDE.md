# Gmail Manager — FastAPI backend + Next.js frontend for triaging a Gmail inbox

Monorepo, two subprojects, one tracked file at the root (`docker-compose.yml`).
115 tracked files, 24 commits, single remote `origin`.

## Service Map

| Service  | Path                      | Stack                                   | Port  |
|----------|---------------------------|-----------------------------------------|-------|
| Backend  | `gmail-manager-backend/`  | Python 3.11, FastAPI, uvicorn           | 8123  |
| Frontend | `gmail-manager-frontend/` | Next.js 14.2.5, React 19, Tailwind v4   | 3123  |

**No database anywhere** — no DB service in the compose, no driver or ORM in the backend.
The only *server-side* persistence is `token.json` on disk; the frontend also persists in
the browser (`recent_labels` in `localStorage`, `components/label-modal.tsx:48,80`, plus
the `next-themes` key). The only remote service is Google's Gmail API.

⚠️ This table describes the **development** stack. `docker-compose.yml` has no `restart:`
policy, no healthcheck, no profile and no override file: it says nothing about how this
runs in production.

## Commands

| Task            | Command                                    | Where    |
|-----------------|--------------------------------------------|----------|
| Start all       | `docker compose up --build`                | Root     |
| Backend tests   | `pytest -v tests/`                         | `gmail-manager-backend/` |
| Backend syntax  | `python -m compileall -q src`              | backend  |
| Frontend types  | `pnpm exec tsc --noEmit --types node`      | frontend |
| Frontend build  | `pnpm build`                               | frontend |
| Frontend dev    | `pnpm dev` (port 3123, hard-coded)         | frontend |

⚠️ **`python run_tests.py` runs no tests and exits 0.** Its whole body sits under
`if os.getenv('RUN_TESTS', 'false') == 'true'` (`run_tests.py:7`), and the only place in
the repo that sets the variable is `docker-compose.yml:12`. Typed in a shell it prints
`Skipping tests (RUN_TESTS not set to true)` and returns **success having collected
nothing** — a green light that proves nothing. Use `pytest -v tests/`, or
`RUN_TESTS=true python run_tests.py`.

⚠️ **`pnpm lint` is broken and always has been.** `package.json` declares
`"lint": "eslint ."`, but eslint is in neither `dependencies` nor `devDependencies`,
appears nowhere in `pnpm-lock.yaml`, and no `.eslintrc*` / `eslint.config.*` exists.
There is **no linter at all** in this repo — none on the Python side either (no ruff,
black, flake8 or mypy, in config or in `requirements.txt`).

⚠️ **The backend README is wrong on three points — do not copy its instructions.**
(1) It says `uvicorn src.main:app --reload` serves on `http://127.0.0.1:8123`: that command
has no `--port`, so uvicorn listens on **8000**; the 8123 comes only from `Dockerfile:24`.
(2) It claims "Python 3.8+", while `gmail_service.py:90` annotates `-> tuple[dict, list]`
(PEP 585, evaluated at definition, no `from __future__ import annotations` anywhere) —
**3.9 is the floor**, and the image is 3.11-slim. (3) `README.md:73` says the backend
detects you are not authenticated "the very first time the frontend makes an API call":
authentication is **not lazy**, it happens at import — see below.

## Backend

`src/` holds four modules: `config.py` (19 l.), `schemas.py` (86 l., **17** Pydantic
models), `main.py` (414 l., **17** endpoints), `gmail_service.py` (680 l.).

> None of these files ends with a newline, so `wc -l` reports one less than the real count
> for every one of them. The numbers above are real line counts.

- **Pydantic v2 only** — `main.py:392` calls `model_dump(exclude_none=True, by_alias=True)`.
- **No version is pinned.** `requirements.txt` is 7 lines without a single operator, and
  there is no lockfile, no `pyproject.toml`, no `pytest.ini`. What runs is whatever the
  ambient interpreter resolves.
- **No `__init__.py` anywhere** — relative imports work through PEP 420 namespace packages.
- `pytest-asyncio` is declared but unused: there is no `async def` and no `await` in the
  whole backend. Every endpoint is a sync `def`, so FastAPI runs them in the threadpool.
- 16 of the 17 endpoints route through `GmailService`; `POST /alerts/custom`
  (`main.py:351`) is a 501 placeholder that touches nothing.

### ⚠️ The import of `src.main` authenticates — and the test suite cannot survive it

`gmail_service = GmailService()` sits at module top level (`main.py:43`), so the whole
auth path runs at **import** time. What it actually does depends on two files that are
absent and gitignored here:

| State | What importing `src.main` does |
|-------|-------------------------------|
| `credentials.json` + valid `token.json` | no authentication at all (`gmail_service.py:60`) |
| expired token with `refresh_token` | headless renewal, no browser (`:61-63`) |
| `credentials.json`, no usable token | **browser OAuth** via `run_local_server(port=0)` (`:73`) |
| **neither file — this checkout** | `FileNotFoundError` swallowed at `:85-87` → `None` → `AttributeError` at `:94` |

**`tests/conftest.py` does not protect against this — it triggers it.** Line 4 is
`from src.main import app`, executed at collection, before any fixture runs. Its
`patch('src.main.gmail_service')` (`conftest.py:9`) lives inside a fixture body, so it can
only swap an object that has already been constructed. Consequence: in a fresh checkout
**pytest cannot even collect** — it dies with `ImportError while loading conftest`.
To genuinely avoid the import-time auth, patch `src.gmail_service.GmailService` *before*
importing the app; `tests/test_filters.py:32-33` shows the working shape.

### Two rough edges before editing `gmail_service.py`

Five methods re-call `self._get_gmail_service()` on every invocation instead of using
`self.service` (`:323, :345, :394, :460, :519`), and the `inbox_categories` mapping is
duplicated verbatim four times in `main.py` (`:75`, `:126`, `:190`, `:304`).

⚠️ **`labels_map` is built once in `__init__` and never refreshed**
(`gmail_service.py:50`). A label created after start-up stays invisible until the process
restarts. Four endpoints read it directly (`main.py:85,135,203,313`).

## Frontend

- **App Router**, no `pages/`, no `app/api/`. TypeScript `strict: true` — but
  `next.config.mjs` sets `ignoreBuildErrors`, so a type error does not stop the build.
  `pnpm exec tsc --noEmit --types node` is the real check (the `--types node` is not
  optional: a deprecated `@types/dompurify` stub otherwise raises `TS2688` and TypeScript
  withholds every other diagnostic).
- **Tailwind v4** (4.1.17) in CSS-first mode via the `@tailwindcss/postcss` plugin.
  `tailwind.config.js` exists in v3 style and **is referenced nowhere** — editing it
  changes nothing. The live tokens are the oklch variables in `app/globals.css`
  (`:root` / `.dark`), exposed through an `@theme inline` block.
- `components/` holds 72 files: **57 generated by shadcn/ui** (style new-york, neutral,
  lucide) and **15 written by hand**. Only 11 of the ui/ ones are actually consumed.
- **`app/page.tsx` (876 lines) is the app's only route and its single state container** —
  not the whole application. It already mounts **11 extracted components** (`:5-15`),
  ~1 870 lines between them. What remains in `page.tsx` is state and fetch logic, so the
  useful split is into hooks, not into new presentational components. **Read
  `components/` before extracting anything.**
- Conventions: kebab-case filenames, `export default function PascalCase` for business
  components, `cn()` = `twMerge(clsx(...))` in `lib/utils.ts`, lucide icons only.

**Dead code has two shapes, and a plain "no importer" grep conflates them.** 40 files have
zero importer, so "unimported" is the norm, not a finding. What matters:

- **Shadowed duplicates** — `components/ui/use-toast.ts` and `components/ui/use-mobile.tsx`
  are byte-identical twins of the imported `hooks/use-toast.ts` / `hooks/use-mobile.ts`,
  and `styles/globals.css` is a stale divergent copy of the imported `app/globals.css`.
  **Editing any of the three changes nothing** — that is the trap.
- **One hand-written orphan** — `components/sidebar-toggle.tsx`, which nothing imports; it
  is the sole importer of `ui/sidebar.tsx`, which drags in a subtree of its own.
- The remaining 38 unimported files in `components/ui/` are unused shadcn primitives.
  Leave them; they are not a cleanup task.

**How the frontend reaches the backend** — `middleware.ts` is a **proxy, not an auth
guard**: on matcher `/api/:path*` (`middleware.ts:19`) it strips the `/api` prefix and
rewrites to `process.env.API_URL`, defaulting to `http://localhost:8123`. There is no
`rewrites()` in `next.config.mjs`; two commit messages claim otherwise (`af5d1f4`,
`25b9397`) and are stale.

`const API_BASE = '/api'` is redeclared identically in **5 files** — 21 `fetch` calls in
all, with no axios, no SWR, no react-query and no shared client module.

## Tests

**Backend only.** Four files under `tests/` (`conftest.py`, `test_api.py`,
`test_filters.py`, `test_schemas.py`) — 7 tests: 5 module-level functions and 2 methods of
`class TestGmailServiceFilters` in `test_filters.py`. The frontend has **no test runner and
no test file** — no `test` script, and no vitest/jest/playwright/cypress.

⚠️ **The suite gates the container, but only under compose.** The backend CMD is
`python run_tests.py && uvicorn …`, and `run_tests.py:7` runs pytest only when
`RUN_TESTS=true` — set at `docker-compose.yml:12` and nowhere else (`Dockerfile:20` sets
only `PYTHONUNBUFFERED`). Under `docker compose up` a red test means the backend never
serves. Run the image any other way, and the suite is skipped, exit 0.

## Constraints

- **Locally you CAN**: read and edit, `python -m compileall -q src`, `pytest -v tests/`,
  `pnpm build`. Neither `venv/` nor `node_modules/` exists in the checkout — both need
  installing first, and until then pytest stops at `ModuleNotFoundError`.
- **A first Gmail authorization needs a human; the everyday path does not.** With no usable
  `token.json`, `_get_gmail_service` falls through to `flow.run_local_server(port=0)`
  (`gmail_service.py:73`), which opens a random local port and waits for a browser **on the
  same machine** — a port no compose service publishes, so it cannot happen in the
  container. Every branch before it is unattended.
- **No CI** — there is no `.github/` anywhere.
- Editing backend code takes effect on container restart, not live: the bind-mount
  `./gmail-manager-backend:/app` exists but the CMD carries no `--reload`. Editing
  frontend code requires `docker compose build frontend` — it has no volume at all.

## Security

- **OAuth scopes are broad**: `gmail.modify` (read *and* modify every message) and
  `gmail.settings.basic` (create and delete filters).
- `credentials.json` and `token.json` live in `gmail-manager-backend/`. They are gitignored
  by **`gmail-manager-backend/.gitignore:31-32`** — the root `.gitignore` is 19 lines and
  does not cover them — and have never entered history. Never read, print or copy their
  contents.
- ⚠️ **A credential file written at the repository ROOT is not ignored.** `config.py:15-16`
  defines both as bare relative names resolved against the CWD, and the `.gitignore` that
  covers them is scoped to `gmail-manager-backend/`. Running the backend from the repo root
  writes `credentials.json` / `token.json` where `git check-ignore` returns exit 1. The root
  `.gitignore` added here closes that path — do not remove those two lines.
- ⚠️ **There is no `.dockerignore` in this repo, and the backend Dockerfile does
  `COPY . /app/`.** Both credential files land inside the image whenever they exist in the
  build context. Flag this before any image is built for anything but a local run.
- CORS allows a single origin from `FRONTEND_URL`, defaulting to `http://localhost:3123`.
  The compose does not set it, so the default applies.
- The email HTML is injected with `dangerouslySetInnerHTML` **after** `DOMPurify.sanitize()`.
  That sanitize call is the only thing between a hostile email and the DOM.
- **There is no authentication anywhere in this application**, and the proxy is not the only
  way in: the compose publishes **both** ports on the host (`docker-compose.yml:7`
  `"8123:8123"`, `:22` `"3123:3123"`), so 8123 answers directly with Next.js out of the
  picture. Anyone reaching either port reads and modifies every message *and* creates or
  deletes mail filters.

## Conventions

Commit history is **Conventional Commits in English**, `feat:` on 23 of 24 commits,
single-line subjects with no body. The 24th, `62b9b3a`, is a `git revert`: its
auto-generated `Revert "feat: …"` subject carries no type prefix and its
`This reverts commit …` line is the only body in the history — a git artefact, not a
deviation to imitate. Per the user's global rule commits are now written **bilingual
EN + FR**; no commit in this repository follows that yet.

Code comments and docstrings are **in English** throughout — match them.

`gmail-manager-backend/prompt_for_frontend_expert-*.md` are development briefs sent to a
front-end contributor, not documentation. The first lists 6 endpoints where `main.py` has
17 — do not read them as a description of the current state.
