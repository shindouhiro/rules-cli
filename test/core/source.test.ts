import { describe, expect, it } from 'vitest'
import { getSourceKey, normalizeSource, sourceFromInput } from '~/core/source'

describe('remote source', () => {
  it('兼容旧版 GitHub source 配置', () => {
    const source = normalizeSource({ repo: 'owner/rules-repo', subPath: 'rules' })

    expect(source).toEqual({ type: 'github', repo: 'owner/rules-repo', subPath: 'rules' })
    expect(getSourceKey(source)).toBe('github:owner/rules-repo/rules')
  })

  it('支持新版通用 Git source 配置', () => {
    const source = normalizeSource({
      type: 'git',
      name: 'personal-gitlab',
      url: 'git@gitlab.com:user/rules.git',
      subPath: 'rules',
    })

    expect(source).toEqual({
      type: 'git',
      name: 'personal-gitlab',
      url: 'git@gitlab.com:user/rules.git',
      subPath: 'rules',
    })
    expect(getSourceKey(source)).toBe('git:git@gitlab.com:user/rules.git#rules')
  })

  it('根据 CLI 输入区分 GitHub owner/repo 与 Git URL', () => {
    expect(sourceFromInput('owner/repo')).toEqual({ type: 'github', repo: 'owner/repo' })
    expect(sourceFromInput('https://gitlab.com/user/rules.git')).toEqual({
      type: 'git',
      repo: 'https://gitlab.com/user/rules.git',
      url: 'https://gitlab.com/user/rules.git',
    })
  })
})
