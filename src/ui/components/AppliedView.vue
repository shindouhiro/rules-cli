<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineProps<{
  applied: any[]
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'remove', item: any): void
}>()
</script>

<template>
  <div class="glass-card rounded-2xl p-4 sm:p-5">
    <h2 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
      自动发现各智能体配置文件对应映射规则
    </h2>
    <div v-if="loading" class="py-12 text-center text-slate-500 text-xs">
      正在嗅探配置文件…
    </div>
    <div v-else-if="applied.length === 0" class="py-12 text-center text-slate-500 border border-dashed border-slate-800/80 rounded-xl text-xs">
      当前机器与项目中未发现任何被绑定应用的规则映射单据
    </div>
    <div v-else class="space-y-2.5">
      <div v-for="(item, idx) in applied" :key="idx" class="bg-slate-900/60 border border-slate-800/60 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors">
        <div class="flex items-start space-x-3 min-w-0 flex-1">
          <Icon v-if="item.mode === 'symlink'" icon="ph:link-duotone" class="text-lg mt-0.5 shrink-0 text-cyan-500" aria-hidden="true" />
          <Icon v-else icon="ph:needle-duotone" class="text-lg mt-0.5 shrink-0 text-rose-500" aria-hidden="true" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center space-x-2">
              <span class="font-medium text-xs text-slate-200">{{ item.name }}</span>
              <span class="text-xs px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-cyan-400 font-mono">{{ item.agentName }}</span>
              <span class="text-xs px-1.5 py-0.5 rounded font-medium" :class="item.scope === 'global' ? 'bg-purple-950 text-purple-300' : 'bg-slate-800 text-slate-400'">
                {{ item.scope === 'global' ? '全局层级' : '项目层级' }}
              </span>
              <span class="text-xs text-slate-500 font-mono">{{ item.mode }}</span>
            </div>
            <p class="text-xs text-slate-500 truncate mt-1 font-mono" :title="item.path">
              {{ item.path }}
            </p>
          </div>
        </div>
        <button class="bg-slate-950 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-900 text-slate-400 hover:text-rose-300 px-2.5 py-1 rounded-lg text-xs transition-colors shrink-0 self-end sm:self-auto focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500" @click="emit('remove', item)">
          解绑/卸载
        </button>
      </div>
    </div>
  </div>
</template>
