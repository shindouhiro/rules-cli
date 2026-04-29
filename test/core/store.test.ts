import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const TEST_DIR = join(import.meta.dirname, '..', '..', '.test-tmp-store')

function cleanTmpDir(): void {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true })
  }
}

describe('store', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    cleanTmpDir()
    vi.restoreAllMocks()
  })

  it('ensureStoreDir 创建不存在的目录', async () => {
    const { ensureStoreDir, getProjectStoreDir } = await import('~/core/store')
    const dir = ensureStoreDir({ cwd: TEST_DIR })
    expect(existsSync(dir)).toBe(true)
    expect(dir).toBe(getProjectStoreDir(TEST_DIR))
  })

  it('ensureStoreDir 支持创建全局目录', async () => {
    vi.doMock('node:os', () => ({
      homedir: () => TEST_DIR,
    }))

    const { ensureStoreDir, getGlobalStoreDir } = await import('~/core/store')
    const dir = ensureStoreDir({ global: true })
    expect(existsSync(dir)).toBe(true)
    expect(dir).toBe(getGlobalStoreDir())
  })

  it('listStoreRuleNames 返回排序的规则名称', async () => {
    // 创建模拟 store 结构
    const storeDir = join(TEST_DIR, '.rules', 'store')
    mkdirSync(join(storeDir, 'zz-rule'), { recursive: true })
    mkdirSync(join(storeDir, 'aa-rule'), { recursive: true })
    mkdirSync(join(storeDir, 'mm-rule'), { recursive: true })
    // 创建一个文件（应被忽略）
    writeFileSync(join(storeDir, 'not-a-dir.txt'), 'ignored', 'utf-8')

    const { listStoreRuleNames } = await import('~/core/store')
    const names = listStoreRuleNames({ cwd: TEST_DIR })
    expect(names).toEqual(['aa-rule', 'mm-rule', 'zz-rule'])
  })

  it('listStoreRuleNames store 不存在时返回空数组', async () => {
    const { listStoreRuleNames } = await import('~/core/store')
    const names = listStoreRuleNames({ cwd: join(TEST_DIR, 'nonexistent') })
    expect(names).toEqual([])
  })
})
