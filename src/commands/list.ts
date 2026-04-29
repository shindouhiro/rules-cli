import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import consola from 'consola'
import pc from 'picocolors'
import { AGENTS, resolveAgentPath } from '~/core/agents'
import { getStoreDir, listStoreRuleNames } from '~/core/store'

export interface ListOptions {
  store?: boolean
  project?: boolean
  global?: boolean
}

type ListScope = 'project' | 'global'

export async function listCommand(options: ListOptions): Promise<void> {
  const cwd = process.cwd()
  const scopes = getListScopes(options)
  const isStoreMode = options.store ?? false
  let totalFound = 0

  for (const scope of scopes) {
    const scopeFound = isStoreMode
      ? listStoreScope(scope, cwd)
      : listAppliedScope(scope, cwd)
    totalFound += scopeFound
  }

  if (totalFound === 0) {
    if (isStoreMode) {
      consola.info('没有找到 store 规则')
      consola.info(`运行 ${pc.cyan('rules create <name>')} 创建规则`)
    }
    else {
      consola.info('没有找到已应用的规则')
      consola.info(`运行 ${pc.cyan('rules apply')} 开始应用规则`)
    }
  }
  else {
    consola.log(`\n${pc.dim(`共 ${totalFound} 条规则`)}`)
  }
}

function getListScopes(options: ListOptions): ListScope[] {
  if (options.project && !options.global)
    return ['project']
  if (options.global && !options.project)
    return ['global']
  return ['project', 'global']
}

function listAppliedScope(scope: ListScope, cwd: string): number {
  const isGlobal = scope === 'global'
  let found = 0

  consola.log(`\n${pc.bold(scope === 'global' ? '全局规则' : '当前项目规则')}`)

  // 按目标路径分组 agents，避免同一文件重复显示
  const directoryAgents: typeof AGENTS = []
  const singleFileGroups = new Map<string, typeof AGENTS>()

  for (const agent of AGENTS) {
    if (agent.rulesType === 'directory') {
      directoryAgents.push(agent)
    }
    else {
      const targetPath = resolveAgentPath(agent, { global: isGlobal, cwd })
      const group = singleFileGroups.get(targetPath) || []
      group.push(agent)
      singleFileGroups.set(targetPath, group)
    }
  }

  // 目录型 agents（各自独立，不会共享目录）
  for (const agent of directoryAgents) {
    const baseDir = resolveAgentPath(agent, { global: isGlobal, cwd })
    if (!existsSync(baseDir))
      continue

    const entries = readdirSync(baseDir, { withFileTypes: true })
    const rules = entries.filter(e => e.isFile() || e.isSymbolicLink())

    if (rules.length === 0)
      continue

    consola.log(`\n${pc.bold(pc.cyan(agent.name))} ${pc.dim(baseDir)}`)

    for (const entry of rules) {
      const fullPath = join(baseDir, entry.name)
      const isLink = lstatSync(fullPath).isSymbolicLink()
      const icon = isLink ? pc.green('🔗') : pc.dim('📄')
      const status = isLink ? pc.dim('(symlink)') : ''
      consola.log(`  ${icon} ${entry.name} ${status}`)
      found++
    }
  }

  // 单文件型 agents（按路径去重，同一文件合并显示）
  for (const [targetFile, agents] of singleFileGroups) {
    if (!existsSync(targetFile))
      continue

    const content = readFileSync(targetFile, 'utf-8')
    const markerStart = agents[0].injectMarkerStart || '<!-- rules-cli:start -->'

    if (!content.includes(markerStart))
      continue

    // 提取注入的规则名称
    const ruleNames = [...content.matchAll(/<!-- rule: (.+?) -->/g)].map(m => m[1])

    if (ruleNames.length === 0)
      continue

    // 合并多个 agent 名称显示（如 "Gemini CLI / Antigravity"）
    const agentLabel = agents.map(a => a.name).join(' / ')
    consola.log(`\n${pc.bold(pc.cyan(agentLabel))} ${pc.dim(targetFile)}`)

    for (const name of ruleNames) {
      consola.log(`  ${pc.green('💉')} ${name} ${pc.dim('(injected)')}`)
      found++
    }
  }

  if (found === 0)
    consola.log(`  ${pc.dim('无')}`)

  return found
}

function listStoreScope(scope: ListScope, cwd: string): number {
  const isGlobal = scope === 'global'
  const names = listStoreRuleNames({ global: isGlobal, cwd })
  const dir = getStoreDir({ global: isGlobal, cwd })

  consola.log(`\n${pc.bold(scope === 'global' ? '全局 Store' : '当前项目 Store')} ${pc.dim(dir)}`)

  if (names.length === 0) {
    consola.log(`  ${pc.dim('无')}`)
    return 0
  }

  for (const name of names) {
    consola.log(`  ${pc.cyan('📦')} ${name}`)
  }

  return names.length
}
