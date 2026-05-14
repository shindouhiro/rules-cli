<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  applied: any[]
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'remove', item: any): void
  (e: 'removeMany', items: any[]): void
}>()

const selectedKeys = ref(new Set<string>())

function itemKey(item: any) {
  return [
    item.scope,
    item.agentId,
    item.type,
    item.name,
    item.path,
  ].join('::')
}

const allKeys = computed(() => props.applied.map(itemKey))
const selectedItems = computed(() => props.applied.filter(item => selectedKeys.value.has(itemKey(item))))
const allSelected = computed(() => props.applied.length > 0 && selectedItems.value.length === props.applied.length)
const hasSelection = computed(() => selectedItems.value.length > 0)

watch(
  () => props.applied,
  () => {
    const liveKeys = new Set(allKeys.value)
    selectedKeys.value = new Set([...selectedKeys.value].filter(key => liveKeys.has(key)))
  },
  { deep: true },
)

function toggleItem(item: any) {
  const next = new Set(selectedKeys.value)
  const key = itemKey(item)
  if (next.has(key))
    next.delete(key)
  else
    next.add(key)
  selectedKeys.value = next
}

function toggleAll() {
  selectedKeys.value = allSelected.value ? new Set() : new Set(allKeys.value)
}

function clearSelection() {
  selectedKeys.value = new Set()
}

function removeMany() {
  emit('removeMany', selectedItems.value)
}
</script>

<template>
  <div class="glass-card rounded-2xl p-4 sm:p-5">
    <div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h2 class="text-xs font-bold text-slate-400 uppercase tracking-wider">
          自动发现各智能体配置文件对应映射规则
        </h2>
        <p class="mt-1 text-xs text-slate-500">
          可批量选择映射并同步清理入口文件与引用 docs。
        </p>
      </div>

      <div v-if="!loading && applied.length > 0" class="flex flex-wrap items-center gap-2">
        <button class="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" :class="allSelected ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-200' : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700 hover:text-slate-200'" @click="toggleAll">
          <span class="flex h-4 w-4 items-center justify-center rounded border transition-colors" :class="allSelected ? 'border-cyan-400 bg-cyan-400 text-slate-950' : 'border-slate-700 bg-slate-900'">
            <Icon v-if="allSelected" icon="ph:check-bold" class="text-[11px]" aria-hidden="true" />
          </span>
          {{ allSelected ? '取消全选' : '全选' }}
        </button>
        <button v-if="hasSelection" class="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 text-xs font-medium text-slate-400 transition-colors hover:border-slate-700 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" @click="clearSelection">
          <Icon icon="ph:x-bold" class="text-sm" aria-hidden="true" />
          清空
        </button>
        <button class="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-950/50 disabled:text-slate-600" :class="hasSelection ? 'border-rose-500/40 bg-rose-950/45 text-rose-200 hover:border-rose-400/70 hover:bg-rose-900/50' : ''" :disabled="!hasSelection" @click="removeMany">
          <Icon icon="ph:trash-duotone" class="text-base" aria-hidden="true" />
          删除选中 {{ selectedItems.length || '' }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="py-12 text-center text-slate-500 text-xs">
      正在嗅探配置文件…
    </div>
    <div v-else-if="applied.length === 0" class="py-12 text-center text-slate-500 border border-dashed border-slate-800/80 rounded-xl text-xs">
      当前机器与项目中未发现任何被绑定应用的规则映射单据
    </div>
    <div v-else class="space-y-2.5">
      <div v-for="item in applied" :key="itemKey(item)" class="group border rounded-xl p-3 transition-colors" :class="selectedKeys.has(itemKey(item)) ? 'border-cyan-500/45 bg-cyan-950/20 shadow-[0_0_0_1px_rgba(34,211,238,0.08)]' : 'border-slate-800/60 bg-slate-900/60 hover:border-slate-700'">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-start space-x-3 min-w-0 flex-1">
            <button class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500" :class="selectedKeys.has(itemKey(item)) ? 'border-cyan-400 bg-cyan-400 text-slate-950' : 'border-slate-700 bg-slate-950 text-transparent group-hover:border-slate-500'" :aria-pressed="selectedKeys.has(itemKey(item))" :aria-label="`选择 ${item.name}`" @click="toggleItem(item)">
              <Icon icon="ph:check-bold" class="text-xs" aria-hidden="true" />
            </button>
            <Icon v-if="item.mode === 'symlink'" icon="ph:link-duotone" class="text-lg mt-0.5 shrink-0 text-cyan-500" aria-hidden="true" />
            <Icon v-else icon="ph:needle-duotone" class="text-lg mt-0.5 shrink-0 text-rose-500" aria-hidden="true" />
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
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
  </div>
</template>
