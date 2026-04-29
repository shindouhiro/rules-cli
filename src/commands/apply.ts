import type { AgentRulesDef, RuleInfo } from '~/types'
import process from 'node:process'
import * as p from '@clack/prompts'
import consola from 'consola'
import pc from 'picocolors'
import { AGENTS, getAgentsByIds, resolveAgentPath } from '~/core/agents'
import { loadConfig } from '~/core/config'
import { injectRuleToSingleFileAgent, linkRuleToDirectoryAgent } from '~/core/linker'
import { getRuleByName, scanStoreRules } from '~/core/scanner'
import { resolveIsGlobal } from '~/core/scope'

export interface ApplyOptions {
  agent?: string
  global?: boolean
  project?: boolean
  force?: boolean
}

interface ApplyTarget {
  agent: AgentRulesDef
  displayName: string
}

export async function applyCommand(name: string | undefined, options: ApplyOptions): Promise<void> {
  const cwd = process.cwd()
  const config = loadConfig(cwd)
  const isGlobal = resolveIsGlobal(options)

  // === 选择规则 ===
  let selectedRules: RuleInfo[]

  if (name) {
    const rule = getRuleByName(name, { cwd, global: isGlobal })
    if (!rule) {
      consola.error(`规则 "${name}" 不存在`)
      return
    }
    selectedRules = [rule]
  }
  else {
    const allRules = scanStoreRules({ cwd, global: isGlobal })
    if (allRules.length === 0) {
      consola.info('没有找到任何规则')
      consola.info(`运行 ${pc.cyan('rules create <name>')} 创建一条新规则`)
      return
    }

    const selected = await p.multiselect({
      message: '选择要应用的规则',
      options: allRules.map(r => ({
        value: r.name,
        label: r.name,
        hint: r.meta?.description,
      })),
      required: true,
    })

    if (p.isCancel(selected)) {
      consola.info('已取消')
      return
    }

    selectedRules = (selected as string[])
      .map(n => getRuleByName(n, { cwd, global: isGlobal }))
      .filter((r): r is RuleInfo => r !== undefined)
  }

  await applySelectedRules(selectedRules, options, isGlobal, cwd, config.defaultAgents)
}

export async function applyRulesByNames(ruleNames: string[], options: ApplyOptions = {}): Promise<void> {
  const cwd = process.cwd()
  const isGlobal = resolveIsGlobal(options)
  const config = loadConfig(cwd)
  const selectedRules = ruleNames
    .map(name => getRuleByName(name, { cwd, global: isGlobal }))
    .filter((r): r is RuleInfo => r !== undefined)

  if (selectedRules.length === 0) {
    consola.warn('没有可应用的已下载规则')
    return
  }

  await applySelectedRules(selectedRules, options, isGlobal, cwd, config.defaultAgents)
}

async function applySelectedRules(
  selectedRules: RuleInfo[],
  options: ApplyOptions,
  isGlobal: boolean,
  cwd: string,
  defaultAgents: string[],
): Promise<void> {
  // === 选择目标 agents ===
  let targetAgents: AgentRulesDef[]

  if (options.agent) {
    const ids = options.agent.split(',').map(s => s.trim())
    targetAgents = getAgentsByIds(ids)
    if (targetAgents.length === 0) {
      consola.error(`未找到匹配的 Agent: ${options.agent}`)
      return
    }
  }
  else if (defaultAgents.length > 0) {
    const selected = await p.multiselect({
      message: '选择目标 Agents',
      options: AGENTS.map(a => ({
        value: a.id,
        label: `${a.name} ${pc.dim(`(${a.rulesType})`)}`,
        hint: isGlobal ? a.globalPath : a.projectPath,
      })),
      initialValues: getAgentsByIds(defaultAgents).map(a => a.id),
      required: true,
    })

    if (p.isCancel(selected)) {
      consola.info('已取消')
      return
    }

    targetAgents = getAgentsByIds(selected as string[])
  }
  else {
    const selected = await p.multiselect({
      message: '选择目标 Agents',
      options: AGENTS.map(a => ({
        value: a.id,
        label: `${a.name} ${pc.dim(`(${a.rulesType})`)}`,
        hint: isGlobal ? a.globalPath : a.projectPath,
      })),
      required: true,
    })

    if (p.isCancel(selected)) {
      consola.info('已取消')
      return
    }

    targetAgents = getAgentsByIds(selected as string[])
  }

  const targets = mergeSameSingleFileTargets(targetAgents, isGlobal, cwd)

  // === 执行应用 ===
  consola.log('')
  let successCount = 0
  let failCount = 0

  for (const rule of selectedRules) {
    for (const target of targets) {
      const result = target.agent.rulesType === 'directory'
        ? linkRuleToDirectoryAgent(rule, target.agent, { global: isGlobal, cwd, force: options.force })
        : injectRuleToSingleFileAgent(rule, target.agent, { global: isGlobal, cwd, force: options.force })

      if (result.success) {
        consola.success(`${pc.green(rule.name)} → ${pc.cyan(target.displayName)} ${pc.dim(result.targetPath)}`)
        successCount++
      }
      else {
        consola.warn(`${pc.yellow(rule.name)} → ${pc.cyan(target.displayName)} ${pc.dim(result.error || '未知错误')}`)
        failCount++
      }
    }
  }

  consola.log('')
  if (successCount > 0) {
    consola.success(`已应用 ${successCount} 条规则`)
  }
  if (failCount > 0) {
    consola.warn(`${failCount} 条跳过或失败`)
  }
}

function mergeSameSingleFileTargets(
  agents: AgentRulesDef[],
  isGlobal: boolean,
  cwd: string,
): ApplyTarget[] {
  const merged: ApplyTarget[] = []
  const groupedSingleFile = new Map<string, { agent: AgentRulesDef, names: string[] }>()

  for (const agent of agents) {
    if (agent.rulesType !== 'single-file') {
      merged.push({ agent, displayName: agent.name })
      continue
    }

    const targetPath = resolveAgentPath(agent, { global: isGlobal, cwd })
    const existing = groupedSingleFile.get(targetPath)

    if (existing) {
      existing.names.push(agent.name)
    }
    else {
      groupedSingleFile.set(targetPath, { agent, names: [agent.name] })
    }
  }

  let mergedCount = 0
  for (const group of groupedSingleFile.values()) {
    if (group.names.length > 1)
      mergedCount += group.names.length - 1
    merged.push({
      agent: group.agent,
      displayName: group.names.join(' / '),
    })
  }

  if (mergedCount > 0) {
    consola.info(`检测到共享目标文件的 Agent，已合并 ${mergedCount} 项重复写入`)
  }

  return merged
}
