import * as p from '@clack/prompts'
import consola from 'consola'
import pc from 'picocolors'
import { AGENTS } from '~/core/agents'
import { getGlobalConfigPath, saveConfig } from '~/core/config'
import { resolveIsGlobal } from '~/core/scope'
import { ensureStoreDir, getStoreDir } from '~/core/store'
import { printScope, printSection } from '~/core/ui'

export interface InitOptions {
  global?: boolean
  project?: boolean
}

export async function initCommand(options: InitOptions): Promise<void> {
  const isGlobal = resolveIsGlobal(options)
  printSection('初始化配置')
  printScope(isGlobal)
  consola.log('')

  // 选择默认 agents
  const selected = await p.multiselect({
    message: '选择默认目标 Agents（可多选）',
    options: AGENTS.map(a => ({
      value: a.id,
      label: `${a.name} ${pc.dim(`(${a.rulesType})`)}`,
    })),
    required: false,
  })

  if (p.isCancel(selected)) {
    consola.info('已取消')
    return
  }

  const defaultAgents = (selected as string[]) || []

  // 确保 store 目录存在
  ensureStoreDir({ global: isGlobal })

  // 保存配置
  const configPath = isGlobal
    ? getGlobalConfigPath()
    : '.rulesrc'

  saveConfig(
    {
      defaultAgents,
      scope: isGlobal ? 'global' : 'project',
    },
    configPath,
  )

  consola.success(`配置已保存: ${pc.dim(configPath)}`)
  consola.success(`规则存储目录: ${pc.dim(getStoreDir({ global: isGlobal }))}`)
  consola.log('')
  consola.info(`下一步: 运行 ${pc.cyan('rules create <name>')} 创建你的第一条规则`)
}
