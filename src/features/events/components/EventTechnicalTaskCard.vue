<template>
  <BentoCard size="1x1" variant="minimal" class="self-start">
    <template #header>
      <div class="flex items-center justify-between gap-2 w-full">
        <div class="flex items-center gap-2">
          <IconV2 name="file-text" size="sm" />
          <h3 class="text-base sm:text-lg font-semibold leading-tight">Техзадание</h3>
        </div>
        <ButtonV2
          v-if="technicalTask"
          variant="minimal"
          size="sm"
          @click="handleCopyTask"
        >
          <IconV2 name="copy" size="sm" class="mr-2" />
          Копировать
        </ButtonV2>
      </div>
    </template>
    
    <!-- Technical Task Content -->
    <div v-if="technicalTask" class="bg-accent/50 border border-secondary/20 rounded-lg p-3 max-h-56 overflow-auto">
      <pre class="whitespace-pre-wrap font-mono text-xs text-primary">{{ technicalTask }}</pre>
    </div>
    
    <!-- Empty State -->
    <div v-else class="flex items-center gap-3 text-secondary text-sm">
      <IconV2 name="info" size="sm" class="text-secondary/70" />
      <span>Техническое задание не указано</span>
    </div>
  </BentoCard>
</template>

<script setup>
/**
 * EventTechnicalTaskCard - карточка с техническим заданием мероприятия
 * Включает функцию копирования в буфер обмена
 */
import { BentoCard, ButtonV2, IconV2 } from '@/shared/ui-v2'

const props = defineProps({
  // Техническое задание
  technicalTask: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['copy', 'copy-success', 'copy-error'])

// Методы
const handleCopyTask = async () => {
  try {
    await navigator.clipboard.writeText(String(props.technicalTask || ''))
    emit('copy-success', 'Техническое задание скопировано')
    emit('copy', props.technicalTask)
  } catch (error) {
    emit('copy-error', 'Не удалось скопировать техническое задание')
  }
}
</script>

<style scoped>
/* Дополнительные стили при необходимости */
</style>
