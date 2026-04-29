import type { AgentRulesDef, RuleInfo } from '~/types'
import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { injectRuleToSingleFileAgent, linkRuleToDirectoryAgent, removeRuleFromSingleFileAgent } from '~/core/linker'
import { getGlobalStoreDir } from '~/core/store'

// 使用项目内临时目录，测试后清理
const TEST_DIR = join(import.meta.dirname, '..', '..', '.test-tmp')
// 真实 store 路径（由 getGlobalStoreDir() 决定）
const STORE_DIR = getGlobalStoreDir()

function makeTmpDir(sub: string): string {
  const dir = join(TEST_DIR, sub)
  mkdirSync(dir, { recursive: true })
  return dir
}

function cleanTmpDir(): void {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true })
  }
}

function createMockRule(name: string, content: string): RuleInfo {
  return {
    name,
    path: join(STORE_DIR, name, 'rule.md'),
    meta: { name, description: `mock ${name}` },
    content,
  }
}

/**
 * 在真实 store 中创建规则源文件（linkRuleToDirectoryAgent 会读取它）
 */
function createStoreRule(name: string, content: string): void {
  const ruleDir = join(STORE_DIR, name)
  mkdirSync(ruleDir, { recursive: true })
  writeFileSync(join(ruleDir, 'rule.md'), content, 'utf-8')
}

function cleanStoreRule(name: string): void {
  const ruleDir = join(STORE_DIR, name)
  if (existsSync(ruleDir)) {
    rmSync(ruleDir, { recursive: true, force: true })
  }
}

const mockDirectoryAgent: AgentRulesDef = {
  id: 'test-dir',
  name: 'Test Dir Agent',
  rulesType: 'directory',
  projectPath: '.test-agent/rules/',
  globalPath: '~/.test-agent/rules/',
  fileExtension: '.mdc',
}

const mockSingleFileAgent: AgentRulesDef = {
  id: 'test-sf',
  name: 'Test Single File Agent',
  rulesType: 'single-file',
  projectPath: 'TEST-RULES.md',
  globalPath: '~/.test-agent/TEST-RULES.md',
  injectMarkerStart: '<!-- rules-cli:start -->',
  injectMarkerEnd: '<!-- rules-cli:end -->',
}

// 使用唯一前缀避免与真实规则冲突
const TEST_RULE_PREFIX = '__test_linker_'

describe('linker', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    cleanTmpDir()
    // 清理测试在 store 中创建的规则
    cleanStoreRule(`${TEST_RULE_PREFIX}rule1`)
    cleanStoreRule(`${TEST_RULE_PREFIX}rule2`)
    cleanStoreRule(`${TEST_RULE_PREFIX}rule3`)
  })

  describe('linkRuleToDirectoryAgent', () => {
    it('源文件不存在时返回失败', () => {
      const cwd = makeTmpDir('link-test-1')
      const rule = createMockRule(`${TEST_RULE_PREFIX}nonexistent`, '内容')
      const result = linkRuleToDirectoryAgent(rule, mockDirectoryAgent, {
        global: false,
        cwd,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('规则源文件不存在')
    })

    it('源文件存在时创建 symlink', () => {
      const ruleName = `${TEST_RULE_PREFIX}rule1`
      createStoreRule(ruleName, '规则内容')

      const cwd = makeTmpDir('link-test-2')
      const rule = createMockRule(ruleName, '规则内容')
      const result = linkRuleToDirectoryAgent(rule, mockDirectoryAgent, {
        global: false,
        cwd,
      })

      expect(result.success).toBe(true)
      expect(result.targetPath).toContain(`${ruleName}.mdc`)
      expect(existsSync(result.targetPath)).toBe(true)
      expect(lstatSync(result.targetPath).isSymbolicLink()).toBe(true)
    })

    it('已存在时不 force 则失败', () => {
      const ruleName = `${TEST_RULE_PREFIX}rule2`
      createStoreRule(ruleName, '规则内容')

      const cwd = makeTmpDir('link-test-3')
      const rule = createMockRule(ruleName, '规则内容')

      // 先创建一次
      linkRuleToDirectoryAgent(rule, mockDirectoryAgent, { global: false, cwd })

      // 再次不 force
      const result = linkRuleToDirectoryAgent(rule, mockDirectoryAgent, { global: false, cwd })
      expect(result.success).toBe(false)
      expect(result.error).toContain('已存在')
    })

    it('force 覆盖已有 symlink', () => {
      const ruleName = `${TEST_RULE_PREFIX}rule3`
      createStoreRule(ruleName, '规则内容v2')

      const cwd = makeTmpDir('link-test-4')
      const rule = createMockRule(ruleName, '规则内容v2')

      linkRuleToDirectoryAgent(rule, mockDirectoryAgent, { global: false, cwd })

      const result = linkRuleToDirectoryAgent(rule, mockDirectoryAgent, { global: false, cwd, force: true })
      expect(result.success).toBe(true)
      expect(lstatSync(result.targetPath).isSymbolicLink()).toBe(true)
    })
  })

  describe('injectRuleToSingleFileAgent', () => {
    it('在空文件/新文件中注入', () => {
      const cwd = makeTmpDir('inject-test-1')
      const rule = createMockRule('use-chinese', '所有回复使用中文')

      const result = injectRuleToSingleFileAgent(rule, mockSingleFileAgent, {
        global: false,
        cwd,
      })

      expect(result.success).toBe(true)

      const content = readFileSync(result.targetPath, 'utf-8')
      expect(content).toContain('<!-- rules-cli:start -->')
      expect(content).toContain('<!-- rule: use-chinese -->')
      expect(content).toContain('所有回复使用中文')
      expect(content).toContain('<!-- /rule: use-chinese -->')
      expect(content).toContain('<!-- rules-cli:end -->')
    })

    it('在已有内容的文件中追加', () => {
      const cwd = makeTmpDir('inject-test-2')
      const targetFile = join(cwd, 'TEST-RULES.md')
      writeFileSync(targetFile, '# 已有内容\n\n这是原始文件\n', 'utf-8')

      const rule = createMockRule('pnpm-rule', '使用 pnpm 作为包管理器')
      const result = injectRuleToSingleFileAgent(rule, mockSingleFileAgent, {
        global: false,
        cwd,
      })

      expect(result.success).toBe(true)

      const content = readFileSync(targetFile, 'utf-8')
      expect(content).toContain('# 已有内容')
      expect(content).toContain('这是原始文件')
      expect(content).toContain('使用 pnpm 作为包管理器')
    })

    it('在已有标记区间的文件中追加新规则', () => {
      const cwd = makeTmpDir('inject-test-3')
      const targetFile = join(cwd, 'TEST-RULES.md')

      const rule1 = createMockRule('rule-1', '第一条规则')
      injectRuleToSingleFileAgent(rule1, mockSingleFileAgent, { global: false, cwd })

      const rule2 = createMockRule('rule-2', '第二条规则')
      const result = injectRuleToSingleFileAgent(rule2, mockSingleFileAgent, { global: false, cwd })

      expect(result.success).toBe(true)

      const content = readFileSync(targetFile, 'utf-8')
      expect(content).toContain('<!-- rule: rule-1 -->')
      expect(content).toContain('第一条规则')
      expect(content).toContain('<!-- rule: rule-2 -->')
      expect(content).toContain('第二条规则')
    })

    it('重复注入不 force 应失败', () => {
      const cwd = makeTmpDir('inject-test-4')
      const rule = createMockRule('dup-rule', '重复规则')

      injectRuleToSingleFileAgent(rule, mockSingleFileAgent, { global: false, cwd })

      const result = injectRuleToSingleFileAgent(rule, mockSingleFileAgent, {
        global: false,
        cwd,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('规则已注入')
    })

    it('force 替换已注入的规则', () => {
      const cwd = makeTmpDir('inject-test-5')
      const targetFile = join(cwd, 'TEST-RULES.md')
      const rule = createMockRule('update-rule', '旧内容')

      injectRuleToSingleFileAgent(rule, mockSingleFileAgent, { global: false, cwd })

      const updatedRule = createMockRule('update-rule', '新内容')
      const result = injectRuleToSingleFileAgent(updatedRule, mockSingleFileAgent, {
        global: false,
        cwd,
        force: true,
      })

      expect(result.success).toBe(true)

      const content = readFileSync(targetFile, 'utf-8')
      expect(content).toContain('新内容')
      expect(content).not.toContain('旧内容')
    })
  })

  describe('removeRuleFromSingleFileAgent', () => {
    it('移除已注入的规则', () => {
      const cwd = makeTmpDir('remove-test-1')
      const targetFile = join(cwd, 'TEST-RULES.md')
      const rule = createMockRule('to-remove', '待删除')

      injectRuleToSingleFileAgent(rule, mockSingleFileAgent, { global: false, cwd })
      expect(readFileSync(targetFile, 'utf-8')).toContain('待删除')

      const result = removeRuleFromSingleFileAgent('to-remove', mockSingleFileAgent, {
        global: false,
        cwd,
      })

      expect(result.success).toBe(true)

      const content = readFileSync(targetFile, 'utf-8')
      expect(content).not.toContain('待删除')
      expect(content).not.toContain('<!-- rule: to-remove -->')
    })

    it('文件不存在时返回失败', () => {
      const cwd = makeTmpDir('remove-test-2')
      const result = removeRuleFromSingleFileAgent('nope', mockSingleFileAgent, {
        global: false,
        cwd,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('目标文件不存在')
    })

    it('规则不存在时返回失败', () => {
      const cwd = makeTmpDir('remove-test-3')
      const targetFile = join(cwd, 'TEST-RULES.md')
      writeFileSync(targetFile, '# 空文件\n', 'utf-8')

      const result = removeRuleFromSingleFileAgent('nonexistent', mockSingleFileAgent, {
        global: false,
        cwd,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('规则未找到')
    })

    it('移除最后一条规则后清除标记区间', () => {
      const cwd = makeTmpDir('remove-test-4')
      const targetFile = join(cwd, 'TEST-RULES.md')
      const rule = createMockRule('only-rule', '唯一规则')

      injectRuleToSingleFileAgent(rule, mockSingleFileAgent, { global: false, cwd })
      removeRuleFromSingleFileAgent('only-rule', mockSingleFileAgent, { global: false, cwd })

      const content = readFileSync(targetFile, 'utf-8')
      expect(content).not.toContain('<!-- rules-cli:start -->')
      expect(content).not.toContain('<!-- rules-cli:end -->')
    })

    it('移除一条不影响其他规则', () => {
      const cwd = makeTmpDir('remove-test-5')
      const targetFile = join(cwd, 'TEST-RULES.md')

      injectRuleToSingleFileAgent(
        createMockRule('rule-a', '规则A'),
        mockSingleFileAgent,
        { global: false, cwd },
      )
      injectRuleToSingleFileAgent(
        createMockRule('rule-b', '规则B'),
        mockSingleFileAgent,
        { global: false, cwd },
      )

      removeRuleFromSingleFileAgent('rule-a', mockSingleFileAgent, { global: false, cwd })

      const content = readFileSync(targetFile, 'utf-8')
      expect(content).not.toContain('规则A')
      expect(content).toContain('规则B')
      expect(content).toContain('<!-- rules-cli:start -->')
    })
  })
})
