#!/usr/bin/env node
import process from 'node:process'
import cac from 'cac'
import consola from 'consola'
import pc from 'picocolors'
import { applyCommand } from '~/commands/apply'
import { createCommand } from '~/commands/create'
import { initCommand } from '~/commands/init'
import { listCommand } from '~/commands/list'
import { removeCommand } from '~/commands/remove'
import { searchCommand } from '~/commands/search'
import { version } from '../package.json'

const cli = cac('rules')

// === Banner ===
function showBanner(): void {
  consola.log('')
  consola.log(`${pc.bold(pc.cyan('  📐 Rules CLI'))} ${pc.dim(`v${version}`)}`)
  consola.log(pc.dim('  AI Agent Rules 管理工具'))
  consola.log('')
}

// === search ===
cli
  .command('search [keyword]', '搜索本地规则 (alias: s)')
  .alias('s')
  .action(async (keyword?: string) => {
    showBanner()
    await searchCommand(keyword)
  })

// === apply ===
cli
  .command('apply [name]', '应用规则到 agents (alias: a)')
  .alias('a')
  .option('-a, --agent <agents>', '目标助手，逗号分隔（如 cursor,claude-code）')
  .option('-g, --global', '应用到全局（用户级）目录')
  .option('-f, --force', '强制覆盖已存在的规则')
  .action(async (name: string | undefined, options: { agent?: string, global?: boolean, force?: boolean }) => {
    showBanner()
    await applyCommand(name, options)
  })

// === list ===
cli
  .command('list', '列出已应用的规则 (alias: ls)')
  .alias('ls')
  .option('-g, --global', '列出全局已应用的规则')
  .action(async (options: { global?: boolean }) => {
    showBanner()
    await listCommand(options)
  })

// === remove ===
cli
  .command('remove [name]', '移除已应用的规则 (alias: rm)')
  .alias('rm')
  .alias('delete')
  .option('-a, --agent <agents>', '目标助手，逗号分隔')
  .option('-g, --global', '从全局目录移除')
  .action(async (name: string | undefined, options: { agent?: string, global?: boolean }) => {
    showBanner()
    await removeCommand(name, options)
  })

// === create ===
cli
  .command('create <name>', '创建新规则模板 (alias: new)')
  .alias('new')
  .action(async (name: string) => {
    showBanner()
    await createCommand(name)
  })

// === init ===
cli
  .command('init', '初始化配置和存储目录 (alias: i)')
  .alias('i')
  .option('-g, --global', '初始化全局配置')
  .action(async (options: { global?: boolean }) => {
    showBanner()
    await initCommand(options)
  })

// === Global options ===
cli.help()
cli.version(version)

// === Run ===
async function main(): Promise<void> {
  try {
    cli.parse()

    if (!cli.matchedCommand) {
      showBanner()
      cli.outputHelp()
    }
  }
  catch (err) {
    consola.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
}

main()
