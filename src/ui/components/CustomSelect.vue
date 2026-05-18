<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

interface SelectOption {
  label: string
  value: string
  description?: string
  disabled?: boolean
}

const props = defineProps<{
  id: string
  modelValue: string
  options: SelectOption[]
  placeholder?: string
  ariaLabel?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
}>()

const rootEl = ref<HTMLElement>()
const open = ref(false)

const selectedOption = computed(() => props.options.find(option => option.value === props.modelValue))
const displayLabel = computed(() => selectedOption.value?.label || props.placeholder || '请选择')

function close() {
  open.value = false
}

function toggle() {
  open.value = !open.value
}

function selectOption(option: SelectOption) {
  if (option.disabled)
    return
  emit('update:modelValue', option.value)
  emit('change', option.value)
  close()
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (!rootEl.value?.contains(event.target as Node))
    close()
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape')
    close()
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div ref="rootEl" class="relative">
    <button
      :id="id"
      type="button"
      class="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-left text-xs text-slate-200 transition focus-visible:border-cyan-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500"
      :aria-label="ariaLabel || placeholder || '选择选项'"
      :aria-expanded="open"
      aria-haspopup="listbox"
      :title="displayLabel"
      @click="toggle"
    >
      <span class="min-w-0 truncate">{{ displayLabel }}</span>
      <Icon icon="ph:caret-down-bold" class="shrink-0 text-sm text-slate-500 transition-transform" :class="open ? 'rotate-180' : ''" />
    </button>

    <div
      v-if="open"
      class="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-72 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-1 shadow-2xl shadow-slate-950/60"
      role="listbox"
      :aria-labelledby="id"
    >
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-xs transition disabled:cursor-not-allowed disabled:opacity-45"
        :class="option.value === modelValue ? 'bg-cyan-500/15 text-cyan-100' : 'text-slate-300 hover:bg-slate-800/80'"
        :disabled="option.disabled"
        role="option"
        :aria-selected="option.value === modelValue"
        :title="option.description || option.label"
        @click="selectOption(option)"
      >
        <Icon :icon="option.value === modelValue ? 'ph:check-circle-duotone' : 'ph:circle-duotone'" class="mt-0.5 shrink-0 text-sm" :class="option.value === modelValue ? 'text-cyan-300' : 'text-slate-600'" />
        <span class="min-w-0">
          <span class="block truncate font-medium">{{ option.label }}</span>
          <span v-if="option.description" class="mt-0.5 block truncate text-[11px] text-slate-500">{{ option.description }}</span>
        </span>
      </button>
    </div>
  </div>
</template>
