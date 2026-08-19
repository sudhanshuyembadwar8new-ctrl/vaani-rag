---
name: bug-audit-design-align
description: Use when asked to audit, fix bugs, or check design/spec alignment. Triggers on "check bugs", "fix", "align with DESIGN.md", "improve project".
---

# Bug Audit + Design Alignment

## Scope
Only read files changed in the last commit, named by the user, or covered by currently failing tests. Never rescan the whole repo unless told "full repo scan."

## Procedure
1. Read @DESIGN.md once. Extract binding rules: API contracts, env var names, folder structure, naming conventions.
2. Run the existing test suite once. Work from real failures, don't guess bugs.
3. Output a numbered findings list BEFORE editing anything: Bug | Severity P0/P1/P2 | File:Line | 1-line cause.
4. Stop after the list. Wait for go-ahead unless user said "auto-fix."
5. Auto-fix only P0 (blocking) bugs. List P1/P2 as TODOs, don't touch.
6. Use minimal diffs. Never rewrite a full file for a small fix.
7. Re-run tests once after fixing. Report pass/fail. Stop - no extra refactors, no unrelated cleanup.
8. List DESIGN.md violations separately. Don't auto-fix those without confirmation - may be intentional.

## Token discipline
- Never paste full file contents into chat when a diff will do.
- Don't re-explain context already in AGENTS.md.
- Batch reads - don't reread a file already open this session.
