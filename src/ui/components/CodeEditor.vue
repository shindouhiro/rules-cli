<script setup lang="ts">
import { shikiToMonaco } from '@shikijs/monaco'
import * as monaco from 'monaco-editor-core'
import EditorWorker from 'monaco-editor-core/esm/vs/editor/editor.worker.start?worker'
import { createHighlighterCore } from 'shiki/core'
import { createOnigurumaEngine } from 'shiki/engine/oniguruma'
import javascript from 'shiki/langs/javascript.mjs'
import json from 'shiki/langs/json.mjs'
import markdown from 'shiki/langs/markdown.mjs'
import typescript from 'shiki/langs/typescript.mjs'
import yaml from 'shiki/langs/yaml.mjs'
import vitesseDark from 'shiki/themes/vitesse-dark.mjs'
import { computed, nextTick, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string
  language?: string
  path?: string
}>(), {
  language: 'markdown',
  path: 'rule.md',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const editorEl = useTemplateRef<HTMLDivElement>('editorEl')
const editor = shallowRef<monaco.editor.IStandaloneCodeEditor>()
const model = shallowRef<monaco.editor.ITextModel>()
const editorReady = shallowRef(false)
const editorError = shallowRef('')

const editorLanguage = computed(() => {
  const lowerPath = props.path.toLowerCase()
  if (lowerPath.endsWith('.json'))
    return 'json'
  if (lowerPath.endsWith('.yaml') || lowerPath.endsWith('.yml'))
    return 'yaml'
  if (lowerPath.endsWith('.ts'))
    return 'typescript'
  if (lowerPath.endsWith('.js'))
    return 'javascript'
  return props.language
})

let initialized = false
let resizeObserver: ResizeObserver | undefined

async function setupShiki() {
  if (initialized)
    return

  monaco.languages.register({ id: 'markdown' })
  monaco.languages.register({ id: 'yaml' })
  monaco.languages.register({ id: 'json' })
  monaco.languages.register({ id: 'typescript' })
  monaco.languages.register({ id: 'javascript' })

  const highlighter = await createHighlighterCore({
    themes: [vitesseDark],
    langs: [markdown, yaml, json, typescript, javascript],
    engine: createOnigurumaEngine(import('shiki/wasm')),
  })

  shikiToMonaco(highlighter, monaco)
  initialized = true
}

function createEditor() {
  if (!editorEl.value)
    return

  model.value = monaco.editor.createModel(props.modelValue, editorLanguage.value)
  editor.value = monaco.editor.create(editorEl.value, {
    model: model.value,
    theme: 'vitesse-dark',
    automaticLayout: true,
    fontFamily: '\'JetBrains Mono\', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontLigatures: true,
    fontSize: 14,
    lineHeight: 22,
    minimap: { enabled: true, side: 'right', size: 'fit' },
    padding: { top: 16, bottom: 16 },
    renderLineHighlight: 'all',
    roundedSelection: false,
    scrollBeyondLastLine: false,
    smoothScrolling: true,
    tabSize: 2,
    wordWrap: 'on',
  })

  editor.value.onDidChangeModelContent(() => {
    emit('update:modelValue', editor.value?.getValue() || '')
  })

  resizeObserver = new ResizeObserver(() => {
    editor.value?.layout()
  })
  resizeObserver.observe(editorEl.value)
}

watch(() => props.modelValue, (value) => {
  if (model.value && value !== model.value.getValue())
    model.value.setValue(value)
})

watch(editorLanguage, (language) => {
  if (model.value)
    monaco.editor.setModelLanguage(model.value, language)
})

onMounted(async () => {
  globalThis.MonacoEnvironment = {
    getWorker() {
      return new EditorWorker()
    },
  }

  try {
    await setupShiki()
    await nextTick()
    createEditor()
    editorReady.value = true
  }
  catch (err) {
    editorError.value = err instanceof Error ? err.message : String(err)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  editor.value?.dispose()
  model.value?.dispose()
})
</script>

<template>
  <div class="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-800 bg-[#121212]">
    <div ref="editorEl" class="h-full min-h-[360px] w-full" />
    <div v-if="!editorReady && !editorError" class="absolute inset-0 flex items-center justify-center bg-slate-950 text-xs text-slate-400">
      正在加载语法高亮编辑器...
    </div>
    <div v-if="editorError" class="absolute inset-0 flex items-center justify-center bg-slate-950 p-4 text-center text-xs text-rose-300">
      编辑器加载失败：{{ editorError }}
    </div>
  </div>
</template>
