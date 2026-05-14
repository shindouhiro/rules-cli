<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  show: boolean
  rule: any
  agents: any[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', path: string, content: string, references: Array<{ sourcePath: string, content: string }>): void
  (e: 'apply', rule: any, agentIds: string[], isGlobal: boolean): void
}>()

const content = ref('')
const activeFile = ref('rule.md')
const referencesDir = ref('docs')
const referenceContents = ref<Record<string, string>>({})
const selectedAgents = ref<string[]>([])
const applyScopeGlobal = ref(false)
const saving = ref(false)

function getDefaultSelectedAgentIds(agents: any[]): string[] {
  if (agents.length === 0)
    return []
  const claudeAgent = agents.find(agent => agent.id === 'claude-code')
  return [claudeAgent?.id || agents[0].id]
}

watch(() => props.rule, (newRule) => {
  if (newRule) {
    content.value = newRule.rawContent || ''
    activeFile.value = 'rule.md'
    referencesDir.value = newRule.meta?.referencesDir || 'docs'
    applyScopeGlobal.value = !!newRule.isGlobal
    selectedAgents.value = getDefaultSelectedAgentIds(props.agents)
    referenceContents.value = Object.fromEntries(
      (newRule.references || []).map((reference: any) => [reference.sourcePath, reference.rawContent || '']),
    )
  }
}, { immediate: true })

watch(() => props.agents, (agents) => {
  if (agents.length > 0 && selectedAgents.value.length === 0)
    selectedAgents.value = getDefaultSelectedAgentIds(agents)
}, { immediate: true })

function getActiveContent() {
  if (activeFile.value === 'rule.md')
    return content.value
  return referenceContents.value[activeFile.value] || ''
}

function setActiveContent(value: string) {
  if (activeFile.value === 'rule.md') {
    content.value = value
    return
  }
  referenceContents.value = {
    ...referenceContents.value,
    [activeFile.value]: value,
  }
}

function toggleAgent(id: string) {
  const idx = selectedAgents.value.indexOf(id)
  if (idx >= 0)
    selectedAgents.value.splice(idx, 1)
  else selectedAgents.value.push(id)
}

function emitApply() {
  if (!props.rule || selectedAgents.value.length === 0)
    return
  emit('apply', props.rule, selectedAgents.value, applyScopeGlobal.value)
}

function handleSave() {
  if (!props.rule?.path)
    return
  saving.value = true
  emit(
    'save',
    props.rule.path,
    withReferencesDir(content.value, referencesDir.value),
    (props.rule.references || []).map((reference: any) => ({
      sourcePath: reference.sourcePath,
      content: referenceContents.value[reference.sourcePath] || '',
    })),
  )
  setTimeout(() => {
    saving.value = false
  }, 500)
}

function withReferencesDir(rawContent: string, nextReferencesDir: string): string {
  const normalizedDir = nextReferencesDir.trim() || 'docs'
  const frontmatterMatch = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!frontmatterMatch) {
    return `---\nreferencesDir: ${normalizedDir}\nreferences: []\n---\n\n${rawContent.trim()}\n`
  }

  const lines = frontmatterMatch[1].split(/\r?\n/u)
  const existingIndex = lines.findIndex(line => line.startsWith('referencesDir:'))
  if (existingIndex >= 0)
    lines[existingIndex] = `referencesDir: ${normalizedDir}`
  else lines.push(`referencesDir: ${normalizedDir}`)

  return `---\n${lines.join('\n')}\n---\n\n${rawContent.slice(frontmatterMatch[0].length).trim()}\n`
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop animate-fade-in">
    <div class="glass-card w-full max-w-5xl rounded-2xl overflow-hidden flex flex-col max-h-[85vh] border-slate-700 shadow-2xl">
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
      <div class="p-4 flex-1 grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 overflow-hidden bg-slate-950">
        <aside class="rounded-xl border border-slate-800 bg-slate-900/80 p-2 overflow-y-auto">
          <button class="w-full text-left rounded-lg px-3 py-2 text-xs transition-colors" :class="activeFile === 'rule.md' ? 'bg-brand-500/20 text-brand-200' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'" @click="activeFile = 'rule.md'">
            <span class="block font-semibold">入口文件</span>
            <span class="block truncate font-mono text-[10px] opacity-70">rule.md</span>
          </button>
          <div v-if="rule?.references?.length" class="mt-3 border-t border-slate-800 pt-3">
            <p class="px-3 pb-2 text-[10px] font-semibold text-cyan-300">
              引用文件
            </p>
            <button v-for="reference in rule.references" :key="reference.sourcePath" class="mb-1 w-full text-left rounded-lg px-3 py-2 text-xs transition-colors" :class="activeFile === reference.sourcePath ? 'bg-cyan-500/20 text-cyan-100' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'" @click="activeFile = reference.sourcePath">
              <span class="block truncate">{{ reference.title || reference.targetPath }}</span>
              <span class="block truncate font-mono text-[10px] opacity-70">{{ reference.targetPath }}</span>
            </button>
          </div>
          <p v-else class="mt-3 border-t border-slate-800 px-3 pt-3 text-[10px] text-slate-500">
            当前规则未声明引用文件。
          </p>
        </aside>
        <section class="flex min-h-0 flex-col overflow-hidden">
          <div class="mb-2 flex items-center justify-between gap-3">
            <p class="truncate text-[11px] text-slate-400">
              {{ activeFile === 'rule.md' ? '修改入口地图与 frontmatter' : '修改引用文件源码' }}
            </p>
            <span v-if="rule?.meta?.referencesDir" class="shrink-0 rounded border border-cyan-500/20 bg-cyan-500/5 px-2 py-0.5 font-mono text-[10px] text-cyan-300">
              referencesDir: {{ rule.meta.referencesDir }}
            </span>
          </div>
          <label class="mb-2 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-[11px] text-slate-400">
            <span class="shrink-0">引用目录</span>
            <input v-model="referencesDir" class="min-w-0 flex-1 bg-transparent font-mono text-cyan-200 outline-none" placeholder="docs">
          </label>
          <textarea :value="getActiveContent()" class="w-full flex-1 resize-none rounded-xl border border-slate-800 bg-slate-900/90 p-3 text-xs leading-relaxed text-slate-200 transition-colors focus:border-brand-500 focus:outline-none" @input="setActiveContent(($event.target as HTMLTextAreaElement).value)" />
        </section>
      </div>
      <div class="border-t border-slate-800 bg-slate-900 px-5 py-3">
        <div class="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="mr-1 text-[11px] text-slate-500">生成到 Agents</span>
            <button v-for="agent in agents" :key="agent.id" class="rounded-lg border px-2.5 py-1 text-xs transition-colors" :class="selectedAgents.includes(agent.id) ? 'border-brand-500 bg-brand-500/20 text-brand-100' : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'" @click="toggleAgent(agent.id)">
              {{ agent.name }}
            </button>
          </div>
          <div class="flex items-center gap-2">
            <div class="rounded-xl border border-slate-800 bg-slate-950 p-1">
              <button class="rounded-lg px-2.5 py-1 text-xs transition-colors" :class="!applyScopeGlobal ? 'bg-slate-800 text-brand-300' : 'text-slate-500'" @click="applyScopeGlobal = false">
                项目级
              </button>
              <button class="rounded-lg px-2.5 py-1 text-xs transition-colors" :class="applyScopeGlobal ? 'bg-slate-800 text-purple-300' : 'text-slate-500'" @click="applyScopeGlobal = true">
                全局级
              </button>
            </div>
            <button :disabled="selectedAgents.length === 0" class="rounded-xl bg-cyan-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-cyan-500 disabled:opacity-50" @click="emitApply">
              生成引用
            </button>
          </div>
        </div>
        <div class="flex items-center justify-end space-x-3">
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
  </div>
</template>
