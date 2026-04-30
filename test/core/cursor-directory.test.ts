import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { ofetch } from 'ofetch'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadCursorDirectoryRule, isCursorDirectorySource, searchCursorDirectoryRules } from '~/core/cursor-directory'

vi.mock('ofetch', () => ({
  ofetch: vi.fn(),
}))

const TEST_ROOT = join(import.meta.dirname, '..', '..', '.test-tmp-cursor-directory')

function cleanTmpDir(): void {
  if (existsSync(TEST_ROOT)) {
    rmSync(TEST_ROOT, { recursive: true, force: true })
  }
}

describe('core/cursor-directory', () => {
  beforeEach(() => {
    cleanTmpDir()
    vi.mocked(ofetch).mockReset()
  })

  afterEach(() => {
    cleanTmpDir()
    vi.restoreAllMocks()
  })

  it('识别 cursor.directory source', () => {
    expect(isCursorDirectorySource('cursor.directory')).toBe(true)
    expect(isCursorDirectorySource('https://cursor.directory/')).toBe(true)
    expect(isCursorDirectorySource('cursor')).toBe(true)
    expect(isCursorDirectorySource('owner/repo')).toBe(false)
  })

  it('按关键字搜索 cursor.directory 规则', async () => {
    vi.mocked(ofetch).mockResolvedValue(JSON.stringify({
      data: [
        {
          title: 'Vue Best Practices',
          slug: 'vue-best-practices',
          tags: ['vue'],
          libs: ['typescript'],
          content: 'Use Composition API.',
        },
        {
          title: 'React Rules',
          slug: 'react-rules',
          tags: ['react'],
          libs: [],
          content: 'Use hooks.',
        },
      ],
    }))

    const results = await searchCursorDirectoryRules('vue')

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      name: 'vue-best-practices',
      source: 'cursor.directory',
      meta: {
        name: 'Vue Best Practices',
        tags: ['vue', 'typescript'],
      },
    })
  })

  it('下载规则并写入 rule.md', async () => {
    vi.mocked(ofetch).mockResolvedValue(JSON.stringify({
      data: {
        title: 'Vue Best Practices',
        slug: 'vue-best-practices',
        tags: ['vue'],
        libs: ['typescript'],
        content: 'Use Composition API.',
      },
    }))

    const dir = await downloadCursorDirectoryRule('vue-best-practices', {
      cwd: TEST_ROOT,
      global: false,
    })
    const content = readFileSync(join(dir, 'rule.md'), 'utf-8')

    expect(dir).toBe(join(TEST_ROOT, '.rules', 'store', 'vue-best-practices'))
    expect(content).toContain('name: "vue-best-practices"')
    expect(content).toContain('description: "Vue Best Practices"')
    expect(content).toContain('tags: [vue, typescript]')
    expect(content).toContain('Use Composition API.')
  })

  it('cursor.directory 被安全检查拦截时回退到镜像规则列表', async () => {
    vi.mocked(ofetch)
      .mockResolvedValueOnce('<!DOCTYPE html><title>Vercel Security Checkpoint</title>')
      .mockResolvedValueOnce(`
        <a href="/posts/angular-cursor-rules"><h3>Angular Cursor Rules</h3></a>
        <p>from https://github.com/pontusab/cursor.directory</p>
      `)

    const results = await searchCursorDirectoryRules('angular')

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      name: 'angular-cursor-rules',
      meta: {
        name: 'Angular Cursor Rules',
        description: '来自 cursor.directory 镜像数据',
      },
    })
  })
})
