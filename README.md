<p align="right">
  <a href="./README.md">中文</a> | <a href="./README.en.md">English</a>
</p>

# ⚡ Rules CLI (@shindou/rules-cli)

<p align="center">
  <img src="./assets/readme-banner.svg" alt="Rules CLI Banner" width="600" />
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

**Rules CLI** 是一个为多种 AI 编码助手设计的规则管理工具。它可以把同一套 **Rules** 指令集统一存放在本地 store 中，并一键同步到 Cursor、Claude Code、Codex、Gemini CLI、Antigravity 等助手，减少重复维护不同配置文件的成本。

## ✨ 特性

- 🚀 **一键创建与应用**：快速创建规则模板，并应用到指定 AI 助手。
- 📦 **多助手适配**：支持目录型规则和单文件注入型规则两种模式。
- 🔗 **智能共享**：目录型助手默认使用符号链接（Symlink），一份规则多处共享。
- 🔍 **远程搜索与下载**：支持 GitHub 规则源，也支持从 [cursor.directory](https://cursor.directory/) 搜索和下载规则。
- 🧭 **作用域清晰**：支持项目级和全局级 store / applied rules。
- 🧾 **手写规则可见**：`rules list` 会显示已有的手写单文件规则，并标记为 manual。
- 🗑️ **交互式移除**：支持从已应用规则或 store 中交互式选择并删除。
- 🛠️ **高度可配置**：支持 `.rulesrc` 配置默认 agents、scope 和远程 sources。

## 🚀 安装

推荐使用 `pnpm` 进行全局安装：

```bash
pnpm add -g @shindou/rules-cli
```

本地开发：

```bash
pnpm install
pnpm build
```

安装完成后，通过 `rules` 命令调用。

## 💡 快速上手

### 1. 初始化配置

```bash
rules init
rules init --project
```

### 2. 创建规则

```bash
rules create use-chinese
rules c use-pnpm --project
```

### 3. 应用规则到助手

```bash
rules apply use-chinese
rules a use-chinese --agent cursor,claude-code
rules a use-chinese --project
```

### 4. 搜索规则

搜索本地 store：

```bash
rules search vue
```

同时搜索 GitHub 远程源：

```bash
rules search react --remote
```

搜索 [cursor.directory](https://cursor.directory/)：

```bash
rules search angular --cursor
```

### 5. 下载远程规则

从 `.rulesrc` 配置的 GitHub sources 下载：

```bash
rules install react
rules i react --project
```

从 `cursor.directory` 下载：

```bash
rules install angular-cursor-rules --cursor
rules i nextjs-react-typescript-cursor-rules --source cursor.directory
```

也可以不带 `--cursor`。当配置的 GitHub sources 找不到规则时，CLI 会自动尝试从 `cursor.directory` 下载同名规则。

### 6. 查看规则

```bash
rules list
rules ls --global
rules ls --store
```

`rules list` 会展示已应用规则；对于 `~/.gemini/GEMINI.md`、`~/.codex/AGENTS.md` 这类已有但不是由 `rules-cli` 注入的手写规则，会显示为：

```text
📄 GEMINI.md — 语言要求 所有回复、思考过程及任务清单，均须使用中文 (manual, not managed by rules-cli)
```

### 7. 移除规则

```bash
rules remove use-chinese
rules rm use-chinese --store
rules rm -i
rules rm -i --store --global
```

## 🛠️ 指令一览

| 指令 | 别名 | 描述 | 常用选项 |
| :--- | :--- | :--- | :--- |
| `search [keyword]` | `s` | 搜索本地、GitHub 远程源或 cursor.directory 规则 | `-r, --remote`: 搜索远程源<br>`-c, --cursor`: 搜索 cursor.directory |
| `install [name]` | `i` | 从远程源下载规则到本地 store，并进入应用流程 | `-s, --source <repo>`: 指定 GitHub 仓库或 cursor.directory<br>`-c, --cursor`: 从 cursor.directory 下载<br>`-g, --global`: 下载到全局 store<br>`-p, --project`: 下载到项目 store<br>`-f, --force`: 覆盖已存在规则 |
| `apply [name]` | `a` | 将 store 中的规则应用到 AI 助手 | `-a, --agent <agents>`: 指定目标助手<br>`-g, --global`: 应用到全局目录<br>`-p, --project`: 应用到项目目录<br>`-f, --force`: 强制覆盖 |
| `list` | `ls` | 列出已应用规则或 store 规则 | `-s, --store`: 查看 store<br>`-g, --global`: 只看全局<br>`-p, --project`: 只看项目 |
| `remove [name]` | `rm`, `delete` | 移除已应用规则或删除 store 规则 | `-a, --agent <agents>`: 指定助手<br>`-s, --store`: 从 store 删除<br>`-i, --interactive`: 交互式选择<br>`-g, --global`: 全局作用域<br>`-p, --project`: 项目作用域 |
| `create <name>` | `c` | 创建规则模板 | `-g, --global`: 创建到全局 store<br>`-p, --project`: 创建到项目 store |
| `init` | - | 初始化配置和存储目录 | `-g, --global`: 初始化全局配置<br>`-p, --project`: 初始化项目配置 |

## 📂 支持的 AI 助手

| 助手名称 | ID | 规则写入方式 |
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

## ⚙️ 配置 (.rulesrc)

你可以通过 `rules init` 创建配置文件。

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

### 字段说明

| 字段 | 说明 |
| :--- | :--- |
| `defaultAgents` | 默认应用到哪些 AI 助手 |
| `scope` | 默认作用域，支持 `project` 或 `global` |
| `storePath` | 自定义 store 路径，可选 |
| `sources` | GitHub 远程规则源列表 |

## 📌 作用域规则

| 命令组 | 默认作用域 | 切换到项目作用域 |
| :--- | :--- | :--- |
| `create` / `install` / `apply` / `remove` / `init` | 全局 | `--project` |
| `list` | 同时显示项目 + 全局 | `--project` 或 `--global` |

## 🧩 规则文件结构

本地 store 中每条规则是一个目录，核心文件为 `rule.md`：

```text
.rules/store/
└── use-chinese/
    └── rule.md
```

推荐在 `rule.md` 顶部写入 frontmatter：

```md
---
name: use-chinese
description: 所有回复均须使用中文
tags: [language, i18n]
---

所有回复、思考过程及任务清单，均须使用中文。
```


## 📄 开源协议

基于 [MIT](./LICENSE) 协议开源。
