# Capital One Shopping Tracker — Claude Code Instructions

Claude-specific config only. **Read [HANDOFF.md](HANDOFF.md) first** — current
state, environment capability matrix, infra/secrets map, roadmap, open issues.
Architecture, protocols, and shared-doc pointers live in [AGENTS.md](AGENTS.md);
deep reference (ingestor, parser, worker, endpoints) in [README.md](README.md).

## Permissions
`.claude/settings.json` sets `permissions.defaultMode: "auto"`; the workspace-wide pre-approvals are in `~/Automation/docs/USER_PROFILE.md`.
