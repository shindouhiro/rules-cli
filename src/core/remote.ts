import type { NormalizedRuleSource } from '~/core/source'
import type { RuleMeta, RuleSource } from '~/types'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join, relative, sep } from 'node:path'
import process from 'node:process'
import { ofetch } from 'ofetch'
import { cleanupTempGitDir, cloneRepo, resolveRemoteDefaultBranch } from '~/core/git'
import { parseRuleMeta } from '~/core/scanner'
import { getSourceKey, normalizeSource } from '~/core/source'
import { getStoreDir } from '~/core/store'

/**
 * 远程搜索结果
 */
export interface RemoteRuleResult {
  name: string
  meta?: RuleMeta
  source: string
  sourceUrl: string
}

interface GitHubContent {
  name: string
  path: string
  type: 'file' | 'dir'
  download_url: string | null
}

interface GitHubTreeItem {
  path: string
  type: 'blob' | 'tree'
}

interface GitHubTreeResponse {
  tree: GitHubTreeItem[]
}

interface GitHubRepo {
  default_branch: string
}

const RULE_FILE_EXTENSIONS = new Set(['.md', '.mdc'])
const PREFERRED_RULE_FILES = ['rule.md', 'index.md', 'README.md']

function getHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'rules-cli',
  }
  if (token)
    headers.Authorization = `Bearer ${token}`
  return headers
}

async function getDefaultBranch(repo: string, headers: Record<string, string>): Promise<string> {
  const repoInfo = await ofetch<GitHubRepo>(`https://api.github.com/repos/${repo}`, { headers })
  return repoInfo.default_branch || 'main'
}

function isRuleFile(path: string): boolean {
  return RULE_FILE_EXTENSIONS.has(extname(path).toLowerCase())
}

function getRuleNameFromFile(fileName: string): string {
  return basename(fileName, extname(fileName))
}

function toPosixPath(path: string): string {
  return path.split(sep).join('/')
}

function pickRuleFile(files: GitHubContent[]): GitHubContent | undefined {
  const markdownFiles = files.filter(file => file.type === 'file' && isRuleFile(file.name))
  return PREFERRED_RULE_FILES
    .map(name => markdownFiles.find(file => file.name.toLowerCase() === name.toLowerCase()))
    .find((file): file is GitHubContent => file !== undefined)
    ?? markdownFiles[0]
}

async function fetchRawText(url: string, headers: Record<string, string>): Promise<string> {
  return await ofetch(url, {
    headers,
    parseResponse: txt => txt,
  }) as string
}

async function createGitHubResultFromFile(
  params: {
    name: string
    file: GitHubContent
    repo: string
    branch: string
    source: NormalizedRuleSource & { type: 'github' }
    sourcePath: string
    headers: Record<string, string>
  },
): Promise<RemoteRuleResult | null> {
  if (!params.file.download_url)
    return null

  const content = await fetchRawText(params.file.download_url, params.headers)
  const { meta } = parseRuleMeta(content)
  const result: RemoteRuleResult = {
    name: params.name,
    source: getSourceKey(params.source),
    sourceUrl: `https://github.com/${params.repo}/tree/${params.branch}/${params.sourcePath}`,
  }
  if (meta)
    result.meta = meta

  return result
}

async function searchGitHubRemoteRules(
  source: NormalizedRuleSource & { type: 'github' },
  keyword?: string,
): Promise<RemoteRuleResult[]> {
  const { repo, subPath } = source
  const baseApi = `https://api.github.com/repos/${repo}`
  const rulesRoot = subPath || ''
  const headers = getHeaders()
  const branch = await getDefaultBranch(repo, headers)

  const contentsPath = rulesRoot
    ? `${baseApi}/contents/${rulesRoot}`
    : `${baseApi}/contents`

  const contents = await ofetch<GitHubContent[]>(contentsPath, { headers })
  const candidates = contents.filter(content =>
    content.type === 'dir' || (content.type === 'file' && isRuleFile(content.name)),
  )

  const lower = keyword?.toLowerCase()
  const filteredCandidates = lower
    ? candidates.filter(candidate => candidate.name.toLowerCase().includes(lower))
    : candidates

  const promises = filteredCandidates.map(async (candidate) => {
    try {
      if (candidate.type === 'file') {
        return createGitHubResultFromFile({
          name: getRuleNameFromFile(candidate.name),
          file: candidate,
          repo,
          branch,
          source,
          sourcePath: candidate.path,
          headers,
        })
      }

      const dirContents = await ofetch<GitHubContent[]>(`${baseApi}/contents/${candidate.path}`, {
        headers,
      })
      const ruleFile = pickRuleFile(dirContents)
      if (!ruleFile)
        return null

      return createGitHubResultFromFile({
        name: candidate.name,
        file: ruleFile,
        repo,
        branch,
        source,
        sourcePath: candidate.path,
        headers,
      })
    }
    catch {
      return null
    }
  })

  const results = await Promise.all(promises)
  return results.filter((result): result is RemoteRuleResult => result !== null)
}

function pickLocalRuleFile(ruleDir: string): string | undefined {
  const files = readdirSync(ruleDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && isRuleFile(entry.name))
    .map(entry => join(ruleDir, entry.name))

  return PREFERRED_RULE_FILES
    .map(name => files.find(file => basename(file).toLowerCase() === name.toLowerCase()))
    .find((file): file is string => file !== undefined)
    ?? files[0]
}

async function searchGitRemoteRules(
  source: NormalizedRuleSource & { type: 'git' },
  keyword?: string,
): Promise<RemoteRuleResult[]> {
  const branch = await resolveRemoteDefaultBranch(source.url)
  const repoDir = await cloneRepo(source.url, { branch })
  try {
    const rootDir = source.subPath ? join(repoDir, source.subPath) : repoDir
    if (!existsSync(rootDir) || !statSync(rootDir).isDirectory())
      return []

    const candidates = readdirSync(rootDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory() || (entry.isFile() && isRuleFile(entry.name)))

    const lower = keyword?.toLowerCase()
    const filteredCandidates = lower
      ? candidates.filter(candidate => candidate.name.toLowerCase().includes(lower))
      : candidates

    const results: RemoteRuleResult[] = []
    for (const candidate of filteredCandidates) {
      if (candidate.isFile()) {
        const filePath = join(rootDir, candidate.name)
        const raw = readFileSync(filePath, 'utf-8')
        const { meta } = parseRuleMeta(raw)
        const relPath = toPosixPath(relative(repoDir, filePath))
        results.push({
          name: getRuleNameFromFile(candidate.name),
          meta,
          source: getSourceKey(source),
          sourceUrl: `${source.url}#${relPath}`,
        })
        continue
      }

      const ruleDir = join(rootDir, candidate.name)
      const ruleFile = pickLocalRuleFile(ruleDir)
      if (!ruleFile)
        continue

      const raw = readFileSync(ruleFile, 'utf-8')
      const { meta } = parseRuleMeta(raw)
      const relPath = toPosixPath(relative(repoDir, ruleDir))
      results.push({
        name: candidate.name,
        meta,
        source: getSourceKey(source),
        sourceUrl: `${source.url}#${relPath}`,
      })
    }

    return results
  }
  finally {
    cleanupTempGitDir(repoDir)
  }
}

/**
 * 搜索远程规则源
 */
export async function searchRemoteRules(
  source: RuleSource,
  keyword?: string,
): Promise<RemoteRuleResult[]> {
  const normalized = normalizeSource(source)
  return normalized.type === 'git'
    ? searchGitRemoteRules(normalized, keyword)
    : searchGitHubRemoteRules(normalized, keyword)
}

/**
 * 从所有配置的远程源搜索规则
 */
export async function searchAllRemoteSources(
  sources: RuleSource[],
  keyword?: string,
): Promise<RemoteRuleResult[]> {
  const results = await Promise.all(
    sources.map(source => searchRemoteRules(source, keyword).catch(() => [])),
  )
  return results.flat()
}

async function downloadGitHubRule(
  source: NormalizedRuleSource & { type: 'github' },
  ruleName: string,
  options: { cwd?: string, global?: boolean } = {},
): Promise<string> {
  const { repo, subPath } = source
  const baseApi = `https://api.github.com/repos/${repo}`
  const rulesRoot = subPath || ''
  const headers = getHeaders()
  const branch = await getDefaultBranch(repo, headers)

  const treeData = await ofetch<GitHubTreeResponse>(
    `${baseApi}/git/trees/${branch}?recursive=1`,
    { headers },
  )

  const normalizedRoot = rulesRoot.replace(/\/$/u, '')
  const prefix = normalizedRoot
    ? `${normalizedRoot}/${ruleName}/`
    : `${ruleName}/`
  let files = treeData.tree.filter(
    item => item.type === 'blob' && item.path.startsWith(prefix),
  )
  let flatFile = false

  if (files.length === 0) {
    const flatPrefix = normalizedRoot ? `${normalizedRoot}/` : ''
    const flatRule = treeData.tree.find((item) => {
      if (item.type !== 'blob' || !isRuleFile(item.path))
        return false
      return item.path === `${flatPrefix}${ruleName}${extname(item.path)}`
        || getRuleNameFromFile(item.path.slice(flatPrefix.length)) === ruleName
    })

    if (flatRule) {
      files = [flatRule]
      flatFile = true
    }
  }

  if (files.length === 0)
    throw new Error(`规则 "${ruleName}" 在 ${repo} 中未找到`)

  const storeDir = getStoreDir(options)
  const ruleDir = join(storeDir, ruleName)
  const downloadedRuleFiles: { relativePath: string, content: string }[] = []

  const downloadPromises = files.map(async (file) => {
    const relativePath = flatFile ? 'rule.md' : file.path.slice(prefix.length)
    const filePath = join(ruleDir, relativePath)

    mkdirSync(dirname(filePath), { recursive: true })

    const rawUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${file.path}`
    const content = await fetchRawText(rawUrl, headers)
    writeFileSync(filePath, content, 'utf-8')

    if (isRuleFile(relativePath))
      downloadedRuleFiles.push({ relativePath, content })
  })

  await Promise.all(downloadPromises)
  ensureRuleEntry(ruleDir, downloadedRuleFiles)

  return ruleDir
}

function walkFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath))
      continue
    }

    if (entry.isFile())
      files.push(fullPath)
  }
  return files
}

function ensureRuleEntry(ruleDir: string, downloadedRuleFiles: Array<{ relativePath: string, content: string }>): void {
  if (downloadedRuleFiles.some(file => file.relativePath === 'rule.md'))
    return

  const ruleContent = downloadedRuleFiles
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath))
    .map(file => `# ${file.relativePath}\n\n${file.content.trim()}`)
    .join('\n\n')

  writeFileSync(join(ruleDir, 'rule.md'), `${ruleContent}\n`, 'utf-8')
}

async function downloadGitRule(
  source: NormalizedRuleSource & { type: 'git' },
  ruleName: string,
  options: { cwd?: string, global?: boolean } = {},
): Promise<string> {
  const branch = await resolveRemoteDefaultBranch(source.url)
  const repoDir = await cloneRepo(source.url, { branch })
  try {
    const rootDir = source.subPath ? join(repoDir, source.subPath) : repoDir
    const ruleDirInRepo = join(rootDir, ruleName)
    const flatFile = existsSync(rootDir)
      ? readdirSync(rootDir, { withFileTypes: true })
          .filter(entry => entry.isFile() && isRuleFile(entry.name))
          .map(entry => join(rootDir, entry.name))
          .find(filePath => getRuleNameFromFile(basename(filePath)) === ruleName)
      : undefined

    const sourceFiles = existsSync(ruleDirInRepo) && statSync(ruleDirInRepo).isDirectory()
      ? walkFiles(ruleDirInRepo)
      : flatFile
        ? [flatFile]
        : []

    if (sourceFiles.length === 0)
      throw new Error(`规则 "${ruleName}" 在 ${source.url} 中未找到`)

    const storeDir = getStoreDir(options)
    const ruleDir = join(storeDir, ruleName)
    const downloadedRuleFiles: { relativePath: string, content: string }[] = []

    for (const sourceFile of sourceFiles) {
      const relativePath = flatFile ? 'rule.md' : toPosixPath(relative(ruleDirInRepo, sourceFile))
      const targetPath = join(ruleDir, relativePath)
      mkdirSync(dirname(targetPath), { recursive: true })
      copyFileSync(sourceFile, targetPath)

      if (isRuleFile(relativePath)) {
        downloadedRuleFiles.push({
          relativePath,
          content: readFileSync(sourceFile, 'utf-8'),
        })
      }
    }

    ensureRuleEntry(ruleDir, downloadedRuleFiles)
    return ruleDir
  }
  finally {
    cleanupTempGitDir(repoDir)
  }
}

/**
 * 下载远程规则到本地 store
 */
export async function downloadRule(
  source: RuleSource,
  ruleName: string,
  options: { cwd?: string, global?: boolean } = {},
): Promise<string> {
  const normalized = normalizeSource(source)
  return normalized.type === 'git'
    ? downloadGitRule(normalized, ruleName, options)
    : downloadGitHubRule(normalized, ruleName, options)
}

export { getSourceKey } from '~/core/source'
