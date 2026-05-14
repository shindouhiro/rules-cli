import type { AgentRulesDef, RuleInfo } from '~/types'
import { existsSync, mkdirSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import process from 'node:process'
import { resolveAgentPath } from '~/core/agents'
import { applyRuleReferences, removeRuleReferences } from '~/core/references'

/**
 * 为目录型 agent 创建 symlink
 */
export function linkRuleToDirectoryAgent(
  rule: RuleInfo,
  agent: AgentRulesDef,
  options: { global: boolean, cwd: string, force?: boolean },
): { targetPath: string, success: boolean, error?: string } {
  const ext = agent.fileExtension || '.md'
  const baseDir = resolveAgentPath(agent, options)

  const targetFile = join(baseDir, `${rule.name}${ext}`)
  const sourceFile = rule.path

  if (!existsSync(sourceFile)) {
    return { targetPath: targetFile, success: false, error: '规则源文件不存在' }
  }

  if (existsSync(targetFile) && !options.force) {
    return { targetPath: targetFile, success: false, error: '已存在（使用 --force 覆盖）' }
  }

  try {
    mkdirSync(baseDir, { recursive: true })

    // 删除已有文件
    if (existsSync(targetFile)) {
      unlinkSync(targetFile)
    }

    // 创建相对路径 symlink
    const relPath = process.platform === 'win32'
      ? sourceFile
      : relative(dirname(targetFile), sourceFile)

    symlinkSync(
      relPath,
      targetFile,
      process.platform === 'win32' ? 'junction' : 'file',
    )

    applyRuleReferences(rule, join(baseDir, rule.name))

    return { targetPath: targetFile, success: true }
  }
  catch (err) {
    return {
      targetPath: targetFile,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 为单文件型 agent 注入规则内容
 */
export function injectRuleToSingleFileAgent(
  rule: RuleInfo,
  agent: AgentRulesDef,
  options: { global: boolean, cwd: string, force?: boolean },
): { targetPath: string, success: boolean, error?: string } {
  const targetFile = resolveAgentPath(agent, options)
  const ruleForApply = toSingleFileReferenceRule(rule)

  const markerStart = agent.injectMarkerStart || '<!-- rules-cli:start -->'
  const markerEnd = agent.injectMarkerEnd || '<!-- rules-cli:end -->'

  try {
    mkdirSync(dirname(targetFile), { recursive: true })

    let existing = ''
    if (existsSync(targetFile)) {
      existing = readFileSync(targetFile, 'utf-8')
    }

    const ruleBlock = createRuleBlock(ruleForApply.name, ruleForApply.content)
    const fullBlock = [markerStart, ruleBlock, markerEnd].join('\n')

    let newContent: string

    // 检查是否已有标记区间
    const markerRegex = new RegExp(
      `${escapeRegex(markerStart)}[\\s\\S]*?${escapeRegex(markerEnd)}`,
    )

    if (markerRegex.test(existing)) {
      // 已有标记区间 → 在区间内追加或替换
      const ruleRegex = createManagedRuleRegex(ruleForApply.name, markerEnd)

      if (ruleRegex.test(existing)) {
        if (!options.force) {
          return { targetPath: targetFile, success: false, error: '规则已注入（使用 --force 覆盖）' }
        }
        newContent = existing.replace(ruleRegex, ruleBlock)
      }
      else {
        newContent = existing.replace(
          markerRegex,
          block => block.replace(markerEnd, `${ruleBlock}\n${markerEnd}`),
        )
      }
    }
    else {
      // 无标记区间 → 追加整个块
      newContent = existing
        ? `${existing.trimEnd()}\n\n${fullBlock}\n`
        : `${fullBlock}\n`
    }

    writeFileSync(targetFile, newContent, 'utf-8')
    applyRuleReferences(ruleForApply, dirname(targetFile))
    return { targetPath: targetFile, success: true }
  }
  catch (err) {
    return {
      targetPath: targetFile,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 从单文件型 agent 中移除规则
 */
export function removeRuleFromSingleFileAgent(
  ruleName: string,
  agent: AgentRulesDef,
  options: { global: boolean, cwd: string, rule?: RuleInfo, targetPath?: string, forceReferences?: boolean },
): { success: boolean, error?: string } {
  const targetFile = options.targetPath || resolveAgentPath(agent, options)

  if (!existsSync(targetFile)) {
    if (options.rule && options.forceReferences) {
      removeRuleReferences(toSingleFileReferenceRule(options.rule), dirname(targetFile), { force: true })
      return { success: true }
    }
    return { success: false, error: '目标文件不存在' }
  }

  try {
    let content = readFileSync(targetFile, 'utf-8')

    const markerEnd = agent.injectMarkerEnd || '<!-- rules-cli:end -->'
    const ruleRegex = createManagedRuleRegex(ruleName, markerEnd)

    if (!ruleRegex.test(content)) {
      if (options.rule && options.forceReferences) {
        removeRuleReferences(toSingleFileReferenceRule(options.rule), dirname(targetFile), { force: true })
        return { success: true }
      }
      return { success: false, error: '规则未找到' }
    }

    content = content.replace(ruleRegex, '\n')

    // 如果标记区间内空了，移除整个区间
    const markerStart = agent.injectMarkerStart || '<!-- rules-cli:start -->'
    const emptyBlockRegex = new RegExp(
      `\n?${escapeRegex(markerStart)}\\s*${escapeRegex(markerEnd)}\n?`,
    )
    content = content.replace(emptyBlockRegex, '')

    writeFileSync(targetFile, content.trim() ? `${content.trim()}\n` : '', 'utf-8')
    if (options.rule)
      removeRuleReferences(toSingleFileReferenceRule(options.rule), dirname(targetFile), { force: options.forceReferences })
    return { success: true }
  }
  catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

function toSingleFileReferenceRule(rule: RuleInfo): RuleInfo {
  if (rule.references?.length)
    return rule

  const targetPath = `docs/${rule.name}.md`
  return {
    ...rule,
    content: `# ${rule.name}\n\n- [${rule.name}.md](./${targetPath})`,
    references: [{
      targetPath,
      title: `${rule.name}.md`,
      content: rule.content,
    }],
  }
}

export function removeRuleReferencesFromDirectoryAgent(
  rule: RuleInfo,
  agent: AgentRulesDef,
  options: { global: boolean, cwd: string, forceReferences?: boolean },
): void {
  const baseDir = resolveAgentPath(agent, options)
  removeRuleReferences(rule, join(baseDir, rule.name), { force: options.forceReferences })
}

export function extractManagedRuleNames(
  content: string,
  markerStart = '<!-- rules-cli:start -->',
  markerEnd = '<!-- rules-cli:end -->',
): string[] {
  const markerRegex = new RegExp(
    `${escapeRegex(markerStart)}([\\s\\S]*?)${escapeRegex(markerEnd)}`,
  )
  const matched = content.match(markerRegex)
  if (!matched)
    return []

  const block = matched[1] || ''
  const names = [
    ...[...block.matchAll(/<!-- rule: (.+?) -->/g)].map(m => m[1]),
    ...block
      .split(/\r?\n/u)
      .filter(line => line.startsWith('## '))
      .map(line => line.slice(3).trim()),
  ]
  return [...new Set(names)]
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function createRuleBlock(ruleName: string, content: string): string {
  const visibleContent = stripLeadingRuleHeading(content, ruleName).trim()
  return [
    `## ${ruleName}`,
    visibleContent,
  ].join('\n')
}

function createManagedRuleRegex(ruleName: string, markerEnd: string): RegExp {
  const escapedName = escapeRegex(ruleName)
  const legacyPattern = `\\n?<!-- rule: ${escapedName} -->[\\s\\S]*?<!-- /rule: ${escapedName} -->\\n?`
  const headingPattern = `\\n?## ${escapedName}\\n[\\s\\S]*?(?=\\n## |\\n${escapeRegex(markerEnd)}|$)\\n?`
  return new RegExp(`${legacyPattern}|${headingPattern}`)
}

function stripLeadingRuleHeading(content: string, ruleName: string): string {
  const lines = content.trim().split(/\r?\n/u)
  if (lines[0]?.trim() === `# ${ruleName}`)
    return lines.slice(1).join('\n').trim()
  return content
}
