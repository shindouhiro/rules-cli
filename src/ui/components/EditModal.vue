<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { defineAsyncComponent, ref, watch } from 'vue'

interface EditableReference {
  key: string
  sourcePath?: string
  targetPath: string
  title?: string
  content: string
  isNew?: boolean
}

const props = defineProps<{
  show: boolean
  rule: any
  agents: any[]
  defaultAgentIds?: string[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', path: string, content: string, references: Array<{ sourcePath?: string, targetPath?: string, content: string }>): void
  (e: 'apply', rule: any, agentIds: string[], isGlobal: boolean, content: string, references: Array<{ sourcePath?: string, targetPath?: string, content: string }>): void
}>()

const CodeEditor = defineAsyncComponent(() => import('./CodeEditor.vue'))

const content = ref('')
const activeFile = ref('rule.md')
const referencesDir = ref('docs')
const editableReferences = ref<EditableReference[]>([])
const newReferencePath = ref('')
const referenceError = ref('')
const selectedAgents = ref<string[]>([])
const applyScopeGlobal = ref(false)
const saving = ref(false)

function getDefaultSelectedAgentIds(agents: any[], defaultAgentIds: string[] = []): string[] {
  if (agents.length === 0)
    return []
  const liveDefaultAgentIds = defaultAgentIds.filter(id => agents.some(agent => agent.id === id))
  if (liveDefaultAgentIds.length > 0)
    return liveDefaultAgentIds
  const claudeAgent = agents.find(agent => agent.id === 'claude-code')
  return [claudeAgent?.id || agents[0].id]
}

watch(() => props.rule, (newRule) => {
  if (newRule) {
    content.value = newRule.rawContent || ''
    activeFile.value = 'rule.md'
    referencesDir.value = newRule.meta?.referencesDir || 'docs'
    applyScopeGlobal.value = !!newRule.isGlobal
    selectedAgents.value = getDefaultSelectedAgentIds(props.agents, props.defaultAgentIds || [])
    referenceError.value = ''
    newReferencePath.value = ''
    editableReferences.value = (newRule.references || []).map((reference: any) => ({
      key: getReferenceKey(reference),
      sourcePath: reference.sourcePath,
      targetPath: reference.targetPath,
      title: reference.title,
      content: reference.rawContent || reference.content || '',
    }))
  }
}, { immediate: true })

watch(() => props.agents, (agents) => {
  if (agents.length > 0 && selectedAgents.value.length === 0)
    selectedAgents.value = getDefaultSelectedAgentIds(agents, props.defaultAgentIds || [])
}, { immediate: true })

watch(() => props.defaultAgentIds, (defaultAgentIds) => {
  if (props.show)
    selectedAgents.value = getDefaultSelectedAgentIds(props.agents, defaultAgentIds || [])
}, { deep: true })

function getActiveContent() {
  if (activeFile.value === 'rule.md')
    return content.value
  return editableReferences.value.find(reference => reference.key === activeFile.value)?.content || ''
}

function setActiveContent(value: string) {
  if (activeFile.value === 'rule.md') {
    content.value = value
    return
  }
  const reference = editableReferences.value.find(item => item.key === activeFile.value)
  if (reference)
    reference.content = value
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
  emit('apply', props.rule, selectedAgents.value, applyScopeGlobal.value, withReferenceFrontmatter(content.value, referencesDir.value), getReferencePayload())
}

function getReferencePayload(): Array<{ sourcePath?: string, targetPath?: string, content: string }> {
  return editableReferences.value.map(reference => ({
    sourcePath: reference.sourcePath,
    targetPath: reference.isNew ? reference.targetPath : undefined,
    content: reference.content,
  }))
}

function handleSave() {
  if (!props.rule?.path)
    return
  saving.value = true
  emit(
    'save',
    props.rule.path,
    withReferenceFrontmatter(content.value, referencesDir.value),
    getReferencePayload(),
  )
  setTimeout(() => {
    saving.value = false
  }, 500)
}

function getReferenceKey(reference: any): string {
  return reference.sourcePath || `new:${reference.targetPath}`
}

function normalizeReferencePath(path: string): string {
  return path.trim().replace(/\\/g, '/')
}

function isUnsafeReferencePath(path: string): boolean {
  const normalized = normalizeReferencePath(path)
  return !normalized
    || normalized.startsWith('/')
    || normalized === '..'
    || normalized.startsWith('../')
    || normalized.includes('/../')
    || normalized.startsWith('~/')
}

function addReference() {
  const targetPath = normalizeReferencePath(newReferencePath.value)
  if (isUnsafeReferencePath(targetPath)) {
    referenceError.value = '请输入安全的相对路径，例如 docs/my-rule.md'
    return
  }

  if (editableReferences.value.some(reference => reference.targetPath === targetPath)) {
    referenceError.value = '该引用文件已存在'
    return
  }

  const reference: EditableReference = {
    key: `new:${targetPath}`,
    targetPath,
    title: targetPath.split('/').pop() || targetPath,
    content: `# ${targetPath.split('/').pop()?.replace(/\.[^.]+$/u, '') || '新引用'}\n\n`,
    isNew: true,
  }

  editableReferences.value = [...editableReferences.value, reference]
  activeFile.value = reference.key
  newReferencePath.value = ''
  referenceError.value = ''
}

function withReferenceFrontmatter(rawContent: string, nextReferencesDir: string): string {
  const normalizedDir = nextReferencesDir.trim() || 'docs'
  const frontmatterMatch = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!frontmatterMatch) {
    return `---\nreferencesDir: ${normalizedDir}\n${serializeReferences()}\n---\n\n${rawContent.trim()}\n`
  }

  const lines = frontmatterMatch[1].split(/\r?\n/u)
  const existingIndex = lines.findIndex(line => line.startsWith('referencesDir:'))
  if (existingIndex >= 0)
    lines[existingIndex] = `referencesDir: ${normalizedDir}`
  else lines.push(`referencesDir: ${normalizedDir}`)

  const nextLines = upsertNewReferenceEntries(lines)

  return `---\n${nextLines.join('\n')}\n---\n\n${rawContent.slice(frontmatterMatch[0].length).trim()}\n`
}

function upsertNewReferenceEntries(lines: string[]): string[] {
  const newReferences = editableReferences.value.filter(reference => reference.isNew)
  if (newReferences.length === 0)
    return lines

  const referencesIndex = lines.findIndex(line => line.trim() === 'references:')
  if (referencesIndex === -1) {
    const emptyReferencesIndex = lines.findIndex(line => line.trim() === 'references: []')
    if (emptyReferencesIndex >= 0) {
      return [
        ...lines.slice(0, emptyReferencesIndex),
        ...serializeReferences().split('\n'),
        ...lines.slice(emptyReferencesIndex + 1),
      ]
    }
    return [...lines, ...serializeReferences().split('\n')]
  }

  const existingPaths = new Set<string>()
  for (let i = referencesIndex + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.startsWith(' ') && !line.startsWith('\t'))
      break
    const trimmed = line.trim()
    if (trimmed.startsWith('- path:'))
      existingPaths.add(trimmed.slice('- path:'.length).trim().replace(/^["']|["']$/g, ''))
  }

  const additions = newReferences
    .filter(reference => !existingPaths.has(reference.targetPath))
    .flatMap(reference => serializeReference(reference))

  if (additions.length === 0)
    return lines

  let insertIndex = referencesIndex + 1
  while (insertIndex < lines.length && (lines[insertIndex].startsWith(' ') || lines[insertIndex].startsWith('\t')))
    insertIndex++

  return [
    ...lines.slice(0, insertIndex),
    ...additions,
    ...lines.slice(insertIndex),
  ]
}

function serializeReferences(): string {
  if (editableReferences.value.length === 0)
    return 'references: []'
  return [
    'references:',
    ...editableReferences.value.flatMap(reference => serializeReference(reference)),
  ].join('\n')
}

function serializeReference(reference: EditableReference): string[] {
  const lines = [`  - path: ${reference.targetPath}`]
  if (reference.title)
    lines.push(`    title: ${reference.title}`)
  return lines
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop animate-fade-in">
    <div class="glass-card flex h-[92vh] w-full max-w-[min(96vw,1280px)] flex-col overflow-hidden rounded-2xl border-slate-700 shadow-2xl">
      <div class="px-5 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div class="flex items-center space-x-2 truncate">
          <Icon icon="ph:pencil-simple-duotone" class="text-brand-400 text-lg shrink-0" />
          <h3 class="text-sm font-semibold text-slate-200 truncate">
            实时在线编辑源码: <span class="text-white font-mono">{{ rule?.name }}</span>
          </h3>
          <span class="text-xs bg-slate-950 px-2 py-0.5 rounded text-slate-400 border border-slate-800 truncate" :title="rule?.path">
            {{ rule?.path }}
          </span>
        </div>
        <button class="text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500" aria-label="关闭" @click="emit('close')">
          <Icon icon="ph:x-bold" />
        </button>
      </div>
      <div class="grid flex-1 grid-cols-1 gap-4 overflow-hidden bg-slate-950 p-4 md:grid-cols-[260px_1fr]">
        <aside class="rounded-xl border border-slate-800 bg-slate-900/80 p-2 overflow-y-auto">
          <button class="w-full text-left rounded-lg px-3 py-2 text-xs transition-colors" :class="activeFile === 'rule.md' ? 'bg-brand-500/20 text-brand-200' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'" @click="activeFile = 'rule.md'">
            <span class="block font-semibold">入口文件</span>
            <span class="block truncate font-mono text-xs opacity-70">rule.md</span>
          </button>
          <div class="mt-3 border-t border-slate-800 pt-3">
            <div class="mb-2 flex items-center justify-between gap-2 px-3">
              <p class="text-xs font-semibold text-cyan-300">
                引用文件
              </p>
              <span class="font-mono text-[10px] text-slate-500">{{ editableReferences.length }}</span>
            </div>
            <button v-for="reference in editableReferences" :key="reference.key" class="mb-1 w-full text-left rounded-lg px-3 py-2 text-xs transition-colors" :class="activeFile === reference.key ? 'bg-cyan-500/20 text-cyan-100' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'" @click="activeFile = reference.key">
              <span class="block truncate">{{ reference.title || reference.targetPath }}</span>
              <span class="block truncate font-mono text-xs opacity-70">{{ reference.isNew ? '新建 · ' : '' }}{{ reference.targetPath }}</span>
            </button>
            <div class="mt-3 space-y-2 border-t border-slate-800 px-3 pt-3">
              <input v-model="newReferencePath" name="new-reference-path" autocomplete="off" spellcheck="false" class="w-full rounded-lg border border-slate-800 bg-slate-950 px-2 py-1.5 font-mono text-xs text-cyan-100 placeholder:text-slate-600 focus-visible:border-cyan-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500" placeholder="docs/new-rule.md" @keydown.enter.prevent="addReference">
              <button class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2 py-1.5 text-xs font-semibold text-cyan-300 transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500" @click="addReference">
                <Icon icon="ph:plus-circle-duotone" class="text-sm" />
                新建引用
              </button>
              <p v-if="referenceError" class="text-xs text-rose-300">
                {{ referenceError }}
              </p>
            </div>
          </div>
        </aside>
        <section class="flex min-h-0 flex-col overflow-hidden">
          <div class="mb-2 flex items-center justify-between gap-3">
            <p class="truncate text-xs text-slate-400">
              {{ activeFile === 'rule.md' ? '修改入口地图与 frontmatter' : '修改引用文件源码' }}
            </p>
            <span v-if="rule?.meta?.referencesDir" class="shrink-0 rounded border border-cyan-500/20 bg-cyan-500/5 px-2 py-0.5 font-mono text-xs text-cyan-300">
              referencesDir: {{ rule.meta.referencesDir }}
            </span>
          </div>
          <label class="mb-2 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs text-slate-400">
            <span class="shrink-0">引用目录</span>
            <input v-model="referencesDir" name="references-dir" autocomplete="off" spellcheck="false" class="min-w-0 flex-1 bg-transparent font-mono text-cyan-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500 rounded" placeholder="docs">
          </label>
          <CodeEditor :model-value="getActiveContent()" :path="activeFile" language="markdown" @update:model-value="setActiveContent" />
        </section>
      </div>
      <div class="border-t border-slate-800 bg-slate-900/50 p-5">
        <div class="bg-slate-950 rounded-xl border border-slate-800/80 p-3 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 shadow-inner">
          <div class="flex flex-col gap-2.5">
            <div class="flex items-center gap-1.5 px-1">
              <Icon icon="ph:robot-duotone" class="text-brand-400 text-sm" />
              <span class="text-xs font-medium text-slate-400 uppercase tracking-wider">目标智能体 (Agents)</span>
            </div>
            <div class="flex flex-wrap items-center gap-1.5">
              <button v-for="agent in agents" :key="agent.id" class="rounded-lg border px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" :class="selectedAgents.includes(agent.id) ? 'border-brand-500 bg-brand-500/10 text-brand-300 shadow-sm shadow-brand-500/10' : 'border-slate-800 bg-slate-900 text-slate-500 hover:text-slate-300 hover:bg-slate-800'" @click="toggleAgent(agent.id)">
                {{ agent.name }}
              </button>
            </div>
          </div>

          <div class="flex items-end gap-3 shrink-0">
            <div class="flex flex-col gap-2">
              <span class="text-xs font-medium text-slate-500 uppercase tracking-wider px-1">作用域级别</span>
              <div class="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button class="rounded-lg px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 font-medium" :class="!applyScopeGlobal ? 'bg-slate-800 text-brand-400 shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'" @click="applyScopeGlobal = false">
                  项目级
                </button>
                <button class="rounded-lg px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 font-medium" :class="applyScopeGlobal ? 'bg-slate-800 text-purple-400 shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'" @click="applyScopeGlobal = true">
                  全局级
                </button>
              </div>
            </div>
            <button :disabled="selectedAgents.length === 0" class="h-[38px] px-4 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 hover:border-cyan-500/30 transition-colors text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500" @click="emitApply">
              <Icon icon="ph:link-break-duotone" class="text-sm" />
              生成引用
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between px-1">
          <button class="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 rounded p-1" @click="emit('close')">
            <Icon icon="ph:x-circle-duotone" class="text-sm" /> 放弃修改并关闭
          </button>
          <button :disabled="saving" class="h-9 px-5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-brand-500/20 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900" @click="handleSave">
            <Icon v-if="saving" icon="ph:spinner-gap" class="animate-spin text-sm" />
            <Icon v-else icon="ph:floppy-disk-duotone" class="text-sm" />
            保存源码文件
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
