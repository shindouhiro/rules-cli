<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  (e: 'install', name: string, source: string, isGlobal: boolean): void
  (e: 'create', name: string, isGlobal: boolean, referencesDir: string): void
}>()

const installForm = ref({ name: '', source: 'cursor.directory', repo: '', global: false })
const createForm = ref({ name: '', global: false, referencesDir: 'docs' })

function handleInstall() {
  if (!installForm.value.name)
    return
  const src = installForm.value.source === 'custom' ? installForm.value.repo : 'cursor.directory'
  emit('install', installForm.value.name, src, installForm.value.global)
  installForm.value.name = ''
}

function handleCreate() {
  if (!createForm.value.name)
    return
  emit('create', createForm.value.name, createForm.value.global, createForm.value.referencesDir || 'docs')
  createForm.value.name = ''
}
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div class="glass-card rounded-2xl p-6 border-slate-800">
      <h3 class="text-base font-semibold text-slate-200 mb-2 flex items-center space-x-2">
        <span>☁️ 市场远程接驳拉取</span>
      </h3>
      <p class="text-xs text-slate-400 mb-5 leading-relaxed">
        直接输入规则缩写名从官方 cursor.directory 社区同步拉取，或者填写开源仓库名拉取自定义指令包。
      </p>

      <div class="space-y-4">
        <div>
          <label class="block text-xs text-slate-400 mb-1">规则名称 (Slug)</label>
          <input v-model="installForm.name" type="text" placeholder="例如: vue, react, nextjs" class="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500 font-mono">
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-1">规则来源通道</label>
          <select v-model="installForm.source" class="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500">
            <option value="cursor.directory">
              官方 cursor.directory 生态
            </option>
            <option value="custom">
              指定 GitHub 自定义仓库
            </option>
          </select>
        </div>
        <div v-if="installForm.source === 'custom'">
          <label class="block text-xs text-slate-400 mb-1">GitHub 仓库地址 (owner/repo)</label>
          <input v-model="installForm.repo" type="text" placeholder="例如: owner/rules-repo" class="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500 font-mono">
        </div>
        <div class="flex items-center space-x-4 pt-1">
          <label class="flex items-center space-x-1.5 text-xs text-slate-400 cursor-pointer">
            <input v-model="installForm.global" type="checkbox" class="rounded bg-slate-900 border-slate-700 text-brand-500 focus:ring-0">
            <span>直接持久化至全局库</span>
          </label>
        </div>
        <button :disabled="!installForm.name" class="w-full bg-slate-900 hover:bg-slate-800 text-brand-400 border border-slate-800 hover:border-slate-700 px-4 py-2.5 rounded-xl text-xs font-medium transition-all disabled:opacity-50" @click="handleInstall">
          启动同步拉取
        </button>
      </div>
    </div>

    <div class="glass-card rounded-2xl p-6 border-slate-800">
      <h3 class="text-base font-semibold text-slate-200 mb-2 flex items-center space-x-2">
        <span>➕ 新建自定义模板空单</span>
      </h3>
      <p class="text-xs text-slate-400 mb-5 leading-relaxed">
        在本地创建标准的目录空间与空白 rule.md frontmatter 元信息架构，方便立即在线编辑内容。
      </p>

      <div class="space-y-4">
        <div>
          <label class="block text-xs text-slate-400 mb-1">自定义规则名标识</label>
          <input v-model="createForm.name" type="text" placeholder="例如: my-project-spec" class="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500 font-mono">
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-1">默认引用目录</label>
          <input v-model="createForm.referencesDir" type="text" placeholder="docs" class="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500 font-mono">
        </div>
        <div class="flex items-center space-x-4 pt-1">
          <label class="flex items-center space-x-1.5 text-xs text-slate-400 cursor-pointer">
            <input v-model="createForm.global" type="checkbox" class="rounded bg-slate-900 border-slate-700 text-brand-500 focus:ring-0">
            <span>保存至全局 store</span>
          </label>
        </div>
        <button :disabled="!createForm.name" class="w-full bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-500 hover:to-indigo-400 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-purple-500/10 transition-all disabled:opacity-50" @click="handleCreate">
          初始化生成架构
        </button>
      </div>
    </div>
  </div>
</template>
