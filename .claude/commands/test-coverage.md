---
description: Établit l'état réel de la couverture de tests — backend pytest, frontend sans lanceur
argument-hint: (aucun)
allowed-tools: Read, Grep, Glob, Bash
---

# /test-coverage — Coverage Report

## Two halves, one of which has no tests at all

| Side | Runner | Files |
|------|--------|-------|
| `gmail-manager-backend/` | pytest — `pytest -v tests/` (le wrapper `run_tests.py` est gaté sur `RUN_TESTS`) | `tests/conftest.py`, `test_api.py`, `test_filters.py`, `test_schemas.py` |
| `gmail-manager-frontend/` | **none** | none |

Do not report the frontend as "0% covered" as though it were a gap in a measured system:
there is no `test` script and no vitest/jest/playwright/cypress in `package.json`. It is
unmeasured, not failing.

## Method

1. **Count `def test_`** in `tests/` — but the raw count hides the shape: 5 are
   module-level pytest functions (`test_api.py`, `test_schemas.py`) and 2 are methods of
   `class TestGmailServiceFilters` in `test_filters.py`, taking `self` and a class-scoped
   fixture. Report both forms, not just the total.
2. **Count endpoints**: `grep -c "@app\." src/main.py`. Compare against the endpoints
   actually exercised by `test_api.py`. **The gap is the finding**, and it is what this
   command exists to produce.
3. **Count `GmailService` methods** vs those touched by a test.
4. **Run it** — `cd gmail-manager-backend && pytest -v tests/` — and report the real
   output, pass and fail. A count of test functions is not a result.
   ⚠️ **Never conclude from `python run_tests.py` alone**: `run_tests.py:7` gates the whole
   pytest call on `RUN_TESTS`, defaulted to `false`, so the bare command prints
   `Skipping tests (RUN_TESTS not set to true)` and exits **0** — a green exit from a run
   that never happened. That skip notice is not a result either.
   Locally the suite currently stops at conftest import (`credentials.json` absent) — that
   is the import-time construction described below, not a coverage finding.

## Two facts that change how you read the number

- **The suite gates the container — but only under compose.** The backend CMD is
  `python run_tests.py && uvicorn …`, and `run_tests.py:7` runs pytest only when
  `RUN_TESTS` is `true`. The Dockerfile never sets it (`Dockerfile:20` sets only
  `PYTHONUNBUFFERED`); `docker-compose.yml:12` is the single place in the repo that does.
  So under `docker compose up`, coverage is a start-up condition and a red suite means
  uvicorn never serves. Run the image any other way and the tests are skipped, exit 0.
- **The import itself authenticates**, because `gmail_service = GmailService()` runs at
  module load (`main.py:43`) — and `conftest.py:4` performs that import at collection,
  *before* any fixture. The fixtures do not prevent it; they replace an object already
  built. This is why the suite cannot collect without `credentials.json`.

## Output

Counts first, in a table. Then the named list of untested endpoints and untested
`GmailService` methods. Then the suite's actual exit status.
