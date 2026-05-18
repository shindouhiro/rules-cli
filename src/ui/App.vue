<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { onMounted, ref } from 'vue'
import AppliedView from './components/AppliedView.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import EditModal from './components/EditModal.vue'
import RemoteRepoView from './components/RemoteRepoView.vue'
import RemoteView from './components/RemoteView.vue'
import StoreView from './components/StoreView.vue'

const loading = ref(true)
const rules = ref<any[]>([])
const agents = ref<any[]>([])
const applied = ref<any[]>([])
const currentTab = ref('store')

const toast = ref({ show: false, message: '', type: 'success' })
const editModal = ref({ show: false, rule: null as any })
const confirmDialog = ref({
  show: false,
  title: '',
  message: '',
  details: [] as string[],
  confirmText: '确认',
  cancelText: '取消',
  tone: 'danger' as 'danger' | 'default',
  resolve: null as null | ((confirmed: boolean) => void),
})

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

async function handleApply(ruleNames: string[], agentIds: string[], isGlobal: boolean, rulePaths: string[] = []) {
  try {
    const res = await fetch('/api/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ruleNames,
        rulePaths,
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

async function handleApplyRuleFromModal(rule: any, agentIds: string[], isGlobal: boolean, content: string, references: Array<{ sourcePath: string, content: string }> = []) {
  try {
    const saveRes = await fetch('/api/update-store-rule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: rule.path, content, references }),
    })
    const saveJson = await saveRes.json()
    if (!saveJson.success) {
      showToast(saveJson.message || '保存引用配置失败', 'error')
      return
    }

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
      editModal.value.show = false
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
  const confirmed = await requestConfirm({
    title: '解除生效映射',
    message: `确定将规则 ${item.name} 从 ${item.agentName} 映射中解除绑定吗？`,
    details: [item.path],
    confirmText: '解除绑定',
  })
  if (!confirmed)
    return
  try {
    const json = await removeAppliedItem(item)
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

async function removeAppliedItem(item: any) {
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
  return await res.json()
}

async function handleRemoveManyApplied(items: any[]) {
  if (items.length === 0)
    return

  const confirmed = await requestConfirm({
    title: '批量解除生效映射',
    message: `确定批量解除 ${items.length} 条生效映射吗？`,
    details: items.map(item => `${item.name} / ${item.agentName}`),
    confirmText: `确认解除`,
  })
  if (!confirmed)
    return

  let successCount = 0
  let failCount = 0
  for (const item of items) {
    try {
      const json = await removeAppliedItem(item)
      if (json.success)
        successCount++
      else
        failCount++
    }
    catch {
      failCount++
    }
  }

  if (failCount > 0)
    showToast(`批量删除完成：成功 ${successCount} 条，失败 ${failCount} 条`, 'error')
  else
    showToast(`已删除 ${successCount} 条生效映射`)

  fetchData()
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
  const confirmed = await requestConfirm({
    title: '永久删除规则模板',
    message: `确定永久销毁本地规则模板空间 [${rule.name}] 吗？该操作会同步清理已应用映射和引用文件。`,
    details: [rule.path],
    confirmText: '永久删除',
  })
  if (!confirmed)
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

async function handlePublishRules(payload: {
  rulePaths: string[]
  repo: string
  branch?: string
  path?: string
  message?: string
  dryRun?: boolean
  isGlobal: boolean
}) {
  try {
    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rulePaths: payload.rulePaths,
        repo: payload.repo,
        branch: payload.branch,
        path: payload.path,
        message: payload.message,
        dryRun: payload.dryRun,
        global: payload.isGlobal,
      }),
    })
    const json = await res.json()
    if (json.success)
      showToast(json.message || '规则上传发布完成')
    else
      showToast(json.message || '上传发布失败', 'error')
  }
  catch (err: any) {
    showToast(`上传通信错误: ${err.message}`, 'error')
  }
}

onMounted(() => {
  fetchData()
})

function requestConfirm(options: {
  title: string
  message: string
  details?: string[]
  confirmText?: string
  cancelText?: string
  tone?: 'danger' | 'default'
}): Promise<boolean> {
  return new Promise((resolve) => {
    confirmDialog.value = {
      show: true,
      title: options.title,
      message: options.message,
      details: options.details || [],
      confirmText: options.confirmText || '确认',
      cancelText: options.cancelText || '取消',
      tone: options.tone || 'danger',
      resolve,
    }
  })
}

function closeConfirmDialog(confirmed: boolean) {
  const resolver = confirmDialog.value.resolve
  confirmDialog.value.show = false
  confirmDialog.value.resolve = null
  resolver?.(confirmed)
}
</script>

<template>
  <div class="min-h-screen bg-slate-950/70 text-slate-200">
    <!-- 通知 Toast -->
    <div v-if="toast.show" class="fixed top-6 left-1/2 -translate-x-1/2 z-[60] transition flex items-center space-x-2 px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-md border" :class="toast.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200' : 'bg-rose-950/90 border-rose-500/30 text-rose-200'" aria-live="polite">
      <span class="text-sm font-medium">{{ toast.message }}</span>
    </div>

    <div class="grid min-h-screen grid-cols-1 lg:grid-cols-[292px_1fr]">
      <aside class="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl lg:border-b-0 lg:border-r">
        <div class="flex h-full flex-col">
          <div class="border-b border-slate-800/80 px-6 py-6">
            <div class="flex items-center gap-3">
              <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-cyan-400 text-base font-black text-white shadow-lg shadow-brand-500/25">
                R
              </div>
              <div>
                <h1 class="text-lg font-semibold tracking-tight text-white">
                  Rules CLI
                </h1>
                <p class="text-sm text-slate-400">
                  引用式规则后台
                </p>
              </div>
            </div>
          </div>

          <nav class="grid gap-2 p-4">
            <button class="flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors" :class="currentTab === 'store' ? 'bg-slate-800 text-white shadow-lg shadow-slate-950/20' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'" @click="currentTab = 'store'">
              <Icon icon="ph:database-duotone" class="text-lg" />
              <span>本地规则库</span>
            </button>
            <button class="flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors" :class="currentTab === 'applied' ? 'bg-slate-800 text-white shadow-lg shadow-slate-950/20' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'" @click="currentTab = 'applied'">
              <Icon icon="ph:link-duotone" class="text-lg" />
              <span>生效映射</span>
            </button>
            <button class="flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors" :class="currentTab === 'remote' ? 'bg-slate-800 text-white shadow-lg shadow-slate-950/20' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'" @click="currentTab = 'remote'">
              <Icon icon="ph:plus-circle-duotone" class="text-lg" />
              <span>远程与新建</span>
            </button>
            <button class="flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors" :class="currentTab === 'remote-repos' ? 'bg-slate-800 text-white shadow-lg shadow-slate-950/20' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'" @click="currentTab = 'remote-repos'">
              <Icon icon="ph:git-branch-duotone" class="text-lg" />
              <span>远程仓库</span>
            </button>
          </nav>

          <div class="mt-auto border-t border-slate-800/80 p-4">
            <button class="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-sm font-medium text-slate-300 transition-colors hover:border-slate-700 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" @click="fetchData">
              重新载入发现
            </button>
          </div>
        </div>
      </aside>

      <main class="min-w-0 overflow-y-auto">
        <header class="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/75 px-6 py-5 backdrop-blur-xl sm:px-8">
          <div class="flex flex-col gap-1.5">
            <h2 class="text-2xl font-semibold tracking-tight text-white">
              {{ currentTab === 'store' ? '本地规则库' : currentTab === 'applied' ? '生效映射' : currentTab === 'remote-repos' ? '远程仓库' : '远程与新建' }}
            </h2>
            <p class="text-sm text-slate-400">
              默认以引用文件树同步规则，可在编辑面板调整 referencesDir。
            </p>
          </div>
        </header>

        <section class="p-5 sm:p-8">
          <StoreView v-if="currentTab === 'store'" :rules="rules" :agents="agents" :loading="loading" @apply="handleApply" @publish="handlePublishRules" @edit="handleOpenEdit" @delete="handleDeleteStoreRule" />

          <AppliedView v-if="currentTab === 'applied'" :applied="applied" :loading="loading" @remove="handleRemoveApplied" @remove-many="handleRemoveManyApplied" />

          <RemoteView v-if="currentTab === 'remote'" :rules="rules" @install="handleInstallRemote" @publish="handlePublishRules" @create="handleCreateRule" />

          <RemoteRepoView v-if="currentTab === 'remote-repos'" @install="handleInstallRemote" />
        </section>
      </main>
    </div>

    <!-- 源码编辑器抽屉 Modal -->
    <EditModal :show="editModal.show" :rule="editModal.rule" :agents="agents" @close="editModal.show = false" @save="handleSaveEdit" @apply="handleApplyRuleFromModal" />
    <ConfirmDialog
      :show="confirmDialog.show"
      :title="confirmDialog.title"
      :message="confirmDialog.message"
      :details="confirmDialog.details"
      :confirm-text="confirmDialog.confirmText"
      :cancel-text="confirmDialog.cancelText"
      :tone="confirmDialog.tone"
      @confirm="closeConfirmDialog(true)"
      @cancel="closeConfirmDialog(false)"
    />
  </div>
</template>
