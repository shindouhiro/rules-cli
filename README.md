# Rules CLI

[中文](./README.md) | [English](./README.en.md)

管理和同步 AI Agent 规则的命令行工具。

## 安装

| 场景 | 命令 |
| --- | --- |
| 全局安装 | `pnpm add -g @shindou/rules-cli` |
| 本地开发安装 | `pnpm install` |

## 快速开始

| 步骤 | 命令 | 说明 |
| --- | --- | --- |
| 1 | `rules init` | 初始化配置 |
| 2 | `rules create use-chinese` | 创建规则（默认全局） |
| 3 | `rules apply use-chinese` | 应用规则到 Agent |
| 4 | `rules list` | 查看已应用规则 |

## 作用域规则

| 命令组 | 默认作用域 | 切换到项目作用域 |
| --- | --- | --- |
| `create/install/apply/remove/init` | 全局 | `--project` |
| `list` | 同时显示项目 + 全局 | `--project` 或 `--global` |

## 远程规则源

`.rulesrc` 示例：

```json
{
  "defaultAgents": ["claude-code"],
  "scope": "global",
  "sources": [
    { "repo": "owner/repo", "subPath": "rules" }
  ]
}
```

| 操作 | 命令 |
| --- | --- |
| 远程搜索 | `rules search react --remote` |
| 安装远程规则（默认全局） | `rules install react` |
| 安装到项目 | `rules install react --project` |

`install` 成功后会自动进入 `rules a` 进行 Agent 选择并应用规则。

## cursor.directory

可直接搜索和下载 [cursor.directory](https://cursor.directory/) 上的规则：

| 操作 | 命令 |
| --- | --- |
| 搜索 cursor.directory | `rules search vue --cursor` |
| 交互选择并下载 | `rules install --cursor` |
| 按 slug 下载 | `rules install vue-best-practices --cursor` |
| 使用 source 指定 | `rules install vue-best-practices --source cursor.directory` |

## 命令总览（含 Alias）

| 主命令 | Alias | 用途 | 常用参数 | 示例 |
| --- | --- | --- | --- | --- |
| `search [keyword]` | `s` | 搜索本地/远程规则 | `-r, --remote` `-c, --cursor` | `rules s react -r` |
| `apply [name]` | `a` | 应用规则到 Agent | `-a, --agent` `-p, --project` `-f, --force` | `rules a react --agent cursor,claude-code` |
| `list` | `ls` | 列出已应用规则或 store 规则 | `-s, --store` `-p, --project` `-g, --global` | `rules ls --store --global` |
| `remove [name]` | `rm`, `delete` | 删除已应用规则或 store 规则 | `-s, --store` `-i, --interactive` `-p, --project` | `rules rm react --store` |
| `create <name>` | `c` | 创建规则模板 | `-p, --project` | `rules c use-pnpm --project` |
| `install [name]` | `i` | 从远程下载规则 | `-s, --source` `-c, --cursor` `-p, --project` `-f, --force` | `rules i react --source owner/repo` |
| `init` | `init` | 初始化配置和 store | `-p, --project` `-g, --global` | `rules init --project` |

## Remove 行为

| 场景 | 命令 | 说明 |
| --- | --- | --- |
| 删除已应用规则（默认全局） | `rules remove <name>` | 删除 Agent 目标中的规则 |
| 删除项目已应用规则 | `rules remove <name> --project` | 仅项目作用域 |
| 删除 store 规则目录 | `rules remove <name> --store` | 删除 store 中该规则目录 |
| 交互删除 | `rules remove -i` | 下拉多选，默认展示 project/global + applied/store 全量候选 |

## 支持的 Agent

| Agent | 规则写入方式 |
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
