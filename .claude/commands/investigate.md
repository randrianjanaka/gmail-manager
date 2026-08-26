---
description: Vérifie une affirmation sur le code avec des preuves fichier:ligne et rend un verdict CONFIRMED / PARTIALLY TRUE / FALSE / INCONCLUSIVE
argument-hint: <affirmation à vérifier>
allowed-tools: Read, Grep, Glob, Bash
---

# /investigate — Evidence-Based Statement Verification

The user provides a statement or claim about the codebase. Your job is to verify it with evidence.

## Input

The user provides a statement to verify, e.g.:
- "Every endpoint in main.py validates its body against a Pydantic model"
- "Only GmailService talks to the Gmail API"
- "No component calls fetch outside the 5 files that declare API_BASE"
- "labels_map is never refreshed after start-up"

## Process

1. **Parse the claim** into a testable assertion.
2. **Gather evidence** — use Grep, Glob, Read, and Bash (git log/git blame) to search the codebase exhaustively.
3. **Check every relevant service/file** — do not sample. If the claim is "all scripts do X", check ALL scripts.
4. **Produce a verdict** with one of these labels:

   | Verdict | Meaning |
   |---------|---------|
   | **CONFIRMED** | Evidence supports the claim across all relevant files/services |
   | **PARTIALLY TRUE** | True for some but not all — list exceptions |
   | **FALSE** | Evidence contradicts the claim |
   | **INCONCLUSIVE** | Not enough information in the codebase to determine |

5. **Present findings:**

   ```
   ## Investigation: "<original statement>"

   **Verdict: [LABEL]**

   ### Evidence
   - [file:line] — supports/contradicts because...
   - [file:line] — supports/contradicts because...

   ### Exceptions (if PARTIALLY TRUE)
   - [service/file] — does not match because...

   ### Summary
   One paragraph explaining the conclusion.
   ```

## Rules

- Apply `.claude/rules/verification-before-assertion.md` — its trigger table is more precise than these rules. In particular: a negation ("X does not exist") needs **two searches of different shapes**; a count is re-derived **in the same turn** as the claim; an order of magnitude weaker than the theory predicts is a **refutation to explain**, not a detail to report.
- Do NOT modify any files. This is a read-only investigation.
- Be exhaustive — check every service, not just a sample.
- Use `grep` across the entire codebase for patterns, not just a few known files.
- If the claim involves history ("was X ever changed?"), use `git log` and `git blame`.
- If the investigation reveals a real problem, flag it: "**Finding:** This investigation revealed [issue]. Consider fixing."
