<template>
  <BentoCard v-if="teamMembers.length" size="2x1" variant="default">
    <template #header>
      <div class="flex items-center gap-2">
        <IconV2 name="users" size="sm" />
        <h3 class="text-base sm:text-lg font-semibold leading-tight">Команда проекта</h3>
      </div>
    </template>
    
    <!-- Team Members Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div 
        v-for="member in teamMembers" 
        :key="member.name || member"
        class="flex items-center gap-3 p-3 rounded-xl border border-secondary/20 bg-white"
      >
        <!-- Avatar with Initials -->
        <div class="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold text-sm">
          {{ getInitials(member.name || member) }}
        </div>
        
        <!-- Member Info -->
        <div>
          <div class="font-medium text-primary">{{ member.name || member }}</div>
          <div class="text-xs text-secondary">{{ member.role || 'Ответственный инженер' }}</div>
        </div>
      </div>
    </div>
  </BentoCard>
</template>

<script setup>
/**
 * EventTeamCard - карточка с командой проекта
 * Отображает список ответственных инженеров с аватарами
 */
import { computed } from 'vue'
import { BentoCard, IconV2 } from '@/shared/ui-v2'

const props = defineProps({
  // Список участников команды
  teamMembers: {
    type: Array,
    default: () => [],
    validator: (value) => {
      return Array.isArray(value)
    }
  }
})

// Методы
const getInitials = (name) => {
  if (!name || typeof name !== 'string') return '??'
  
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
</script>

<style scoped>
/* Дополнительные стили при необходимости */
</style>
