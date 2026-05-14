<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  rules: any[]
  agents: any[]
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'apply', ruleNames: string[], agentIds: string[], isGlobal: boolean, rulePaths?: string[]): void
  (e: 'edit', rule: any): void
  (e: 'delete', rule: any): void
}>()

const searchQuery = ref('')
const selectedRulePaths = ref<string[]>([])
const selectedAgents = ref<string[]>([])
const applyScopeGlobal = ref(false)

const filteredRules = computed(() => {
  if (!searchQuery.value)
    return props.rules
  const q = searchQuery.value.toLowerCase()
  return props.rules.filter(r =>
    r.name.toLowerCase().includes(q)
    || (r.meta?.description || '').toLowerCase().includes(q)
    || (r.meta?.tags || []).some((t: string) => t.toLowerCase().includes(q)),
  )
})

const filteredRulePaths = computed(() => filteredRules.value.map(rule => rule.path))
const selectedFilteredCount = computed(() => filteredRulePaths.value.filter(path => selectedRulePaths.value.includes(path)).length)
const allFilteredSelected = computed(() => filteredRules.value.length > 0 && selectedFilteredCount.value === filteredRules.value.length)
const selectedRules = computed(() => props.rules.filter(rule => selectedRulePaths.value.includes(rule.path)))
const hasSelection = computed(() => selectedRulePaths.value.length > 0)

function toggleSelectRule(path: string) {
  const idx = selectedRulePaths.value.indexOf(path)
  if (idx > -1)
    selectedRulePaths.value.splice(idx, 1)
  else selectedRulePaths.value.push(path)
}

function toggleSelectFilteredRules() {
  if (allFilteredSelected.value) {
    selectedRulePaths.value = selectedRulePaths.value.filter(path => !filteredRulePaths.value.includes(path))
    return
  }

  selectedRulePaths.value = [...new Set([...selectedRulePaths.value, ...filteredRulePaths.value])]
}

function clearSelectedRules() {
  selectedRulePaths.value = []
}

function toggleSelectAgent(id: string) {
  const idx = selectedAgents.value.indexOf(id)
  if (idx > -1)
    selectedAgents.value.splice(idx, 1)
  else selectedAgents.value.push(id)
}

function executeApply() {
  if (selectedRulePaths.value.length === 0 || selectedAgents.value.length === 0)
    return
  const selectedNames = selectedRules.value.map(rule => rule.name)
  emit('apply', selectedNames, selectedAgents.value, applyScopeGlobal.value, selectedRulePaths.value)
  selectedRulePaths.value = []
}

watch(() => props.rules, () => {
  const livePaths = new Set(props.rules.map(rule => rule.path))
  selectedRulePaths.value = selectedRulePaths.value.filter(path => livePaths.has(path))
}, { deep: true })

watch(() => props.agents, (newAgents) => {
  if (newAgents.length > 0 && selectedAgents.value.length === 0) {
    const claudeAgent = newAgents.find(a => a.id === 'claude-code')
    selectedAgents.value = [claudeAgent?.id || newAgents[0].id]
  }
}, { immediate: true })
</script>

<template>
  <div class="space-y-6">
    <div class="relative">
      <input v-model="searchQuery" name="search" autocomplete="off" spellcheck="false" aria-label="检索规则" type="text" placeholder="检索规则名称、描述或前端分类标签…" class="w-full rounded-2xl border border-slate-800 bg-slate-900/80 px-5 py-3.5 pl-12 text-base text-slate-100 shadow-lg shadow-slate-950/20 transition-colors placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
      <Icon icon="ph:magnifying-glass-duotone" class="absolute left-4 top-4 text-xl text-slate-500" aria-hidden="true" />
    </div>

    <div v-if="!loading && filteredRules.length > 0" class="glass-card rounded-2xl p-4">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-wider text-slate-400">
            批量选择规则库
          </p>
          <p class="mt-1 text-xs text-slate-500">
            当前筛选 <span class="font-mono text-slate-300">{{ filteredRules.length }}</span> 条，已选 <span class="font-mono text-cyan-300">{{ selectedRulePaths.length }}</span> 条。
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button class="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500" :class="allFilteredSelected ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-200' : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700 hover:text-slate-200'" @click="toggleSelectFilteredRules">
            <span class="flex h-4 w-4 items-center justify-center rounded border transition-colors" :class="allFilteredSelected ? 'border-cyan-400 bg-cyan-400 text-slate-950' : 'border-slate-700 bg-slate-900'">
              <Icon v-if="allFilteredSelected" icon="ph:check-bold" class="text-[11px]" aria-hidden="true" />
            </span>
            {{ allFilteredSelected ? '取消当前筛选' : '全选当前筛选' }}
          </button>
          <button v-if="hasSelection" class="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 text-xs font-medium text-slate-400 transition-colors hover:border-slate-700 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500" @click="clearSelectedRules">
            <Icon icon="ph:x-bold" class="text-sm" aria-hidden="true" />
            清空选择
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="py-20 text-center text-slate-500 text-xs">
      正在扫描规则库空间…
    </div>
    <div v-else-if="filteredRules.length === 0" class="py-20 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl text-xs">
      未发现匹配规则空间清单
    </div>
    <div v-else class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      <div v-for="rule in filteredRules" :key="rule.path" class="glass-card group relative flex flex-col justify-between rounded-3xl p-6 transition duration-200 hover:-translate-y-0.5 hover:border-slate-600 hover:shadow-brand-500/10" :class="selectedRulePaths.includes(rule.path) ? 'border-cyan-500/45 bg-cyan-950/20 shadow-[0_0_0_1px_rgba(34,211,238,0.08)]' : ''">
        <div>
          <div class="flex items-start justify-between mb-2">
            <div class="flex min-w-0 cursor-pointer items-center gap-2" @click="toggleSelectRule(rule.path)">
              <button class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500" :class="selectedRulePaths.includes(rule.path) ? 'border-cyan-400 bg-cyan-400 text-slate-950' : 'border-slate-700 bg-slate-950 text-transparent group-hover:border-slate-500'" :aria-pressed="selectedRulePaths.includes(rule.path)" :aria-label="`选择 ${rule.name}`" @click.stop="toggleSelectRule(rule.path)">
                <Icon icon="ph:check-bold" class="text-xs" aria-hidden="true" />
              </button>
              <h3 class="text-lg font-semibold tracking-tight text-slate-100 transition-colors group-hover:text-brand-300">
                {{ rule.name }}
              </h3>
            </div>
            <span class="text-xs px-2 py-0.5 rounded-full font-medium" :class="rule.isGlobal ? 'bg-purple-950/80 text-purple-300 border border-purple-800/40' : 'bg-slate-900 text-slate-400 border border-slate-800'">
              {{ rule.isGlobal ? '全局层级' : '项目层级' }}
            </span>
          </div>
          <p class="mb-5 line-clamp-2 cursor-pointer text-sm leading-relaxed text-slate-400" @click="toggleSelectRule(rule.path)">
            {{ rule.meta?.description || '暂无描述信息' }}
          </p>
          <div v-if="rule.references?.length" class="mb-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-2">
            <p class="text-xs font-semibold text-cyan-300">
              引用文件 <span class="tabular-nums">{{ rule.references.length }}</span> 个
              <span v-if="rule.meta?.referencesDir" class="ml-1 font-mono text-cyan-400/80">→ {{ rule.meta.referencesDir }}</span>
            </p>
            <div class="mt-1 flex flex-wrap gap-1">
              <span v-for="reference in rule.references" :key="reference.targetPath" class="max-w-full truncate rounded border border-slate-800 bg-slate-950 px-1.5 py-0.5 font-mono text-xs text-slate-400" :title="reference.targetPath">
                {{ reference.targetPath }}
              </span>
            </div>
          </div>
        </div>

        <div class="pt-3 border-t border-slate-800/60 flex items-center justify-between gap-2 mt-auto">
          <div class="flex flex-wrap gap-1 max-w-[65%] truncate">
            <span v-for="tag in rule.meta?.tags" :key="tag" class="text-xs bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded border border-slate-800/80">#{{ tag }}</span>
          </div>
          <div class="flex items-center space-x-2 shrink-0">
            <button class="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-500 flex items-center gap-1.5" @click="emit('edit', rule)">
              <Icon icon="ph:pencil-simple-duotone" class="text-sm" />
              编辑
            </button>
            <button class="p-1.5 rounded-lg hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500" title="彻底删除" aria-label="彻底删除" @click="emit('delete', rule)">
              <Icon icon="ph:trash-duotone" class="text-base" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 同步操作底栏 -->
    <div v-if="selectedRulePaths.length > 0" class="sticky bottom-6 glass-card rounded-2xl p-5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 shadow-2xl border-cyan-500/40 animate-fade-in">
      <div class="space-y-1">
        <p class="text-xs text-slate-400">
          已勾选同步下发规则数: <span class="text-cyan-400 font-bold text-sm tabular-nums">{{ selectedRulePaths.length }}</span>
        </p>
        <div class="flex max-w-3xl flex-wrap gap-1.5">
          <span v-for="rule in selectedRules.slice(0, 6)" :key="rule.path" class="max-w-[13rem] truncate rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-200" :title="rule.name">
            {{ rule.name }}
          </span>
          <span v-if="selectedRules.length > 6" class="rounded-lg border border-slate-800 bg-slate-950 px-2 py-0.5 text-xs text-slate-400">
            +{{ selectedRules.length - 6 }}
          </span>
        </div>
        <div class="flex flex-wrap items-center gap-1.5 pt-1">
          <span class="text-xs text-slate-500">生效通道:</span>
          <button v-for="agent in agents" :key="agent.id" class="px-2.5 py-1 rounded-lg text-xs font-medium border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" :class="selectedAgents.includes(agent.id) ? 'bg-brand-500/20 border-brand-500 text-brand-200' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'" @click="toggleSelectAgent(agent.id)">
            {{ agent.name }}
          </button>
        </div>
      </div>

      <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
        <div class="bg-slate-900 p-1 rounded-xl border border-slate-800 flex items-center space-x-1">
          <span class="text-xs text-slate-500 px-2">同步级别作用域:</span>
          <button class="px-2.5 py-1 rounded-lg text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" :class="!applyScopeGlobal ? 'bg-slate-800 text-brand-400 shadow-sm' : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'" @click="applyScopeGlobal = false">
            项目级
          </button>
          <button class="px-2.5 py-1 rounded-lg text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500" :class="applyScopeGlobal ? 'bg-slate-800 text-purple-400 shadow-sm' : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'" @click="applyScopeGlobal = true">
            全局级
          </button>
        </div>

        <button :disabled="selectedAgents.length === 0" class="rounded-xl bg-gradient-to-r from-brand-600 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 transition-colors hover:from-brand-500 hover:to-cyan-400 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900" @click="executeApply">
          分发绑定下发
        </button>
      </div>
    </div>
  </div>
</template>
