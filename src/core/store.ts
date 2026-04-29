import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const DEFAULT_STORE_DIR = '.rules/store'

/**
 * 获取全局 store 目录
 */
export function getGlobalStoreDir(): string {
  return join(homedir(), DEFAULT_STORE_DIR)
}

/**
 * 获取 store 中指定规则的目录
 */
export function getStoreRuleDir(name: string): string {
  return join(getGlobalStoreDir(), name)
}

/**
 * 确保 store 目录存在
 */
export function ensureStoreDir(): string {
  const dir = getGlobalStoreDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

/**
 * 列出 store 中所有规则名称
 */
export function listStoreRuleNames(): string[] {
  const dir = getGlobalStoreDir()
  if (!existsSync(dir))
    return []

  return readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort()
}
