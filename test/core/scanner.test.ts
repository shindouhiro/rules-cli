import { describe, expect, it } from 'vitest'
import { parseRuleMeta } from '~/core/scanner'

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
})
