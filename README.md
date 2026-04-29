# Rules CLI

管理和同步 AI Agent 规则的命令行工具。规则可以存放在当前项目的 `.rules/store`，也可以放在全局 `~/.rules/store`，再按需应用到 Cursor、Claude Code、Codex、Gemini CLI 等 Agent 的规则文件中。

## 特性

- 支持项目级规则库：`.rules/store`
- 支持全局规则库：`~/.rules/store`
- 项目规则和全局规则会一起搜索，项目同名规则优先
- 支持从 GitHub 远程规则源下载规则
- 支持目录型 Agent 通过 symlink 应用规则
- 支持单文件型 Agent 通过标记区间注入规则
- 支持交互式选择规则和目标 Agent

## 安装

开发环境内使用 pnpm：

```bash
pnpm install
pnpm build
```

本地运行：

```bash
node dist/cli.mjs --help
```

包发布后可通过 `rules` 命令使用：

```bash
rules --help
```

## 快速开始

初始化当前项目配置：

```bash
rules init
```

创建一条规则：

```bash
rules create use-chinese
```

默认会写入全局：

```text
~/.rules/store/use-chinese/rule.md
```

应用规则：

```bash
rules apply use-chinese
```

查看已应用规则：

```bash
rules list
```

## Store 规则库

### 项目规则

项目规则位于当前项目：

```text
.rules/store/<rule-name>/rule.md
```

默认命令使用全局规则库：

```bash
rules create react
rules install react
rules apply react
```

使用项目规则库时显式传 `--project`：

```bash
rules create react --project
rules install react --project
rules apply react --project
```

### 全局规则

全局规则位于：

```text
~/.rules/store/<rule-name>/rule.md
```

全局规则库也可以显式传 `--global`（与默认行为一致）：

```bash
rules create use-pnpm --global
rules install commit --global
```

`search` 默认会同时读取项目和全局规则。若同名，项目规则优先。

## 规则格式

每条规则是一个目录，目录内至少包含 `rule.md`：

```text
.rules/store/use-chinese/
  rule.md
```

`rule.md` 示例：

```markdown
---
name: use-chinese
description: 所有回复使用中文
tags: [language, i18n]
---

# use-chinese

所有回复、思考过程、代码注释及任务清单，均须使用中文。
```

## 远程规则源

`.rulesrc` 中可以配置 GitHub 规则源：

```json
{
  "defaultAgents": ["claude-code"],
  "scope": "global",
  "sources": [
    {
      "repo": "continuedev/awesome-rules",
      "subPath": "rules"
    },
    {
      "repo": "steipete/agent-rules",
      "subPath": "project-rules"
    },
    {
      "repo": "steipete/agent-rules",
      "subPath": "global-rules"
    }
  ]
}
```

搜索远程规则：

```bash
rules search react --remote
```

默认下载远程规则到全局 `~/.rules/store`：

```bash
rules install react
```

下载到项目 `.rules/store`：

```bash
rules install react --project
```

如果没有指定 `--source`，`install` 会按 `.rulesrc.sources` 顺序尝试，直到找到并下载成功。下载成功后会自动进入 `rules a` 选择 Agent 并应用规则。

## 常用命令

### init

初始化配置和 store：

```bash
rules init
rules init --global
rules init --project
```

### create

创建规则模板：

```bash
rules create <name>
rules create <name> --global
rules create <name> --project
```

### search

搜索本地规则：

```bash
rules search
rules search <keyword>
```

同时搜索远程规则：

```bash
rules search <keyword> --remote
```

### install

从远程源下载规则：

```bash
rules install <name>
rules install <name> --global
rules install <name> --project
rules install <name> --source owner/repo
rules install <name> --force
```

### apply

应用规则到 Agent：

```bash
rules apply
rules apply <name>
rules apply <name> --agent cursor,claude-code
rules apply <name> --global
rules apply <name> --project
rules apply <name> --force
```

未传 `--agent` 时会进入交互式 Agent 选择。`.rulesrc.defaultAgents` 只作为默认预选项。

### list

默认查看当前项目和全局已应用规则：

```bash
rules list
```

只看当前项目：

```bash
rules list --project
```

只看全局：

```bash
rules list --global
```

查看 store 规则：

```bash
rules list --store
rules list --store --project
rules list --store --global
```

### remove

移除已应用规则：

```bash
rules remove <name>
rules remove <name> --agent claude-code
rules remove <name> --global
rules remove <name> --project
```

从 store 删除规则目录：

```bash
rules remove <name> --store
rules remove <name> --store --project
```

交互模式（下拉多选）：

```bash
rules remove -i
```

`-i` 默认会展示所有可删除项（项目/全局 + applied/store），可在面板中直接选择删除。

## 支持的 Agent

当前内置 Agent 包括：

- Cursor
- Trae
- Kiro
- Claude Code
- Codex / OpenAI
- Gemini CLI
- Antigravity
- Windsurf
- Cline / Roo Code
- GitHub Copilot

目录型 Agent 会创建 symlink。单文件型 Agent 会在目标文件中注入如下标记区间：

```markdown
<!-- rules-cli:start -->
<!-- rule: use-chinese -->
规则内容
<!-- /rule: use-chinese -->
<!-- rules-cli:end -->
```

## 开发

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

本项目使用：

- pnpm
- TypeScript
- tsdown
- Vitest
- @antfu/eslint-config
