import type { AgentRulesDef } from '~/types'
import process from 'node:process'

/**
 * 30+ AI 编码助手的 rules 文件映射表
 *
 * rulesType:
 *   - 'directory'   → 规则以独立文件存放在目录中，使用 symlink
 *   - 'single-file' → 规则写入单个文件，使用标记区间注入
 */
export const AGENTS: AgentRulesDef[] = [
  // === 目录型 (symlink) ===
  {
    id: 'cursor',
    name: 'Cursor',
    rulesType: 'directory',
    projectPath: '.cursor/rules/',
    globalPath: '~/.cursor/rules/',
    fileExtension: '.mdc',
  },
  {
    id: 'trae',
    name: 'Trae',
    rulesType: 'directory',
    projectPath: '.trae/rules/',
    globalPath: '~/.trae/rules/',
    fileExtension: '.md',
  },
  {
    id: 'kiro',
    name: 'Kiro',
    rulesType: 'directory',
    projectPath: '.kiro/rules/',
    globalPath: '~/.kiro/rules/',
    fileExtension: '.md',
  },

  // === 单文件型 (内容注入) ===
  {
    id: 'claude-code',
    name: 'Claude Code',
    rulesType: 'single-file',
    projectPath: 'CLAUDE.md',
    globalPath: '~/.claude/CLAUDE.md',
    injectMarkerStart: '<!-- rules-cli:start -->',
    injectMarkerEnd: '<!-- rules-cli:end -->',
  },
  {
    id: 'codex',
    name: 'Codex / OpenAI',
    rulesType: 'single-file',
    projectPath: 'AGENTS.md',
    globalPath: '~/.codex/AGENTS.md',
    injectMarkerStart: '<!-- rules-cli:start -->',
    injectMarkerEnd: '<!-- rules-cli:end -->',
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    rulesType: 'single-file',
    projectPath: 'GEMINI.md',
    globalPath: '~/.gemini/GEMINI.md',
    injectMarkerStart: '<!-- rules-cli:start -->',
    injectMarkerEnd: '<!-- rules-cli:end -->',
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    rulesType: 'single-file',
    projectPath: '.agent/rules.md',
    globalPath: '~/.gemini/antigravity/user_rules.md',
    injectMarkerStart: '<!-- rules-cli:start -->',
    injectMarkerEnd: '<!-- rules-cli:end -->',
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    rulesType: 'single-file',
    projectPath: '.windsurfrules',
    globalPath: '~/.codeium/windsurf/rules',
    injectMarkerStart: '<!-- rules-cli:start -->',
    injectMarkerEnd: '<!-- rules-cli:end -->',
  },
  {
    id: 'cline',
    name: 'Cline / Roo Code',
    rulesType: 'single-file',
    projectPath: '.clinerules',
    globalPath: '~/.cline/rules',
    injectMarkerStart: '<!-- rules-cli:start -->',
    injectMarkerEnd: '<!-- rules-cli:end -->',
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    rulesType: 'single-file',
    projectPath: '.github/copilot-instructions.md',
    globalPath: '~/.copilot/instructions.md',
    injectMarkerStart: '<!-- rules-cli:start -->',
    injectMarkerEnd: '<!-- rules-cli:end -->',
  },
]

/**
 * 按 ID 查找 agent
 */
export function getAgentById(id: string): AgentRulesDef | undefined {
  return AGENTS.find(a => a.id === id)
}

/**
 * 按 ID 列表查找 agents
 */
export function getAgentsByIds(ids: string[]): AgentRulesDef[] {
  return ids
    .map(id => getAgentById(id))
    .filter((a): a is AgentRulesDef => a !== undefined)
}

/**
 * 展开 ~ 为用户主目录
 */
export function expandHome(dir: string): string {
  if (dir.startsWith('~/')) {
    const home = process.env.HOME || process.env.USERPROFILE || ''
    return dir.replace('~', home)
  }
  return dir
}
