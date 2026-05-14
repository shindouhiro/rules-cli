import type { AgentRulesDef, RuleInfo } from '~/types'
import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { injectRuleToSingleFileAgent, linkRuleToDirectoryAgent, removeRuleFromSingleFileAgent, removeRuleReferencesFromDirectoryAgent } from '~/core/linker'
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

function createMockRuleWithReferences(name: string, content: string): RuleInfo {
  return {
    name,
    path: join(STORE_DIR, name, 'rule.md'),
    meta: {
      name,
      description: `mock ${name}`,
      references: [
        { path: 'docs/architecture.md', title: '分层架构详细说明' },
        { path: 'docs/design-docs/ref-*.md', title: '参考项目架构说明' },
      ],
    },
    references: [
      {
        sourcePath: join(STORE_DIR, name, 'docs', 'architecture.md'),
        targetPath: 'docs/architecture.md',
        title: '分层架构详细说明',
      },
      {
        sourcePath: join(STORE_DIR, name, 'docs', 'design-docs', 'ref-cli.md'),
        targetPath: 'docs/design-docs/ref-cli.md',
        title: '参考项目架构说明',
      },
    ],
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

function createStoreRuleWithReferences(name: string): void {
  const ruleDir = join(STORE_DIR, name)
  mkdirSync(join(ruleDir, 'docs', 'design-docs'), { recursive: true })
  writeFileSync(join(ruleDir, 'rule.md'), '# AGENTS.md\n\n- [架构说明](./docs/architecture.md)\n', 'utf-8')
  writeFileSync(join(ruleDir, 'docs', 'architecture.md'), '# 架构说明\n', 'utf-8')
  writeFileSync(join(ruleDir, 'docs', 'design-docs', 'ref-cli.md'), '# 参考架构\n', 'utf-8')
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

    it('目录型 agent 应用规则时同步引用文件树', () => {
      const ruleName = `${TEST_RULE_PREFIX}rule1`
      createStoreRuleWithReferences(ruleName)

      const cwd = makeTmpDir('link-test-references')
      const rule = createMockRuleWithReferences(ruleName, '# AGENTS.md')
      const result = linkRuleToDirectoryAgent(rule, mockDirectoryAgent, {
        global: false,
        cwd,
      })

      expect(result.success).toBe(true)
      expect(readFileSync(join(cwd, '.test-agent', 'rules', ruleName, 'docs', 'architecture.md'), 'utf-8')).toContain('架构说明')
      expect(readFileSync(join(cwd, '.test-agent', 'rules', ruleName, 'docs', 'design-docs', 'ref-cli.md'), 'utf-8')).toContain('参考架构')
    })
  })

  describe('injectRuleToSingleFileAgent', () => {
    it('在空文件/新文件中以 docs 引用方式注入', () => {
      const cwd = makeTmpDir('inject-test-1')
      const rule = createMockRule('use-chinese', '所有回复使用中文')

      const result = injectRuleToSingleFileAgent(rule, mockSingleFileAgent, {
        global: false,
        cwd,
      })

      expect(result.success).toBe(true)

      const content = readFileSync(result.targetPath, 'utf-8')
      expect(content).toContain('<!-- rules-cli:start -->')
      expect(content).toContain('## use-chinese')
      expect(content).toContain('[use-chinese.md](./docs/use-chinese.md)')
      expect(content).not.toContain('所有回复使用中文')
      expect(content).not.toContain('<!-- rule: use-chinese -->')
      expect(content).toContain('<!-- rules-cli:end -->')
      expect(readFileSync(join(cwd, 'docs', 'use-chinese.md'), 'utf-8')).toBe('所有回复使用中文\n')
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
      expect(content).toContain('[pnpm-rule.md](./docs/pnpm-rule.md)')
      expect(content).not.toContain('使用 pnpm 作为包管理器')
      expect(readFileSync(join(cwd, 'docs', 'pnpm-rule.md'), 'utf-8')).toBe('使用 pnpm 作为包管理器\n')
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
      expect(content).toContain('## rule-1')
      expect(content).toContain('[rule-1.md](./docs/rule-1.md)')
      expect(content).toContain('## rule-2')
      expect(content).toContain('[rule-2.md](./docs/rule-2.md)')
      expect(readFileSync(join(cwd, 'docs', 'rule-1.md'), 'utf-8')).toBe('第一条规则\n')
      expect(readFileSync(join(cwd, 'docs', 'rule-2.md'), 'utf-8')).toBe('第二条规则\n')
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
      expect(content).toContain('[update-rule.md](./docs/update-rule.md)')
      expect(readFileSync(join(cwd, 'docs', 'update-rule.md'), 'utf-8')).toBe('新内容\n')
      expect(content).not.toContain('旧内容')
    })

    it('单文件型 agent 注入规则时同步引用文件树', () => {
      const ruleName = `${TEST_RULE_PREFIX}rule2`
      createStoreRuleWithReferences(ruleName)

      const cwd = makeTmpDir('inject-test-references')
      const rule = createMockRuleWithReferences(ruleName, '# AGENTS.md\n\n- [架构说明](./docs/architecture.md)')
      const result = injectRuleToSingleFileAgent(rule, mockSingleFileAgent, {
        global: false,
        cwd,
      })

      expect(result.success).toBe(true)
      expect(readFileSync(join(cwd, 'TEST-RULES.md'), 'utf-8')).toContain('[架构说明](./docs/architecture.md)')
      expect(readFileSync(join(cwd, 'docs', 'architecture.md'), 'utf-8')).toContain('架构说明')
      expect(readFileSync(join(cwd, 'docs', 'design-docs', 'ref-cli.md'), 'utf-8')).toContain('参考架构')
    })
  })

  describe('removeRuleFromSingleFileAgent', () => {
    it('移除已注入的规则', () => {
      const cwd = makeTmpDir('remove-test-1')
      const targetFile = join(cwd, 'TEST-RULES.md')
      const rule = createMockRule('to-remove', '待删除')

      injectRuleToSingleFileAgent(rule, mockSingleFileAgent, { global: false, cwd })
      expect(readFileSync(targetFile, 'utf-8')).toContain('[to-remove.md](./docs/to-remove.md)')
      expect(readFileSync(join(cwd, 'docs', 'to-remove.md'), 'utf-8')).toBe('待删除\n')

      const result = removeRuleFromSingleFileAgent('to-remove', mockSingleFileAgent, {
        global: false,
        cwd,
        rule,
      })

      expect(result.success).toBe(true)

      const content = readFileSync(targetFile, 'utf-8')
      expect(content).not.toContain('待删除')
      expect(content).not.toContain('## to-remove')
      expect(existsSync(join(cwd, 'docs', 'to-remove.md'))).toBe(false)
      expect(existsSync(join(cwd, 'docs'))).toBe(false)
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

      removeRuleFromSingleFileAgent('rule-a', mockSingleFileAgent, {
        global: false,
        cwd,
        rule: createMockRule('rule-a', '规则A'),
      })

      const content = readFileSync(targetFile, 'utf-8')
      expect(content).not.toContain('规则A')
      expect(content).toContain('[rule-b.md](./docs/rule-b.md)')
      expect(content).toContain('<!-- rules-cli:start -->')
      expect(existsSync(join(cwd, 'docs', 'rule-a.md'))).toBe(false)
      expect(existsSync(join(cwd, 'docs'))).toBe(true)
      expect(readFileSync(join(cwd, 'docs', 'rule-b.md'), 'utf-8')).toBe('规则B\n')
    })

    it('可按显式 targetPath 移除规则', () => {
      const cwd = makeTmpDir('remove-test-target-path')
      const targetFile = join(cwd, 'CUSTOM-RULES.md')
      writeFileSync(targetFile, [
        '<!-- rules-cli:start -->',
        '<!-- rule: custom-path -->',
        '自定义路径规则',
        '<!-- /rule: custom-path -->',
        '<!-- rules-cli:end -->',
        '',
      ].join('\n'), 'utf-8')

      const result = removeRuleFromSingleFileAgent('custom-path', mockSingleFileAgent, {
        global: false,
        cwd,
        targetPath: targetFile,
      })

      expect(result.success).toBe(true)
      expect(readFileSync(targetFile, 'utf-8')).not.toContain('custom-path')
    })

    it('移除规则时清理引用文件但保留用户修改过的同路径文件', () => {
      const ruleName = `${TEST_RULE_PREFIX}rule3`
      createStoreRuleWithReferences(ruleName)

      const cwd = makeTmpDir('remove-test-references')
      const managedRule = createMockRuleWithReferences(ruleName, '# AGENTS.md')
      injectRuleToSingleFileAgent(managedRule, mockSingleFileAgent, { global: false, cwd })

      writeFileSync(join(cwd, 'docs', 'architecture.md'), '# 用户改写\n', 'utf-8')

      const result = removeRuleFromSingleFileAgent(ruleName, mockSingleFileAgent, {
        global: false,
        cwd,
        rule: managedRule,
      })

      expect(result.success).toBe(true)
      expect(readFileSync(join(cwd, 'docs', 'architecture.md'), 'utf-8')).toContain('用户改写')
      expect(existsSync(join(cwd, 'docs', 'design-docs', 'ref-cli.md'))).toBe(false)
      expect(existsSync(join(cwd, 'docs', 'design-docs'))).toBe(false)
      expect(existsSync(join(cwd, 'docs'))).toBe(true)
    })

    it('强制移除引用文件时删除用户修改过的同路径文件', () => {
      const ruleName = `${TEST_RULE_PREFIX}rule3`
      createStoreRuleWithReferences(ruleName)

      const cwd = makeTmpDir('remove-test-force-references')
      const managedRule = createMockRuleWithReferences(ruleName, '# AGENTS.md')
      injectRuleToSingleFileAgent(managedRule, mockSingleFileAgent, { global: false, cwd })

      writeFileSync(join(cwd, 'docs', 'architecture.md'), '# 用户改写\n', 'utf-8')

      const result = removeRuleFromSingleFileAgent(ruleName, mockSingleFileAgent, {
        global: false,
        cwd,
        rule: managedRule,
        forceReferences: true,
      })

      expect(result.success).toBe(true)
      expect(existsSync(join(cwd, 'docs', 'architecture.md'))).toBe(false)
      expect(existsSync(join(cwd, 'docs', 'design-docs', 'ref-cli.md'))).toBe(false)
      expect(existsSync(join(cwd, 'docs'))).toBe(false)
    })

    it('强制移除引用文件时即使规则注入块已不存在也会删除实际文件', () => {
      const ruleName = `${TEST_RULE_PREFIX}rule3`
      createStoreRuleWithReferences(ruleName)

      const cwd = makeTmpDir('remove-test-force-references-without-block')
      const managedRule = createMockRuleWithReferences(ruleName, '# AGENTS.md')
      injectRuleToSingleFileAgent(managedRule, mockSingleFileAgent, { global: false, cwd })

      writeFileSync(join(cwd, 'TEST-RULES.md'), '# 用户已手动删除规则注入块\n', 'utf-8')

      const result = removeRuleFromSingleFileAgent(ruleName, mockSingleFileAgent, {
        global: false,
        cwd,
        rule: managedRule,
        forceReferences: true,
      })

      expect(result.success).toBe(true)
      expect(existsSync(join(cwd, 'docs', 'architecture.md'))).toBe(false)
      expect(existsSync(join(cwd, 'docs', 'design-docs', 'ref-cli.md'))).toBe(false)
      expect(existsSync(join(cwd, 'docs'))).toBe(false)
    })

    it('强制移除目录型 agent 引用文件时不依赖源文件内容匹配', () => {
      const ruleName = `${TEST_RULE_PREFIX}rule3`
      createStoreRuleWithReferences(ruleName)

      const cwd = makeTmpDir('remove-test-force-directory-references')
      const managedRule = createMockRuleWithReferences(ruleName, '# AGENTS.md')
      linkRuleToDirectoryAgent(managedRule, mockDirectoryAgent, { global: false, cwd })

      writeFileSync(join(cwd, '.test-agent', 'rules', ruleName, 'docs', 'architecture.md'), '# 用户改写\n', 'utf-8')

      removeRuleReferencesFromDirectoryAgent(managedRule, mockDirectoryAgent, {
        global: false,
        cwd,
        forceReferences: true,
      })

      expect(existsSync(join(cwd, '.test-agent', 'rules', ruleName, 'docs', 'architecture.md'))).toBe(false)
      expect(existsSync(join(cwd, '.test-agent', 'rules', ruleName, 'docs', 'design-docs', 'ref-cli.md'))).toBe(false)
      expect(existsSync(join(cwd, '.test-agent', 'rules', ruleName, 'docs'))).toBe(false)
    })
  })
})
