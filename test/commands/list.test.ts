import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import consola from 'consola'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const TEST_ROOT = join(import.meta.dirname, '..', '..', '.test-tmp-list')
const PROJECT_DIR = join(TEST_ROOT, 'project')
const HOME_DIR = join(TEST_ROOT, 'home')

function cleanTmpDir(): void {
  if (existsSync(TEST_ROOT)) {
    rmSync(TEST_ROOT, { recursive: true, force: true })
  }
}

describe('commands/list --store', () => {
  beforeEach(() => {
    mkdirSync(PROJECT_DIR, { recursive: true })
    mkdirSync(HOME_DIR, { recursive: true })
    mkdirSync(join(PROJECT_DIR, '.rules', 'store', 'project-rule'), { recursive: true })
    writeFileSync(join(PROJECT_DIR, '.rules', 'store', 'project-rule', 'rule.md'), '# p', 'utf-8')
    mkdirSync(join(HOME_DIR, '.rules', 'store', 'global-rule'), { recursive: true })
    writeFileSync(join(HOME_DIR, '.rules', 'store', 'global-rule', 'rule.md'), '# g', 'utf-8')
  })

  afterEach(() => {
    cleanTmpDir()
    vi.restoreAllMocks()
    vi.resetModules()
    vi.doUnmock('node:os')
  })

  it('默认显示项目和全局 store', async () => {
    vi.doMock('node:os', () => ({
      homedir: () => HOME_DIR,
    }))
    vi.spyOn(process, 'cwd').mockReturnValue(PROJECT_DIR)
    const logSpy = vi.spyOn(consola, 'log').mockImplementation(() => {})
    vi.spyOn(consola, 'info').mockImplementation(() => {})

    const { listCommand } = await import('~/commands/list')
    await listCommand({ store: true })

    const logs = logSpy.mock.calls.flat().join('\n')
    expect(logs).toContain('当前项目 Store')
    expect(logs).toContain('全局 Store')
    expect(logs).toContain('project-rule')
    expect(logs).toContain('global-rule')
  })

  it('传 --project 时只显示项目 store', async () => {
    vi.doMock('node:os', () => ({
      homedir: () => HOME_DIR,
    }))
    vi.spyOn(process, 'cwd').mockReturnValue(PROJECT_DIR)
    const logSpy = vi.spyOn(consola, 'log').mockImplementation(() => {})
    vi.spyOn(consola, 'info').mockImplementation(() => {})

    const { listCommand } = await import('~/commands/list')
    await listCommand({ store: true, project: true })

    const logs = logSpy.mock.calls.flat().join('\n')
    expect(logs).toContain('当前项目 Store')
    expect(logs).not.toContain('全局 Store')
    expect(logs).toContain('project-rule')
    expect(logs).not.toContain('global-rule')
  })
})
