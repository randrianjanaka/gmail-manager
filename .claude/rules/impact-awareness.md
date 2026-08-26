# Impact Awareness Rules

> Apply BEFORE modifying anything in the tables below.

## 1. The Contract Nobody Checks

**The frontend and backend share no types, no codegen and no client module.** The 21
`fetch` calls are string literals spread across 5 files, each redeclaring
`const API_BASE = '/api'`.

Consequence: **renaming an endpoint, or changing a response shape, breaks the frontend
silently.** Nothing fails at build — `next.config.mjs` even ignores type errors. It fails
at runtime, in the browser, on the user.

So: touching `main.py` or `schemas.py` means grepping the frontend for the route string
before you finish.

## 2. Blast Radius

| Path | Impact |
|------|--------|
| `gmail-manager-backend/src/gmail_service.py` | Every endpoint but one — 16 of the 17 route through this class (`POST /alerts/custom` is a 501 placeholder, `main.py:351`) |
| `gmail-manager-backend/src/schemas.py` | The public API shape, therefore the frontend |
| `gmail-manager-backend/src/config.py` | `SCOPES` — ⚠️ a widened scope does **not** take effect on its own, and does **not** trigger a re-consent (see below) |
| `gmail-manager-frontend/middleware.ts` | Every `/api/*` call — it is the only rewrite mechanism |
| `gmail-manager-frontend/lib/utils.ts` | `cn()` — every component |
| `gmail-manager-frontend/app/globals.css` | The oklch tokens — every colour on screen |
| `docker-compose.yml` | Both services |

## 3. Editing `SCOPES` Fails Silently

Nothing in this codebase invalidates `token.json` when `SCOPES` changes, and no path
reaches a browser consent from one. `creds.valid` does not compare scopes, so a still-valid
token is reused **with the old grant** (`gmail_service.py:57-75`) and the new scope simply
never takes effect — the opposite of a loud re-consent. The `run_local_server(port=0)` call
is the `else` of `if creds.expired and creds.refresh_token`, itself inside
`if not creds or not creds.valid`; in the documented headless container it binds a port
nothing publishes and so cannot run at all.

Changing a scope therefore means: edit `config.py`, **delete `token.json`**, and re-consent
from a host with a browser. Say all three, or the change ships inert.

## 4. shadcn/ui Is Generated Code

The 57 files in `components/ui/` come from the shadcn CLI (`components.json`, style
new-york). Editing one is legitimate, but **a later `npx shadcn add` overwrites it without
warning**. If a change must survive, put it in a wrapper under `components/`, not in
`components/ui/`.

Only 11 of them are actually imported by application code. The rest are dead weight —
do not "fix" them, and do not count them as coverage.

## 5. Two Deploy-Shaped Traps

- **Backend edits need a container restart**, not just a save: the bind-mount
  `./gmail-manager-backend:/app` exists but the CMD has no `--reload`.
- **Frontend edits need a rebuild**: the frontend has no volume at all, its code is baked
  in at `RUN pnpm build`. `docker compose restart frontend` changes nothing.

## 6. When to Skip

Typos, comments, docs, and any change confined to a single unimported component.
