<template>
  <BentoCard title="" size="1x1" variant="minimal" class="overflow-hidden">
    
    <!-- Минималистичный заголовок -->
    <div class="flex items-center justify-between mb-6 pb-3 border-b border-gray-100">
      <div class="flex items-center gap-2">
        <div class="w-6 h-6 bg-accent rounded-md flex items-center justify-center">
          <IconV2 name="package" size="xs" color="secondary" />
        </div>
        <h3 class="font-medium text-primary font-mono text-sm">
          Выбранное оборудование
        </h3>
      </div>
      
      <div class="flex items-center gap-2">
        <span class="text-xs text-secondary font-mono bg-accent px-2 py-1 rounded">
          {{ selectedEquipment.length }}
        </span>
        <ButtonV2 
          v-if="selectedEquipment.length > 0"
          variant="minimal" 
          size="sm" 
          @click="clearAll"
          class="text-xs"
        >
          <template #icon>
            <IconV2 name="x" size="xs" />
          </template>
          Очистить
        </ButtonV2>
      </div>
    </div>

    <!-- Пустое состояние (минималистичное) -->
    <div v-if="selectedEquipment.length === 0" class="text-center py-12">
      <div class="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center mx-auto mb-4">
        <IconV2 name="package" size="lg" color="secondary" />
      </div>
      <p class="text-sm text-secondary font-mono mb-1">Пустой список</p>
      <p class="text-xs text-secondary/70">Выберите оборудование →</p>
    </div>

    <!-- Компактный список оборудования -->
    <div v-else class="space-y-4">
      
      <!-- Расширяемый список с большей высотой -->
      <div class="max-h-[500px] overflow-y-auto custom-scrollbar">
        <div class="space-y-1">
          <div 
            v-for="equipment in selectedEquipment" 
            :key="equipment.id"
            class="group relative p-2 hover:bg-gray-50 rounded-md transition-all duration-200 cursor-pointer"
          >
            
            <!-- Компактный вид (всегда видимый) -->
            <div class="flex items-center gap-3">
              
              <!-- Индикатор категории -->
              <div class="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs"
                   :class="getCategoryStyle(equipment.type)">
                {{ getCategoryIcon(equipment.type) }}
              </div>

              <!-- Базовая информация -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between">
                  <span class="font-medium text-primary text-sm font-mono truncate">
                    {{ equipment.brand }} {{ equipment.model }}
                  </span>
                  
                  <!-- Категория справа -->
                  <span class="text-xs text-secondary font-mono ml-2 flex-shrink-0">
                    {{ equipment.type }}
                  </span>
                </div>
              </div>

              <!-- Кнопка удаления -->
              <div class="flex-shrink-0">
                <ButtonV2 
                  variant="minimal" 
                  size="sm"
                  @click="removeEquipment(equipment.id)"
                  class="w-6 h-6 p-0 opacity-60 hover:opacity-100 transition-opacity"
                  :title="`Убрать ${equipment.brand} ${equipment.model} из списка`"
                >
                  <span class="text-xs text-secondary hover:text-error">×</span>
                </ButtonV2>
              </div>
            </div>

            <!-- Детализированная информация (показывается при hover) -->
            <div class="group-hover:block hidden mt-2 p-2 bg-white rounded-md border border-gray-100 shadow-sm">
              <div class="space-y-1 text-xs font-mono">
                
                <!-- Серийный номер -->
                <div v-if="equipment.serialnumber" class="flex items-center gap-2">
                  <span class="text-secondary">№:</span>
                  <span class="text-primary bg-accent px-2 py-0.5 rounded">
                    {{ equipment.serialnumber }}
                  </span>
                </div>
                
                <!-- Подтип -->
                <div v-if="equipment.subtype" class="flex items-center gap-2">
                  <span class="text-secondary">Тип:</span>
                  <span class="text-primary bg-gray-100 px-2 py-0.5 rounded">
                    {{ equipment.subtype }}
                  </span>
                </div>
                
                <!-- Локация -->
                <div v-if="equipment.location" class="flex items-center gap-2">
                  <span class="text-secondary">📍</span>
                  <span class="text-primary">{{ equipment.location }}</span>
                </div>
                
                <!-- Доступность -->
                <div v-if="equipment.availability" class="flex items-center gap-2">
                  <span class="text-secondary">Статус:</span>
                  <span class="text-success text-xs">{{ equipment.availability }}</span>
                </div>
                
                <!-- Техническая спецификация (если есть) -->
                <div v-if="equipment.technicalspecification" class="flex items-start gap-2 pt-1">
                  <span class="text-secondary">Спец:</span>
                  <span class="text-primary text-xs leading-relaxed">
                    {{ equipment.technicalspecification }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Минималистичная статистика -->
      <div class="pt-3 border-t border-gray-100">
        <div class="flex items-center justify-between text-xs">
          <div class="flex items-center gap-4 text-secondary font-mono">
            <span>{{ selectedEquipment.length }} единиц</span>
            <span>{{ uniqueCategories.length }} категорий</span>
          </div>
          
          <ButtonV2 
            variant="minimal" 
            size="sm" 
            @click="$emit('export-list')"
            class="text-xs"
          >
            <template #icon>
              <IconV2 name="arrow-right" size="xs" />
            </template>
            Экспорт
          </ButtonV2>
        </div>
        
        <!-- Категории (компактно) -->
        <div v-if="uniqueCategories.length > 0" class="mt-2 flex flex-wrap gap-1">
          <span v-for="category in uniqueCategories.slice(0, 3)" 
                :key="category"
                class="text-xs font-mono text-secondary bg-accent px-2 py-0.5 rounded">
            {{ category }}
          </span>
          <span v-if="uniqueCategories.length > 3" 
                class="text-xs font-mono text-secondary">
            +{{ uniqueCategories.length - 3 }}
          </span>
        </div>
      </div>
    </div>
  </BentoCard>
</template>

<script setup>
/**
 * SelectedEquipmentPreview - EPR System
 * 
 * Компонент для отображения выбранного оборудования в виде карточек
 * Используется в форме создания списков оборудования
 */

import { computed } from 'vue'

import { 
  BentoCard,
  ButtonV2,
  IconV2
} from '@/shared/ui-v2'

// ===== PROPS =====
const props = defineProps({
  selectedEquipment: {
    type: Array,
    default: () => []
  }
})

// ===== EMITS =====
const emit = defineEmits([
  'remove',
  'clear-all',
  'export-list'
])

// ===== COMPUTED =====
const uniqueCategories = computed(() => {
  const categories = props.selectedEquipment
    .map(item => item.type)
    .filter(Boolean)
  return [...new Set(categories)]
})

// ===== МЕТОДЫ =====
const removeEquipment = (equipmentId) => {
  emit('remove', equipmentId)
}

const clearAll = () => {
  emit('clear-all')
}

// Стили для категорий
const getCategoryStyle = (type) => {
  const styles = {
    'Аудиооборудование': 'bg-blue-100 text-blue-600',
    'Видеотехника': 'bg-purple-100 text-purple-600',
    'Световое оборудование': 'bg-yellow-100 text-yellow-600',
    'default': 'bg-gray-100 text-gray-600'
  }
  return styles[type] || styles.default
}

// Иконки для категорий
const getCategoryIcon = (type) => {
  const icons = {
    'Аудиооборудование': '🎵',
    'Видеотехника': '📹',
    'Световое оборудование': '💡',
    'default': '📦'
  }
  return icons[type] || icons.default
}
</script>

<style scoped>
/* Кастомный скроллбар для расширенного списка */
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: var(--color-secondary) transparent;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--color-secondary);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--color-primary);
}

/* Анимация появления элементов списка */
.space-y-1 > div {
  animation: fadeInUp 0.15s ease-out;
}

/* Анимация hover для кнопки удаления */
.hover\:text-error:hover {
  color: var(--color-error) !important;
}

/* Плавное появление детализированной информации */
.group:hover .hidden {
  display: block;
  animation: slideDownFade 0.2s ease-out;
}

@keyframes slideDownFade {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Состояние наведения для карточек */
.space-y-2 > div:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>