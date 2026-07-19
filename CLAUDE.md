# Capital One Shopping Tracker — Claude Code Instructions

Claude-specific config only. **Read [HANDOFF.md](HANDOFF.md) first** — current
state, the environment capability matrix (mobile/Dispatch vs the owner's Mac),
infra/secrets map, roadmap, and open issues. Architecture + protocols live in
[AGENTS.md](AGENTS.md); deep reference (ingestor, parser, worker, endpoints)
in [README.md](README.md). Don't restate those here.

## Session start
Read HANDOFF.md, then skim the top of [CHANGELOG.md](CHANGELOG.md).

## Permissions
`bypassPermissions` mode via `.claude/settings.json` — all tool calls
auto-approved. Collin additionally pre-approves every action under
`~/Automation/`, `~/Library/LaunchAgents/`, and `/tmp/`.

## Push rules (canonical version: HANDOFF.md → Auto-push protocol)
- The CI ingestor commits `public/offers.json` hourly (GitHub Actions cron `17 * * * *`) — **always
  `git pull --rebase` before pushing**, or the push is rejected.
- Never hand-edit or manually commit `public/offers.json` — the ingestor owns it.
- Push after every meaningful change, at least every 30 min, and before the
  user steps away. Add a CHANGELOG entry for significant changes.
- Live URL: https://CMR2334.github.io/capone-shopping/ (rebuilds 30–90 s after push).

## Shared docs
`~/Automation/docs/USER_PROFILE.md` (owner + working style) ·
`~/Automation/docs/PREFERENCES.md` (code/doc standards) ·
`~/Automation/docs/CONTEXT.md` (workspace overview).
