import type { ResolvedRuleReference, RuleInfo, RuleMeta, ScopedRuleInfo } from '~/types'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { extname, join, relative, sep } from 'node:path'
import process from 'node:process'
import { parseReferences, resolveRuleReferences, toTargetPath } from '~/core/references'
import { getGlobalStoreDir, getProjectStoreDir } from '~/core/store'

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
  const references = parseReferences(frontmatter)

  return {
    meta: {
      name: (meta.name as string) || '',
      description: (meta.description as string) || '',
      icon: meta.icon as string | undefined,
      tags,
      referencesDir: meta.referencesDir as string | undefined,
      references,
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
  const referencesDir = meta?.referencesDir || 'docs'
  let references = resolveRuleReferences(ruleDir, meta?.references, referencesDir)
  let content = body

  if (!references && !meta?.references) {
    references = inferLegacyReferences(ruleDir, referencesDir)
    if (references)
      content = renderReferenceMap(ruleName, references)
  }

  return { name: ruleName, path: ruleMdPath, meta, content, references }
}

function inferLegacyReferences(ruleDir: string, referencesDir?: string): ResolvedRuleReference[] | undefined {
  const references = walkRuleFiles(ruleDir)
    .map((sourcePath) => {
      const sourceRelativePath = relative(ruleDir, sourcePath).split(sep).join('/')
      const targetPath = toTargetPath(sourceRelativePath, referencesDir)
      return {
        sourcePath,
        targetPath,
        title: sourceRelativePath,
      }
    })
    .sort((a, b) => a.targetPath.localeCompare(b.targetPath))

  return references.length > 0 ? references : undefined
}

function walkRuleFiles(dir: string, root = dir): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkRuleFiles(fullPath, root))
      continue
    }

    if (!entry.isFile())
      continue

    const relPath = relative(root, fullPath).split(sep).join('/')
    if (relPath === 'rule.md')
      continue

    const ext = extname(entry.name).toLowerCase()
    if (ext === '.md' || ext === '.mdc')
      files.push(fullPath)
  }
  return files
}

function renderReferenceMap(ruleName: string, references: ResolvedRuleReference[]): string {
  const links = references
    .map(reference => `- [${reference.title || reference.targetPath}](./${reference.targetPath})`)
    .join('\n')
  return `# ${ruleName}\n\n${links}`
}

function scanSingleStore(storeDir: string): RuleInfo[] {
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

export function scanStoreRules(options: { cwd?: string, global?: boolean } = {}): RuleInfo[] {
  const cwd = options.cwd || process.cwd()
  if (options.global === true)
    return scanSingleStore(getGlobalStoreDir())
  if (options.global === false)
    return scanSingleStore(getProjectStoreDir(cwd))

  const byName = new Map<string, RuleInfo>()
  for (const rule of scanSingleStore(getProjectStoreDir(cwd))) {
    byName.set(rule.name, rule)
  }
  for (const rule of scanSingleStore(getGlobalStoreDir())) {
    if (!byName.has(rule.name))
      byName.set(rule.name, rule)
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function scanStoreRuleEntries(options: { cwd?: string, global?: boolean, projectStoreDir?: string, globalStoreDir?: string } = {}): ScopedRuleInfo[] {
  const cwd = options.cwd || process.cwd()
  const projectStoreDir = options.projectStoreDir || getProjectStoreDir(cwd)
  const globalStoreDir = options.globalStoreDir || getGlobalStoreDir()
  const entries: ScopedRuleInfo[] = []

  if (options.global !== true) {
    entries.push(...scanSingleStore(projectStoreDir).map(rule => ({
      ...rule,
      scope: 'project' as const,
      isGlobal: false,
    })))
  }

  if (options.global !== false) {
    entries.push(...scanSingleStore(globalStoreDir).map(rule => ({
      ...rule,
      scope: 'global' as const,
      isGlobal: true,
    })))
  }

  return entries.sort((a, b) => {
    const nameSort = a.name.localeCompare(b.name)
    if (nameSort !== 0)
      return nameSort
    if (a.scope === b.scope)
      return 0
    return a.scope === 'project' ? -1 : 1
  })
}

export function searchRules(keyword?: string, options: { cwd?: string, global?: boolean } = {}): RuleInfo[] {
  const all = scanStoreRules(options)
  if (!keyword)
    return all
  const lower = keyword.toLowerCase()
  return all.filter((rule) => {
    return rule.name.toLowerCase().includes(lower)
      || rule.meta?.description?.toLowerCase().includes(lower)
      || rule.meta?.tags?.some(t => t.toLowerCase().includes(lower))
  })
}

export function getRuleByName(name: string, options: { cwd?: string, global?: boolean } = {}): RuleInfo | undefined {
  const cwd = options.cwd || process.cwd()
  const dirs = options.global === true
    ? [getGlobalStoreDir()]
    : options.global === false
      ? [getProjectStoreDir(cwd)]
      : [getProjectStoreDir(cwd), getGlobalStoreDir()]

  for (const storeDir of dirs) {
    const ruleDir = join(storeDir, name)
    if (!existsSync(ruleDir))
      continue
    const rule = readRuleFromDir(ruleDir, name)
    if (rule)
      return rule
  }
  return undefined
}
