import * as p from '@clack/prompts'
import consola from 'consola'
import pc from 'picocolors'
import { AGENTS } from '~/core/agents'
import { getGlobalConfigPath, saveConfig } from '~/core/config'
import { ensureStoreDir, getGlobalStoreDir } from '~/core/store'

export interface InitOptions {
  global?: boolean
}

export async function initCommand(options: InitOptions): Promise<void> {
  const isGlobal = options.global ?? false

  consola.log('')
  consola.log(pc.bold('🔧 初始化 Rules CLI 配置'))
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
  ensureStoreDir()

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
  consola.success(`规则存储目录: ${pc.dim(getGlobalStoreDir())}`)
  consola.log('')
  consola.info(`下一步: 运行 ${pc.cyan('rules create <name>')} 创建你的第一条规则`)
}
