import consola from 'consola'
import pc from 'picocolors'

const DIVIDER = '─'.repeat(48)

export function printDivider(): void {
  consola.log(pc.dim(DIVIDER))
}

export function printSection(title: string): void {
  consola.log(`\n${pc.bold(pc.cyan(title))}`)
}

export function printScope(isGlobal: boolean): void {
  const scope = isGlobal ? 'global' : 'project'
  const label = isGlobal ? '全局' : '项目'
  consola.log(pc.dim(`scope: ${scope} (${label})`))
}

export function printSummary(successCount: number, failCount: number, verb: string): void {
  consola.log('')
  if (successCount > 0) {
    consola.success(`${verb} ${successCount} 条规则`)
  }
  if (failCount > 0) {
    consola.warn(`${failCount} 条跳过或失败`)
  }
}
