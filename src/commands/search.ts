import consola from 'consola'
import pc from 'picocolors'
import { searchRules } from '~/core/scanner'

export async function searchCommand(keyword?: string): Promise<void> {
  const rules = searchRules(keyword)

  if (rules.length === 0) {
    consola.info(keyword ? `没有找到匹配 "${keyword}" 的规则` : '没有找到任何规则')
    consola.info(`运行 ${pc.cyan('rules create <name>')} 创建一条新规则`)
    return
  }

  consola.log(pc.dim(`找到 ${rules.length} 条规则：\n`))

  for (const rule of rules) {
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
