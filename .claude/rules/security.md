# Security Rules

## Gmail OAuth Credentials — the highest-value secret here

`gmail-manager-backend/credentials.json` (Google client secret) and `token.json` (the
refresh token) are the keys to a real mailbox. Both are gitignored by
**`gmail-manager-backend/.gitignore:31-32`** — not by the root `.gitignore`, which is 19
lines and does not name them — and have never entered history (verified two ways:
`git rev-list --all --objects` and `git log --all -- "*credentials.json"`).

⚠️ **That protection is scoped to one directory, and the paths are not.** `config.py:15-16`
defines `CREDENTIALS_FILE = 'credentials.json'` and `TOKEN_FILE = 'token.json'` as bare
relative names, resolved against the **current working directory**. Run the backend from
the repository root and both files are written there, where `git check-ignore` returns
exit 1 — untracked but *stageable*, one `git add -A` from being committed. The root
`.gitignore` in this repo now names both; **do not remove those two lines**.

- **NEVER read, print, quote, copy or summarise their contents** — not in a response, not
  in a log, not in a commit, not in a memory file. Naming their existence and their path
  is enough for every legitimate purpose.
- Never widen `SCOPES` in `config.py` without saying so explicitly. The current pair is
  already broad: `gmail.modify` (read **and** modify every message) and
  `gmail.settings.basic` (create and delete filters).
- Never add a code path that writes token material anywhere but `TOKEN_FILE`.

⚠️ **There is no `.dockerignore` in this repo, and the backend Dockerfile does
`COPY . /app/`.** Both credential files land inside the image whenever they exist in the
build context. Flag this before any image is built for anything but a local run; do not
push such an image anywhere.

## Secrets in General

- NEVER hardcode credentials, API keys or connection strings. Configuration goes through
  environment variables (`os.getenv`) or `.env`, which is gitignored on both sides.
- A secret found hardcoded → flag it immediately, propose moving it to the environment.
  Never edit the line to slip past a scanner.

## Input Validation

- Endpoint bodies are validated by the Pydantic models in `schemas.py` — keep it that way.
  A raw `dict` body accepts anything Gmail will then act on.
- Values that reach a Gmail API query (`q=`, label ids, message ids) are attacker-shaped
  once the app is exposed. Validate label ids against `labels_map` rather than forwarding
  what the client sent.

## XSS

- Email HTML is rendered with `dangerouslySetInnerHTML` **after** `DOMPurify.sanitize()`.
  That sanitize call is the only thing standing between a hostile email and the DOM —
  never remove it, never bypass it, never add a second unsanitised injection point.

## Exposure

- **There is no authentication anywhere in this application.** No guard in
  `middleware.ts` (it is a proxy, not a gate), no login, no token. And the proxy is not the
  only way in: `docker compose up` publishes **both** ports on the host
  (`docker-compose.yml:7` `"8123:8123"`, `:22` `"3123:3123"`) and the backend binds
  `0.0.0.0` (`Dockerfile:24`), so 8123 answers directly with Next.js out of the picture.
  Anyone reaching **either** port reads and modifies every message *and* creates or deletes
  mail filters — `POST /filters` (`main.py:383`) and `DELETE /filters/{filter_id}`
  (`main.py:404`) are unauthenticated like everything else, and `FilterAction` accepts a
  `forward` field (`schemas.py:74`).
- CORS allows one origin from `FRONTEND_URL`, defaulting to `http://localhost:3123`.
  Widening it — `*` above all — turns the missing auth into a remote one. Do not.
- Treat any change that makes this reachable beyond localhost as a decision for the user,
  not an implementation detail.
