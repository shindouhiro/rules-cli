import type { RuleSource } from '~/types'
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import process from 'node:process'
import consola from 'consola'
import pc from 'picocolors'
import { loadConfig } from '~/core/config'
import { cleanupTempGitDir, createTempGitDir, hasGitChanges, resolveRemoteDefaultBranch, runGit } from '~/core/git'
import { resolveIsGlobal } from '~/core/scope'
import { findConfiguredSource, getSourceKey, normalizeSource, sourceFromInput } from '~/core/source'
import { getStoreDir } from '~/core/store'
import { printScope, printSection } from '~/core/ui'

export interface PublishOptions {
  repo?: string
  source?: string
  branch?: string
  path?: string
  message?: string
  rulePaths?: string[]
  dryRun?: boolean
  global?: boolean
  project?: boolean
}

export interface DeleteRemoteRuleOptions {
  repo: string
  ruleName: string
  branch?: string
  path?: string
  message?: string
}

function resolvePublishSource(options: PublishOptions, configuredSources: RuleSource[] | undefined): RuleSource {
  if (options.repo)
    return sourceFromInput(options.repo)

  if (options.source) {
    const matched = findConfiguredSource(configuredSources, options.source)
    return matched || sourceFromInput(options.source.replace(/^github:/u, ''))
  }

  if (configuredSources?.length)
    return configuredSources[0]

  throw new Error(`请通过 ${pc.cyan('--repo <git-url>')} 或 ${pc.cyan('--source <name-or-url>')} 指定远程仓库`)
}

function listPublishRuleDirs(storeDir: string): string[] {
  if (!existsSync(storeDir))
    return []

  return readdirSync(storeDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && existsSync(join(storeDir, entry.name, 'rule.md')))
    .map(entry => join(storeDir, entry.name))
    .sort((a, b) => basename(a).localeCompare(basename(b)))
}

function resolvePublishRuleDirs(options: PublishOptions, storeDir: string): string[] {
  if (options.rulePaths?.length) {
    return options.rulePaths
      .filter(rulePath => existsSync(rulePath) && statSync(rulePath).isFile())
      .map(rulePath => join(rulePath, '..'))
      .filter(ruleDir => existsSync(join(ruleDir, 'rule.md')))
      .sort((a, b) => basename(a).localeCompare(basename(b)))
  }

  return listPublishRuleDirs(storeDir)
}

async function cloneForPublish(url: string, branch: string): Promise<string> {
  const dir = createTempGitDir()
  try {
    const cloned = await runGit(['clone', '--depth', '1', '--branch', branch, url, dir], { allowFailure: true })
    if (!cloned && !existsSync(join(dir, '.git'))) {
      await runGit(['clone', url, dir])
      await runGit(['checkout', '-B', branch], { cwd: dir })
    }
    return dir
  }
  catch (err) {
    cleanupTempGitDir(dir)
    throw err
  }
}

export async function publishCommand(options: PublishOptions): Promise<void> {
  const cwd = process.cwd()
  const config = loadConfig(cwd)
  const isGlobal = resolveIsGlobal(options)
  const storeDir = getStoreDir({ cwd, global: isGlobal })
  const ruleDirs = resolvePublishRuleDirs(options, storeDir)

  printSection('发布规则到远程 Git 仓库')
  printScope(isGlobal)

  if (ruleDirs.length === 0) {
    consola.warn(`当前 ${isGlobal ? '全局' : '项目'} store 没有可发布的规则`)
    return
  }

  const source = resolvePublishSource(options, config.sources)
  const normalized = normalizeSource(source)
  const repoUrl = normalized.type === 'git'
    ? normalized.url
    : `https://github.com/${normalized.repo}.git`
  const targetPath = options.path ?? normalized.subPath ?? ''
  const branch = options.branch || await resolveRemoteDefaultBranch(repoUrl)
  const message = options.message || 'chore: sync rules'

  consola.info(`远程源: ${pc.cyan(getSourceKey(source))}`)
  consola.info(`目标分支: ${pc.cyan(branch)}`)
  consola.info(`目标目录: ${pc.cyan(targetPath || '.')}`)
  consola.info(`待发布规则: ${ruleDirs.map(dir => basename(dir)).join(', ')}`)

  if (options.dryRun) {
    consola.success('dry-run 完成：未 clone、未提交、未推送')
    return
  }

  const repoDir = await cloneForPublish(repoUrl, branch)
  try {
    const publishRoot = targetPath ? join(repoDir, targetPath) : repoDir
    mkdirSync(publishRoot, { recursive: true })

    for (const ruleDir of ruleDirs) {
      const name = basename(ruleDir)
      const targetRuleDir = join(publishRoot, name)
      if (!statSync(ruleDir).isDirectory())
        continue
      cpSync(ruleDir, targetRuleDir, { recursive: true, force: true })
    }

    if (!await hasGitChanges(repoDir)) {
      consola.info('远程仓库已是最新状态，无需提交')
      return
    }

    await runGit(['add', targetPath || '.'], { cwd: repoDir })
    await runGit(['-c', 'user.name=rules-cli', '-c', 'user.email=rules-cli@example.invalid', 'commit', '-m', message], { cwd: repoDir })
    await runGit(['push', '-u', 'origin', branch], { cwd: repoDir })

    consola.success(`已发布 ${ruleDirs.length} 条规则到 ${pc.cyan(repoUrl)}`)
  }
  finally {
    cleanupTempGitDir(repoDir)
  }
}

function findRemoteRuleTargets(rootDir: string, ruleName: string): string[] {
  if (!existsSync(rootDir))
    return []

  const targets: string[] = []
  const dirTarget = join(rootDir, ruleName)
  if (existsSync(dirTarget) && statSync(dirTarget).isDirectory())
    targets.push(dirTarget)

  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    if (!entry.isFile())
      continue
    const ext = extname(entry.name).toLowerCase()
    if ((ext === '.md' || ext === '.mdc') && basename(entry.name, ext) === ruleName)
      targets.push(join(rootDir, entry.name))
  }

  return targets
}

export async function deleteRemoteRuleCommand(options: DeleteRemoteRuleOptions): Promise<void> {
  if (!options.repo)
    throw new Error('缺少远程仓库地址')
  if (!options.ruleName)
    throw new Error('缺少要删除的规则名')

  const normalized = normalizeSource(sourceFromInput(options.repo))
  const repoUrl = normalized.type === 'git'
    ? normalized.url
    : `https://github.com/${normalized.repo}.git`
  const branch = options.branch || await resolveRemoteDefaultBranch(repoUrl)
  const targetPath = options.path || ''
  const message = options.message || `chore: remove rule ${options.ruleName}`

  const repoDir = await cloneForPublish(repoUrl, branch)
  try {
    const rootDir = targetPath ? join(repoDir, targetPath) : repoDir
    const targets = findRemoteRuleTargets(rootDir, options.ruleName)
    if (targets.length === 0)
      throw new Error(`远程仓库中未找到规则 ${options.ruleName}`)

    for (const target of targets)
      rmSync(target, { recursive: true, force: true })

    if (!await hasGitChanges(repoDir)) {
      consola.info('远程仓库没有需要删除的变更')
      return
    }

    await runGit(['add', targetPath || '.'], { cwd: repoDir })
    await runGit(['-c', 'user.name=rules-cli', '-c', 'user.email=rules-cli@example.invalid', 'commit', '-m', message], { cwd: repoDir })
    await runGit(['push', '-u', 'origin', branch], { cwd: repoDir })
  }
  finally {
    cleanupTempGitDir(repoDir)
  }
}
