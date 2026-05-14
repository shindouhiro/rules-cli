import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parseRuleMeta, scanStoreRuleEntries, scanStoreRules } from '~/core/scanner'

const TEST_DIR = join(import.meta.dirname, '..', '..', '.test-tmp-scanner')

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
})

describe('scanner - parseRuleMeta', () => {
  it('解析完整 frontmatter', () => {
    const content = `---
name: use-chinese
description: 回复使用中文
tags: [language, i18n]
---

所有回复均须使用中文
`
    const { meta, body } = parseRuleMeta(content)
    expect(meta).toBeDefined()
    expect(meta!.name).toBe('use-chinese')
    expect(meta!.description).toBe('回复使用中文')
    expect(meta!.tags).toEqual(['language', 'i18n'])
    expect(body).toBe('所有回复均须使用中文')
  })

  it('解析无 tags 的 frontmatter', () => {
    const content = `---
name: test-rule
description: 测试规则
---

规则内容
`
    const { meta, body } = parseRuleMeta(content)
    expect(meta!.name).toBe('test-rule')
    expect(meta!.tags).toBeUndefined()
    expect(body).toBe('规则内容')
  })

  it('无 frontmatter 时返回纯 body', () => {
    const content = '这是一条没有 frontmatter 的规则'
    const { meta, body } = parseRuleMeta(content)
    expect(meta).toBeUndefined()
    expect(body).toBe('这是一条没有 frontmatter 的规则')
  })

  it('空内容', () => {
    const { meta, body } = parseRuleMeta('')
    expect(meta).toBeUndefined()
    expect(body).toBe('')
  })

  it('frontmatter 中的引号值会被去除', () => {
    const content = `---
name: "quoted-name"
description: 'quoted desc'
---

body
`
    const { meta } = parseRuleMeta(content)
    expect(meta!.name).toBe('quoted-name')
    expect(meta!.description).toBe('quoted desc')
  })

  it('tags 带空格能正确拆分', () => {
    const content = `---
name: test
description: test
tags: [vue, typescript, best-practice]
---

body
`
    const { meta } = parseRuleMeta(content)
    expect(meta!.tags).toEqual(['vue', 'typescript', 'best-practice'])
  })

  it('解析 references 引用清单', () => {
    const content = `---
name: agent-map
description: 地图式入口
tags: [agent]
references:
  - path: docs/architecture.md
    title: 分层架构详细说明
  - path: docs/design-docs/ref-*.md
    title: 参考项目架构说明
---

# AGENTS.md
`
    const { meta } = parseRuleMeta(content)
    expect(meta!.references).toEqual([
      { path: 'docs/architecture.md', title: '分层架构详细说明' },
      { path: 'docs/design-docs/ref-*.md', title: '参考项目架构说明' },
    ])
  })

  it('扫描规则时拒绝越界引用路径', () => {
    const ruleDir = join(TEST_DIR, '.rules', 'store', 'unsafe-rule')
    mkdirSync(ruleDir, { recursive: true })
    writeFileSync(join(ruleDir, 'rule.md'), `---
name: unsafe-rule
description: unsafe
references:
  - path: ../secret.md
    title: secret
---

body
`, 'utf-8')

    expect(() => scanStoreRules({ cwd: TEST_DIR, global: false })).toThrow('引用路径不安全')
  })

  it('扫描旧下载规则时自动把同目录 md 文件转换为地图式引用', () => {
    const ruleDir = join(TEST_DIR, '.rules', 'store', 'legacy-rule')
    mkdirSync(ruleDir, { recursive: true })
    writeFileSync(join(ruleDir, 'rule.md'), '# first.md\n\n第一条完整内容\n\n# second.md\n\n第二条完整内容\n', 'utf-8')
    writeFileSync(join(ruleDir, 'first.md'), '第一条完整内容\n', 'utf-8')
    writeFileSync(join(ruleDir, 'second.md'), '第二条完整内容\n', 'utf-8')

    const [rule] = scanStoreRules({ cwd: TEST_DIR, global: false })

    expect(rule.references).toEqual([
      { sourcePath: join(ruleDir, 'first.md'), targetPath: 'docs/first.md', title: 'first.md' },
      { sourcePath: join(ruleDir, 'second.md'), targetPath: 'docs/second.md', title: 'second.md' },
    ])
    expect(rule.content).toBe('# legacy-rule\n\n- [first.md](./docs/first.md)\n- [second.md](./docs/second.md)')
    expect(rule.content).not.toContain('第一条完整内容')
  })

  it('显式 references 可通过 referencesDir 指定目标引用目录', () => {
    const ruleDir = join(TEST_DIR, '.rules', 'store', 'custom-dir-rule')
    mkdirSync(join(ruleDir, 'docs'), { recursive: true })
    writeFileSync(join(ruleDir, 'rule.md'), `---
name: custom-dir-rule
description: custom dir
referencesDir: ai-rules
references:
  - path: docs/architecture.md
    title: 架构说明
---

# custom-dir-rule

- [架构说明](./ai-rules/docs/architecture.md)
`, 'utf-8')
    writeFileSync(join(ruleDir, 'docs', 'architecture.md'), '# 架构说明\n', 'utf-8')

    const [rule] = scanStoreRules({ cwd: TEST_DIR, global: false })

    expect(rule.references).toEqual([
      {
        sourcePath: join(ruleDir, 'docs', 'architecture.md'),
        targetPath: 'ai-rules/architecture.md',
        title: '架构说明',
      },
    ])
  })

  it('旧下载规则可通过 referencesDir 把自动引用落到指定目录', () => {
    const ruleDir = join(TEST_DIR, '.rules', 'store', 'legacy-custom-dir')
    mkdirSync(ruleDir, { recursive: true })
    writeFileSync(join(ruleDir, 'rule.md'), `---
name: legacy-custom-dir
description: custom dir
referencesDir: ai-rules
---

# first.md

第一条完整内容
`, 'utf-8')
    writeFileSync(join(ruleDir, 'first.md'), '第一条完整内容\n', 'utf-8')

    const [rule] = scanStoreRules({ cwd: TEST_DIR, global: false })

    expect(rule.references).toEqual([
      {
        sourcePath: join(ruleDir, 'first.md'),
        targetPath: 'ai-rules/first.md',
        title: 'first.md',
      },
    ])
    expect(rule.content).toBe('# legacy-custom-dir\n\n- [first.md](./ai-rules/first.md)')
  })

  it('扫描带作用域规则时保留项目和全局同名规则', async () => {
    const projectRuleDir = join(TEST_DIR, '.rules', 'store', 'same-name')
    const homeDir = join(TEST_DIR, 'home')
    const globalRuleDir = join(homeDir, '.rules', 'store', 'same-name')
    mkdirSync(projectRuleDir, { recursive: true })
    mkdirSync(globalRuleDir, { recursive: true })
    writeFileSync(join(projectRuleDir, 'rule.md'), 'project body\n', 'utf-8')
    writeFileSync(join(globalRuleDir, 'rule.md'), 'global body\n', 'utf-8')

    const rules = scanStoreRuleEntries({
      cwd: TEST_DIR,
      globalStoreDir: join(homeDir, '.rules', 'store'),
    })

    expect(rules.map(rule => `${rule.scope}:${rule.content}`)).toEqual([
      'project:project body',
      'global:global body',
    ])
  })
})
