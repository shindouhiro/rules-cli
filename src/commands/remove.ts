import type { AgentRulesDef } from '~/types'
import { existsSync, lstatSync, readdirSync, readFileSync, unlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import * as p from '@clack/prompts'
import consola from 'consola'
import pc from 'picocolors'
import { AGENTS, expandHome, getAgentsByIds } from '~/core/agents'
import { removeRuleFromSingleFileAgent } from '~/core/linker'

export interface RemoveOptions {
  agent?: string
  global?: boolean
}

interface FoundRule {
  name: string
  agent: AgentRulesDef
  path: string
  mode: 'symlink' | 'injected'
}

/**
 * 扫描所有已应用的规则
 */
function findAppliedRules(agents: AgentRulesDef[], isGlobal: boolean, cwd: string): FoundRule[] {
  const found: FoundRule[] = []

  for (const agent of agents) {
    const baseDir = isGlobal
      ? expandHome(agent.globalPath)
      : resolve(cwd, agent.projectPath)

    if (agent.rulesType === 'directory') {
      if (!existsSync(baseDir))
        continue

      for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
        if (!entry.isFile() && !entry.isSymbolicLink())
          continue
        const fullPath = join(baseDir, entry.name)
        const isLink = lstatSync(fullPath).isSymbolicLink()
        const ruleName = entry.name.replace(/\.[^.]+$/, '')
        found.push({ name: ruleName, agent, path: fullPath, mode: isLink ? 'symlink' : 'symlink' })
      }
    }
    else {
      const targetFile = isGlobal
        ? expandHome(agent.globalPath)
        : resolve(cwd, agent.projectPath)

      if (!existsSync(targetFile))
        continue

      const content = readFileSync(targetFile, 'utf-8')
      const ruleNames = [...content.matchAll(/<!-- rule: (.+?) -->/g)].map(m => m[1])

      for (const name of ruleNames) {
        found.push({ name, agent, path: targetFile, mode: 'injected' })
      }
    }
  }

  return found
}

export async function removeCommand(name: string | undefined, options: RemoveOptions): Promise<void> {
  const cwd = process.cwd()
  const isGlobal = options.global ?? false

  const agents = options.agent
    ? getAgentsByIds(options.agent.split(',').map(s => s.trim()))
    : AGENTS

  const allApplied = findAppliedRules(agents, isGlobal, cwd)

  if (allApplied.length === 0) {
    consola.info('没有找到已应用的规则')
    return
  }

  let toRemove: FoundRule[]

  if (name) {
    toRemove = allApplied.filter(r => r.name === name)
    if (toRemove.length === 0) {
      consola.error(`没有找到规则 "${name}"`)
      return
    }
  }
  else {
    // 去重显示
    const uniqueLabels = [...new Map(allApplied.map(r => [
      `${r.name}@${r.agent.id}`,
      r,
    ])).values()]

    const selected = await p.multiselect({
      message: '选择要移除的规则',
      options: uniqueLabels.map(r => ({
        value: `${r.name}@${r.agent.id}`,
        label: `${r.name} → ${r.agent.name}`,
        hint: r.mode,
      })),
      required: true,
    })

    if (p.isCancel(selected)) {
      consola.info('已取消')
      return
    }

    toRemove = (selected as string[]).map((key) => {
      const [ruleName, agentId] = key.split('@')
      return allApplied.find(r => r.name === ruleName && r.agent.id === agentId)!
    }).filter(Boolean)
  }

  // 执行移除
  let successCount = 0

  for (const item of toRemove) {
    if (item.mode === 'symlink') {
      try {
        unlinkSync(item.path)
        consola.success(`${pc.red('✗')} ${item.name} → ${pc.cyan(item.agent.name)}`)
        successCount++
      }
      catch (err) {
        consola.error(`移除失败: ${item.name} → ${item.agent.name}: ${err}`)
      }
    }
    else {
      const result = removeRuleFromSingleFileAgent(item.name, item.agent, { global: isGlobal, cwd })
      if (result.success) {
        consola.success(`${pc.red('✗')} ${item.name} → ${pc.cyan(item.agent.name)}`)
        successCount++
      }
      else {
        consola.error(`移除失败: ${item.name} → ${item.agent.name}: ${result.error}`)
      }
    }
  }

  consola.log('')
  consola.success(`已移除 ${successCount} 条规则`)
}
