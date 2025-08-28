<template>
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
    <!-- Event Title and Icon -->
    <div class="flex items-start sm:items-center gap-2 min-w-0">
      <IconV2 name="calendar" size="sm" />
      <h2 class="text-accent text-xl sm:text-2xl lg:text-3xl font-semibold leading-tight break-words">
        {{ eventName }}
      </h2>
    </div>

    <!-- Status and Actions -->
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
      <!-- Event Status Badge -->
      <StatusBadgeV2 
        :label="eventStatus.label" 
        :variant="eventStatus.variant" 
        size="sm" 
        class="self-start sm:self-auto" 
      />
      
      <!-- Quick Actions -->
      <div class="flex items-center gap-2">
        <!-- Copy Link Button -->
        <TooltipV2 content="Скопировать ссылку на мероприятие">
          <ButtonV2 
            variant="ghost" 
            size="sm" 
            class="touch-manipulation min-h-[44px] min-w-[44px] sm:min-h-auto sm:min-w-auto" 
            @click="handleCopyLink"
          >
            <IconV2 name="link" size="sm" />
          </ButtonV2>
        </TooltipV2>
        
        <!-- Copy Info Button -->
        <TooltipV2 content="Скопировать информацию о мероприятии">
          <ButtonV2 
            variant="ghost" 
            size="sm" 
            class="touch-manipulation min-h-[44px] min-w-[44px] sm:min-h-auto sm:min-w-auto" 
            @click="handleCopyInfo"
          >
            <IconV2 name="copy" size="sm" />
          </ButtonV2>
        </TooltipV2>
        
        <!-- Edit Button -->
        <ButtonV2 
          variant="minimal" 
          size="sm" 
          class="touch-manipulation min-h-[44px] sm:min-h-auto" 
          @click="handleEdit"
        >
          <IconV2 name="edit" size="sm" class="mr-1" /> 
          <span class="hidden sm:inline">Редактировать</span>
          <span class="sm:hidden">Изменить</span>
        </ButtonV2>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * EventDetailsHeader - заголовок страницы деталей мероприятия
 * Включает название, статус и быстрые действия
 */
import { 
  ButtonV2, 
  IconV2, 
  StatusBadgeV2, 
  TooltipV2 
} from '@/shared/ui-v2'

const props = defineProps({
  // Название мероприятия
  eventName: {
    type: String,
    default: ''
  },
  
  // Статус мероприятия
  eventStatus: {
    type: Object,
    default: () => ({ label: 'Неизвестно', variant: 'info' }),
    validator: (value) => {
      return value && 
        typeof value.label === 'string' &&
        typeof value.variant === 'string'
    }
  }
})

const emit = defineEmits([
  'copy-link',
  'copy-info', 
  'edit'
])

// Методы обработки событий
const handleCopyLink = () => {
  emit('copy-link')
}

const handleCopyInfo = () => {
  emit('copy-info')
}

const handleEdit = () => {
  emit('edit')
}
</script>

<style scoped>
/* Дополнительные стили при необходимости */
</style>
