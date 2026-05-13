<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppliedView from './components/AppliedView.vue'
import EditModal from './components/EditModal.vue'
import RemoteView from './components/RemoteView.vue'
import StoreView from './components/StoreView.vue'

const loading = ref(true)
const rules = ref<any[]>([])
const agents = ref<any[]>([])
const applied = ref<any[]>([])
const currentTab = ref('store')

const toast = ref({ show: false, message: '', type: 'success' })
const editModal = ref({ show: false, rule: null as any })

function showToast(message: string, type = 'success') {
  toast.value = { show: true, message, type }
  setTimeout(() => {
    toast.value.show = false
  }, 3000)
}

async function fetchData() {
  loading.value = true
  try {
    const res = await fetch('/api/data')
    const json = await res.json()
    if (json.success) {
      rules.value = json.data.rules || []
      agents.value = json.data.agents || []
      applied.value = json.data.applied || []
    }
  }
  catch (err: any) {
    showToast(`数据同步加载失败: ${err.message}`, 'error')
  }
  finally {
    loading.value = false
  }
}

async function handleApply(ruleNames: string[], agentIds: string[], isGlobal: boolean) {
  try {
    const res = await fetch('/api/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ruleNames,
        agents: agentIds,
        global: isGlobal,
        force: true,
      }),
    })
    const json = await res.json()
    if (json.success) {
      showToast('规则配置下发绑定已成功执行！')
      fetchData()
    }
    else {
      showToast(json.message || '下发执行异常', 'error')
    }
  }
  catch (err: any) {
    showToast(`通信中断: ${err.message}`, 'error')
  }
}

async function handleRemoveApplied(item: any) {
  // eslint-disable-next-line no-alert
  if (!confirm(`确定将规则 ${item.name} 从 ${item.agentName} 映射中解除绑定吗？`))
    return
  try {
    const res = await fetch('/api/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: item.name,
        agentId: item.agentId,
        scope: item.scope,
        type: item.type,
        path: item.path,
      }),
    })
    const json = await res.json()
    if (json.success) {
      showToast('映射解绑卸载成功')
      fetchData()
    }
    else {
      showToast(json.message || '卸载失败', 'error')
    }
  }
  catch (err: any) {
    showToast(`网络错误: ${err.message}`, 'error')
  }
}

function handleOpenEdit(rule: any) {
  editModal.value = { show: true, rule }
}

async function handleSaveEdit(path: string, content: string) {
  try {
    const res = await fetch('/api/update-store-rule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content }),
    })
    const json = await res.json()
    if (json.success) {
      showToast('模板文件更新写入磁盘成功！')
      editModal.value.show = false
      fetchData()
    }
    else {
      showToast(json.message || '保存更新失败', 'error')
    }
  }
  catch (err: any) {
    showToast(`回写异常: ${err.message}`, 'error')
  }
}

async function handleDeleteStoreRule(rule: any) {
  // eslint-disable-next-line no-alert
  if (!confirm(`极其危险操作提醒：确定永久销毁本地规则模板空间 [${rule.name}] 吗？`))
    return
  try {
    const res = await fetch('/api/delete-store-rule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: rule.path }),
    })
    const json = await res.json()
    if (json.success) {
      showToast('规则模板已彻底从磁盘销毁')
      fetchData()
    }
    else {
      showToast(json.message || '删除异常', 'error')
    }
  }
  catch (err: any) {
    showToast(`删除中断: ${err.message}`, 'error')
  }
}

async function handleInstallRemote(name: string, source: string, isGlobal: boolean) {
  try {
    const res = await fetch('/api/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        source,
        cursor: source === 'cursor.directory',
        global: isGlobal,
        force: true,
      }),
    })
    const json = await res.json()
    if (json.success) {
      showToast('远程资源包拉取成功，存入 Store 库就绪！')
      fetchData()
      currentTab.value = 'store'
    }
    else {
      showToast(json.message || '拉取异常', 'error')
    }
  }
  catch (err: any) {
    showToast(`拉取失败: ${err.message}`, 'error')
  }
}

async function handleCreateRule(name: string, isGlobal: boolean) {
  try {
    const res = await fetch('/api/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, global: isGlobal }),
    })
    const json = await res.json()
    if (json.success) {
      showToast('单据空间与空白架构生成完毕！')
      fetchData()
      currentTab.value = 'store'
    }
    else {
      showToast(json.message || '初始化异常', 'error')
    }
  }
  catch (err: any) {
    showToast(`创建通信错误: ${err.message}`, 'error')
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 pt-6 relative">
    <!-- 顶部极光渐变背景光 -->
    <div class="absolute top-0 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
    <div class="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

    <!-- Header 栏 -->
    <header class="flex items-center justify-between pb-6 border-b border-slate-800/80 mb-8 relative z-10">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
          <span class="text-white font-bold">R</span>
        </div>
        <div>
          <h1 class="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Rules CLI 沉浸式管理系统平台
          </h1>
          <p class="text-xs text-slate-400">
            本地与全局多助手同步下发、即时编辑修改与深度市场接驳
          </p>
        </div>
      </div>
      <div class="flex items-center space-x-2 bg-slate-900/90 px-3 py-1.5 rounded-full border border-slate-800 text-xs">
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span class="text-slate-300">纯前端组件应用层就绪</span>
      </div>
    </header>

    <!-- 通知 Toast -->
    <div v-if="toast.show" class="fixed top-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 flex items-center space-x-2 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md border" :class="toast.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200' : 'bg-rose-950/90 border-rose-500/30 text-rose-200'">
      <span class="text-sm font-medium">{{ toast.message }}</span>
    </div>

    <!-- 主体导航切换 Tabs -->
    <div class="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center mb-8">
      <div class="flex space-x-1 bg-slate-900/60 p-1.5 rounded-xl border border-slate-800/80 max-w-md">
        <button class="flex-1 py-2 px-3 text-xs font-medium rounded-lg transition-all" :class="currentTab === 'store' ? 'bg-slate-800 text-white shadow' : 'text-slate-400'" @click="currentTab = 'store'">
          📦 本地规则库 ({{ rules.length }})
        </button>
        <button class="flex-1 py-2 px-3 text-xs font-medium rounded-lg transition-all" :class="currentTab === 'applied' ? 'bg-slate-800 text-white shadow' : 'text-slate-400'" @click="currentTab = 'applied'">
          ⚡ 生效对应映射 ({{ applied.length }})
        </button>
        <button class="flex-1 py-2 px-3 text-xs font-medium rounded-lg transition-all" :class="currentTab === 'remote' ? 'bg-slate-800 text-white shadow' : 'text-slate-400'" @click="currentTab = 'remote'">
          ☁️ 远程与新建
        </button>
      </div>

      <button class="bg-slate-900 border border-slate-800 hover:border-slate-700 px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200 transition-all self-end sm:self-auto flex items-center" @click="fetchData">
        🔄 重新载入发现
      </button>
    </div>

    <!-- 动态视图区域 -->
    <StoreView v-if="currentTab === 'store'" :rules="rules" :agents="agents" :loading="loading" @apply="handleApply" @edit="handleOpenEdit" @delete="handleDeleteStoreRule" />

    <AppliedView v-if="currentTab === 'applied'" :applied="applied" :loading="loading" @remove="handleRemoveApplied" />

    <RemoteView v-if="currentTab === 'remote'" @install="handleInstallRemote" @create="handleCreateRule" />

    <!-- 源码编辑器抽屉 Modal -->
    <EditModal :show="editModal.show" :rule="editModal.rule" @close="editModal.show = false" @save="handleSaveEdit" />
  </div>
</template>
