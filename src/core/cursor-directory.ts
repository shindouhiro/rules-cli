import type { RemoteRuleResult } from '~/core/remote'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ofetch } from 'ofetch'
import { getStoreDir } from '~/core/store'

const CURSOR_DIRECTORY_API = 'https://cursor.directory/api'
const CURSOR_DIRECTORY_SOURCE = 'cursor.directory'
const CURSOR_RULE_POSTS_URL = 'https://cursorrule.com/posts'
const CURSOR_RULE_SOURCE_HINT = 'from https://github.com/pontusab/cursor.directory'

interface CursorDirectoryAuthor {
  name: string
  url?: string | null
  avatar?: string | null
}

interface CursorDirectoryRule {
  title: string
  slug: string
  tags?: string[]
  libs?: string[]
  content: string
  description?: string
  author?: CursorDirectoryAuthor
}

interface CursorDirectoryListResponse {
  data: CursorDirectoryRule[]
}

interface CursorDirectoryRuleResponse {
  data: CursorDirectoryRule
}

function getHeaders(): Record<string, string> {
  return {
    'accept': 'application/json',
    'User-Agent': 'rules-cli',
  }
}

async function fetchCursorDirectoryJson<T>(path = ''): Promise<T> {
  const url = `${CURSOR_DIRECTORY_API}${path}`
  const text = await fetchText(url)

  if (isVercelChallenge(text)) {
    throw new Error('cursor.directory 当前返回 Vercel 安全检查，CLI 无法访问公开 API')
  }

  try {
    return JSON.parse(text) as T
  }
  catch {
    throw new Error('cursor.directory 返回了非 JSON 响应')
  }
}

async function fetchText(url: string): Promise<string> {
  return await ofetch<string>(url, {
    headers: getHeaders(),
    ignoreResponseError: true,
    parseResponse: txt => txt,
  })
}

function isVercelChallenge(text: string): boolean {
  const trimmed = text.trim()
  return trimmed.startsWith('<!DOCTYPE') && trimmed.includes('Vercel Security Checkpoint')
}

function uniq(values: string[]): string[] {
  return [...new Set(values.map(v => v.trim()).filter(Boolean))]
}

function getRuleTags(rule: CursorDirectoryRule): string[] | undefined {
  const tags = uniq([...(rule.tags ?? []), ...(rule.libs ?? [])])
  return tags.length > 0 ? tags : undefined
}

function getRuleDescription(rule: CursorDirectoryRule): string {
  if (rule.description)
    return rule.description
  if (rule.author?.name)
    return `来自 cursor.directory，作者 ${rule.author.name}`
  return '来自 cursor.directory'
}

function toRemoteResult(rule: CursorDirectoryRule): RemoteRuleResult {
  return {
    name: rule.slug,
    meta: {
      name: rule.title,
      description: getRuleDescription(rule),
      tags: getRuleTags(rule),
    },
    source: CURSOR_DIRECTORY_SOURCE,
    sourceUrl: `${CURSOR_DIRECTORY_API}/${rule.slug}`,
  }
}

function matchKeyword(rule: CursorDirectoryRule, keyword?: string): boolean {
  if (!keyword)
    return true

  const lower = keyword.toLowerCase()
  return [
    rule.title,
    rule.slug,
    rule.description ?? '',
    ...(rule.tags ?? []),
    ...(rule.libs ?? []),
  ].some(value => value.toLowerCase().includes(lower))
}

function yamlString(value: string): string {
  return JSON.stringify(value)
}

function yamlTags(tags?: string[]): string | undefined {
  if (!tags || tags.length === 0)
    return undefined
  return `[${tags.map(tag => tag.replace(/,/g, '')).join(', ')}]`
}

function buildRuleFile(rule: CursorDirectoryRule): string {
  const tags = yamlTags(getRuleTags(rule))
  const frontmatter = [
    '---',
    `name: ${yamlString(rule.slug)}`,
    `description: ${yamlString(rule.title)}`,
    ...(tags ? [`tags: ${tags}`] : []),
    '---',
  ]

  return `${frontmatter.join('\n')}\n\n${rule.content.trim()}\n`
}

async function getAllCursorDirectoryRules(): Promise<CursorDirectoryRule[]> {
  try {
    const response = await fetchCursorDirectoryJson<CursorDirectoryListResponse>()
    return response.data
  }
  catch (err) {
    if (err instanceof Error && err.message.includes('Vercel 安全检查'))
      return await fetchCursorRuleMirrorRules()
    throw err
  }
}

export function isCursorDirectorySource(source?: string): boolean {
  if (!source)
    return false

  const normalized = source
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//u, '')
    .replace(/\/$/u, '')

  return normalized === 'cursor.directory'
    || normalized === 'www.cursor.directory'
    || normalized === 'cursor'
}

/**
 * 搜索 cursor.directory 规则
 */
export async function searchCursorDirectoryRules(keyword?: string): Promise<RemoteRuleResult[]> {
  const rules = await getAllCursorDirectoryRules()
  return rules
    .filter(rule => matchKeyword(rule, keyword))
    .map(toRemoteResult)
}

async function getCursorDirectoryRule(ruleName: string): Promise<CursorDirectoryRule> {
  try {
    const response = await fetchCursorDirectoryJson<CursorDirectoryRuleResponse>(`/${encodeURIComponent(ruleName)}`)
    return response.data
  }
  catch (err) {
    const rules = await getAllCursorDirectoryRules()
    const lower = ruleName.toLowerCase()
    const rule = rules.find(item =>
      item.slug.toLowerCase() === lower
      || item.title.toLowerCase() === lower,
    )

    if (rule)
      return rule.content ? rule : await fetchCursorRuleMirrorRule(rule.slug)

    throw err
  }
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, '\'')
    .replace(/&#39;/g, '\'')
    .replace(/&nbsp;/g, ' ')
}

function stripTags(value: string): string {
  return decodeHtml(value.replace(/<[^>]*>/g, '')).trim()
}

function getTagsFromTitle(title: string): string[] | undefined {
  const ignored = new Set(['cursor', 'rules', 'rule', 'best', 'practices', 'development', 'guide'])
  const tags = uniq(
    title
      .toLowerCase()
      .replace(/\.net/g, 'dotnet')
      .match(/[a-z0-9+#.]+/gu)
      ?.filter(tag => !ignored.has(tag)) ?? [],
  )
  return tags.length > 0 ? tags : undefined
}

function htmlToText(html: string): string {
  return decodeHtml(html)
    .replace(/<br\s*\/?>/giu, '\n')
    .replace(/<\/p>/giu, '\n\n')
    .replace(/<p[^>]*>/giu, '')
    .replace(/<li[^>]*>/giu, '- ')
    .replace(/<\/li>/giu, '\n')
    .replace(/<\/?(ul|ol)[^>]*>/giu, '\n')
    .replace(/<h[1-6][^>]*>/giu, '\n\n## ')
    .replace(/<\/h[1-6]>/giu, '\n\n')
    .replace(/<pre[^>]*><code[^>]*>/giu, '\n```text\n')
    .replace(/<\/code><\/pre>/giu, '\n```\n')
    .replace(/<code[^>]*>/giu, '`')
    .replace(/<\/code>/giu, '`')
    .replace(/<[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function getCursorRuleMirrorContent(html: string): string {
  const proseMatch = html.match(/<div class="prose[^"]*"[^>]*>([\s\S]*?)<\/div><div class="mt-12">/u)
  if (!proseMatch)
    return ''

  return htmlToText(proseMatch[1])
}

async function fetchCursorRuleMirrorRules(): Promise<CursorDirectoryRule[]> {
  const html = await fetchText(CURSOR_RULE_POSTS_URL)
  const rules: CursorDirectoryRule[] = []
  const pattern = /<a[^>]+href="\/posts\/([^"]+)"[^>]*>\s*<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<\/a>\s*<p[^>]*>([\s\S]*?)<\/p>/gu

  for (const match of html.matchAll(pattern)) {
    const slug = match[1]
    const title = stripTags(match[2]).replace(/\s*→$/u, '')
    const description = stripTags(match[3])
    if (!description.includes(CURSOR_RULE_SOURCE_HINT))
      continue

    rules.push({
      title,
      slug,
      description: '来自 cursor.directory 镜像数据',
      tags: getTagsFromTitle(title),
      libs: [],
      content: '',
    })
  }

  return rules
}

async function fetchCursorRuleMirrorRule(slug: string): Promise<CursorDirectoryRule> {
  const html = await fetchText(`${CURSOR_RULE_POSTS_URL}/${encodeURIComponent(slug)}`)
  const title = stripTags(html.match(/<span class="text-gray-900">([\s\S]*?)<\/span>/u)?.[1]
    ?? html.match(/<title>([\s\S]*?) \| CursorRule<\/title>/u)?.[1]
    ?? slug)
  const content = getCursorRuleMirrorContent(html)

  if (!content)
    throw new Error(`规则 "${slug}" 在 cursor.directory 镜像数据中未找到`)

  return {
    title,
    slug,
    description: '来自 cursor.directory 镜像数据',
    tags: getTagsFromTitle(title),
    libs: [],
    content,
  }
}

/**
 * 从 cursor.directory 下载规则到本地 store
 */
export async function downloadCursorDirectoryRule(
  ruleName: string,
  options: { cwd?: string, global?: boolean } = {},
): Promise<string> {
  const rule = await getCursorDirectoryRule(ruleName)
  const storeDir = getStoreDir(options)
  const ruleDir = join(storeDir, rule.slug)

  mkdirSync(ruleDir, { recursive: true })
  writeFileSync(join(ruleDir, 'rule.md'), buildRuleFile(rule), 'utf-8')

  return ruleDir
}
