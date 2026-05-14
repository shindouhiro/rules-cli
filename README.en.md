<p align="right">
  <a href="./README.md">中文</a> | <a href="./README.en.md">English</a>
</p>

# ⚡ Rules CLI (@shindou/rules-cli)

<p align="center">
  <img src="https://raw.githubusercontent.com/shindouhiro/rules-cli/master/assets/readme-banner.svg" alt="Rules CLI Banner" width="600" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@shindou/rules-cli">
    <img src="https://img.shields.io/npm/v/@shindou/rules-cli?color=a1b858&label=npm" alt="npm version" />
  </a>
  <a href="https://github.com/shindouhiro/rules-cli/actions/workflows/publish-preview.yml">
    <img src="https://github.com/shindouhiro/rules-cli/actions/workflows/publish-preview.yml/badge.svg" alt="Publish Preview" />
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" />
  </a>
</p>

---

**Rules CLI** is a rules management tool for AI coding assistants. It keeps your **Rules** instruction sets in one local store and syncs them into assistants like Cursor, Claude Code, Codex, Gemini CLI, and Antigravity, so you do not need to maintain the same guidance across many different config files by hand.

## ✨ Features

- 🖥️ **Immersive Web Dashboard**: built-in modern Web UI (`rules ui`) powered by Vue 3 SFC and Tailwind CSS, supporting zero-config launch and system default browser integration.
- 🚀 **Create and apply in one flow**: create rule templates and apply them to selected AI assistants.
- 📦 **Multi-assistant support**: supports both directory-based rules and single-file injected rules.
- 🔗 **Shared by design**: directory-based assistants use symlinks by default, so one rule can be reused across multiple targets.
- 🔍 **Remote search and download**: supports GitHub rule sources and [cursor.directory](https://cursor.directory/) search/download.
- 🧭 **Clear scopes**: supports both project-level and global store / applied rules.
- 🧾 **Manual rules are visible**: `rules list` also shows existing handwritten single-file rules and marks them as manual.
- 🗑️ **Interactive removal**: remove applied rules or store rules through an interactive selector.
- 🛠️ **Configurable**: use `.rulesrc` to configure default agents, scope, and remote sources.

## 🚀 Installation

Install globally with `pnpm`:

```bash
pnpm add -g @shindou/rules-cli
```

Local development:

```bash
pnpm install
pnpm build
```

After installation, use the `rules` command.

## 💡 Quick Start

### 1. Initialize Config

```bash
rules init
rules init --project
```

### 2. Create a Rule

```bash
rules create use-chinese
rules c use-pnpm --project
```

### 3. Apply Rules to Assistants

```bash
rules apply use-chinese
rules a use-chinese --agent cursor,claude-code
rules a use-chinese --project
```

### 4. Search Rules

Search the local store:

```bash
rules search vue
```

Search configured GitHub remote sources:

```bash
rules search react --remote
```

Search [cursor.directory](https://cursor.directory/):

```bash
rules search angular --cursor
```

### 5. Download Remote Rules

Download from GitHub sources configured in `.rulesrc`:

```bash
rules install react
rules i react --project
```

Download from `cursor.directory`:

```bash
rules install angular-cursor-rules --cursor
rules i nextjs-react-typescript-cursor-rules --source cursor.directory
```

You can also omit `--cursor`. If configured GitHub sources cannot find the rule, the CLI will automatically try downloading a matching rule from `cursor.directory`.

### 6. List Rules

```bash
rules list
rules ls --global
rules ls --store
```

`rules list` shows applied rules. Existing handwritten single-file rules, such as `~/.gemini/GEMINI.md` or `~/.codex/AGENTS.md`, are shown even when they were not injected by `rules-cli`:

```text
📄 GEMINI.md — Reply, reasoning, and task lists must use Chinese (manual, not managed by rules-cli)
```

### 7. Remove Rules

```bash
rules remove use-chinese
rules rm use-chinese --store
rules rm -i
rules rm -i --store --global
```

### 8. Immersive Web Dashboard

Launch a fully componentized modern Web UI dashboard with a single command, supporting automatic open in your default browser:

```bash
rules ui
rules ui --port 8080
```

- **Unified Store View**: displays global and local project rule stores side by side.
- **Bi-directional Scope Sync**: multi-select and distribute rules instantly to project or global targets.
- **High-Fidelity Real-time Editor**: live editing drawer for `rule.md` source and frontmatter with direct disk saving.
- **Mapping Tracker**: visualizes active symlinks/injections and provides single-click unbinding support.

## 🛠️ Command Reference

| Command | Alias | Description | Common options |
| :--- | :--- | :--- | :--- |
| `ui` | - | Launch the immersive Web UI management dashboard service | `--port <number>`: specify local listening port |
| `search [keyword]` | `s` | Search local rules, GitHub remote sources, or cursor.directory rules | `-r, --remote`: search remote sources<br>`-c, --cursor`: search cursor.directory |
| `install [name]` | `i` | Download a remote rule into the local store and enter the apply flow | `-s, --source <repo>`: GitHub repo or cursor.directory<br>`-c, --cursor`: download from cursor.directory<br>`-g, --global`: download to global store<br>`-p, --project`: download to project store<br>`-f, --force`: overwrite existing rule |
| `apply [name]` | `a` | Apply store rules to AI assistants | `-a, --agent <agents>`: target agents<br>`-g, --global`: apply to global targets<br>`-p, --project`: apply to project targets<br>`-f, --force`: force overwrite |
| `list` | `ls` | List applied rules or store rules | `-s, --store`: list store rules<br>`-g, --global`: global only<br>`-p, --project`: project only |
| `remove [name]` | `rm`, `delete` | Remove applied rules or delete store rules | `-a, --agent <agents>`: target agents<br>`-s, --store`: delete from store<br>`-i, --interactive`: choose interactively<br>`-g, --global`: global scope<br>`-p, --project`: project scope |
| `create <name>` | `c` | Create a rule template | `-g, --global`: create in global store<br>`-p, --project`: create in project store |
| `init` | - | Initialize config and storage directories | `-g, --global`: initialize global config<br>`-p, --project`: initialize project config |

## 📂 Supported AI Assistants

| Assistant | ID | Rule mode |
| :--- | :--- | :--- |
| Cursor | `cursor` | directory (symlink) |
| Trae | `trae` | directory (symlink) |
| Kiro | `kiro` | directory (symlink) |
| Claude Code | `claude-code` | single-file (injected) |
| Codex / OpenAI | `codex` | single-file (injected) |
| Gemini CLI | `gemini-cli` | single-file (injected) |
| Antigravity | `antigravity` | single-file (injected) |
| Windsurf | `windsurf` | single-file (injected) |
| Cline / Roo Code | `cline` | single-file (injected) |
| GitHub Copilot | `github-copilot` | single-file (injected) |

## ⚙️ Configuration (.rulesrc)

Create a config file with `rules init`.

```json
{
  "defaultAgents": ["cursor", "claude-code"],
  "scope": "global",
  "sources": [
    {
      "repo": "owner/rules-repo",
      "subPath": "rules"
    }
  ]
}
```

### Fields

| Field | Description |
| :--- | :--- |
| `defaultAgents` | AI assistants to apply rules to by default |
| `scope` | Default scope, either `project` or `global` |
| `storePath` | Optional custom store path |
| `sources` | GitHub remote rule source list |

## 📌 Scope Rules

| Command group | Default scope | Switch to project scope |
| :--- | :--- | :--- |
| `create` / `install` / `apply` / `remove` / `init` | Global | `--project` |
| `list` | Project + Global | `--project` or `--global` |

## 🧩 Rule File Structure

Each local store rule is a directory with `rule.md` as the main file:

```text
.rules/store/
└── use-chinese/
    └── rule.md
```

Recommended `rule.md` frontmatter:

```md
---
name: use-chinese
description: Always reply in Chinese
tags: [language, i18n]
referencesDir: docs
references: []
---

All replies, reasoning, and task lists must use Chinese.
```

### Map-style References

A rule can use `rule.md` as the entry map and keep detailed guidance in referenced files under the same rule directory:

```text
.rules/store/agent-map/
├── rule.md
└── docs/
    ├── architecture.md
    ├── development.md
    └── design-docs/
        └── ref-cli.md
```

Declare referenced files in the `rule.md` frontmatter:

```md
---
name: agent-map
description: AGENTS.md entry map
tags: [agent]
referencesDir: docs
references:
  - path: docs/architecture.md
    title: Layered architecture
  - path: docs/development.md
    title: Development setup
  - path: docs/design-docs/ref-*.md
    title: Reference architecture notes
---

# AGENTS.md

- [Architecture](./docs/architecture.md)
- [Development](./docs/development.md)
- [Reference](./docs/design-docs/ref-cli.md)
```

After `rules apply agent-map --agent codex --project`, `AGENTS.md` receives the entry map and the referenced files are copied relative to the target rule file. When removing the rule, rules-cli only deletes referenced files whose content still matches the store source; files changed by hand are preserved.

`referencesDir` controls the target directory for referenced files and defaults to `docs`. When set to `ai-rules` or another safe relative directory, referenced files are written under that directory and map links point there. If a source path already starts with `docs/`, that source prefix is stripped when switching directories, so `docs/architecture.md` becomes `ai-rules/architecture.md`.

## 🛠️ Development

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## 📄 License

Released under the [MIT](./LICENSE) License.
