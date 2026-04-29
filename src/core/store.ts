import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'

const DEFAULT_STORE_DIR = '.rules/store'

export type StoreScope = 'project' | 'global'

/**
 * 获取全局 store 目录
 */
export function getGlobalStoreDir(): string {
  return join(homedir(), DEFAULT_STORE_DIR)
}

/**
 * 获取当前项目 store 目录
 */
export function getProjectStoreDir(cwd = process.cwd()): string {
  return resolve(cwd, DEFAULT_STORE_DIR)
}

/**
 * 按作用域获取 store 目录
 */
export function getStoreDir(options: { global?: boolean, cwd?: string } = {}): string {
  return options.global
    ? getGlobalStoreDir()
    : getProjectStoreDir(options.cwd)
}

/**
 * 获取 store 中指定规则的目录
 */
export function getStoreRuleDir(name: string, options: { global?: boolean, cwd?: string } = {}): string {
  return join(getStoreDir(options), name)
}

/**
 * 确保 store 目录存在
 */
export function ensureStoreDir(options: { global?: boolean, cwd?: string } = {}): string {
  const dir = getStoreDir(options)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

/**
 * 列出 store 中所有规则名称
 */
export function listStoreRuleNames(options: { global?: boolean, cwd?: string } = {}): string[] {
  const dir = getStoreDir(options)
  if (!existsSync(dir))
    return []

  return readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort()
}
