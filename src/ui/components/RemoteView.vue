<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref, watch } from 'vue'

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

const props = defineProps<{
  rules: any[]
}>()

const emit = defineEmits<{
  (e: 'install', name: string, source: string, isGlobal: boolean): void
  (e: 'publish', payload: { rulePaths: string[], repo: string, branch?: string, path?: string, message?: string, dryRun?: boolean, isGlobal: boolean }): void
  (e: 'create', name: string, isGlobal: boolean, referencesDir: string): void
}>()

interface ManagedRepo {
  url: string
  branch: string
  path: string
}

const MANAGED_REPOS_STORAGE_KEY = 'rules-cli:managed-publish-repos'

const publishForm = ref({
  rulePath: '',
  repo: '',
  branch: 'main',
  path: 'rules',
  message: 'chore: sync rules',
  dryRun: false,
  global: true,
})
const managedRepos = ref<ManagedRepo[]>([])
const installForm = ref({ name: '', source: 'cursor.directory', repo: '', global: true })
const createForm = ref({ name: '', global: true, referencesDir: 'docs' })
const searchForm = ref({ keyword: '', target: 'all', global: true })
const searchState = ref({ loading: false, searched: false, error: '', hasConfiguredSources: false })
const searchResults = ref<RemoteRuleResult[]>([])

const canSearchSources = computed(() => searchForm.value.target === 'all' || searchForm.value.target === 'sources')
const publishableRules = computed(() => props.rules.filter(rule => rule.path))
const canPublish = computed(() => !!publishForm.value.rulePath && !!publishForm.value.repo.trim())
const hasManagedRepos = computed(() => managedRepos.value.length > 0)

function normalizeManagedRepo(repo: ManagedRepo): ManagedRepo {
  return {
    url: repo.url.trim(),
    branch: repo.branch.trim() || 'main',
    path: repo.path.trim() || 'rules',
  }
}

function loadManagedRepos() {
  try {
    const raw = localStorage.getItem(MANAGED_REPOS_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    managedRepos.value = Array.isArray(parsed)
      ? parsed
          .filter(item => item?.url)
          .map(item => normalizeManagedRepo({
            url: String(item.url),
            branch: String(item.branch || 'main'),
            path: String(item.path || 'rules'),
          }))
      : []
  }
  catch {
    managedRepos.value = []
  }
}

function saveManagedRepos() {
  localStorage.setItem(MANAGED_REPOS_STORAGE_KEY, JSON.stringify(managedRepos.value))
}

function handleSelectManagedRepo(url: string) {
  const repo = managedRepos.value.find(item => item.url === url)
  if (!repo)
    return

  publishForm.value.repo = repo.url
  publishForm.value.branch = repo.branch
  publishForm.value.path = repo.path
}

function handleSaveManagedRepo() {
  if (!publishForm.value.repo.trim())
    return

  upsertManagedRepo()
}

function upsertManagedRepo() {
  const repo = normalizeManagedRepo({
    url: publishForm.value.repo,
    branch: publishForm.value.branch,
    path: publishForm.value.path,
  })
  managedRepos.value = [
    repo,
    ...managedRepos.value.filter(item => item.url !== repo.url),
  ]
}

function handleDeleteManagedRepo(url: string) {
  managedRepos.value = managedRepos.value.filter(item => item.url !== url)
  if (publishForm.value.repo === url)
    publishForm.value.repo = ''
}

function handlePublish() {
  if (!canPublish.value)
    return

  upsertManagedRepo()
  emit('publish', {
    rulePaths: [publishForm.value.rulePath],
    repo: publishForm.value.repo.trim(),
    branch: publishForm.value.branch.trim() || undefined,
    path: publishForm.value.path.trim() || undefined,
    message: publishForm.value.message.trim() || undefined,
    dryRun: publishForm.value.dryRun,
    isGlobal: publishForm.value.global,
  })
}

function handleInstall() {
  if (!installForm.value.name)
    return
  const src = installForm.value.source === 'custom' ? installForm.value.repo : 'cursor.directory'
  emit('install', installForm.value.name, src, installForm.value.global)
  installForm.value.name = ''
}

function handleInstallSearchResult(rule: RemoteRuleResult) {
  emit('install', rule.name, rule.source, searchForm.value.global)
}

async function handleSearch() {
  searchState.value = { ...searchState.value, loading: true, searched: true, error: '' }
  try {
    const params = new URLSearchParams({ target: searchForm.value.target })
    if (searchForm.value.keyword.trim())
      params.set('keyword', searchForm.value.keyword.trim())

    const res = await fetch(`/api/search-remote?${params.toString()}`)
    const json = await res.json()
    if (!json.success)
      throw new Error(json.message || '远程搜索失败')

    searchResults.value = json.data.results || []
    searchState.value.hasConfiguredSources = !!json.data.hasConfiguredSources
  }
  catch (err: any) {
    searchResults.value = []
    searchState.value.error = err.message || String(err)
  }
  finally {
    searchState.value.loading = false
  }
}

function handleCreate() {
  if (!createForm.value.name)
    return
  emit('create', createForm.value.name, createForm.value.global, createForm.value.referencesDir || 'docs')
  createForm.value.name = ''
}

onMounted(() => {
  loadManagedRepos()
})

watch(managedRepos, () => {
  saveManagedRepos()
}, { deep: true })
</script>

<template>
  <div class="space-y-6">
    <div class="glass-card rounded-2xl p-6 border-emerald-500/30">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 class="text-base font-semibold text-slate-200 mb-2 flex items-center space-x-2">
            <Icon icon="ph:cloud-arrow-up-duotone" class="text-xl text-emerald-400" />
            <span>上传规则到仓库</span>
          </h3>
          <p class="text-xs text-slate-400 leading-relaxed">
            选择本地规则，填写 GitHub / GitLab / Gitee / 自建 Git 仓库地址后发布到指定目录。
          </p>
        </div>
        <label class="flex items-center space-x-1.5 text-xs text-slate-400 cursor-pointer">
          <input v-model="publishForm.global" type="checkbox" name="publish-global" class="rounded bg-slate-900 border-slate-700 text-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 mt-0.5">
          <span>按全局规则上传</span>
        </label>
      </div>

      <div class="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(180px,0.9fr)_minmax(220px,1fr)_minmax(260px,1.4fr)_100px_100px]">
        <select v-model="publishForm.rulePath" name="publish-rule" class="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 focus-visible:border-emerald-500">
          <option value="">
            选择要上传的本地规则
          </option>
          <option v-for="rule in publishableRules" :key="rule.path" :value="rule.path">
            {{ rule.name }} · {{ rule.isGlobal ? '全局' : '项目' }}
          </option>
        </select>
        <select name="managed-publish-repo" class="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 focus-visible:border-emerald-500" @change="handleSelectManagedRepo(($event.target as HTMLSelectElement).value)">
          <option value="">
            {{ hasManagedRepos ? '选择已保存仓库' : '暂无已保存仓库' }}
          </option>
          <option v-for="repo in managedRepos" :key="repo.url" :value="repo.url">
            {{ repo.url }}
          </option>
        </select>
        <input v-model="publishForm.repo" type="text" name="publish-repo" autocomplete="off" spellcheck="false" placeholder="git@gitlab.com:user/rules.git 或 https://gitee.com/user/rules.git" class="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 focus-visible:border-emerald-500 font-mono">
        <input v-model="publishForm.branch" type="text" name="publish-branch" autocomplete="off" spellcheck="false" placeholder="main" class="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 focus-visible:border-emerald-500 font-mono">
        <input v-model="publishForm.path" type="text" name="publish-path" autocomplete="off" spellcheck="false" placeholder="rules" class="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 focus-visible:border-emerald-500 font-mono">
      </div>

      <div class="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
        <input v-model="publishForm.message" type="text" name="publish-message" autocomplete="off" spellcheck="false" placeholder="chore: sync rules" class="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 focus-visible:border-emerald-500">
        <label class="flex items-center justify-center space-x-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs text-slate-400 cursor-pointer">
          <input v-model="publishForm.dryRun" type="checkbox" name="publish-dry-run" class="rounded bg-slate-950 border-slate-700 text-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
          <span>只预检</span>
        </label>
        <button
          :disabled="!publishForm.repo.trim()"
          class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-200 transition hover:bg-slate-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          title="保存仓库配置"
          aria-label="保存仓库配置"
          @click="handleSaveManagedRepo"
        >
          <Icon icon="ph:floppy-disk-duotone" class="text-lg" />
        </button>
        <button
          :disabled="!canPublish"
          class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white transition hover:bg-emerald-500 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          title="上传到仓库"
          aria-label="上传到仓库"
          @click="handlePublish"
        >
          <Icon icon="ph:cloud-arrow-up-duotone" class="text-lg" />
        </button>
      </div>

      <div v-if="hasManagedRepos" class="mt-4 grid gap-2">
        <div v-for="repo in managedRepos" :key="repo.url" class="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <button class="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-lg" @click="handleSelectManagedRepo(repo.url)">
            <span class="block truncate font-mono text-xs text-slate-200">{{ repo.url }}</span>
            <span class="mt-0.5 block text-xs text-slate-500">{{ repo.branch }} · {{ repo.path || '.' }}</span>
          </button>
          <button
            class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-900/50 text-rose-300 transition hover:bg-rose-950/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            :title="`删除仓库 ${repo.url}`"
            :aria-label="`删除仓库 ${repo.url}`"
            @click="handleDeleteManagedRepo(repo.url)"
          >
            <Icon icon="ph:trash-duotone" class="text-lg" />
          </button>
        </div>
      </div>

      <p v-if="publishableRules.length === 0" class="mt-3 text-xs text-amber-300/90">
        当前本地 Store 没有可上传规则，请先创建或拉取规则。
      </p>
    </div>

    <div class="glass-card rounded-2xl p-6 border-slate-800">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 class="text-base font-semibold text-slate-200 mb-2 flex items-center space-x-2">
            <Icon icon="ph:magnifying-glass-duotone" class="text-xl text-emerald-400" />
            <span>远程规则搜索</span>
          </h3>
          <p class="text-xs text-slate-400 leading-relaxed">
            搜索 cursor.directory 与 .rulesrc 中配置的远程规则源，点击结果即可拉取到本地 Store。
          </p>
        </div>
        <label class="flex items-center space-x-1.5 text-xs text-slate-400 cursor-pointer">
          <input v-model="searchForm.global" type="checkbox" name="search-global" class="rounded bg-slate-900 border-slate-700 text-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 mt-0.5">
          <span>安装到全局统一库</span>
        </label>
      </div>

      <div class="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_180px_auto]">
        <input v-model="searchForm.keyword" type="search" name="remote-keyword" autocomplete="off" spellcheck="false" placeholder="输入关键词，如 vue / react / django" class="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500 focus-visible:border-brand-500 font-mono" @keydown.enter="handleSearch">
        <select v-model="searchForm.target" name="remote-target" class="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500 focus-visible:border-brand-500">
          <option value="all">
            全部来源
          </option>
          <option value="cursor">
            cursor.directory
          </option>
          <option value="sources">
            .rulesrc 远程源
          </option>
        </select>
        <button
          :disabled="searchState.loading"
          class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white transition hover:bg-emerald-500 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          :title="searchState.loading ? '正在搜索远程规则' : '搜索远程规则'"
          :aria-label="searchState.loading ? '正在搜索远程规则' : '搜索远程规则'"
          @click="handleSearch"
        >
          <Icon :icon="searchState.loading ? 'ph:spinner-gap-duotone' : 'ph:magnifying-glass-duotone'" class="text-lg" :class="searchState.loading ? 'animate-spin' : ''" />
        </button>
      </div>

      <p v-if="canSearchSources && searchState.searched && !searchState.hasConfiguredSources" class="mt-3 text-xs text-amber-300/90">
        未检测到 .rulesrc sources 配置，本次仅会返回 cursor.directory 结果。
      </p>
      <p v-if="searchState.error" class="mt-3 text-xs text-rose-300">
        {{ searchState.error }}
      </p>

      <div v-if="searchResults.length" class="mt-5 grid gap-3">
        <article v-for="rule in searchResults" :key="`${rule.source}:${rule.name}`" class="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
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
              <div v-if="rule.meta?.tags?.length" class="mt-3 flex flex-wrap gap-1.5">
                <span v-for="tag in rule.meta.tags" :key="tag" class="rounded-md bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400">{{ tag }}</span>
              </div>
            </div>
            <div class="relative group/install shrink-0">
              <button class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-sm transition hover:bg-emerald-500/20 hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400" title="安装到本地" aria-label="安装到本地" @click="handleInstallSearchResult(rule)">
                <Icon icon="ph:download-simple-duotone" class="text-lg" />
              </button>
              <div class="absolute bottom-full right-1/2 translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-[10px] text-slate-200 rounded opacity-0 group-hover/install:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-slate-700 shadow-xl z-10">
                安装到本地
              </div>
            </div>
          </div>
        </article>
      </div>
      <p v-else-if="searchState.searched && !searchState.loading && !searchState.error" class="mt-5 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-6 text-center text-xs text-slate-500">
        未找到匹配的远程规则。
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="glass-card rounded-2xl p-6 border-slate-800">
        <h3 class="text-base font-semibold text-slate-200 mb-2 flex items-center space-x-2">
          <Icon icon="ph:cloud-arrow-down-duotone" class="text-xl text-cyan-400" />
          <span>市场远程接驳拉取</span>
        </h3>
        <p class="text-xs text-slate-400 mb-5 leading-relaxed">
          已知 slug 时可直接拉取；也可以填写 GitHub owner/repo 或任意 Git URL 拉取自定义指令包。
        </p>

        <div class="space-y-4">
          <div>
            <label class="block text-xs text-slate-400 mb-1">规则名称 (Slug)</label>
            <input v-model="installForm.name" type="text" name="slug" autocomplete="off" spellcheck="false" placeholder="例如: vue, react, nextjs" class="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500 focus-visible:border-brand-500 font-mono">
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">规则来源通道</label>
            <select v-model="installForm.source" name="source" class="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500 focus-visible:border-brand-500">
              <option value="cursor.directory">
                官方 cursor.directory 生态
              </option>
              <option value="custom">
                指定远程 Git 规则源
              </option>
            </select>
          </div>
          <div v-if="installForm.source === 'custom'">
            <label class="block text-xs text-slate-400 mb-1">远程规则源</label>
            <input v-model="installForm.repo" type="text" name="repo" autocomplete="off" spellcheck="false" placeholder="owner/rules-repo 或 git@gitlab.com:user/rules.git" class="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500 focus-visible:border-brand-500 font-mono">
          </div>
          <div class="flex items-center space-x-4 pt-1">
            <label class="flex items-center space-x-1.5 text-xs text-slate-400 cursor-pointer">
              <input v-model="installForm.global" type="checkbox" name="global" class="rounded bg-slate-900 border-slate-700 text-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 mt-0.5">
              <span>直接持久化至全局统一库</span>
            </label>
          </div>
          <button
            :disabled="!installForm.name"
            class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-brand-400 transition-colors hover:border-slate-700 hover:bg-slate-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            title="启动同步拉取"
            aria-label="启动同步拉取"
            @click="handleInstall"
          >
            <Icon icon="ph:cloud-arrow-down-duotone" class="text-lg" />
          </button>
        </div>
      </div>

      <div class="glass-card rounded-2xl p-6 border-slate-800">
        <h3 class="text-base font-semibold text-slate-200 mb-2 flex items-center space-x-2">
          <Icon icon="ph:plus-circle-duotone" class="text-xl text-purple-400" />
          <span>新建自定义模板空单</span>
        </h3>
        <p class="text-xs text-slate-400 mb-5 leading-relaxed">
          在本地创建标准的目录空间与空白 rule.md frontmatter 元信息架构，方便立即在线编辑内容。
        </p>

        <div class="space-y-4">
          <div>
            <label class="block text-xs text-slate-400 mb-1">自定义规则名标识</label>
            <input v-model="createForm.name" type="text" name="create-slug" autocomplete="off" spellcheck="false" placeholder="例如: my-project-spec" class="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500 focus-visible:border-brand-500 font-mono">
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">默认引用目录</label>
            <input v-model="createForm.referencesDir" type="text" name="references-dir" autocomplete="off" spellcheck="false" placeholder="docs" class="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500 focus-visible:border-brand-500 font-mono">
          </div>
          <div class="flex items-center space-x-4 pt-1">
            <label class="flex items-center space-x-1.5 text-xs text-slate-400 cursor-pointer">
              <input v-model="createForm.global" type="checkbox" name="create-global" class="rounded bg-slate-900 border-slate-700 text-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 mt-0.5">
              <span>保存至全局统一库</span>
            </label>
          </div>
          <button
            :disabled="!createForm.name"
            class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-purple-600 to-indigo-500 text-white shadow-lg shadow-purple-500/10 transition hover:from-purple-500 hover:to-indigo-400 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            title="初始化生成架构"
            aria-label="初始化生成架构"
            @click="handleCreate"
          >
            <Icon icon="ph:plus-circle-duotone" class="text-lg" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
