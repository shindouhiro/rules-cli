<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  show: boolean
  rule: any
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', path: string, content: string): void
}>()

const content = ref('')
const saving = ref(false)

watch(() => props.rule, (newRule) => {
  if (newRule) {
    content.value = newRule.rawContent || ''
  }
}, { immediate: true })

function handleSave() {
  if (!props.rule?.path)
    return
  saving.value = true
  emit('save', props.rule.path, content.value)
  setTimeout(() => {
    saving.value = false
  }, 500)
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop animate-fade-in">
    <div class="glass-card w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col max-h-[85vh] border-slate-700 shadow-2xl">
      <div class="px-5 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div class="flex items-center space-x-2 truncate">
          <span class="text-brand-400">✏️</span>
          <h3 class="text-sm font-semibold text-slate-200 truncate">
            实时在线编辑源码: <span class="text-white font-mono">{{ rule?.name }}</span>
          </h3>
          <span class="text-[10px] bg-slate-950 px-2 py-0.5 rounded text-slate-400 border border-slate-800 truncate" :title="rule?.path">
            {{ rule?.path }}
          </span>
        </div>
        <button class="text-slate-500 hover:text-slate-300 transition-colors p-1" @click="emit('close')">
          ✕
        </button>
      </div>
      <div class="p-4 flex-1 flex flex-col overflow-hidden bg-slate-950">
        <p class="text-[11px] text-slate-400 mb-2">
          修改 rule.md frontmatter 元信息头及正文主体结构指令：
        </p>
        <textarea v-model="content" class="w-full flex-1 bg-slate-900/90 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-brand-500 transition-colors leading-relaxed resize-none" />
      </div>
      <div class="px-5 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-end space-x-3">
        <button class="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-slate-200 transition-colors" @click="emit('close')">
          放弃修改
        </button>
        <button :disabled="saving" class="bg-brand-600 hover:bg-brand-500 text-white px-4 py-1.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 flex items-center space-x-1" @click="handleSave">
          <span v-if="saving" class="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span>立即保存回写至磁盘文件</span>
        </button>
      </div>
    </div>
  </div>
</template>
