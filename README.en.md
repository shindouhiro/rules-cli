# Rules CLI

[English](./README.en.md) | [中文](./README.md)

![Rules CLI Banner](./assets/readme-banner.svg)

A CLI tool to manage and sync AI agent rules. Rules can be stored in project-level `.rules/store` or global `~/.rules/store`, then applied to agents like Cursor, Claude Code, Codex, Gemini CLI, and more.

## Features

- Project store: `.rules/store`
- Global store: `~/.rules/store`
- Local and global search (project rule wins on name collision)
- Remote rule download from GitHub sources
- Directory-based agents via symlink
- Single-file agents via marker-based injection
- Interactive selection for rules and target agents

## Install

Use `pnpm` in development:

```bash
pnpm install
pnpm build
```

Run locally:

```bash
node dist/cli.mjs --help
```

After publishing, use:

```bash
rules --help
```

## Quick Start

Initialize config:

```bash
rules init
```

Create a rule:

```bash
rules create use-chinese
```

By default, rules are written to global store:

```text
~/.rules/store/use-chinese/rule.md
```

Apply rule:

```bash
rules apply use-chinese
```

List applied rules:

```bash
rules list
```

## Rule Stores

Project store:

```text
.rules/store/<rule-name>/rule.md
```

Global store:

```text
~/.rules/store/<rule-name>/rule.md
```

Default scope for `create/install/apply/remove/init` is global. Use `--project` to target project scope.

## Remote Sources

Configure `.rulesrc`:

```json
{
  "defaultAgents": ["claude-code"],
  "scope": "global",
  "sources": [
    { "repo": "continuedev/awesome-rules", "subPath": "rules" },
    { "repo": "steipete/agent-rules", "subPath": "project-rules" },
    { "repo": "steipete/agent-rules", "subPath": "global-rules" }
  ]
}
```

Search remote rules:

```bash
rules search react --remote
```

Install a remote rule (default global store):

```bash
rules install react
```

Install into project store:

```bash
rules install react --project
```

After a successful install, the CLI automatically enters `rules a` flow for agent selection and apply.

## Commands

### init

```bash
rules init
rules init --global
rules init --project
```

### create

```bash
rules create <name>
rules create <name> --global
rules create <name> --project
```

### search

```bash
rules search
rules search <keyword>
rules search <keyword> --remote
```

### install

```bash
rules install <name>
rules install <name> --global
rules install <name> --project
rules install <name> --source owner/repo
rules install <name> --force
```

### apply

```bash
rules apply
rules apply <name>
rules apply <name> --agent cursor,claude-code
rules apply <name> --global
rules apply <name> --project
rules apply <name> --force
```

### list

```bash
rules list
rules list --project
rules list --global
rules list --store
rules list --store --project
rules list --store --global
```

### remove

```bash
rules remove <name>
rules remove <name> --agent claude-code
rules remove <name> --global
rules remove <name> --project
rules remove <name> --store
rules remove <name> --store --project
rules remove -i
```

`-i` shows all removable candidates by default (project/global + applied/store).

## Development

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Tech stack:

- pnpm
- TypeScript
- tsdown
- Vitest
- @antfu/eslint-config
