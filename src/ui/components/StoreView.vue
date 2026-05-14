<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  rules: any[]
  agents: any[]
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'apply', ruleNames: string[], agentIds: string[], isGlobal: boolean): void
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

function toggleSelectRule(path: string) {
  const idx = selectedRulePaths.value.indexOf(path)
  if (idx > -1)
    selectedRulePaths.value.splice(idx, 1)
  else selectedRulePaths.value.push(path)
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
  const selectedNames = props.rules
    .filter(rule => selectedRulePaths.value.includes(rule.path))
    .map(rule => rule.name)
  emit('apply', selectedNames, selectedAgents.value, applyScopeGlobal.value)
  selectedRulePaths.value = []
}

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

    <div v-if="loading" class="py-20 text-center text-slate-500 text-xs">
      正在扫描规则库空间…
    </div>
    <div v-else-if="filteredRules.length === 0" class="py-20 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl text-xs">
      未发现匹配规则空间清单
    </div>
    <div v-else class="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      <div v-for="rule in filteredRules" :key="rule.path" class="glass-card group relative flex flex-col justify-between rounded-3xl p-6 transition duration-200 hover:-translate-y-0.5 hover:border-slate-600 hover:shadow-brand-500/10" :class="selectedRulePaths.includes(rule.path) ? 'ring-2 ring-brand-500 border-transparent' : ''">
        <div>
          <div class="flex items-start justify-between mb-2">
            <div class="flex items-center space-x-2 cursor-pointer" @click="toggleSelectRule(rule.path)">
              <input type="checkbox" :checked="selectedRulePaths.includes(rule.path)" aria-label="选中规则" class="rounded bg-slate-900 border-slate-700 text-brand-500 focus-visible:ring-brand-500 focus-visible:outline-none mt-0.5 cursor-pointer">
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
    <div v-if="selectedRulePaths.length > 0" class="sticky bottom-6 glass-card rounded-2xl p-5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 shadow-2xl border-brand-500/40 animate-fade-in">
      <div class="space-y-1">
        <p class="text-xs text-slate-400">
          已勾选同步下发规则数: <span class="text-brand-400 font-bold text-sm tabular-nums">{{ selectedRulePaths.length }}</span>
        </p>
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
