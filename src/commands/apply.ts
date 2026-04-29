import type { AgentRulesDef, RuleInfo } from '~/types'
import process from 'node:process'
import * as p from '@clack/prompts'
import consola from 'consola'
import pc from 'picocolors'
import { AGENTS, getAgentsByIds } from '~/core/agents'
import { loadConfig } from '~/core/config'
import { injectRuleToSingleFileAgent, linkRuleToDirectoryAgent } from '~/core/linker'
import { getRuleByName, scanStoreRules } from '~/core/scanner'

export interface ApplyOptions {
  agent?: string
  global?: boolean
  force?: boolean
}

export async function applyCommand(name: string | undefined, options: ApplyOptions): Promise<void> {
  const cwd = process.cwd()
  const config = loadConfig(cwd)
  const isGlobal = options.global ?? false

  // === 选择规则 ===
  let selectedRules: RuleInfo[]

  if (name) {
    const rule = getRuleByName(name)
    if (!rule) {
      consola.error(`规则 "${name}" 不存在`)
      return
    }
    selectedRules = [rule]
  }
  else {
    const allRules = scanStoreRules()
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
      .map(n => getRuleByName(n))
      .filter((r): r is RuleInfo => r !== undefined)
  }

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
  else if (config.defaultAgents.length > 0) {
    targetAgents = getAgentsByIds(config.defaultAgents)
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

  // === 执行应用 ===
  consola.log('')
  let successCount = 0
  let failCount = 0

  for (const rule of selectedRules) {
    for (const agent of targetAgents) {
      const result = agent.rulesType === 'directory'
        ? linkRuleToDirectoryAgent(rule, agent, { global: isGlobal, cwd, force: options.force })
        : injectRuleToSingleFileAgent(rule, agent, { global: isGlobal, cwd, force: options.force })

      if (result.success) {
        consola.success(`${pc.green(rule.name)} → ${pc.cyan(agent.name)} ${pc.dim(result.targetPath)}`)
        successCount++
      }
      else {
        consola.warn(`${pc.yellow(rule.name)} → ${pc.cyan(agent.name)} ${pc.dim(result.error || '未知错误')}`)
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
