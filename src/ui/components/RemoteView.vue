<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'

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

const emit = defineEmits<{
  (e: 'install', name: string, source: string, isGlobal: boolean): void
  (e: 'create', name: string, isGlobal: boolean, referencesDir: string): void
}>()

const installForm = ref({ name: '', source: 'cursor.directory', repo: '', global: false })
const createForm = ref({ name: '', global: false, referencesDir: 'docs' })
const searchForm = ref({ keyword: '', target: 'all', global: false })
const searchState = ref({ loading: false, searched: false, error: '', hasConfiguredSources: false })
const searchResults = ref<RemoteRuleResult[]>([])

const canSearchSources = computed(() => searchForm.value.target === 'all' || searchForm.value.target === 'sources')

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
</script>

<template>
  <div class="space-y-6">
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
          <span>安装到全局库</span>
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
        <button :disabled="searchState.loading" class="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-xs font-semibold transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900" @click="handleSearch">
          {{ searchState.loading ? '搜索中...' : '搜索远程' }}
        </button>
      </div>

      <p v-if="canSearchSources && searchState.searched && !searchState.hasConfiguredSources" class="mt-3 text-[11px] text-amber-300/90">
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
                <span class="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400">{{ rule.source }}</span>
              </div>
              <p v-if="rule.meta?.name || rule.meta?.description" class="mt-2 text-xs leading-relaxed text-slate-400">
                {{ rule.meta?.description || rule.meta?.name }}
              </p>
              <div v-if="rule.meta?.tags?.length" class="mt-3 flex flex-wrap gap-1.5">
                <span v-for="tag in rule.meta.tags" :key="tag" class="rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">{{ tag }}</span>
              </div>
            </div>
            <button class="shrink-0 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900" @click="handleInstallSearchResult(rule)">
              安装
            </button>
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
          已知 slug 时可直接拉取；也可以填写 GitHub 仓库名拉取自定义指令包。
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
                指定 GitHub 自定义仓库
              </option>
            </select>
          </div>
          <div v-if="installForm.source === 'custom'">
            <label class="block text-xs text-slate-400 mb-1">GitHub 仓库地址 (owner/repo)</label>
            <input v-model="installForm.repo" type="text" name="repo" autocomplete="off" spellcheck="false" placeholder="例如: owner/rules-repo" class="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500 focus-visible:border-brand-500 font-mono">
          </div>
          <div class="flex items-center space-x-4 pt-1">
            <label class="flex items-center space-x-1.5 text-xs text-slate-400 cursor-pointer">
              <input v-model="installForm.global" type="checkbox" name="global" class="rounded bg-slate-900 border-slate-700 text-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 mt-0.5">
              <span>直接持久化至全局库</span>
            </label>
          </div>
          <button :disabled="!installForm.name" class="w-full bg-slate-900 hover:bg-slate-800 text-brand-400 border border-slate-800 hover:border-slate-700 px-4 py-2.5 rounded-xl text-xs font-medium transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900" @click="handleInstall">
            启动同步拉取
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
              <span>保存至全局 store</span>
            </label>
          </div>
          <button :disabled="!createForm.name" class="w-full bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-500 hover:to-indigo-400 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-purple-500/10 transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900" @click="handleCreate">
            初始化生成架构
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
