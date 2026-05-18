<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref, watch } from 'vue'

defineEmits<{
  (e: 'install', name: string, source: string, isGlobal: boolean): void
}>()

interface ManagedRepo {
  url: string
  branch: string
  path: string
}

interface RemoteRuleResult {
  name: string
  meta?: {
    name?: string
    description?: string
    tags?: string[]
  }
  source: string
  sourceUrl: string
}

const MANAGED_REPOS_STORAGE_KEY = 'rules-cli:managed-publish-repos'
const REMOTE_RULES_CACHE_KEY = 'rules-cli:remote-repo-rules-cache:v1'
const REMOTE_RULES_CACHE_MAX_AGE = 1000 * 60 * 60 * 24

const repos = ref<ManagedRepo[]>([])
const form = ref({
  url: '',
  branch: 'main',
  path: 'rules',
  keyword: '',
})
const state = ref({ loading: false, deleting: '', error: '', message: '' })
const rules = ref<RemoteRuleResult[]>([])
const pendingDeleteRule = ref('')
const pendingDeleteRepo = ref('')

const hasRepos = computed(() => repos.value.length > 0)
const canLoad = computed(() => !!form.value.url.trim())

interface RemoteRulesCacheEntry {
  cachedAt: number
  rules: RemoteRuleResult[]
}

function normalizeRepo(repo: ManagedRepo): ManagedRepo {
  return {
    url: repo.url.trim(),
    branch: repo.branch.trim() || 'main',
    path: repo.path.trim() || 'rules',
  }
}

function loadRepos() {
  try {
    const raw = localStorage.getItem(MANAGED_REPOS_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    repos.value = Array.isArray(parsed)
      ? parsed
          .filter(item => item?.url)
          .map(item => normalizeRepo({
            url: String(item.url),
            branch: String(item.branch || 'main'),
            path: String(item.path || 'rules'),
          }))
      : []
  }
  catch {
    repos.value = []
  }
}

function saveRepos() {
  localStorage.setItem(MANAGED_REPOS_STORAGE_KEY, JSON.stringify(repos.value))
}

function getRemoteRulesCacheKey(): string {
  return [
    form.value.url.trim(),
    form.value.branch.trim() || 'main',
    form.value.path.trim() || 'rules',
    form.value.keyword.trim(),
  ].join('::')
}

function loadRemoteRulesCache(): Record<string, RemoteRulesCacheEntry> {
  try {
    const raw = localStorage.getItem(REMOTE_RULES_CACHE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  }
  catch {
    return {}
  }
}

function saveRemoteRulesCache(cache: Record<string, RemoteRulesCacheEntry>) {
  localStorage.setItem(REMOTE_RULES_CACHE_KEY, JSON.stringify(cache))
}

function formatCacheAge(cachedAt: number): string {
  const diffMinutes = Math.max(0, Math.round((Date.now() - cachedAt) / 60000))
  if (diffMinutes < 1)
    return '刚刚'
  if (diffMinutes < 60)
    return `${diffMinutes} 分钟前`
  return `${Math.round(diffMinutes / 60)} 小时前`
}

function readCachedRemoteRules(): RemoteRulesCacheEntry | undefined {
  const cache = loadRemoteRulesCache()
  const entry = cache[getRemoteRulesCacheKey()]
  if (!entry || !Array.isArray(entry.rules))
    return undefined

  if (Date.now() - entry.cachedAt > REMOTE_RULES_CACHE_MAX_AGE)
    return undefined

  return entry
}

function writeCachedRemoteRules(nextRules: RemoteRuleResult[]) {
  const cache = loadRemoteRulesCache()
  cache[getRemoteRulesCacheKey()] = {
    cachedAt: Date.now(),
    rules: nextRules,
  }
  saveRemoteRulesCache(cache)
}

async function selectRepo(url: string) {
  const repo = repos.value.find(item => item.url === url)
  if (!repo)
    return

  form.value.url = repo.url
  form.value.branch = repo.branch
  form.value.path = repo.path
  pendingDeleteRepo.value = ''
  await loadRemoteRules({ persist: false })
}

async function saveCurrentRepo() {
  if (!form.value.url.trim())
    return

  upsertCurrentRepo()
  await loadRemoteRules({ persist: false, savedMessage: '仓库配置已保存并已自动读取' })
}

function upsertCurrentRepo() {
  const repo = normalizeRepo({
    url: form.value.url,
    branch: form.value.branch,
    path: form.value.path,
  })
  repos.value = [repo, ...repos.value.filter(item => item.url !== repo.url)]
}

function removeRepo(url: string) {
  if (pendingDeleteRepo.value !== url) {
    pendingDeleteRepo.value = url
    state.value = {
      ...state.value,
      error: '',
      message: `再次点击移除按钮确认删除仓库配置 ${url}`,
    }
    return
  }

  pendingDeleteRepo.value = ''
  repos.value = repos.value.filter(item => item.url !== url)
  if (form.value.url === url) {
    form.value.url = ''
    rules.value = []
  }
}

async function loadRemoteRules(options: { persist?: boolean, savedMessage?: string, forceRefresh?: boolean } = {}) {
  if (!canLoad.value)
    return

  if (options.persist !== false)
    upsertCurrentRepo()

  pendingDeleteRule.value = ''
  pendingDeleteRepo.value = ''

  if (!options.forceRefresh) {
    const cached = readCachedRemoteRules()
    if (cached) {
      rules.value = cached.rules
      state.value = {
        ...state.value,
        loading: false,
        error: '',
        message: options.savedMessage || `已从缓存读取 ${cached.rules.length} 条远程规则，缓存时间 ${formatCacheAge(cached.cachedAt)}`,
      }
      return
    }
  }

  state.value = { ...state.value, loading: true, error: '', message: '' }
  try {
    const params = new URLSearchParams({
      repo: form.value.url.trim(),
      path: form.value.path.trim(),
    })
    if (form.value.keyword.trim())
      params.set('keyword', form.value.keyword.trim())

    const res = await fetch(`/api/remote-repo-rules?${params.toString()}`)
    const json = await res.json()
    if (!json.success)
      throw new Error(json.message || '远程规则读取失败')
    rules.value = json.data.results || []
    writeCachedRemoteRules(rules.value)
    state.value.message = options.savedMessage || `已读取 ${rules.value.length} 条远程规则`
  }
  catch (err: any) {
    rules.value = []
    const message = err.message || String(err)
    state.value.error = message === 'Failed to fetch'
      ? '无法连接 rules-cli UI 后端服务，请使用 rules ui 启动控制台后再读取远程仓库'
      : message
  }
  finally {
    state.value.loading = false
  }
}

async function deleteRemoteRule(rule: RemoteRuleResult) {
  if (pendingDeleteRule.value !== rule.name) {
    pendingDeleteRule.value = rule.name
    state.value.message = `再次点击删除按钮确认删除远程规则 ${rule.name}`
    return
  }

  pendingDeleteRule.value = ''
  state.value = { ...state.value, deleting: rule.name, error: '', message: '' }
  try {
    const res = await fetch('/api/delete-remote-rule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repo: form.value.url.trim(),
        ruleName: rule.name,
        branch: form.value.branch.trim() || undefined,
        path: form.value.path.trim() || undefined,
        message: `chore: remove rule ${rule.name}`,
      }),
    })
    const json = await res.json()
    if (!json.success)
      throw new Error(json.message || '远程规则删除失败')
    state.value.message = json.message || '远程规则已删除'
    await loadRemoteRules({ forceRefresh: true })
  }
  catch (err: any) {
    state.value.error = err.message || String(err)
  }
  finally {
    state.value.deleting = ''
  }
}

onMounted(() => {
  loadRepos()
  if (repos.value[0])
    void selectRepo(repos.value[0].url)
})

watch(repos, () => {
  saveRepos()
}, { deep: true })
</script>

<template>
  <div class="space-y-6">
    <div class="glass-card rounded-2xl border-slate-800 p-6">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 class="mb-2 flex items-center space-x-2 text-base font-semibold text-slate-200">
            <Icon icon="ph:git-branch-duotone" class="text-xl text-cyan-400" />
            <span>远程仓库 Rules 管理</span>
          </h3>
          <p class="text-xs leading-relaxed text-slate-400">
            管理你保存的远程仓库，读取仓库中的 rules，并删除不需要的远程规则。
          </p>
        </div>
        <button
          :disabled="!form.url.trim()"
          class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-200 transition hover:bg-slate-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          title="保存当前仓库并读取"
          aria-label="保存当前仓库并读取"
          @click="saveCurrentRepo"
        >
          <Icon icon="ph:floppy-disk-duotone" class="text-lg" />
        </button>
      </div>

      <div class="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(190px,0.8fr)_minmax(280px,1.4fr)_100px_100px]">
        <select :value="form.url" name="remote-managed-repo" class="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs text-slate-200 focus-visible:border-cyan-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500" @change="selectRepo(($event.target as HTMLSelectElement).value)">
          <option value="">
            {{ hasRepos ? '选择已保存仓库' : '暂无已保存仓库' }}
          </option>
          <option v-for="repo in repos" :key="repo.url" :value="repo.url">
            {{ repo.url }}
          </option>
        </select>
        <input v-model="form.url" type="text" name="remote-repo-url" autocomplete="off" spellcheck="false" placeholder="git@gitlab.com:user/rules.git" class="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 font-mono text-xs text-slate-200 focus-visible:border-cyan-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500">
        <input v-model="form.branch" type="text" name="remote-repo-branch" autocomplete="off" spellcheck="false" placeholder="main" class="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 font-mono text-xs text-slate-200 focus-visible:border-cyan-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500">
        <input v-model="form.path" type="text" name="remote-repo-path" autocomplete="off" spellcheck="false" placeholder="rules" class="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 font-mono text-xs text-slate-200 focus-visible:border-cyan-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500">
      </div>

      <div class="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
        <input v-model="form.keyword" type="search" name="remote-rule-keyword" autocomplete="off" spellcheck="false" placeholder="按规则名筛选" class="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 font-mono text-xs text-slate-200 focus-visible:border-cyan-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500" @keydown.enter="loadRemoteRules">
        <button
          :disabled="state.loading || !canLoad"
          class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-600 text-white transition hover:bg-cyan-500 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          :title="state.loading ? '正在读取远程 Rules' : '刷新远程 Rules'"
          :aria-label="state.loading ? '正在读取远程 Rules' : '刷新远程 Rules'"
          @click="loadRemoteRules({ forceRefresh: true })"
        >
          <Icon :icon="state.loading ? 'ph:spinner-gap-duotone' : 'ph:cloud-arrow-down-duotone'" class="text-lg" :class="state.loading ? 'animate-spin' : ''" />
        </button>
      </div>

      <div v-if="hasRepos" class="mt-4 grid gap-2">
        <div v-for="repo in repos" :key="repo.url" class="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <button class="min-w-0 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500" :title="`选择并读取 ${repo.url}`" :aria-label="`选择并读取 ${repo.url}`" @click="selectRepo(repo.url)">
            <span class="block truncate font-mono text-xs text-slate-200">{{ repo.url }}</span>
            <span class="mt-0.5 block text-xs text-slate-500">{{ repo.branch }} · {{ repo.path || '.' }}</span>
          </button>
          <button
            class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-900/50 text-rose-300 transition hover:bg-rose-950/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            :title="pendingDeleteRepo === repo.url ? `确认移除仓库配置 ${repo.url}` : `移除仓库配置 ${repo.url}`"
            :aria-label="pendingDeleteRepo === repo.url ? `确认移除仓库配置 ${repo.url}` : `移除仓库配置 ${repo.url}`"
            @click="removeRepo(repo.url)"
          >
            <Icon :icon="pendingDeleteRepo === repo.url ? 'ph:warning-circle-duotone' : 'ph:trash-duotone'" class="text-lg" />
          </button>
        </div>
      </div>

      <p v-if="state.error" class="mt-3 text-xs text-rose-300">
        {{ state.error }}
      </p>
      <p v-else-if="state.message" class="mt-3 text-xs text-cyan-300">
        {{ state.message }}
      </p>
    </div>

    <div class="glass-card rounded-2xl border-slate-800 p-6">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="flex items-center gap-2 text-base font-semibold text-slate-200">
          <Icon icon="ph:files-duotone" class="text-xl text-emerald-400" />
          <span>远程 Rules</span>
        </h3>
        <span class="font-mono text-xs text-slate-500">{{ rules.length }} 条</span>
      </div>

      <div v-if="rules.length" class="grid gap-3">
        <article v-for="rule in rules" :key="`${rule.source}:${rule.name}`" class="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h4 class="font-mono text-sm font-semibold text-white">
                  {{ rule.name }}
                </h4>
                <span class="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-400">{{ rule.source }}</span>
              </div>
              <p v-if="rule.meta?.name || rule.meta?.description" class="mt-2 text-xs leading-relaxed text-slate-400">
                {{ rule.meta?.description || rule.meta?.name }}
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <button class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-brand-500/30 bg-brand-500/10 text-brand-300 transition hover:bg-brand-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400" title="下载到本地" aria-label="下载到本地" @click="$emit('install', rule.name, rule.source, true)">
                <Icon icon="ph:download-simple-duotone" class="text-lg" />
              </button>
              <button
                :disabled="state.deleting === rule.name"
                class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                :title="pendingDeleteRule === rule.name ? `确认删除远程规则 ${rule.name}` : `删除远程规则 ${rule.name}`"
                :aria-label="pendingDeleteRule === rule.name ? `确认删除远程规则 ${rule.name}` : `删除远程规则 ${rule.name}`"
                @click="deleteRemoteRule(rule)"
              >
                <Icon :icon="pendingDeleteRule === rule.name ? 'ph:warning-circle-duotone' : 'ph:trash-duotone'" class="text-lg" />
              </button>
            </div>
          </div>
        </article>
      </div>
      <p v-else class="rounded-xl border border-dashed border-slate-800 px-4 py-10 text-center text-xs text-slate-500">
        选择仓库后读取远程 rules。
      </p>
    </div>
  </div>
</template>
