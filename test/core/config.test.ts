import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { findProjectConfigPath, getDefaultConfig, getEffectiveConfigPath, saveConfig } from '~/core/config'

const TEST_DIR = join(import.meta.dirname, '..', '..', '.test-tmp-config')

function cleanTmpDir(): void {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true })
  }
}

describe('config', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    cleanTmpDir()
  })

  describe('getDefaultConfig', () => {
    it('返回默认配置', () => {
      const config = getDefaultConfig()
      expect(config.defaultAgents).toEqual([])
      expect(config.scope).toBe('project')
    })
  })

  describe('saveConfig', () => {
    it('保存配置到文件', () => {
      const configPath = join(TEST_DIR, 'sub', '.rulesrc')
      const config = {
        defaultAgents: ['cursor', 'claude-code'],
        scope: 'project' as const,
      }

      saveConfig(config, configPath)

      expect(existsSync(configPath)).toBe(true)
      const saved = JSON.parse(readFileSync(configPath, 'utf-8'))
      expect(saved.defaultAgents).toEqual(['cursor', 'claude-code'])
      expect(saved.scope).toBe('project')
    })

    it('自动创建父目录', () => {
      const configPath = join(TEST_DIR, 'deep', 'nested', '.rulesrc')
      saveConfig(getDefaultConfig(), configPath)
      expect(existsSync(configPath)).toBe(true)
    })
  })

  describe('project config lookup', () => {
    it('项目配置优先作为生效配置', () => {
      const configPath = join(TEST_DIR, '.rulesrc')
      saveConfig({
        defaultAgents: ['antigravity'],
        scope: 'project',
      }, configPath)

      expect(findProjectConfigPath(join(TEST_DIR, 'src'))).toBe(configPath)
      expect(getEffectiveConfigPath(join(TEST_DIR, 'src'))).toBe(configPath)
    })
  })
})
