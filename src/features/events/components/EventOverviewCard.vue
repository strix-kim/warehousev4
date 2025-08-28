
<template>
  <BentoCard size="1x1" variant="default">
    <template #header>
      <div class="flex items-center gap-2">
        <IconV2 name="file-text" size="sm" />
        <h3 class="text-base sm:text-lg font-semibold leading-tight">Обзор</h3>
      </div>
    </template>
    
    <!-- Description Content -->
    <div v-if="description" class="text-sm text-primary whitespace-pre-line leading-relaxed">
      {{ description }}
    </div>
    
    <!-- Empty State -->
    <div v-else class="flex items-center gap-3 text-secondary text-sm">
      <IconV2 name="info" size="sm" class="text-secondary/70" />
      <span>Описание не указано</span>
    </div>
  </BentoCard>
</template>

<script setup>
/**
 * EventOverviewCard - карточка с описанием мероприятия
 * Простая карточка для отображения описания события
 */
import { BentoCard, IconV2 } from '@/shared/ui-v2'

const props = defineProps({
  // Описание мероприятия
  description: {
    type: String,
    default: ''
  }
})
</script>

<style scoped>
/* Дополнительные стили при необходимости */
</style>
