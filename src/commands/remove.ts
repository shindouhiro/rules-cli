import type { AgentRulesDef } from '~/types'
import { existsSync, lstatSync, readdirSync, readFileSync, rmSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import * as p from '@clack/prompts'
import consola from 'consola'
import pc from 'picocolors'
import { AGENTS, getAgentsByIds, resolveAgentPath } from '~/core/agents'
import { removeRuleFromSingleFileAgent, removeRuleReferencesFromDirectoryAgent } from '~/core/linker'
import { getRuleByName } from '~/core/scanner'
import { getStoreRuleDir, listStoreRuleNames } from '~/core/store'
import { printSection } from '~/core/ui'

export interface RemoveOptions {
  agent?: string
  store?: boolean
  interactive?: boolean
  global?: boolean
  project?: boolean
}

interface AppliedRule {
  kind: 'applied'
  name: string
  agent: AgentRulesDef
  agentLabel: string
  path: string
  scope: 'global' | 'project'
  mode: 'symlink' | 'injected'
}

interface StoreRule {
  kind: 'store'
  name: string
  path: string
  scope: 'global' | 'project'
}

type RemovableItem = AppliedRule | StoreRule

function getScopes(options: RemoveOptions): Array<'global' | 'project'> {
  if (options.global && options.project)
    return ['project', 'global']
  if (options.global)
    return ['global']
  if (options.project)
    return ['project']
  if (options.interactive)
    return ['project', 'global']
  return ['global']
}

function findAppliedRules(
  agents: AgentRulesDef[],
  scope: 'global' | 'project',
  cwd: string,
): AppliedRule[] {
  const found: AppliedRule[] = []
  const isGlobal = scope === 'global'

  // 目录型 agent
  for (const agent of agents) {
    if (agent.rulesType !== 'directory')
      continue

    const baseDir = resolveAgentPath(agent, { global: isGlobal, cwd })
    if (!existsSync(baseDir))
      continue

    for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.isFile() && !entry.isSymbolicLink())
        continue

      const fullPath = join(baseDir, entry.name)
      const isLink = lstatSync(fullPath).isSymbolicLink()
      const ruleName = entry.name.replace(/\.[^.]+$/, '')
      found.push({
        kind: 'applied',
        name: ruleName,
        agent,
        agentLabel: agent.name,
        path: fullPath,
        scope,
        mode: isLink ? 'symlink' : 'symlink',
      })
    }
  }

  // 单文件型 agent：按目标路径分组，避免同路径重复展示（如 Gemini CLI / Antigravity）
  const singleFileGroups = new Map<string, AgentRulesDef[]>()
  for (const agent of agents) {
    if (agent.rulesType !== 'single-file')
      continue
    const targetFile = resolveAgentPath(agent, { global: isGlobal, cwd })
    const group = singleFileGroups.get(targetFile) || []
    group.push(agent)
    singleFileGroups.set(targetFile, group)
  }

  for (const [targetFile, groupAgents] of singleFileGroups) {
    if (!existsSync(targetFile))
      continue

    const content = readFileSync(targetFile, 'utf-8')
    const ruleNames = [...content.matchAll(/<!-- rule: (.+?) -->/g)].map(m => m[1])
    if (ruleNames.length === 0)
      continue

    const primary = groupAgents[0]
    const agentLabel = groupAgents.map(a => a.name).join(' / ')

    for (const name of ruleNames) {
      found.push({
        kind: 'applied',
        name,
        agent: primary,
        agentLabel,
        path: targetFile,
        scope,
        mode: 'injected',
      })
    }
  }

  return found
}

function findStoreRules(scope: 'global' | 'project', cwd: string): StoreRule[] {
  const isGlobal = scope === 'global'
  return listStoreRuleNames({ global: isGlobal, cwd }).map(name => ({
    kind: 'store',
    name,
    path: getStoreRuleDir(name, { global: isGlobal, cwd }),
    scope,
  }))
}

function renderItem(item: RemovableItem): { key: string, label: string, hint: string } {
  if (item.kind === 'store') {
    return {
      key: `store:${item.scope}:${item.name}:${item.path}`,
      label: `[store/${item.scope}] ${item.name}`,
      hint: item.path,
    }
  }

  return {
    key: `applied:${item.scope}:${item.name}:${item.agent.id}:${item.path}`,
    label: `[applied/${item.scope}] ${item.name} → ${item.agentLabel}`,
    hint: item.mode,
  }
}

function removeOne(item: RemovableItem, cwd: string): { success: boolean, message: string } {
  if (item.kind === 'store') {
    try {
      rmSync(item.path, { recursive: true, force: true })
      return {
        success: true,
        message: `${pc.red('✗')} ${item.name} ${pc.dim(`[store/${item.scope}]`)}`,
      }
    }
    catch (err) {
      return {
        success: false,
        message: `移除失败: ${item.name} [store/${item.scope}]: ${err}`,
      }
    }
  }

  if (item.mode === 'symlink') {
    try {
      const rule = getRuleByName(item.name, { cwd, global: item.scope === 'global' })
      if (rule)
        removeRuleReferencesFromDirectoryAgent(rule, item.agent, { global: item.scope === 'global', cwd })
      unlinkSync(item.path)
      return {
        success: true,
        message: `${pc.red('✗')} ${item.name} → ${pc.cyan(item.agentLabel)} ${pc.dim(`[${item.scope}]`)}`,
      }
    }
    catch (err) {
      return {
        success: false,
        message: `移除失败: ${item.name} → ${item.agentLabel}: ${err}`,
      }
    }
  }

  const rule = getRuleByName(item.name, { cwd, global: item.scope === 'global' })
  const result = removeRuleFromSingleFileAgent(item.name, item.agent, { global: item.scope === 'global', cwd, rule })
  if (result.success) {
    return {
      success: true,
      message: `${pc.red('✗')} ${item.name} → ${pc.cyan(item.agentLabel)} ${pc.dim(`[${item.scope}]`)}`,
    }
  }
  return {
    success: false,
    message: `移除失败: ${item.name} → ${item.agentLabel}: ${result.error}`,
  }
}

export async function removeCommand(name: string | undefined, options: RemoveOptions): Promise<void> {
  printSection('移除规则')
  const cwd = process.cwd()
  const scopes = getScopes(options)
  const includeStore = options.store || options.interactive
  const includeApplied = !options.store || options.interactive

  const agents = options.agent
    ? getAgentsByIds(options.agent.split(',').map(s => s.trim()))
    : AGENTS

  if (options.agent && agents.length === 0) {
    consola.error(`未找到匹配的 Agent: ${options.agent}`)
    return
  }

  let allItems: RemovableItem[] = []

  for (const scope of scopes) {
    if (includeApplied) {
      allItems = allItems.concat(findAppliedRules(agents, scope, cwd))
    }
    if (includeStore) {
      allItems = allItems.concat(findStoreRules(scope, cwd))
    }
  }

  if (allItems.length === 0) {
    consola.info('没有找到可移除的规则')
    return
  }

  if (name) {
    allItems = allItems.filter(item => item.name === name)
    if (allItems.length === 0) {
      consola.error(`没有找到规则 "${name}"`)
      return
    }
  }

  let toRemove: RemovableItem[]

  const shouldInteractivePick = options.interactive || !name
  if (shouldInteractivePick) {
    const unique = [...new Map(allItems.map((item) => {
      const rendered = renderItem(item)
      return [rendered.key, item] as const
    })).values()]

    const selected = await p.multiselect({
      message: '选择要移除的规则',
      options: unique.map((item) => {
        const rendered = renderItem(item)
        return {
          value: rendered.key,
          label: rendered.label,
          hint: rendered.hint,
        }
      }),
      required: true,
    })

    if (p.isCancel(selected)) {
      consola.info('已取消')
      return
    }

    const pickedKeys = new Set(selected as string[])
    toRemove = unique.filter((item) => {
      const rendered = renderItem(item)
      return pickedKeys.has(rendered.key)
    })
  }
  else {
    toRemove = allItems
  }

  let successCount = 0
  let failCount = 0

  for (const item of toRemove) {
    const result = removeOne(item, cwd)
    if (result.success) {
      consola.success(result.message)
      successCount++
    }
    else {
      consola.error(result.message)
      failCount++
    }
  }

  consola.log('')
  if (successCount > 0)
    consola.success(`已移除 ${successCount} 条规则`)
  if (failCount > 0)
    consola.warn(`${failCount} 条移除失败`)
}
