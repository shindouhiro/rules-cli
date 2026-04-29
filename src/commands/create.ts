import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import consola from 'consola'
import pc from 'picocolors'
import { resolveIsGlobal } from '~/core/scope'
import { ensureStoreDir, getStoreRuleDir } from '~/core/store'
import { printScope, printSection } from '~/core/ui'

export interface CreateOptions {
  global?: boolean
  project?: boolean
}

export async function createCommand(name: string, options: CreateOptions = {}): Promise<void> {
  const isGlobal = resolveIsGlobal(options)
  const scopeOptions = { global: isGlobal }
  printSection('创建规则')
  printScope(isGlobal)

  ensureStoreDir(scopeOptions)

  const ruleDir = getStoreRuleDir(name, scopeOptions)

  if (existsSync(ruleDir)) {
    consola.error(`规则 "${name}" 已存在: ${ruleDir}`)
    return
  }

  mkdirSync(ruleDir, { recursive: true })

  const template = `---
name: ${name}
description: 在此添加规则描述
tags: []
---

# ${name}

在此编写你的规则内容...
`

  writeFileSync(join(ruleDir, 'rule.md'), template, 'utf-8')

  consola.success(`已创建规则: ${pc.green(name)}`)
  consola.info(`路径: ${pc.dim(ruleDir)}`)
  consola.info(`编辑: ${pc.cyan(`$EDITOR ${join(ruleDir, 'rule.md')}`)}`)
}
