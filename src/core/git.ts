import { execFile } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface GitRunOptions {
  cwd?: string
  allowFailure?: boolean
}

export async function runGit(args: string[], options: GitRunOptions = {}): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd: options.cwd,
      maxBuffer: 1024 * 1024 * 10,
    })
    return stdout.trim()
  }
  catch (err: any) {
    if (options.allowFailure)
      return ''

    const stderr = err?.stderr?.toString().trim()
    const stdout = err?.stdout?.toString().trim()
    const detail = stderr || stdout || err?.message || String(err)
    throw new Error(`git ${args.join(' ')} 失败: ${detail}`)
  }
}

export function createTempGitDir(): string {
  return mkdtempSync(join(tmpdir(), 'rules-cli-git-'))
}

export function cleanupTempGitDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true })
}

export async function cloneRepo(url: string, options: { branch?: string } = {}): Promise<string> {
  const dir = createTempGitDir()
  try {
    const args = ['clone', '--depth', '1']
    if (options.branch)
      args.push('--branch', options.branch)
    args.push(url, dir)
    await runGit(args)
    return dir
  }
  catch (err) {
    cleanupTempGitDir(dir)
    throw err
  }
}

export async function resolveRemoteDefaultBranch(url: string): Promise<string> {
  const output = await runGit(['ls-remote', '--symref', url, 'HEAD'], { allowFailure: true })
  const match = output.match(/refs\/heads\/(\S+)\s+HEAD/u)
  return match?.[1] || 'main'
}

export async function hasGitChanges(cwd: string): Promise<boolean> {
  const output = await runGit(['status', '--porcelain'], { cwd })
  return output.length > 0
}
