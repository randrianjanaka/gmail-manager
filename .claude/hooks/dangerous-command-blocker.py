#!/usr/bin/env python3
"""PreToolUse hook: block dangerous shell commands.
Adapted for Gmail Manager (FastAPI backend + Next.js frontend).
"""
import json
import re
import sys

# Level 1: Catastrophic — always block
CATASTROPHIC = [
    # rm on root, on a top-level system directory, or on home. Any flag order or
    # spelling. The lookahead means "the target ends here": it must NOT swallow
    # `rm -rf /tmp/build`, but it MUST fire on `/etc`, `/home/*` and `$(rm -rf /)`.
    # Anchoring on the bare slash alone is not enough — measured on a sibling repo,
    # it let `rm -rf /etc` through.
    r'''\brm\s+(-[-a-zA-Z]+\s+)*/+(?=[\s;)|&*'"]|$)''',
    r'''\brm\s+(-[-a-zA-Z]+\s+)*/(bin|boot|dev|etc|home|lib|lib64|opt|proc'''
    r'''|root|sbin|srv|sys|usr|var)/?(?=[\s;)|&*'"]|$)''',
    r'''\brm\s+(-[-a-zA-Z]+\s+)*~/?(?=[\s;)|&*'"]|$)''',
    # a dot-directory directly under home: ~/.ssh, ~/.aws, ~/.config ...
    r'''\brm\s+(-[-a-zA-Z]+\s+)*~/\.[-\w.]+/?(?=[\s;)|&*'"]|$)''',
    r'rm\s+-rf\s+\*',                             # rm -rf *
    # PowerShell / cmd: this is the primary shell on these machines
    r'Remove-Item\s+(-\w+\s+)*[A-Za-z]:[\\/]?(?=\s|$)',
    r'\brd\s+/s\b',
    r'\bdel\s+/[fsq]\b',
    r'\bFormat-Volume\b',
    r'\bdd\b[^;|&]*\bof=/dev/',                    # dd to device
    r'\bmkfs\b',                                   # format filesystem
    r':\(\)\s*\{\s*:\|:\s*&\s*\}\s*;:',          # fork bomb
    r'>\s*/dev/sd[a-z]',                           # write to disk device
    r'chmod\s+777\s+/',                            # chmod 777 root
    r'git\s+reset\s+--hard\s+HEAD~',             # destructive git reset
]

# Level 1-bis: Force push — block.
# Anchored on "git push" so the pattern cannot leak onto unrelated commands, and
# [^;|&]* keeps it inside a single command of a compound line. Replaces the two
# inline `if: Bash(git push *-f*)` hooks that used to live in settings.json: the
# `if` filter is documented as best-effort and fails OPEN on $(), backticks or
# $VAR, so those hooks denied unrelated commands while letting the real thing by.
FORCE_PUSH = [
    r'''^\s*git\s+(-C\s+\S+\s+)?push\b[^;|&]*\s(--force\b|--force-with-lease\b|-f\b)''',
    # refspec force: git push origin +main
    r'''^\s*git\s+(-C\s+\S+\s+)?push\b[^;|&]*\s\+\S''',
]


def fragments(command):
    """Split a compound line into the commands it actually runs.

    CRITICAL_PATHS is matched per fragment so a whitelisted `git rm` in one
    command cannot excuse a plain `rm` in the next.
    """
    return re.split(r';|&&|\|\||\|', command)


# Whitelist: recoverable removals, allowed despite matching CRITICAL_PATHS.
# `git rm` on a tracked file is undoable; plain `rm` is not.
WHITELIST = [
    r'\bgit\s+rm\b',
]


def strip_commit_message(command):
    """Drop a commit message BODY, which is an argument and never executes.

    Anchored on the `-m` flag on purpose: a quoted-delimiter heredoc fed to an
    interpreter EXECUTES, so it must keep being scanned.
    """
    command = re.sub(r"-m\s+@'.*?'@", ' ', command, flags=re.DOTALL)
    command = re.sub(r"""-m\s+"?\$\(\s*cat\s*<<-?\s*'(\w+)'.*?^\1\s*\)"?""",
                     ' ', command, flags=re.DOTALL | re.MULTILINE)
    command = re.sub(r"-m\s+'[^']*'", ' ', command, flags=re.DOTALL)
    command = re.sub(r'-m\s+"[^"$`]*"', ' ', command, flags=re.DOTALL)
    return command


# Level 2: Critical path protection — block
CRITICAL_PATHS = [
    r'\b(rm|mv|rmdir|del|Remove-Item|Move-Item)\s+[^;|&]*\.claude/',                 # .claude/ directory
    r'\b(rm|mv|rmdir|del|Remove-Item|Move-Item)\s+[^;|&]*\.git/',                   # .git directory
    r'\b(rm|mv|rmdir|del|Remove-Item|Move-Item)\s+[^;|&]*\.env($|\s)',              # .env files
    r'\b(rm|mv|rmdir|del|Remove-Item|Move-Item)\s+[^;|&]*docker-compose\.yml',      # compose file
    r'\b(rm|mv|rmdir|del|Remove-Item|Move-Item)\s+[^;|&]*Dockerfile($|\s)',         # Dockerfile
    r'\b(rm|mv|rmdir|del|Remove-Item|Move-Item)\s+[^;|&]*package\.json',            # Node.js manifest
    r'\b(rm|mv|rmdir|del|Remove-Item|Move-Item)\s+[^;|&]*pnpm-lock\.yaml',          # Node.js lockfile
    r'\b(rm|mv|rmdir|del|Remove-Item|Move-Item)\s+[^;|&]*requirements\.txt',        # Python manifest
    r'\b(rm|mv|rmdir|del|Remove-Item|Move-Item)\s+[^;|&]*credentials\.json',        # Gmail OAuth client secret
    r'\b(rm|mv|rmdir|del|Remove-Item|Move-Item)\s+[^;|&]*token\.json',              # Gmail refresh token
    r'\b(rm|mv|rmdir|del|Remove-Item|Move-Item)\s+[^;|&]*src/main\.py',             # FastAPI entry point
    r'\b(rm|mv|rmdir|del|Remove-Item|Move-Item)\s+[^;|&]*run_tests\.py',            # Gates the backend container
]

# Level 3: Suspicious — warn only
SUSPICIOUS = [
    r'rm\s+.*\*',                                  # rm with wildcards
    r'find\s+.*-delete',                           # find -delete
    r'xargs\s+rm',                                 # piped rm
    r'git\s+clean\s+-[a-zA-Z]*f',                 # git clean -f
    r'git\s+checkout\s+--\s+\.',                   # git checkout -- .
    r'DROP\s+(TABLE|DATABASE)',                     # SQL destructive
    r'TRUNCATE\s+TABLE',                           # SQL truncate
]


def main():
    hook_input = json.loads(sys.stdin.read())
    tool_input = hook_input.get('tool_input', {})
    command = tool_input.get('command', '')

    if not command:
        sys.exit(0)

    command = strip_commit_message(command)

    def deny(reason):
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason
        }}))
        sys.exit(2)

    # Level 1: Catastrophic
    for pattern in CATASTROPHIC:
        if re.search(pattern, command, re.IGNORECASE):
            deny(f"BLOCKED: Catastrophic command detected: {command}")

    # Level 1-bis: Force push (per fragment, anchored at its start so that a
    # command merely MENTIONING the string — grep, echo — is not refused)
    for pattern in FORCE_PUSH:
        for fragment in fragments(command):
            if re.search(pattern, fragment, re.IGNORECASE):
                deny("BLOCKED: Force push. Use a regular push, or ask the user "
                     f"for explicit permission: {fragment.strip()}")

    # Level 2: Critical paths (recoverable removals whitelisted, per fragment)
    for pattern in CRITICAL_PATHS:
        for fragment in fragments(command):
            if re.search(pattern, fragment, re.IGNORECASE):
                if any(re.search(wp, fragment, re.IGNORECASE) for wp in WHITELIST):
                    continue
                deny(f"BLOCKED: Command targets critical path: {fragment.strip()}")

    # Level 3: Suspicious (warn only)
    for pattern in SUSPICIOUS:
        if re.search(pattern, command, re.IGNORECASE):
            print(f"WARNING: Suspicious command pattern: {command}", file=sys.stderr)
            break

    sys.exit(0)


if __name__ == '__main__':
    main()
