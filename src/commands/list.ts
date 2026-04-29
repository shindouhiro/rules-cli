import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import consola from 'consola'
import pc from 'picocolors'
import { AGENTS, expandHome } from '~/core/agents'

export interface ListOptions {
  global?: boolean
}

export async function listCommand(options: ListOptions): Promise<void> {
  const cwd = process.cwd()
  const isGlobal = options.global ?? false
  let totalFound = 0

  for (const agent of AGENTS) {
    const baseDir = isGlobal
      ? expandHome(agent.globalPath)
      : resolve(cwd, agent.projectPath)

    if (agent.rulesType === 'directory') {
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
        totalFound++
      }
    }
    else {
      // 单文件型：检查是否有 rules-cli 注入标记
      const targetFile = isGlobal
        ? expandHome(agent.globalPath)
        : resolve(cwd, agent.projectPath)

      if (!existsSync(targetFile))
        continue

      const content = readFileSync(targetFile, 'utf-8')
      const markerStart = agent.injectMarkerStart || '<!-- rules-cli:start -->'

      if (!content.includes(markerStart))
        continue

      // 提取注入的规则名称
      const ruleNames = [...content.matchAll(/<!-- rule: (.+?) -->/g)].map(m => m[1])

      if (ruleNames.length === 0)
        continue

      consola.log(`\n${pc.bold(pc.cyan(agent.name))} ${pc.dim(targetFile)}`)

      for (const name of ruleNames) {
        consola.log(`  ${pc.green('💉')} ${name} ${pc.dim('(injected)')}`)
        totalFound++
      }
    }
  }

  if (totalFound === 0) {
    consola.info('没有找到已应用的规则')
    consola.info(`运行 ${pc.cyan('rules apply')} 开始应用规则`)
  }
  else {
    consola.log(`\n${pc.dim(`共 ${totalFound} 条规则`)}`)
  }
}
