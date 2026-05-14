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
        <button class="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-950/50 disabled:text-slate-600" :class="hasSelection ? 'border-rose-500/40 bg-rose-950/45 text-rose-200 hover:border-rose-400/70 hover:bg-rose-900/50 shadow-lg shadow-rose-950/20' : ''" :disabled="!hasSelection" @click="removeMany">
          <Icon icon="ph:trash-duotone" class="text-base" aria-hidden="true" />
          删除选中
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
      <div v-for="item in applied" :key="itemKey(item)" class="group border rounded-2xl p-4 transition-all duration-200" :class="selectedKeys.has(itemKey(item)) ? 'border-cyan-500/40 bg-cyan-950/20 shadow-lg shadow-cyan-950/20' : 'border-slate-800/60 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60'">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-start space-x-4 min-w-0 flex-1">
            <button class="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500" :class="selectedKeys.has(itemKey(item)) ? 'border-cyan-400 bg-cyan-400 text-slate-950' : 'border-slate-700 bg-slate-950 text-transparent group-hover:border-slate-500'" :aria-pressed="selectedKeys.has(itemKey(item))" :aria-label="`选择 ${item.name}`" @click="toggleItem(item)">
              <Icon icon="ph:check-bold" class="text-xs" aria-hidden="true" />
            </button>
            <div class="relative group/icon mt-0.5">
              <Icon v-if="item.mode === 'symlink'" icon="ph:link-duotone" class="text-xl shrink-0 text-cyan-500" aria-hidden="true" />
              <Icon v-else icon="ph:needle-duotone" class="text-xl shrink-0 text-rose-500" aria-hidden="true" />
              <!-- Hover Tooltip -->
              <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-[10px] text-slate-200 rounded opacity-0 group-hover/icon:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-slate-700 z-10">
                {{ item.mode === 'symlink' ? '符号链接映射' : '内容注入映射' }}
              </div>
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2 mb-1">
                <span class="font-semibold text-sm text-slate-100">{{ item.name }}</span>
                <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800">
                  <Icon icon="ph:robot-duotone" class="text-xs text-brand-400" />
                  <span class="text-[10px] text-brand-300 font-bold uppercase tracking-wider">{{ item.agentName }}</span>
                </div>
                <span class="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider" :class="item.scope === 'global' ? 'bg-purple-900/40 text-purple-300 border border-purple-800/30' : 'bg-slate-800/80 text-slate-400 border border-slate-700/50'">
                  {{ item.scope === 'global' ? 'Global' : 'Project' }}
                </span>
              </div>
              <p class="text-xs text-slate-500 truncate font-mono bg-slate-950/50 px-2 py-1 rounded border border-slate-800/30 inline-block max-w-full" :title="item.path">
                {{ item.path }}
              </p>
            </div>
          </div>
          <div class="relative group/delete shrink-0 self-end sm:self-auto">
            <button class="p-2 rounded-xl bg-slate-950 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-900/50 text-slate-400 hover:text-rose-400 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 shadow-sm" aria-label="解绑卸载" @click="emit('remove', item)">
              <Icon icon="ph:link-break-duotone" class="text-lg" />
            </button>
            <div class="absolute bottom-full right-1/2 translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-[10px] text-slate-200 rounded opacity-0 group-hover/delete:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-slate-700 shadow-xl z-10">
              解绑卸载
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
