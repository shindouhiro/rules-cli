import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import consola from 'consola'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { multiselectMock } = vi.hoisted(() => ({
  multiselectMock: vi.fn(),
}))

vi.mock('@clack/prompts', () => ({
  multiselect: multiselectMock,
  isCancel: () => false,
}))

const TEST_ROOT = join(import.meta.dirname, '..', '..', '.test-tmp-remove')
const PROJECT_DIR = join(TEST_ROOT, 'project')
const HOME_DIR = join(TEST_ROOT, 'home')

function cleanTmpDir(): void {
  if (existsSync(TEST_ROOT)) {
    rmSync(TEST_ROOT, { recursive: true, force: true })
  }
}

describe('commands/remove', () => {
  beforeEach(() => {
    mkdirSync(PROJECT_DIR, { recursive: true })
    mkdirSync(HOME_DIR, { recursive: true })
    multiselectMock.mockReset()
  })

  afterEach(() => {
    cleanTmpDir()
    vi.restoreAllMocks()
    vi.resetModules()
    vi.doUnmock('node:os')
  })

  it('rm --store 默认删除全局 store', async () => {
    const globalRuleDir = join(HOME_DIR, '.rules', 'store', 'global-only')
    const projectRuleDir = join(PROJECT_DIR, '.rules', 'store', 'project-only')
    mkdirSync(globalRuleDir, { recursive: true })
    writeFileSync(join(globalRuleDir, 'rule.md'), '# g', 'utf-8')
    mkdirSync(projectRuleDir, { recursive: true })
    writeFileSync(join(projectRuleDir, 'rule.md'), '# p', 'utf-8')

    vi.doMock('node:os', () => ({
      homedir: () => HOME_DIR,
    }))
    vi.spyOn(process, 'cwd').mockReturnValue(PROJECT_DIR)
    vi.spyOn(consola, 'success').mockImplementation(() => {})
    vi.spyOn(consola, 'error').mockImplementation(() => {})
    vi.spyOn(consola, 'warn').mockImplementation(() => {})
    vi.spyOn(consola, 'info').mockImplementation(() => {})
    vi.spyOn(consola, 'log').mockImplementation(() => {})

    const { removeCommand } = await import('~/commands/remove')
    await removeCommand('global-only', { store: true })

    expect(existsSync(globalRuleDir)).toBe(false)
    expect(existsSync(projectRuleDir)).toBe(true)
  })

  it('-i 交互模式默认展示 project/global 的 store 候选', async () => {
    const globalRuleDir = join(HOME_DIR, '.rules', 'store', 'global-rule')
    const projectRuleDir = join(PROJECT_DIR, '.rules', 'store', 'project-rule')
    mkdirSync(globalRuleDir, { recursive: true })
    writeFileSync(join(globalRuleDir, 'rule.md'), '# g', 'utf-8')
    mkdirSync(projectRuleDir, { recursive: true })
    writeFileSync(join(projectRuleDir, 'rule.md'), '# p', 'utf-8')
    multiselectMock.mockResolvedValue([])

    vi.doMock('node:os', () => ({
      homedir: () => HOME_DIR,
    }))
    vi.spyOn(process, 'cwd').mockReturnValue(PROJECT_DIR)
    vi.spyOn(consola, 'success').mockImplementation(() => {})
    vi.spyOn(consola, 'error').mockImplementation(() => {})
    vi.spyOn(consola, 'warn').mockImplementation(() => {})
    vi.spyOn(consola, 'info').mockImplementation(() => {})
    vi.spyOn(consola, 'log').mockImplementation(() => {})

    const { removeCommand } = await import('~/commands/remove')
    await removeCommand(undefined, { interactive: true, store: true })

    expect(multiselectMock).toHaveBeenCalledTimes(1)
    const firstCall = multiselectMock.mock.calls[0][0] as { options: Array<{ label: string }> }
    const labels = firstCall.options.map(o => o.label).join('\n')
    expect(labels).toContain('[store/project] project-rule')
    expect(labels).toContain('[store/global] global-rule')
  })
})
