---
description: Audite une fonctionnalité de bout en bout — du clic dans le frontend jusqu'à l'appel Gmail — et signale ce qui casse en silence
argument-hint: <nom de la fonctionnalité, ex. "assignation de label">
allowed-tools: Read, Grep, Glob, Bash
---

# /audit-feature — End-to-End Flow Audit

Trace one feature from the browser to the Gmail API and back. Report what you found, not
what you assume.

## The chain, in order

1. **Component** — which file under `gmail-manager-frontend/components/` (or the relevant
   branch of `app/page.tsx`, 876 lines) renders the control?
2. **`fetch`** — which URL string, which method, which body? Remember `API_BASE = '/api'`
   is redeclared in 5 files: grep the route, not the variable.
3. **Rewrite** — `middleware.ts` strips `/api` and forwards to `API_URL`. A route that
   does not start with `/api` never reaches the backend.
4. **Endpoint** — which `def` in `src/main.py`? Which Pydantic model validates the body?
5. **Service** — which `GmailService` method? Does it use `self.service` or re-call
   `_get_gmail_service()`?
6. **Gmail API** — which `users().*` call, which scope does it need?

## What to look for at each hop

- **Silent contract break** — the route string in the frontend vs the decorator in
  `main.py`. There is no shared type and no codegen: a mismatch is a runtime 404 nobody
  catches at build.
- **Alias drift** — `schemas.py` renames fields (`from` ↔ `from_sender`) and
  `model_dump(by_alias=True)` renames them back. Check both directions.
- **Stale `labels_map`** — built once in `__init__`, never refreshed. Any feature reading
  it is blind to labels created after start-up.
- **Unhandled `HttpError`** — a Gmail failure that reaches the endpoint unwrapped becomes
  a 500 with a stack trace.
- **Scope** — does the call need more than `gmail.modify` + `gmail.settings.basic`?

## Output

A table, one row per hop: `file:line` · what it does · verdict.
Then, separately, **only the defects you can point to** — with the `file:line` that proves
each one. No speculation, no "could potentially". If a hop is unverified, say so.
