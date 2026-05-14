import type { ResolvedRuleReference, RuleReference } from '~/types'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path'

export function isUnsafeReferencePath(path: string): boolean {
  const normalized = normalize(path)
  return isAbsolute(path)
    || normalized === '..'
    || normalized.startsWith(`..${sep}`)
    || normalized.includes(`${sep}..${sep}`)
}

export function parseReferences(frontmatter: string): RuleReference[] | undefined {
  const lines = frontmatter.split(/\r?\n/u)
  const start = lines.findIndex(line => line.trim() === 'references:')
  if (start === -1)
    return undefined

  const references: RuleReference[] = []
  let current: RuleReference | undefined

  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.startsWith(' ') && !line.startsWith('\t'))
      break

    const trimmed = line.trim()
    if (trimmed.startsWith('- path:')) {
      current = { path: stripYamlQuote(trimmed.slice('- path:'.length).trim()) }
      references.push(current)
      continue
    }

    if (current && (trimmed.startsWith('path:') || trimmed.startsWith('title:') || trimmed.startsWith('content:'))) {
      const colonIdx = trimmed.indexOf(':')
      const key = trimmed.slice(0, colonIdx) as 'path' | 'title' | 'content'
      current[key] = stripYamlQuote(trimmed.slice(colonIdx + 1).trim())
    }
  }

  return references.length > 0 ? references : undefined
}

export function resolveRuleReferences(ruleDir: string, references?: RuleReference[], referencesDir?: string): ResolvedRuleReference[] | undefined {
  if (!references || references.length === 0)
    return undefined
  if (referencesDir)
    assertSafeReferencePath(referencesDir)

  const resolvedReferences: ResolvedRuleReference[] = []
  for (const reference of references) {
    const inlineContent = reference.content
    if (inlineContent) {
      const resolved: ResolvedRuleReference = {
        content: inlineContent,
        targetPath: reference.path || 'docs/unnamed.md',
      }
      if (reference.title)
        resolved.title = reference.title
      resolvedReferences.push(resolved)
      continue
    }

    if (!reference.path)
      continue

    assertSafeReferencePath(reference.path)

    const matches = hasGlob(reference.path)
      ? matchGlob(ruleDir, reference.path)
      : [join(ruleDir, reference.path)].filter(path => existsSync(path) && statSync(path).isFile())

    for (const sourcePath of matches) {
      const targetPath = toTargetPath(toSafeRelativePath(ruleDir, sourcePath), referencesDir || 'docs')
      resolvedReferences.push({
        sourcePath,
        targetPath,
        title: reference.title,
      })
    }
  }

  return resolvedReferences.length > 0 ? resolvedReferences : undefined
}

export function toTargetPath(relativePath: string, referencesDir?: string): string {
  if (!referencesDir)
    return relativePath
  assertSafeReferencePath(referencesDir)
  const normalizedPath = relativePath.split(sep).join('/')
  let pathInReferenceRoot = normalizedPath
  if (normalizedPath.startsWith(`${referencesDir}/`))
    pathInReferenceRoot = normalizedPath.slice(referencesDir.length + 1)
  else if (normalizedPath.startsWith('docs/'))
    pathInReferenceRoot = normalizedPath.slice('docs/'.length)
  return join(referencesDir, pathInReferenceRoot).split(sep).join('/')
}

export function applyRuleReferences(rule: { references?: ResolvedRuleReference[] }, targetRoot: string): void {
  for (const reference of rule.references ?? []) {
    assertSafeReferencePath(reference.targetPath)
    const targetPath = join(targetRoot, reference.targetPath)
    mkdirSync(dirname(targetPath), { recursive: true })
    if (reference.sourcePath)
      copyFileSync(reference.sourcePath, targetPath)
    else writeFileSync(targetPath, ensureTrailingNewline(reference.content || ''), 'utf-8')
  }
}

export function removeRuleReferences(rule: { references?: ResolvedRuleReference[] }, targetRoot: string, options: { force?: boolean } = {}): void {
  for (const reference of rule.references ?? []) {
    assertSafeReferencePath(reference.targetPath)
    const targetPath = join(targetRoot, reference.targetPath)
    if (!existsSync(targetPath))
      continue

    if (!options.force) {
      if (reference.sourcePath && !existsSync(reference.sourcePath))
        continue

      const targetContent = readFileSync(targetPath, 'utf-8')
      const sourceContent = reference.sourcePath
        ? readFileSync(reference.sourcePath, 'utf-8')
        : ensureTrailingNewline(reference.content || '')
      if (targetContent !== sourceContent)
        continue
    }

    rmSync(targetPath, { force: true })
    pruneEmptyReferenceParents(dirname(targetPath), targetRoot, reference.targetPath)
  }
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith('\n') ? content : `${content}\n`
}

function stripYamlQuote(value: string): string {
  return value.replace(/^["']|["']$/g, '')
}

function hasGlob(path: string): boolean {
  return path.includes('*')
}

function assertSafeReferencePath(path: string): void {
  if (isUnsafeReferencePath(path))
    throw new Error(`引用路径不安全: ${path}`)
}

function toSafeRelativePath(root: string, filePath: string): string {
  const relPath = relative(root, filePath)
  assertSafeReferencePath(relPath)
  return relPath
}

function matchGlob(root: string, pattern: string): string[] {
  const regex = globToRegex(pattern)
  const files = walkFiles(root)
  return files
    .map(file => ({ file, relPath: relative(root, file).split(sep).join('/') }))
    .filter(item => regex.test(item.relPath))
    .map(item => item.file)
}

function globToRegex(pattern: string): RegExp {
  const normalized = pattern.split(sep).join('/')
  const escaped = normalized
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '[^/]*')
  return new RegExp(`^${escaped}$`, 'u')
}

function walkFiles(root: string): string[] {
  if (!existsSync(root))
    return []

  const files: string[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = resolve(root, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath))
    }
    else if (entry.isFile()) {
      files.push(fullPath)
    }
  }
  return files
}

function pruneEmptyReferenceParents(startDir: string, targetRoot: string, targetPath: string): void {
  const referenceRoot = getReferenceRoot(targetPath)
  const stopDir = referenceRoot ? join(targetRoot, referenceRoot) : targetRoot
  pruneEmptyParents(startDir, targetRoot, stopDir)
}

function getReferenceRoot(targetPath: string): string | undefined {
  const parts = targetPath.split(/[\\/]/u).filter(Boolean)
  return parts.length > 1 ? parts[0] : undefined
}

function pruneEmptyParents(startDir: string, boundaryDir: string, stopDir: string): void {
  let current = startDir
  const boundary = resolve(boundaryDir)
  const stop = resolve(stopDir)
  while (current.startsWith(boundary) && current !== boundary) {
    try {
      if (readdirSync(current).length > 0)
        return
      rmdirSync(current)
      if (current === stop)
        return
      current = dirname(current)
    }
    catch {
      return
    }
  }
}
