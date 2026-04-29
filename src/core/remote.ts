import type { RuleMeta, RuleSource } from '~/types'
import { mkdirSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import process from 'node:process'
import { ofetch } from 'ofetch'
import { parseRuleMeta } from '~/core/scanner'
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

/**
 * 获取 GitHub API 请求头
 */
function getHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'rules-cli',
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

export function getSourceKey(source: RuleSource): string {
  return source.subPath
    ? `github:${source.repo}/${source.subPath}`
    : `github:${source.repo}`
}

async function getDefaultBranch(repo: string, headers: Record<string, string>): Promise<string> {
  const repoInfo = await ofetch<GitHubRepo>(`https://api.github.com/repos/${repo}`, { headers })
  return repoInfo.default_branch || 'main'
}

function isRuleFile(path: string): boolean {
  return RULE_FILE_EXTENSIONS.has(extname(path).toLowerCase())
}

function getRuleNameFromFile(fileName: string): string {
  const ext = extname(fileName)
  return basename(fileName, ext)
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

async function createResultFromFile(
  params: {
    name: string
    file: GitHubContent
    repo: string
    branch: string
    source: RuleSource
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

/**
 * 搜索远程规则源
 */
export async function searchRemoteRules(
  source: RuleSource,
  keyword?: string,
): Promise<RemoteRuleResult[]> {
  const { repo, subPath } = source
  const baseApi = `https://api.github.com/repos/${repo}`
  const rulesRoot = subPath || ''
  const headers = getHeaders()
  const branch = await getDefaultBranch(repo, headers)

  // 获取规则目录列表
  const contentsPath = rulesRoot
    ? `${baseApi}/contents/${rulesRoot}`
    : `${baseApi}/contents`

  const contents = await ofetch<GitHubContent[]>(contentsPath, {
    headers,
  })

  // 目录型源：每个目录是一条规则；平铺型源：每个 Markdown 文件是一条规则。
  const candidates = contents.filter(content =>
    content.type === 'dir' || (content.type === 'file' && isRuleFile(content.name)),
  )

  // 关键字过滤
  let filteredCandidates = candidates
  if (keyword) {
    const lower = keyword.toLowerCase()
    filteredCandidates = candidates.filter(candidate =>
      candidate.name.toLowerCase().includes(lower),
    )
  }

  // 并行获取每条规则的元数据
  const promises = filteredCandidates.map(async (candidate) => {
    try {
      if (candidate.type === 'file') {
        return createResultFromFile({
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

      return createResultFromFile({
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
  return results.filter((r): r is RemoteRuleResult => r !== null)
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

/**
 * 下载远程规则到本地 store
 */
export async function downloadRule(
  source: RuleSource,
  ruleName: string,
  options: { cwd?: string, global?: boolean } = {},
): Promise<string> {
  const { repo, subPath } = source
  const baseApi = `https://api.github.com/repos/${repo}`
  const rulesRoot = subPath || ''
  const headers = getHeaders()
  const branch = await getDefaultBranch(repo, headers)

  // 使用 Git Trees API 递归获取目录下所有文件
  const treeData = await ofetch<GitHubTreeResponse>(
    `${baseApi}/git/trees/${branch}?recursive=1`,
    { headers },
  )

  const normalizedRoot = rulesRoot.replace(/\/$/u, '')
  const prefix = normalizedRoot
    ? `${rulesRoot}/${ruleName}/`
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

  if (files.length === 0) {
    throw new Error(`规则 "${ruleName}" 在 ${repo} 中未找到`)
  }

  const storeDir = getStoreDir(options)
  const ruleDir = join(storeDir, ruleName)
  const downloadedRuleFiles: { relativePath: string, content: string }[] = []

  // 并行下载所有文件
  const downloadPromises = files.map(async (file) => {
    const relativePath = flatFile ? 'rule.md' : file.path.slice(prefix.length)
    const filePath = join(ruleDir, relativePath)
    const fileDir = join(filePath, '..')

    mkdirSync(fileDir, { recursive: true })

    const rawUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${file.path}`
    const content = await fetchRawText(rawUrl, headers)
    writeFileSync(filePath, content, 'utf-8')

    if (isRuleFile(relativePath)) {
      downloadedRuleFiles.push({ relativePath, content })
    }
  })

  await Promise.all(downloadPromises)

  if (!downloadedRuleFiles.some(file => file.relativePath === 'rule.md')) {
    const ruleContent = downloadedRuleFiles
      .sort((a, b) => a.relativePath.localeCompare(b.relativePath))
      .map(file => `# ${file.relativePath}\n\n${file.content.trim()}`)
      .join('\n\n')

    writeFileSync(join(ruleDir, 'rule.md'), `${ruleContent}\n`, 'utf-8')
  }

  return ruleDir
}
