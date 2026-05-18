import type { RuleSource } from '~/types'
import { existsSync } from 'node:fs'
import process from 'node:process'
import * as p from '@clack/prompts'
import consola from 'consola'
import pc from 'picocolors'
import { applyRulesByNames } from '~/commands/apply'
import { loadConfig } from '~/core/config'
import { downloadCursorDirectoryRule, isCursorDirectorySource, searchCursorDirectoryRules } from '~/core/cursor-directory'
import { downloadRule, getSourceKey, searchAllRemoteSources } from '~/core/remote'
import { resolveIsGlobal } from '~/core/scope'
import { sourceFromInput } from '~/core/source'
import { getStoreRuleDir } from '~/core/store'
import { printScope, printSection } from '~/core/ui'

export interface InstallOptions {
  source?: string
  cursor?: boolean
  force?: boolean
  global?: boolean
  project?: boolean
}

export async function installCommand(name: string | undefined, options: InstallOptions): Promise<void> {
  const config = loadConfig()
  const cwd = process.cwd()
  const isGlobal = resolveIsGlobal(options)
  const storeOptions = { global: isGlobal, cwd }
  printSection('安装远程规则')
  printScope(isGlobal)

  if (options.cursor || isCursorDirectorySource(options.source)) {
    const installed = await installFromCursorDirectory(name, storeOptions, options.force)
    if (!installed)
      return

    if (name) {
      consola.info(`进入 ${pc.cyan(`rules a ${name}`)} 选择 agents 并应用规则`)
      await applyRulesByNames([name], { global: isGlobal, force: options.force })
    }
    return
  }

  // 解析远程源
  let sources: RuleSource[]

  if (options.source) {
    sources = [sourceFromInput(options.source)]
  }
  else if (config.sources && config.sources.length > 0) {
    sources = config.sources
  }
  else {
    consola.error('没有配置远程规则源')
    consola.info(`在 ${pc.cyan('.rulesrc')} 中添加 sources 配置：`)
    consola.info(pc.dim('  { "sources": [{ "repo": "owner/rules-repo" }, { "type": "git", "url": "git@gitlab.com:user/rules.git" }] }'))
    consola.info(`或使用 ${pc.cyan('--source owner/repo')} / ${pc.cyan('--source <git-url>')} 指定`)
    return
  }

  // === 选择规则 ===
  let ruleName: string
  let ruleSource: RuleSource

  if (name) {
    ruleName = name
    ruleSource = sources[0]
  }
  else {
    // 交互式：从远程列表中选择
    consola.log(pc.dim('正在搜索远程规则...\n'))

    const allRemote = await searchAllRemoteSources(sources)

    if (allRemote.length === 0) {
      consola.info('远程没有找到任何规则')
      return
    }

    const selected = await p.multiselect({
      message: '选择要下载的远程规则',
      options: allRemote.map(r => ({
        value: `${r.name}@${r.source}`,
        label: r.name,
        hint: r.meta?.description || r.source,
      })),
      required: true,
    })

    if (p.isCancel(selected)) {
      consola.info('已取消')
      return
    }

    // 批量下载
    let successCount = 0
    const installedRules: string[] = []
    for (const key of selected as string[]) {
      const [rName, rSource] = key.split('@')
      const src = sources.find(s => getSourceKey(s) === rSource) || sources[0]
      const result = await downloadSingle(rName, src, storeOptions, options.force)
      if (result) {
        successCount++
        installedRules.push(rName)
      }
    }

    consola.log('')
    consola.success(`已下载 ${successCount} 条规则到本地 store`)
    if (installedRules.length > 0) {
      consola.info(`进入 ${pc.cyan('rules a')} 选择 agents 并应用已下载规则`)
      await applyRulesByNames(installedRules, { global: isGlobal, force: options.force })
    }
    return
  }

  let installed = false
  if (options.source) {
    installed = await downloadSingle(ruleName, ruleSource, storeOptions, options.force)
  }
  else {
    installed = await downloadFromSources(ruleName, sources, storeOptions, options.force, {
      fallbackToCursorDirectory: true,
    })
  }

  if (!installed) {
    return
  }

  consola.info(`进入 ${pc.cyan(`rules a ${ruleName}`)} 选择 agents 并应用规则`)
  await applyRulesByNames([ruleName], { global: isGlobal, force: options.force })
}

async function installFromCursorDirectory(
  name: string | undefined,
  storeOptions: { global?: boolean, cwd?: string },
  force?: boolean,
): Promise<boolean> {
  if (name)
    return downloadCursorDirectorySingle(name, storeOptions, force)

  consola.log(pc.dim('正在搜索 cursor.directory 规则...\n'))

  let allRemote
  try {
    allRemote = await searchCursorDirectoryRules()
  }
  catch (err) {
    consola.error(`cursor.directory 搜索失败: ${err instanceof Error ? err.message : err}`)
    return false
  }

  if (allRemote.length === 0) {
    consola.info('cursor.directory 没有找到任何规则')
    return false
  }

  const selected = await p.multiselect({
    message: '选择要从 cursor.directory 下载的规则',
    options: allRemote.map(r => ({
      value: r.name,
      label: r.name,
      hint: r.meta?.name || r.source,
    })),
    required: true,
  })

  if (p.isCancel(selected)) {
    consola.info('已取消')
    return false
  }

  let successCount = 0
  const installedRules: string[] = []
  for (const ruleName of selected as string[]) {
    const result = await downloadCursorDirectorySingle(ruleName, storeOptions, force)
    if (result) {
      successCount++
      installedRules.push(ruleName)
    }
  }

  consola.log('')
  consola.success(`已从 cursor.directory 下载 ${successCount} 条规则到本地 store`)
  if (installedRules.length > 0) {
    consola.info(`进入 ${pc.cyan('rules a')} 选择 agents 并应用已下载规则`)
    await applyRulesByNames(installedRules, { global: storeOptions.global, force })
  }

  return successCount > 0
}

function canDownload(name: string, storeOptions: { global?: boolean, cwd?: string }, force?: boolean): boolean {
  // 检查是否已存在
  const ruleDir = getStoreRuleDir(name, storeOptions)
  if (existsSync(ruleDir) && !force) {
    consola.warn(`${pc.yellow(name)} 已存在本地（使用 --force 覆盖）`)
    return false
  }

  return true
}

async function downloadFromSources(
  name: string,
  sources: RuleSource[],
  storeOptions: { global?: boolean, cwd?: string },
  force?: boolean,
  options: { fallbackToCursorDirectory?: boolean } = {},
): Promise<boolean> {
  if (!canDownload(name, storeOptions, force))
    return false

  const errors: string[] = []

  for (const source of sources) {
    try {
      consola.log(pc.dim(`正在从 ${getSourceKey(source)} 下载 ${name} ...`))
      const dir = await downloadRule(source, name, storeOptions)
      consola.success(`${pc.green(name)} → ${pc.dim(dir)}`)
      return true
    }
    catch (err) {
      errors.push(`${getSourceKey(source)}: ${err instanceof Error ? err.message : err}`)
    }
  }

  consola.error(`下载失败: ${name}`)
  for (const error of errors) {
    consola.log(pc.dim(`  ${error}`))
  }

  if (options.fallbackToCursorDirectory) {
    consola.log(pc.dim(`正在尝试从 cursor.directory 下载 ${name} ...`))
    return await downloadCursorDirectorySingle(name, storeOptions, force, {
      skipExistingCheck: true,
    })
  }

  return false
}

async function downloadSingle(
  name: string,
  source: RuleSource,
  storeOptions: { global?: boolean, cwd?: string },
  force?: boolean,
): Promise<boolean> {
  if (!canDownload(name, storeOptions, force))
    return false

  try {
    consola.log(pc.dim(`正在从 ${getSourceKey(source)} 下载 ${name} ...`))
    const dir = await downloadRule(source, name, storeOptions)
    consola.success(`${pc.green(name)} → ${pc.dim(dir)}`)
    return true
  }
  catch (err) {
    consola.error(`下载失败: ${name} — ${err instanceof Error ? err.message : err}`)
    return false
  }
}

async function downloadCursorDirectorySingle(
  name: string,
  storeOptions: { global?: boolean, cwd?: string },
  force?: boolean,
  options: { skipExistingCheck?: boolean } = {},
): Promise<boolean> {
  if (!options.skipExistingCheck && !canDownload(name, storeOptions, force))
    return false

  try {
    consola.log(pc.dim(`正在从 cursor.directory 下载 ${name} ...`))
    const dir = await downloadCursorDirectoryRule(name, storeOptions)
    consola.success(`${pc.green(name)} → ${pc.dim(dir)}`)
    return true
  }
  catch (err) {
    consola.error(`下载失败: ${name} — ${err instanceof Error ? err.message : err}`)
    return false
  }
}
