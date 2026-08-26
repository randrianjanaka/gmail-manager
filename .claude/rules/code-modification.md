# Code Modification Rules

## Surgical Edit Protocol

1. **Read first** — always read the file from disk. Never edit from memory.
2. **Minimal diff** — change only what the task requires. Preserve every unrelated line
   character-for-character, indentation included. The test: **every changed line traces
   directly to the request**. A line you cannot trace back is scope you added.
3. **Preserve comments** — never remove one unless the change makes it factually wrong.
4. **Verify after** — see the table below.

## Verification

| Stack | Command | Where |
|-------|---------|-------|
| Python syntax | `python -m compileall -q src` | `gmail-manager-backend/` |
| Python tests | `pytest -v tests/` | `gmail-manager-backend/` |
| TypeScript | `pnpm exec tsc --noEmit --types node` | `gmail-manager-frontend/` |
| Next.js | `pnpm build` | `gmail-manager-frontend/` |

⚠️ **`python run_tests.py` is not a verification.** Its whole body is gated on
`os.getenv('RUN_TESTS', 'false')` (`run_tests.py:7`), set only by `docker-compose.yml:12`.
Run in a shell it prints `Skipping tests (RUN_TESTS not set to true)` and exits **0**
without collecting a single test. Use `pytest -v tests/`, or
`RUN_TESTS=true python run_tests.py` if you want the wrapper.

⚠️ **`python -m py_compile src/*.py` checks nothing in PowerShell** — the primary shell
here. PowerShell passes the glob through literally and py_compile aborts on a filename that
does not exist, returning exit 1 on perfectly valid code. `compileall` takes a directory
and has no glob to expand.

⚠️ **`pnpm build` does not check types.** `next.config.mjs` sets
`typescript.ignoreBuildErrors: true`, so a green build says nothing about type safety.
`tsc --noEmit` is the only type check there is — and the `--types node` is not optional: a
deprecated `@types/dompurify` stub otherwise raises the global `TS2688`, after which
TypeScript withholds every other diagnostic and the run looks clean.

Neither `venv/` nor `node_modules/` is present in a fresh checkout: install before claiming
a verification ran. Until then pytest stops at `ModuleNotFoundError`.

## Two Traps Specific to This Repo

**Backend tests gate the container — but only under compose.** The Docker CMD is
`python run_tests.py && uvicorn …`, and the gate depends on `RUN_TESTS=true`, which
`docker-compose.yml:12` sets and the Dockerfile never does. Under `docker compose up`, a
failing test means the backend never starts. Built and run from the Dockerfile alone, the
suite is skipped and uvicorn serves a red tree silently.

**Importing `src.main` runs the authentication path.** `gmail_service = GmailService()`
sits at module top level (`main.py:43`). `tests/conftest.py:4` does exactly that import at
collection time and its `patch('src.main.gmail_service')` lives in a fixture, so it only
replaces an object already constructed — **conftest is not the pattern to copy.** To
actually prevent it, patch `src.gmail_service.GmailService` *before* importing the app, the
way `tests/test_filters.py:32-33` does.
