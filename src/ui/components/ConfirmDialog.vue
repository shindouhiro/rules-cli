<script setup lang="ts">
defineProps<{
  show: boolean
  title: string
  message: string
  details?: string[]
  confirmText?: string
  cancelText?: string
  tone?: 'danger' | 'default'
}>()

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-[70] flex items-center justify-center p-4">
    <button class="absolute inset-0 modal-backdrop cursor-default" aria-label="关闭确认弹窗" @click="emit('cancel')" />
    <section class="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl shadow-slate-950/70" role="dialog" aria-modal="true" :aria-label="title">
      <div class="border-b border-slate-800/80 px-5 py-4">
        <p class="text-xs font-bold uppercase tracking-wider" :class="tone === 'danger' ? 'text-rose-300' : 'text-cyan-300'">
          二次确认
        </p>
        <h2 class="mt-1 text-lg font-semibold tracking-tight text-white">
          {{ title }}
        </h2>
      </div>

      <div class="space-y-4 px-5 py-5">
        <p class="text-sm leading-6 text-slate-300">
          {{ message }}
        </p>
        <div v-if="details?.length" class="max-h-44 overflow-auto rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <div v-for="detail in details" :key="detail" class="truncate font-mono text-xs text-slate-400" :title="detail">
            {{ detail }}
          </div>
        </div>
      </div>

      <div class="flex flex-col-reverse gap-2 border-t border-slate-800/80 bg-slate-950/80 px-5 py-4 sm:flex-row sm:justify-end">
        <button class="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-slate-700 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500" @click="emit('cancel')">
          {{ cancelText || '取消' }}
        </button>
        <button class="rounded-xl border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2" :class="tone === 'danger' ? 'border-rose-500/40 bg-rose-950/55 text-rose-100 hover:border-rose-400 hover:bg-rose-900/70 focus-visible:ring-rose-500' : 'border-cyan-500/40 bg-cyan-950/55 text-cyan-100 hover:border-cyan-400 hover:bg-cyan-900/70 focus-visible:ring-cyan-500'" @click="emit('confirm')">
          {{ confirmText || '确认' }}
        </button>
      </div>
    </section>
  </div>
</template>
