import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteRemoteRuleCommand, publishCommand } from '~/commands/publish'
import { downloadRule, searchRemoteRules } from '~/core/remote'

const TEST_DIR = join(import.meta.dirname, '..', '..', '.test-tmp-remote-git')
const REMOTE_DIR = join(TEST_DIR, 'remote.git')
const WORK_DIR = join(TEST_DIR, 'work')
const PROJECT_DIR = join(TEST_DIR, 'project')

function git(args: string[], cwd?: string): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function cleanTmpDir(): void {
  if (existsSync(TEST_DIR))
    rmSync(TEST_DIR, { recursive: true, force: true })
}

function commitAll(cwd: string, message: string): void {
  git(['add', '.'], cwd)
  git(['-c', 'user.name=test', '-c', 'user.email=test@example.invalid', 'commit', '-m', message], cwd)
}

function seedRemote(): void {
  mkdirSync(WORK_DIR, { recursive: true })
  git(['init', '--bare', REMOTE_DIR])
  git(['init', '-b', 'main'], WORK_DIR)

  mkdirSync(join(WORK_DIR, 'rules', 'vue'), { recursive: true })
  writeFileSync(join(WORK_DIR, 'rules', 'vue', 'rule.md'), [
    '---',
    'name: vue',
    'description: Vue 规则',
    '---',
    '',
    '# Vue',
    '',
  ].join('\n'), 'utf-8')
  writeFileSync(join(WORK_DIR, 'rules', 'react.md'), '# React\n', 'utf-8')
  writeFileSync(join(WORK_DIR, 'keep.md'), '# keep\n', 'utf-8')

  commitAll(WORK_DIR, 'seed rules')
  git(['remote', 'add', 'origin', REMOTE_DIR], WORK_DIR)
  git(['push', '-u', 'origin', 'main'], WORK_DIR)
  git(['symbolic-ref', 'HEAD', 'refs/heads/main'], REMOTE_DIR)
}

describe('通用 Git 远程源', () => {
  beforeEach(() => {
    cleanTmpDir()
    mkdirSync(TEST_DIR, { recursive: true })
    seedRemote()
  })

  afterEach(() => {
    cleanTmpDir()
    vi.restoreAllMocks()
  })

  it('可以从任意 Git 仓库搜索目录型和平铺型规则', async () => {
    const results = await searchRemoteRules({ type: 'git', url: REMOTE_DIR, subPath: 'rules' })

    expect(results.map(result => result.name)).toEqual(['react', 'vue'])
    expect(results.find(result => result.name === 'vue')?.meta?.description).toBe('Vue 规则')
    expect(results.every(result => result.source.startsWith(`git:${REMOTE_DIR}#rules`))).toBe(true)
  })

  it('可以从任意 Git 仓库下载规则到本地 store', async () => {
    const ruleDir = await downloadRule(
      { type: 'git', url: REMOTE_DIR, subPath: 'rules' },
      'vue',
      { cwd: PROJECT_DIR },
    )

    expect(readFileSync(join(ruleDir, 'rule.md'), 'utf-8')).toContain('Vue 规则')
  })

  it('发布当前项目 store 到任意 Git 仓库并保留远程其他文件', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(PROJECT_DIR)
    mkdirSync(join(PROJECT_DIR, '.rules', 'store', 'vue'), { recursive: true })
    writeFileSync(join(PROJECT_DIR, '.rules', 'store', 'vue', 'rule.md'), '# Vue updated\n', 'utf-8')
    mkdirSync(join(PROJECT_DIR, '.rules', 'store', 'svelte'), { recursive: true })
    writeFileSync(join(PROJECT_DIR, '.rules', 'store', 'svelte', 'rule.md'), '# Svelte\n', 'utf-8')

    await publishCommand({
      repo: REMOTE_DIR,
      project: true,
      branch: 'main',
      path: 'rules',
      message: 'chore: publish test rules',
    })

    const verifyDir = join(TEST_DIR, 'verify')
    git(['clone', REMOTE_DIR, verifyDir])

    expect(readFileSync(join(verifyDir, 'rules', 'vue', 'rule.md'), 'utf-8')).toContain('Vue updated')
    expect(readFileSync(join(verifyDir, 'rules', 'svelte', 'rule.md'), 'utf-8')).toContain('Svelte')
    expect(readFileSync(join(verifyDir, 'keep.md'), 'utf-8')).toContain('keep')
  })

  it('可以只发布指定规则路径', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(PROJECT_DIR)
    const selectedRulePath = join(PROJECT_DIR, '.rules', 'store', 'selected', 'rule.md')
    mkdirSync(join(PROJECT_DIR, '.rules', 'store', 'selected'), { recursive: true })
    writeFileSync(selectedRulePath, '# Selected\n', 'utf-8')
    mkdirSync(join(PROJECT_DIR, '.rules', 'store', 'ignored'), { recursive: true })
    writeFileSync(join(PROJECT_DIR, '.rules', 'store', 'ignored', 'rule.md'), '# Ignored\n', 'utf-8')

    await publishCommand({
      repo: REMOTE_DIR,
      project: true,
      branch: 'main',
      path: 'rules',
      rulePaths: [selectedRulePath],
    })

    const verifyDir = join(TEST_DIR, 'verify-selected')
    git(['clone', REMOTE_DIR, verifyDir])

    expect(readFileSync(join(verifyDir, 'rules', 'selected', 'rule.md'), 'utf-8')).toContain('Selected')
    expect(existsSync(join(verifyDir, 'rules', 'ignored'))).toBe(false)
  })

  it('可以删除远程仓库中的指定规则', async () => {
    await deleteRemoteRuleCommand({
      repo: REMOTE_DIR,
      branch: 'main',
      path: 'rules',
      ruleName: 'vue',
    })

    const verifyDir = join(TEST_DIR, 'verify-delete')
    git(['clone', REMOTE_DIR, verifyDir])

    expect(existsSync(join(verifyDir, 'rules', 'vue'))).toBe(false)
    expect(readFileSync(join(verifyDir, 'rules', 'react.md'), 'utf-8')).toContain('React')
  })

  it('dry-run 不会产生远程提交', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(PROJECT_DIR)
    mkdirSync(join(PROJECT_DIR, '.rules', 'store', 'solid'), { recursive: true })
    writeFileSync(join(PROJECT_DIR, '.rules', 'store', 'solid', 'rule.md'), '# Solid\n', 'utf-8')
    const before = git(['rev-parse', 'main'], REMOTE_DIR)

    await publishCommand({
      repo: REMOTE_DIR,
      project: true,
      branch: 'main',
      path: 'rules',
      dryRun: true,
    })

    expect(git(['rev-parse', 'main'], REMOTE_DIR)).toBe(before)
  })
})
