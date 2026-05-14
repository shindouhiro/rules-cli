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

async function handleApplyRuleFromModal(rule: any, agentIds: string[], isGlobal: boolean) {
  try {
    const res = await fetch('/api/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ruleNames: [rule.name],
        rulePaths: [rule.path],
        agents: agentIds,
        global: isGlobal,
        force: true,
      }),
    })
    const json = await res.json()
    if (json.success) {
      showToast('已按当前规则生成 Agent 引用文件')
      fetchData()
    }
    else {
      showToast(json.message || '生成引用失败', 'error')
    }
  }
  catch (err: any) {
    showToast(`生成引用异常: ${err.message}`, 'error')
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

async function handleSaveEdit(path: string, content: string, references: Array<{ sourcePath: string, content: string }> = []) {
  try {
    const res = await fetch('/api/update-store-rule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content, references }),
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

async function handleCreateRule(name: string, isGlobal: boolean, referencesDir: string) {
  try {
    const res = await fetch('/api/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, global: isGlobal, referencesDir }),
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
  <div class="min-h-screen bg-slate-950 text-slate-200">
    <!-- 通知 Toast -->
    <div v-if="toast.show" class="fixed top-6 left-1/2 -translate-x-1/2 z-50 transition flex items-center space-x-2 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md border" :class="toast.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200' : 'bg-rose-950/90 border-rose-500/30 text-rose-200'" aria-live="polite">
      <span class="text-sm font-medium">{{ toast.message }}</span>
    </div>

    <div class="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_1fr]">
      <aside class="border-b border-slate-800 bg-slate-950 lg:border-b-0 lg:border-r">
        <div class="flex h-full flex-col">
          <div class="border-b border-slate-800 px-5 py-5">
            <div class="flex items-center gap-3">
              <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
                R
              </div>
              <div>
                <h1 class="text-sm font-semibold text-white">
                  Rules CLI
                </h1>
                <p class="text-[11px] text-slate-500">
                  引用式规则后台
                </p>
              </div>
            </div>
          </div>

          <nav class="grid gap-1 p-3">
            <button class="flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors" :class="currentTab === 'store' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'" @click="currentTab = 'store'">
              <span>本地规则库</span>
              <span class="font-mono tabular-nums text-[10px] text-slate-500">{{ rules.length }}</span>
            </button>
            <button class="flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors" :class="currentTab === 'applied' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'" @click="currentTab = 'applied'">
              <span>生效映射</span>
              <span class="font-mono tabular-nums text-[10px] text-slate-500">{{ applied.length }}</span>
            </button>
            <button class="flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors" :class="currentTab === 'remote' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'" @click="currentTab = 'remote'">
              <span>远程与新建</span>
              <span class="font-mono tabular-nums text-[10px] text-slate-500">+</span>
            </button>
          </nav>

          <div class="mt-auto border-t border-slate-800 p-3">
            <button class="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-400 transition-colors hover:border-slate-700 hover:bg-slate-800 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" @click="fetchData">
              重新载入发现
            </button>
          </div>
        </div>
      </aside>

      <main class="min-w-0 overflow-y-auto">
        <header class="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 px-6 py-4 backdrop-blur">
          <div class="flex flex-col gap-1">
            <h2 class="text-base font-semibold text-white">
              {{ currentTab === 'store' ? '本地规则库' : currentTab === 'applied' ? '生效映射' : '远程与新建' }}
            </h2>
            <p class="text-xs text-slate-500">
              默认以引用文件树同步规则，可在编辑面板调整 referencesDir。
            </p>
          </div>
        </header>

        <section class="p-4 sm:p-6">
          <StoreView v-if="currentTab === 'store'" :rules="rules" :agents="agents" :loading="loading" @apply="handleApply" @edit="handleOpenEdit" @delete="handleDeleteStoreRule" />

          <AppliedView v-if="currentTab === 'applied'" :applied="applied" :loading="loading" @remove="handleRemoveApplied" />

          <RemoteView v-if="currentTab === 'remote'" @install="handleInstallRemote" @create="handleCreateRule" />
        </section>
      </main>
    </div>

    <!-- 源码编辑器抽屉 Modal -->
    <EditModal :show="editModal.show" :rule="editModal.rule" :agents="agents" @close="editModal.show = false" @save="handleSaveEdit" @apply="handleApplyRuleFromModal" />
  </div>
</template>
