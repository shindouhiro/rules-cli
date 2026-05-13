<script setup lang="ts">
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
const selectedRules = ref<string[]>([])
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

function toggleSelectRule(name: string) {
  const idx = selectedRules.value.indexOf(name)
  if (idx > -1)
    selectedRules.value.splice(idx, 1)
  else selectedRules.value.push(name)
}

function toggleSelectAgent(id: string) {
  const idx = selectedAgents.value.indexOf(id)
  if (idx > -1)
    selectedAgents.value.splice(idx, 1)
  else selectedAgents.value.push(id)
}

function executeApply() {
  if (selectedRules.value.length === 0 || selectedAgents.value.length === 0)
    return
  emit('apply', selectedRules.value, selectedAgents.value, applyScopeGlobal.value)
  selectedRules.value = []
}

watch(() => props.agents, (newAgents) => {
  if (newAgents.length > 0 && selectedAgents.value.length === 0) {
    selectedAgents.value = newAgents.map(a => a.id)
  }
}, { immediate: true })
</script>

<template>
  <div class="space-y-6">
    <div class="relative">
      <input v-model="searchQuery" type="text" placeholder="检索规则名称、描述或前端分类标签..." class="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2.5 pl-10 text-sm text-slate-200 focus:outline-none focus:border-brand-500 transition-colors placeholder:text-slate-500">
      <span class="absolute left-3.5 top-3 text-slate-500">🔍</span>
    </div>

    <div v-if="loading" class="py-20 text-center text-slate-500 text-xs">
      正在扫描规则库空间...
    </div>
    <div v-else-if="filteredRules.length === 0" class="py-20 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl text-xs">
      未发现匹配规则空间清单
    </div>
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="rule in filteredRules" :key="rule.name" class="glass-card rounded-2xl p-5 transition-all hover:border-slate-700 relative flex flex-col justify-between group" :class="selectedRules.includes(rule.name) ? 'ring-2 ring-brand-500 border-transparent' : ''">
        <div>
          <div class="flex items-start justify-between mb-2">
            <div class="flex items-center space-x-2 cursor-pointer" @click="toggleSelectRule(rule.name)">
              <input type="checkbox" :checked="selectedRules.includes(rule.name)" class="rounded bg-slate-900 border-slate-700 text-brand-500 focus:ring-0 mt-0.5 cursor-pointer">
              <h3 class="text-base font-semibold text-slate-200 group-hover:text-brand-400 transition-colors">
                {{ rule.name }}
              </h3>
            </div>
            <span class="text-[10px] px-2 py-0.5 rounded-full font-medium" :class="rule.isGlobal ? 'bg-purple-950/80 text-purple-300 border border-purple-800/40' : 'bg-slate-900 text-slate-400 border border-slate-800'">
              {{ rule.isGlobal ? '全局层级' : '项目层级' }}
            </span>
          </div>
          <p class="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-4 cursor-pointer" @click="toggleSelectRule(rule.name)">
            {{ rule.meta?.description || '暂无描述信息' }}
          </p>
        </div>

        <div class="pt-3 border-t border-slate-800/60 flex items-center justify-between gap-2 mt-auto">
          <div class="flex flex-wrap gap-1 max-w-[65%] truncate">
            <span v-for="tag in rule.meta?.tags" :key="tag" class="text-[9px] bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded border border-slate-800/80">#{{ tag }}</span>
          </div>
          <div class="flex items-center space-x-2 shrink-0">
            <button class="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-[11px] text-slate-300 transition-colors" @click="emit('edit', rule)">
              ✏️ 编辑
            </button>
            <button class="p-1 rounded-lg hover:bg-rose-950/40 text-slate-600 hover:text-rose-400 transition-colors" title="彻底删除" @click="emit('delete', rule)">
              🗑️
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 同步操作底栏 -->
    <div v-if="selectedRules.length > 0" class="sticky bottom-6 glass-card rounded-2xl p-5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 shadow-2xl border-brand-500/40 animate-fade-in">
      <div class="space-y-1">
        <p class="text-xs text-slate-400">
          已勾选同步下发规则数: <span class="text-brand-400 font-bold text-sm">{{ selectedRules.length }}</span>
        </p>
        <div class="flex flex-wrap items-center gap-1.5 pt-1">
          <span class="text-[11px] text-slate-500">生效通道:</span>
          <button v-for="agent in agents" :key="agent.id" class="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all" :class="selectedAgents.includes(agent.id) ? 'bg-brand-500/20 border-brand-500 text-brand-200' : 'bg-slate-900 border-slate-800 text-slate-400'" @click="toggleSelectAgent(agent.id)">
            {{ agent.name }}
          </button>
        </div>
      </div>

      <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
        <div class="bg-slate-900 p-1 rounded-xl border border-slate-800 flex items-center space-x-1">
          <span class="text-[11px] text-slate-500 px-2">同步级别作用域:</span>
          <button class="px-2.5 py-1 rounded-lg text-xs font-medium transition-all" :class="!applyScopeGlobal ? 'bg-slate-800 text-brand-400 shadow-sm' : 'text-slate-400'" @click="applyScopeGlobal = false">
            项目级
          </button>
          <button class="px-2.5 py-1 rounded-lg text-xs font-medium transition-all" :class="applyScopeGlobal ? 'bg-slate-800 text-purple-400 shadow-sm' : 'text-slate-400'" @click="applyScopeGlobal = true">
            全局级
          </button>
        </div>

        <button :disabled="selectedAgents.length === 0" class="bg-gradient-to-r from-brand-600 to-cyan-500 hover:from-brand-500 hover:to-cyan-400 text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-brand-500/20 transition-all disabled:opacity-50" @click="executeApply">
          分发绑定下发
        </button>
      </div>
    </div>
  </div>
</template>
