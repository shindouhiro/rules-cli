/**
 * Rules 同步策略
 */
export type RulesType = 'directory' | 'single-file'

/**
 * Agent 规则定义
 */
export interface AgentRulesDef {
  /** 唯一标识 */
  id: string
  /** 显示名称 */
  name: string
  /** 规则文件类型 */
  rulesType: RulesType
  /** 项目级 rules 路径（相对于项目根） */
  projectPath: string
  /** 全局 rules 路径（绝对路径，~ 表示用户目录） */
  globalPath: string
  /** 目录型 agent 的文件扩展名（如 .mdc） */
  fileExtension?: string
  /** 单文件型注入标记 — 起始 */
  injectMarkerStart?: string
  /** 单文件型注入标记 — 结束 */
  injectMarkerEnd?: string
}

/**
 * 规则元数据（从 rule.md frontmatter 解析）
 */
export interface RuleMeta {
  name: string
  description: string
  icon?: string
  tags?: string[]
  referencesDir?: string
  references?: RuleReference[]
}

/**
 * rule.md frontmatter 中声明的引用文件
 */
export interface RuleReference {
  /** 引用文件相对路径，支持 * glob。如果指定 content，则 path 视为应用时的目标路径 */
  path?: string
  /** 地图入口展示标题 */
  title?: string
  /** 直接生成的引用文件内容 */
  content?: string
}

/**
 * 已解析到具体文件的引用
 */
export interface ResolvedRuleReference {
  /** store 中的源文件绝对路径 */
  sourcePath?: string
  /** 内联生成的引用文件内容 */
  content?: string
  /** 应用到目标目录时使用的相对路径 */
  targetPath: string
  /** 地图入口展示标题 */
  title?: string
}

/**
 * 扫描到的规则信息
 */
export interface RuleInfo {
  /** 规则名称（目录名） */
  name: string
  /** 规则文件路径 */
  path: string
  /** 元数据 */
  meta?: RuleMeta
  /** 规则内容（不含 frontmatter） */
  content: string
  /** 已解析到具体文件的引用文件 */
  references?: ResolvedRuleReference[]
}

/**
 * 带 store 作用域的规则信息
 */
export interface ScopedRuleInfo extends RuleInfo {
  /** 规则所在 store 作用域 */
  scope: 'project' | 'global'
  /** 是否来自全局 store */
  isGlobal: boolean
}

/**
 * 远程规则源定义
 */
export type RemoteSourceType = 'github' | 'git'

export interface RuleSource {
  /** 远程源类型；省略时兼容旧版 GitHub owner/repo 配置 */
  type?: RemoteSourceType
  /** 远程源展示名，可用于 --source 复用配置 */
  name?: string
  /** GitHub 仓库 (owner/repo)，旧版配置继续使用该字段 */
  repo?: string
  /** 通用 Git 仓库 URL，type 为 git 时使用 */
  url?: string
  /** 默认读取或发布分支 */
  branch?: string
  /** 仓库内规则所在子目录 */
  subPath?: string
}

/**
 * 配置文件结构 (.rulesrc)
 */
export interface RulesConfig {
  /** 默认目标 agents */
  defaultAgents: string[]
  /** store 路径（默认项目 .rules/store，全局模式为 ~/.rules/store） */
  storePath?: string
  /** 安装范围 */
  scope: 'project' | 'global'
  /** 远程规则源列表 */
  sources?: RuleSource[]
}
