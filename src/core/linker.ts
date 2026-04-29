import type { AgentRulesDef, RuleInfo } from '~/types'
import { existsSync, mkdirSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { expandHome } from '~/core/agents'
import { getGlobalStoreDir } from '~/core/store'

/**
 * 为目录型 agent 创建 symlink
 */
export function linkRuleToDirectoryAgent(
  rule: RuleInfo,
  agent: AgentRulesDef,
  options: { global: boolean, cwd: string, force?: boolean },
): { targetPath: string, success: boolean, error?: string } {
  const ext = agent.fileExtension || '.md'
  const baseDir = options.global
    ? expandHome(agent.globalPath)
    : resolve(options.cwd, agent.projectPath)

  const targetFile = join(baseDir, `${rule.name}${ext}`)

  // 源文件：store 中的 rule.md
  const sourceFile = join(getGlobalStoreDir(), rule.name, 'rule.md')

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
  const targetFile = options.global
    ? expandHome(agent.globalPath)
    : resolve(options.cwd, agent.projectPath)

  const markerStart = agent.injectMarkerStart || '<!-- rules-cli:start -->'
  const markerEnd = agent.injectMarkerEnd || '<!-- rules-cli:end -->'

  try {
    mkdirSync(dirname(targetFile), { recursive: true })

    let existing = ''
    if (existsSync(targetFile)) {
      existing = readFileSync(targetFile, 'utf-8')
    }

    // 构建注入块
    const ruleBlock = [
      `${markerStart}`,
      `<!-- rule: ${rule.name} -->`,
      rule.content,
      `<!-- /rule: ${rule.name} -->`,
      `${markerEnd}`,
    ].join('\n')

    let newContent: string

    // 检查是否已有标记区间
    const markerRegex = new RegExp(
      `${escapeRegex(markerStart)}[\\s\\S]*?${escapeRegex(markerEnd)}`,
      'g',
    )

    if (markerRegex.test(existing)) {
      // 已有标记区间 → 在区间内追加或替换
      const ruleRegex = new RegExp(
        `<!-- rule: ${escapeRegex(rule.name)} -->[\\s\\S]*?<!-- /rule: ${escapeRegex(rule.name)} -->`,
      )

      if (ruleRegex.test(existing)) {
        if (!options.force) {
          return { targetPath: targetFile, success: false, error: '规则已注入（使用 --force 覆盖）' }
        }
        // 替换已有规则块
        newContent = existing.replace(ruleRegex, [
          `<!-- rule: ${rule.name} -->`,
          rule.content,
          `<!-- /rule: ${rule.name} -->`,
        ].join('\n'))
      }
      else {
        // 在标记区间结束前追加
        newContent = existing.replace(
          markerEnd,
          `<!-- rule: ${rule.name} -->\n${rule.content}\n<!-- /rule: ${rule.name} -->\n${markerEnd}`,
        )
      }
    }
    else {
      // 无标记区间 → 追加整个块
      newContent = existing
        ? `${existing.trimEnd()}\n\n${ruleBlock}\n`
        : `${ruleBlock}\n`
    }

    writeFileSync(targetFile, newContent, 'utf-8')
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
  options: { global: boolean, cwd: string },
): { success: boolean, error?: string } {
  const targetFile = options.global
    ? expandHome(agent.globalPath)
    : resolve(options.cwd, agent.projectPath)

  if (!existsSync(targetFile)) {
    return { success: false, error: '目标文件不存在' }
  }

  try {
    let content = readFileSync(targetFile, 'utf-8')

    const ruleRegex = new RegExp(
      `\n?<!-- rule: ${escapeRegex(ruleName)} -->[\\s\\S]*?<!-- /rule: ${escapeRegex(ruleName)} -->\n?`,
    )

    if (!ruleRegex.test(content)) {
      return { success: false, error: '规则未找到' }
    }

    content = content.replace(ruleRegex, '\n')

    // 如果标记区间内空了，移除整个区间
    const markerStart = agent.injectMarkerStart || '<!-- rules-cli:start -->'
    const markerEnd = agent.injectMarkerEnd || '<!-- rules-cli:end -->'
    const emptyBlockRegex = new RegExp(
      `\n?${escapeRegex(markerStart)}\\s*${escapeRegex(markerEnd)}\n?`,
    )
    content = content.replace(emptyBlockRegex, '')

    writeFileSync(targetFile, content.trim() ? `${content.trim()}\n` : '', 'utf-8')
    return { success: true }
  }
  catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
