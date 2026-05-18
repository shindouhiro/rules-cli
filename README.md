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

**Rules CLI** 是一个为多种 AI 编码助手设计的规则管理工具。它可以把同一套 **Rules** 指令集统一存放在本地 store 中，并一键同步到 Cursor、Claude Code、Codex、Gemini CLI、Antigravity 等助手，减少重复维护不同配置文件的成本。

## ✨ 特性

- 🖥️ **沉浸式图形化 Web UI**：内置基于现代化 Vue 3 SFC 与 Tailwind CSS 构筑的 Web 控制台 (`rules ui`)，支持零配置服务拉起与系统默认浏览器自启交互管理。
- 🚀 **一键创建与应用**：快速创建规则模板，并应用到指定 AI 助手。
- 📦 **多助手适配**：支持目录型规则和单文件注入型规则两种模式。
- 🗺️ **地图式规则入口**：单文件型助手只写入精简入口地图，详细内容同步到 `docs/` 等引用目录。
- 🔗 **智能共享**：目录型助手默认使用符号链接（Symlink），一份规则多处共享。
- 🔍 **远程搜索与下载**：支持 GitHub `owner/repo`、任意 Git URL 规则源，也支持从 [cursor.directory](https://cursor.directory/) 搜索和下载规则。
- ☁️ **远程仓库发布**：支持将本地 store 中的规则发布到 GitHub、GitLab、Gitee 或自建 Git 仓库，并保留远程仓库内其他文件。
- 🧭 **作用域清晰**：支持项目级和全局级 store / applied rules。
- 🧾 **手写规则可见**：`rules list` 会显示已有的手写单文件规则，并标记为 manual。
- 🗑️ **交互式移除**：支持从已应用规则或 store 中交互式选择并删除；引用文件删除后会自动清理空目录。
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

同时搜索远程源：

```bash
rules search react --remote
```

搜索 [cursor.directory](https://cursor.directory/)：

```bash
rules search angular --cursor
```

### 5. 下载远程规则

从 `.rulesrc` 配置的 sources 下载：

```bash
rules install react
rules i react --project
```

从 `cursor.directory` 下载：

```bash
rules install angular-cursor-rules --cursor
rules i nextjs-react-typescript-cursor-rules --source cursor.directory
```

也可以不带 `--cursor`。当配置的 sources 找不到规则时，CLI 会自动尝试从 `cursor.directory` 下载同名规则。

从任意 Git 仓库下载：

```bash
rules install vue --source git@github.com:owner/rules.git
rules install react --source https://gitlab.com/owner/rules.git --project
```

### 6. 发布本地规则到远程仓库

发布当前作用域 store 中的全部规则：

```bash
rules publish --repo git@github.com:owner/rules.git --branch main --path rules
rules publish --source team-rules --message "chore: sync rules"
```

仅预检发布计划，不提交、不推送：

```bash
rules publish --repo git@github.com:owner/rules.git --dry-run
```

### 7. 查看规则

```bash
rules list
rules ls --global
rules ls --store
```

`rules list` 会展示已应用规则；对于 `~/.gemini/GEMINI.md`、`~/.codex/AGENTS.md` 这类已有但不是由 `rules-cli` 注入的手写规则，会显示为：

```text
📄 GEMINI.md — 语言要求 所有回复、思考过程及任务清单，均须使用中文 (manual, not managed by rules-cli)
```

### 8. 移除规则

```bash
rules remove use-chinese
rules rm use-chinese --store
rules rm -i
rules rm -i --store --global
```

### 9. 图形化 Web UI 沉浸式管理控制台

通过单条终端指令即可拉起全链条组件化架构的现代化控制台，并在默认浏览器中实现自启：

```bash
rules ui
rules ui --port 8080
```

- **全域 Store 融合接驳**：同屏呈现全局与当前项目独立规则空间。
- **作用域双向链路同步下发**：支持将跨域单据一键绑定挂载至指定助手通道的项目或全局环境。
- **高保真即时落盘源码编辑器**：支持在线实时修改 `rule.md` 主体结构及 Frontmatter 并自动回写磁盘。
- **规则库批量选择**：本地规则库支持筛选后全选、清空选择、多助手批量下发，并使用项目/全局规则路径精确匹配。
- **远程仓库管理**：支持保存 Git 仓库地址、分支和目录；进入页面或切换仓库时自动读取远程 rules，并使用 24 小时本地缓存加速重复加载。
- **远程发布与删除**：支持从 UI 上传本地规则到远程 Git 仓库、读取远程 rules、下载到本地和删除远程规则；删除类操作均需要二次确认。
- **Icon 化操作控件**：关键操作统一使用图标按钮，并提供悬停提示与 `aria-label`。
- **映射嗅探与批量解绑**：直观展示已生效的软链接与注入配置，支持多选解绑，解绑时同步清理 agent 入口和引用文件。
- **组件化二次确认**：删除 store 规则、单条解绑、批量解绑均使用内置确认弹窗，不依赖浏览器原生确认框。

## 🛠️ 指令一览

| 指令 | 别名 | 描述 | 常用选项 |
| :--- | :--- | :--- | :--- |
| `ui` | - | 启动沉浸式 Web 图形化管理控制台服务 | `--port <number>`: 指定本地服务监听端口 |
| `search [keyword]` | `s` | 搜索本地、Git 远程源或 cursor.directory 规则 | `-r, --remote`: 搜索远程源<br>`-c, --cursor`: 搜索 cursor.directory |
| `install [name]` | `i` | 从远程源下载规则到本地 store，并进入应用流程 | `-s, --source <repo-or-url>`: 指定 GitHub `owner/repo`、Git URL 或 cursor.directory<br>`-c, --cursor`: 从 cursor.directory 下载<br>`-g, --global`: 下载到全局 store<br>`-p, --project`: 下载到项目 store<br>`-f, --force`: 覆盖已存在规则 |
| `publish` | - | 发布本地 store 规则到远程 Git 仓库 | `--repo <git-url>`: 指定远程仓库<br>`-s, --source <source>`: 使用 `.rulesrc` source 名称、key 或 URL<br>`-b, --branch <branch>`: 目标分支<br>`--path <dir>`: 仓库内目标目录<br>`-m, --message <message>`: 提交信息<br>`--dry-run`: 只预检 |
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
      "name": "github-rules",
      "repo": "owner/rules-repo",
      "subPath": "rules"
    },
    {
      "type": "git",
      "name": "team-rules",
      "url": "git@github.com:owner/rules.git",
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
| `sources` | 远程规则源列表；兼容 GitHub `repo` 配置，也支持 `type: "git"` + `url` |

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
referencesDir: docs
references: []
---

所有回复、思考过程及任务清单，均须使用中文。
```

### 地图式引用管理

一条规则可以只把主规则文件作为入口地图，并把详细说明拆到同一规则目录下的引用文件中：

```text
.rules/store/agent-map/
├── rule.md
└── docs/
    ├── architecture.md
    ├── development.md
    └── design-docs/
        └── ref-cli.md
```

在 `rule.md` frontmatter 中声明引用文件：

```md
---
name: agent-map
description: AGENTS.md 地图入口
tags: [agent]
referencesDir: docs
references:
  - path: docs/architecture.md
    title: 分层架构详细说明
  - path: docs/development.md
    title: 开发环境搭建
  - path: docs/design-docs/ref-*.md
    title: 参考项目架构说明
---

# AGENTS.md

- [架构说明](./docs/architecture.md)
- [开发环境](./docs/development.md)
- [参考架构](./docs/design-docs/ref-cli.md)
```

执行 `rules apply agent-map --agent codex --project` 后，`AGENTS.md` 会写入入口地图，引用文件会同步到目标规则文件所在目录的相对路径下。

单文件型助手的注入区会保持精简，例如：

```md
<!-- rules-cli:start -->
## agent-map
- [架构说明](./docs/architecture.md)
- [开发环境](./docs/development.md)
<!-- rules-cli:end -->
```

`rules-cli:start/end` 是用于可靠增删托管区的边界标记；每条规则不再额外写入 `<!-- rule: ... -->` 包裹。

如果规则没有声明 `references`，单文件型助手也会自动采用引用模式：入口文件只写入 `docs/<rule>.md` 链接，原规则正文会落盘到目标项目的 `docs/<rule>.md`，避免把长正文全部写进 `AGENTS.md` / `CLAUDE.md` / `GEMINI.md`。

移除规则时，rules-cli 只会删除内容仍与 store 源文件一致的引用文件；如果你手动改过目标文件，会保留它以避免误删。引用文件删除后会继续清理空目录，例如 `docs/design-docs/` 为空时会删除该目录；如果 `docs/` 也为空，会一并删除。

`referencesDir` 用于设置引用文件在目标项目中的统一落盘目录，默认值为 `docs`。设置为 `ai-rules` 等目录时，引用文件会写入对应目录下，地图链接也会指向该目录。如果源文件路径本身已经以 `docs/` 开头，切换目录时会去掉这层源目录前缀，例如 `docs/architecture.md` 会落到 `ai-rules/architecture.md`。

## 📄 开源协议

基于 [MIT](./LICENSE) 协议开源。
