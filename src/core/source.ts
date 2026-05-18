import type { RuleSource } from '~/types'

export type NormalizedRuleSource
  = | {
    type: 'github'
    name?: string
    repo: string
    subPath?: string
  }
  | {
    type: 'git'
    name?: string
    url: string
    subPath?: string
  }

const GIT_URL_PATTERNS = [
  /^[\w.-]+@[\w.-]+:.+\.git(?:#.+)?$/u,
  /^(?:https?|ssh|git):\/\/.+/u,
  /^file:\/\/.+/u,
  /^\/.+/u,
  /^\.\.?\//u,
]

export function isGitUrl(value: string): boolean {
  return GIT_URL_PATTERNS.some(pattern => pattern.test(value))
}

export function normalizeSource(source: RuleSource | string): NormalizedRuleSource {
  if (typeof source === 'string') {
    return isGitUrl(source)
      ? { type: 'git', url: source }
      : { type: 'github', repo: source }
  }

  if (source.type === 'git' || source.url) {
    const url = source.url || source.repo
    if (!url)
      throw new Error('Git 远程源缺少 url')
    return {
      type: 'git',
      name: source.name,
      url,
      subPath: source.subPath,
    }
  }

  if (!source.repo)
    throw new Error('GitHub 远程源缺少 repo')

  return {
    type: 'github',
    name: source.name,
    repo: source.repo,
    subPath: source.subPath,
  }
}

export function sourceFromInput(value: string): RuleSource {
  return isGitUrl(value)
    ? { type: 'git', repo: value, url: value }
    : { type: 'github', repo: value }
}

export function getSourceKey(source: RuleSource | NormalizedRuleSource | string): string {
  const normalized = typeof source === 'string' ? normalizeSource(source) : normalizeSource(source as RuleSource)
  if (normalized.type === 'git') {
    return normalized.subPath
      ? `git:${normalized.url}#${normalized.subPath}`
      : `git:${normalized.url}`
  }

  return normalized.subPath
    ? `github:${normalized.repo}/${normalized.subPath}`
    : `github:${normalized.repo}`
}

export function findConfiguredSource(sources: RuleSource[] | undefined, value: string): RuleSource | undefined {
  return sources?.find((source) => {
    const normalized = normalizeSource(source)
    return source.name === value
      || getSourceKey(source) === value
      || (normalized.type === 'github' && normalized.repo === value)
      || (normalized.type === 'git' && normalized.url === value)
  })
}
