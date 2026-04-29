import process from 'node:process'
import consola from 'consola'
import pc from 'picocolors'
import { loadConfig } from '~/core/config'
import { searchAllRemoteSources } from '~/core/remote'
import { searchRules } from '~/core/scanner'

export interface SearchOptions {
  remote?: boolean
}

export async function searchCommand(keyword: string | undefined, options: SearchOptions): Promise<void> {
  const showRemote = options.remote ?? false

  // === 本地搜索 ===
  const localRules = searchRules(keyword, { cwd: process.cwd() })

  if (localRules.length > 0) {
    consola.log(pc.bold(`📁 本地规则 (${localRules.length} 条)：\n`))

    for (const rule of localRules) {
      const name = pc.bold(pc.green(rule.name))
      const desc = rule.meta?.description
        ? pc.dim(` — ${rule.meta.description}`)
        : ''
      const tags = rule.meta?.tags?.length
        ? pc.dim(` [${rule.meta.tags.join(', ')}]`)
        : ''

      consola.log(`  ${name}${desc}${tags}`)
    }
    consola.log('')
  }
  else {
    consola.info(keyword ? `本地没有匹配 "${keyword}" 的规则` : '本地没有规则')
  }

  // === 远程搜索 ===
  if (showRemote) {
    const config = loadConfig()
    const sources = config.sources

    if (!sources || sources.length === 0) {
      consola.warn('没有配置远程规则源')
      consola.info(`在 ${pc.cyan('.rulesrc')} 中添加 sources 配置，例如：`)
      consola.info(pc.dim('  { "sources": [{ "repo": "owner/rules-repo" }] }'))
      return
    }

    consola.log(pc.bold('☁️  远程搜索中...\n'))

    try {
      const remoteResults = await searchAllRemoteSources(sources, keyword)

      if (remoteResults.length === 0) {
        consola.info('远程没有找到匹配的规则')
        return
      }

      consola.log(pc.bold(`☁️  远程规则 (${remoteResults.length} 条)：\n`))

      for (const rule of remoteResults) {
        const name = pc.bold(pc.cyan(rule.name))
        const desc = rule.meta?.description
          ? pc.dim(` — ${rule.meta.description}`)
          : ''
        const source = pc.dim(` [${rule.source}]`)

        consola.log(`  ${name}${desc}${source}`)
      }
      consola.log('')
      consola.info(`运行 ${pc.cyan('rules install <name>')} 下载远程规则到本地`)
    }
    catch (err) {
      consola.error(`远程搜索失败: ${err instanceof Error ? err.message : err}`)
    }
  }
  else if (localRules.length === 0) {
    consola.info(`运行 ${pc.cyan('rules create <name>')} 创建规则`)
    consola.info(`运行 ${pc.cyan('rules search --remote')} 搜索远程规则`)
  }
}
