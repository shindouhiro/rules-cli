import type { RuleInfo, RuleMeta } from '~/types'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getGlobalStoreDir } from '~/core/store'

/**
 * 解析 rule.md 的 frontmatter
 */
export function parseRuleMeta(content: string): { meta?: RuleMeta, body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!match)
    return { body: content.trim() }

  const frontmatter = match[1]
  const meta: Record<string, unknown> = {}

  for (const line of frontmatter.split(/\r?\n/u)) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1)
      continue
    const key = line.slice(0, colonIdx).trim()
    const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '')
    meta[key] = value
  }

  let tags: string[] | undefined
  if (typeof meta.tags === 'string') {
    tags = meta.tags.replace(/^\[|\]$/g, '').split(',').map(t => t.trim()).filter(Boolean)
  }

  return {
    meta: {
      name: (meta.name as string) || '',
      description: (meta.description as string) || '',
      tags,
    },
    body: content.slice(match[0].length).trim(),
  }
}

function readRuleFromDir(ruleDir: string, ruleName: string): RuleInfo | undefined {
  const ruleMdPath = join(ruleDir, 'rule.md')
  if (!existsSync(ruleMdPath))
    return undefined

  const raw = readFileSync(ruleMdPath, 'utf-8')
  const { meta, body } = parseRuleMeta(raw)
  return { name: ruleName, path: ruleMdPath, meta, content: body }
}

export function scanStoreRules(): RuleInfo[] {
  const storeDir = getGlobalStoreDir()
  if (!existsSync(storeDir))
    return []

  const rules: RuleInfo[] = []
  for (const entry of readdirSync(storeDir, { withFileTypes: true })) {
    if (!entry.isDirectory())
      continue
    const rule = readRuleFromDir(join(storeDir, entry.name), entry.name)
    if (rule)
      rules.push(rule)
  }
  return rules.sort((a, b) => a.name.localeCompare(b.name))
}

export function searchRules(keyword?: string): RuleInfo[] {
  const all = scanStoreRules()
  if (!keyword)
    return all
  const lower = keyword.toLowerCase()
  return all.filter((rule) => {
    return rule.name.toLowerCase().includes(lower)
      || rule.meta?.description?.toLowerCase().includes(lower)
      || rule.meta?.tags?.some(t => t.toLowerCase().includes(lower))
  })
}

export function getRuleByName(name: string): RuleInfo | undefined {
  const ruleDir = join(getGlobalStoreDir(), name)
  if (!existsSync(ruleDir))
    return undefined
  return readRuleFromDir(ruleDir, name)
}
