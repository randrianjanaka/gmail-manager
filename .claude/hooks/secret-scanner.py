#!/usr/bin/env python3
"""Pre-commit hook: scan staged files for hardcoded secrets.
Adapted for Gmail Manager (FastAPI backend + Next.js frontend).
"""
import json
import re
import subprocess
import sys

PATTERNS = [
    # Cloud providers
    (r'AKIA[0-9A-Z]{16}', 'AWS Access Key', 'critical'),
    (r'(?i)aws_secret_access_key\s*=\s*["\'][^"\']+["\']', 'AWS Secret Key', 'critical'),
    # Anthropic
    (r'sk-ant-api\d{2}-[A-Za-z0-9_-]{80,}', 'Anthropic API Key', 'critical'),
    # OpenAI
    (r'sk-[A-Za-z0-9]{20,}', 'OpenAI API Key', 'critical'),
    # Google
    (r'AIza[0-9A-Za-z_-]{35}', 'Google API Key', 'high'),
    # Stripe
    (r'sk_live_[0-9a-zA-Z]{24,}', 'Stripe Live Secret', 'critical'),
    (r'sk_test_[0-9a-zA-Z]{24,}', 'Stripe Test Secret', 'medium'),
    # GitHub
    (r'ghp_[0-9a-zA-Z]{36}', 'GitHub PAT', 'critical'),
    (r'gho_[0-9a-zA-Z]{36}', 'GitHub OAuth', 'critical'),
    (r'github_pat_[0-9a-zA-Z_]{82}', 'GitHub Fine-grained PAT', 'critical'),
    # GitLab
    (r'glpat-[0-9a-zA-Z_-]{20,}', 'GitLab PAT', 'critical'),
    # Database connection strings
    (r'mysql://[^@\s"\']+:[^@\s"\']+@[^\s"\']+', 'MySQL Connection String with Credentials', 'critical'),
    (r'mongodb(\+srv)?://[^\s"\']+', 'MongoDB Connection String', 'critical'),
    (r'postgres(ql)?://[^\s"\']+', 'PostgreSQL Connection String', 'critical'),
    (r'redis://[^\s"\']+', 'Redis Connection String', 'high'),
    # JWT / Private keys
    (r'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}', 'JWT Token', 'high'),
    (r'-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----', 'Private Key', 'critical'),
    # Generic patterns
    (r'(?i)(?<![-\w])(password|passwd|pwd)\s*=\s*["\'][^"\']{8,}["\']', 'Hardcoded Password', 'high'),
    (r'(?i)(api_key|apikey|api-key)\s*=\s*["\'][^"\']{16,}["\']', 'Hardcoded API Key', 'high'),
    (r'(?i)(secret|token)\s*=\s*["\'][^"\']{16,}["\']', 'Hardcoded Secret/Token', 'high'),
    # Slack / Discord
    (r'xoxb-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24}', 'Slack Bot Token', 'critical'),
    (r'https://hooks\.slack\.com/services/[A-Za-z0-9/]+', 'Slack Webhook', 'high'),
    (r'https://discord(app)?\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+', 'Discord Webhook', 'high'),
]

EXCLUDE_FILES = {
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
    '.env.example', '.env.template',
    # This scanner's own test fixtures carry patterns by construction — without
    # this entry the scanner blocks every commit that touches its own test.
    'test_secret_scanner.py',
    # Same reason, one file over: PATTERNS is a catalogue of what secrets LOOK
    # like, so the scanner matches its own source. Measured here: line 33,
    # `(r'redis://[^\s"\']+', 'Redis Connection String', 'high')`, is flagged as a
    # Redis Connection String. Without this entry no commit touching the scanner
    # can ever be staged. The trade-off is real and narrow — a secret genuinely
    # pasted into this file goes unseen — and it is the price of the file being
    # the one place whose content is supposed to look like credentials.
    'secret-scanner.py',
}

# '.claude' is deliberately NOT excluded: settings.local.json lives there and is
# the easiest place to commit a secret by accident.
EXCLUDE_DIRS = {'.git', 'node_modules', '.next', 'venv', '__pycache__'}


def _run_git(args):
    try:
        return subprocess.run(args, capture_output=True, text=True,
                              timeout=10).stdout
    except Exception:
        return ''


def porcelain_paths(out):
    """Extract paths from `git status --porcelain` output."""
    paths = []
    for line in out.splitlines():
        if len(line) < 4:
            continue
        path = line[3:]
        if ' -> ' in path:          # rename: keep the destination
            path = path.split(' -> ', 1)[1]
        path = path.strip().strip('"')
        if path:
            paths.append(path)
    return paths


def stages_new_content(command):
    """True when the command will put working-tree content into the index."""
    return bool(re.search(r'\bgit\s+add\b', command)
                or re.search(r'\bgit\s+commit\b[^;|&]*\s-(a|am|-all)\b', command))


def get_files_to_scan(command):
    """Files this command could put into the repository.

    This hook runs BEFORE the command. On `git add . && git commit -m ...` --
    the dominant idiom -- nothing is staged yet at hook time, so looking only at
    the index returned an empty list and the secret went in unscanned.

    When the command stages new content, scan the working tree too. A superset is
    the safe direction: an extra finding on an unrelated dirty file costs a
    second of attention, a miss costs a leaked credential.
    """
    files = [f for f in _run_git(
        ['git', 'diff', '--cached', '--name-only', '--diff-filter=ACMR']
    ).strip().split('\n') if f]
    if stages_new_content(command):
        files += porcelain_paths(
            _run_git(['git', 'status', '--porcelain', '--untracked-files=all'])
        )
    return sorted(set(files))


def scan_file(filepath):
    """Scan a single file for secrets."""
    if any(filepath.startswith(d + '/') for d in EXCLUDE_DIRS):
        return []
    if filepath.split('/')[-1] in EXCLUDE_FILES:
        return []

    findings = []
    try:
        with open(filepath, 'r', errors='ignore') as f:
            for i, line in enumerate(f, 1):
                for pattern, name, severity in PATTERNS:
                    if re.search(pattern, line):
                        findings.append((filepath, i, name, severity))
    except (FileNotFoundError, PermissionError):
        pass
    return findings


def main():
    hook_input = json.loads(sys.stdin.read())
    tool_input = hook_input.get('tool_input', {})
    command = tool_input.get('command', '')

    # Only trigger on git commit commands
    if 'git commit' not in command and 'git add' not in command:
        sys.exit(0)

    files = get_files_to_scan(command)
    if not files:
        sys.exit(0)

    all_findings = []
    for f in files:
        all_findings.extend(scan_file(f))

    if not all_findings:
        sys.exit(0)

    # Block on critical/high findings
    critical = [f for f in all_findings if f[3] in ('critical', 'high')]
    if critical:
        msg = "🔴 BLOCKED: Potential secrets detected in staged files:\n"
        for filepath, line, name, severity in critical:
            msg += f"  [{severity.upper()}] {filepath}:{line} — {name}\n"
        msg += "\nUse environment variables instead. See .claude/rules/security.md"
        print(msg, file=sys.stderr)
        sys.exit(2)

    sys.exit(0)


if __name__ == '__main__':
    main()
