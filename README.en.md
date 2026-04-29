# Rules CLI

[English](./README.en.md) | [中文](./README.md)

CLI for managing and syncing AI Agent rules.

## Installation

| Scenario | Command |
| --- | --- |
| Global install | `pnpm add -g @shindou/rules-cli` |
| Local development install | `pnpm install` |

## Quick Start

| Step | Command | Description |
| --- | --- | --- |
| 1 | `rules init` | Initialize config |
| 2 | `rules create use-chinese` | Create a rule (global by default) |
| 3 | `rules apply use-chinese` | Apply rule to agents |
| 4 | `rules list` | List applied rules |

## Scope Rules

| Command group | Default scope | Switch to project scope |
| --- | --- | --- |
| `create/install/apply/remove/init` | Global | `--project` |
| `list` | Project + Global | `--project` or `--global` |

## Remote Sources

`.rulesrc` example:

```json
{
  "defaultAgents": ["claude-code"],
  "scope": "global",
  "sources": [
    { "repo": "owner/repo", "subPath": "rules" }
  ]
}
```

| Action | Command |
| --- | --- |
| Remote search | `rules search react --remote` |
| Install remote rule (global default) | `rules install react` |
| Install into project store | `rules install react --project` |

After `install` succeeds, CLI automatically enters `rules a` flow for agent selection and apply.

## Command Reference (with Aliases)

| Command | Alias | Purpose | Common options | Example |
| --- | --- | --- | --- | --- |
| `search [keyword]` | `s` | Search local/remote rules | `-r, --remote` | `rules s react -r` |
| `apply [name]` | `a` | Apply rules to agents | `-a, --agent` `-p, --project` `-f, --force` | `rules a react --agent cursor,claude-code` |
| `list` | `ls` | List applied rules or store rules | `-s, --store` `-p, --project` `-g, --global` | `rules ls --store --global` |
| `remove [name]` | `rm`, `delete` | Remove applied rules or store rules | `-s, --store` `-i, --interactive` `-p, --project` | `rules rm react --store` |
| `create <name>` | `c` | Create rule template | `-p, --project` | `rules c use-pnpm --project` |
| `install [name]` | `i` | Download rules from remote | `-s, --source` `-p, --project` `-f, --force` | `rules i react --source owner/repo` |
| `init` | `init` | Initialize config and store | `-p, --project` `-g, --global` | `rules init --project` |

## Remove Behavior

| Scenario | Command | Description |
| --- | --- | --- |
| Remove applied rule (global default) | `rules remove <name>` | Remove from agent targets |
| Remove applied rule in project scope | `rules remove <name> --project` | Project scope only |
| Remove from store | `rules remove <name> --store` | Delete rule directory in store |
| Interactive remove | `rules remove -i` | Dropdown multi-select, default shows all candidates: project/global + applied/store |

## Supported Agents

| Agent | Rule mode |
| --- | --- |
| Cursor | directory (symlink) |
| Trae | directory (symlink) |
| Kiro | directory (symlink) |
| Claude Code | single-file (injected) |
| Codex / OpenAI | single-file (injected) |
| Gemini CLI | single-file (injected) |
| Antigravity | single-file (injected) |
| Windsurf | single-file (injected) |
| Cline / Roo Code | single-file (injected) |
| GitHub Copilot | single-file (injected) |
