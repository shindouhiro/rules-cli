# Rules CLI

管理和同步 AI Agent 规则的命令行工具。

## 安装

```bash
pnpm add -g @shindou/rules-cli
```

## 快速开始

1. 初始化配置

```bash
rules init
```

2. 创建规则（默认全局）

```bash
rules create use-chinese
```

3. 应用规则到 Agent

```bash
rules apply use-chinese
```

4. 查看已应用规则

```bash
rules list
```

## 作用域规则

- `create/install/apply/remove/init` 默认作用域是全局
- 传 `--project` 使用项目作用域
- `list` 默认同时显示项目和全局

## 远程规则

配置 `.rulesrc`：

```json
{
  "defaultAgents": ["claude-code"],
  "scope": "global",
  "sources": [
    { "repo": "owner/repo", "subPath": "rules" }
  ]
}
```

搜索并安装：

```bash
rules search react --remote
rules install react
```

`install` 成功后会自动进入 `rules a` 选择 Agent 并应用规则。

## 常用命令

```bash
# 初始化
rules init
rules init --project

# 创建
rules create <name>
rules create <name> --project

# 搜索
rules search
rules search <keyword>
rules search <keyword> --remote

# 安装
rules install <name>
rules install <name> --project
rules install <name> --source owner/repo
rules install <name> --force

# 应用
rules apply
rules apply <name>
rules apply <name> --agent cursor,claude-code
rules apply <name> --project
rules apply <name> --force

# 列表
rules list
rules list --project
rules list --global
rules list --store

# 删除
rules remove <name>
rules remove <name> --project
rules remove <name> --store
rules remove -i
```

## 删除规则说明

- 默认 `rules remove <name>`：删除已应用规则（默认全局）
- `rules remove <name> --store`：删除 store 内规则目录
- `rules remove -i`：交互下拉多选，默认展示 project/global + applied/store 全部候选

## 支持的 Agent

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
