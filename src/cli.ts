#!/usr/bin/env node
import process from 'node:process'
import cac from 'cac'
import consola from 'consola'
import pc from 'picocolors'
import { applyCommand } from '~/commands/apply'
import { createCommand } from '~/commands/create'
import { initCommand } from '~/commands/init'
import { installCommand } from '~/commands/install'
import { listCommand } from '~/commands/list'
import { publishCommand } from '~/commands/publish'
import { removeCommand } from '~/commands/remove'
import { searchCommand } from '~/commands/search'
import { uiCommand } from '~/commands/ui'
import { printDivider } from '~/core/ui'
import { version } from '../package.json'

const cli = cac('rules')

const COMMAND_HELP = [
  ['search [keyword]', '搜索规则', '-r, --remote  -c, --cursor'],
  ['apply [name]', '应用规则到 agents', '-a, --agent  -g, --global  -p, --project  -f, --force'],
  ['list', '列出规则', '-s, --store  -g, --global  -p, --project'],
  ['remove [name]', '移除已应用的规则', '-a, --agent  -s, --store  -i, --interactive  -g, --global  -p, --project'],
  ['create <name>', '创建新规则模板', '-g, --global  -p, --project'],
  ['install [name]', '从远程源下载规则', '-s, --source  -c, --cursor  -g, --global  -p, --project  -f, --force'],
  ['publish', '发布规则到远程 Git 仓库', '--repo  --source  --branch  --path  --dry-run'],
  ['init', '初始化配置和存储目录', '-g, --global  -p, --project'],
  ['ui', '启动 Web 图形化操作控制台', '-p, --port'],
] as const

function isHelpOption(options: { help?: boolean }): boolean {
  return options.help === true
}

function formatCommandHelp(): string {
  const commandWidth = Math.max(...COMMAND_HELP.map(([command]) => command.length))
  const descWidth = Math.max(...COMMAND_HELP.map(([, desc]) => desc.length))

  return COMMAND_HELP
    .map(([command, desc, options]) =>
      `  ${command.padEnd(commandWidth)}  ${desc.padEnd(descWidth)}  ${pc.dim(options)}`,
    )
    .join('\n')
}

// === Banner ===
function showBanner(): void {
  consola.log('')
  printDivider()
  consola.log(`${pc.bold(pc.cyan('  Rules CLI'))} ${pc.dim(`v${version}`)}`)
  consola.log(pc.dim('  Manage and sync AI Agent rules'))
  printDivider()
  consola.log('')
}

// === search ===
cli
  .command('search [keyword]', '搜索规则 (alias: s)')
  .alias('s')
  .option('-r, --remote', '同时搜索远程规则源')
  .option('-c, --cursor', '搜索 cursor.directory 规则')
  .action(async (keyword: string | undefined, options: { remote?: boolean, cursor?: boolean, help?: boolean }) => {
    if (isHelpOption(options))
      return
    showBanner()
    await searchCommand(keyword, options)
  })

// === apply ===
cli
  .command('apply [name]', '应用规则到 agents (alias: a)')
  .alias('a')
  .option('-a, --agent <agents>', '目标助手，逗号分隔（如 cursor,claude-code）')
  .option('-g, --global', '应用到全局（用户级）目录')
  .option('-p, --project', '应用到当前项目目录')
  .option('-f, --force', '强制覆盖已存在的规则')
  .action(async (name: string | undefined, options: { agent?: string, global?: boolean, project?: boolean, force?: boolean, help?: boolean }) => {
    if (isHelpOption(options))
      return
    showBanner()
    await applyCommand(name, options)
  })

// === list ===
cli
  .command('list', '列出规则 (alias: ls)')
  .alias('ls')
  .option('-s, --store', '列出 store 中的规则')
  .option('-p, --project', '只列出当前项目已应用的规则')
  .option('-g, --global', '只列出全局已应用的规则')
  .action(async (options: { store?: boolean, project?: boolean, global?: boolean, help?: boolean }) => {
    if (isHelpOption(options))
      return
    showBanner()
    await listCommand(options)
  })

// === remove ===
cli
  .command('remove [name]', '移除已应用的规则 (alias: rm)')
  .alias('rm')
  .alias('delete')
  .option('-a, --agent <agents>', '目标助手，逗号分隔')
  .option('-s, --store', '从规则 store 删除（默认删除已应用规则）')
  .option('-i, --interactive', '交互模式：下拉选择要删除的项（默认展示所有）')
  .option('-g, --global', '从全局目录移除')
  .option('-p, --project', '从当前项目目录移除')
  .action(async (name: string | undefined, options: { agent?: string, store?: boolean, interactive?: boolean, global?: boolean, project?: boolean, help?: boolean }) => {
    if (isHelpOption(options))
      return
    showBanner()
    await removeCommand(name, options)
  })

// === create ===
cli
  .command('create <name>', '创建新规则模板 (alias: c)')
  .alias('c')
  .option('-g, --global', '创建到全局 store')
  .option('-p, --project', '创建到当前项目 store')
  .action(async (name: string, options: { global?: boolean, project?: boolean, help?: boolean }) => {
    if (isHelpOption(options))
      return
    showBanner()
    await createCommand(name, options)
  })

// === install ===
cli
  .command('install [name]', '从远程源下载规则 (alias: i)')
  .alias('i')
  .option('-s, --source <repo>', '指定 GitHub 仓库、Git URL 或 cursor.directory')
  .option('-c, --cursor', '从 cursor.directory 下载规则')
  .option('-g, --global', '下载到全局 store')
  .option('-p, --project', '下载到当前项目 store')
  .option('-f, --force', '强制覆盖已存在的规则')
  .action(async (name: string | undefined, options: { source?: string, cursor?: boolean, global?: boolean, project?: boolean, force?: boolean, help?: boolean }) => {
    if (isHelpOption(options))
      return
    showBanner()
    await installCommand(name, options)
  })

// === publish ===
cli
  .command('publish', '发布规则到远程 Git 仓库')
  .option('--repo <git-url>', '任意 Git 远程仓库 URL')
  .option('-s, --source <source>', '使用 .rulesrc source 名称、source key 或远程 URL')
  .option('-b, --branch <branch>', '目标分支（默认使用远程默认分支，无法识别时为 main）')
  .option('--path <dir>', '写入仓库内的目标目录')
  .option('-m, --message <message>', '提交信息（默认: chore: sync rules）')
  .option('--dry-run', '仅展示发布计划，不提交不推送')
  .option('-g, --global', '发布全局 store')
  .option('-p, --project', '发布当前项目 store')
  .action(async (options: { repo?: string, source?: string, branch?: string, path?: string, message?: string, dryRun?: boolean, global?: boolean, project?: boolean, help?: boolean }) => {
    if (isHelpOption(options))
      return
    showBanner()
    await publishCommand(options)
  })

// === init ===
cli
  .command('init', '初始化配置和存储目录 (alias: init)')
  .alias('init')
  .option('-g, --global', '初始化全局配置')
  .option('-p, --project', '初始化当前项目配置')
  .action(async (options: { global?: boolean, project?: boolean, help?: boolean }) => {
    if (isHelpOption(options))
      return
    showBanner()
    await initCommand(options)
  })

// === ui ===
cli
  .command('ui', '启动 Web 图形化操作控制台')
  .option('-p, --port <port>', '指定本地 Web 服务监听端口 (默认: 3000)')
  .action(async (options: { port?: number, help?: boolean }) => {
    if (isHelpOption(options))
      return
    showBanner()
    await uiCommand(options)
  })

// === Global options ===
cli.help(sections =>
  sections
    .filter(section => !section.title?.startsWith('For more info'))
    .map((section) => {
      if (section.title === 'Commands') {
        return {
          ...section,
          body: formatCommandHelp(),
        }
      }
      return section
    }),
)
cli.version(version)

// === Run ===
async function main(): Promise<void> {
  try {
    cli.parse()

    if (!cli.matchedCommand && !cli.options.help && !cli.options.version) {
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
