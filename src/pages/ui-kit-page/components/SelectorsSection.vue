<template>
  <section>
    <h2 class="text-xl font-bold text-primary mb-6">🏷️ Статусы и селекторы</h2>
    <BentoGrid columns="2" gap="6">
      <!-- Статусы оборудования -->
      <BentoCard title="Статусы оборудования">
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-3">
            <StatusBadgeV2 size="sm" label="Доступно" variant="success" />
            <StatusBadgeV2 size="sm" label="В использовании" variant="warning" />
            <StatusBadgeV2 size="sm" label="На обслуживании" variant="warning" />
            <StatusBadgeV2 size="sm" label="Списано" variant="error" />
          </div>
          
          <div class="space-y-2">
            <div class="grid grid-cols-2 gap-3">
              <StatusBadgeV2 size="xs" label="Критично" variant="error" />
              <StatusBadgeV2 size="xs" label="Предупреждение" variant="warning" />
              <StatusBadgeV2 size="xs" label="Норма" variant="success" />
              <StatusBadgeV2 size="xs" label="Инфо" variant="info" />
            </div>
            
            <div class="grid grid-cols-2 gap-3">
              <StatusBadgeV2 size="xs" label="Brand Red" variant="brand-red" />
              <StatusBadgeV2 size="xs" label="Brand Deep" variant="brand-deep-red" />
            </div>
          </div>
          
          <div class="grid grid-cols-3 gap-3">
            <StatusBadgeV2 size="xs" label="Активен" variant="success" />
            <StatusBadgeV2 size="sm" label="Средний" variant="secondary" />
            <StatusBadgeV2 size="md" label="Большой" variant="primary" />
          </div>
        </div>
      </BentoCard>

      <!-- Селекторы -->
      <BentoCard title="Селекторы">
        <div class="space-y-4">
          <div class="space-y-3">
            <SelectV2
              v-model="selectedLocation"
              label="Выберите локацию"
              :options="locationOptions"
              option-value="value"
              option-label="label"
            />
            
            <SelectV2
              v-model="selectedMultiple"
              label="Множественный выбор"
              :options="multipleOptions"
              option-value="value"
              option-label="label"
              :multiple="true"
              placeholder="Выберите несколько..."
            />
          </div>
          
          <div class="text-sm text-secondary space-y-1">
            <p>Выбрано: {{ selectedLocation || 'Ничего' }}</p>
            <p>Множественный: {{ selectedMultiple?.length ? selectedMultiple.join(', ') : 'Ничего' }}</p>
          </div>
        </div>
      </BentoCard>
    </BentoGrid>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import { BentoGrid, BentoCard, StatusBadgeV2, SelectV2 } from '@/shared/ui-v2'

// Данные для селекторов
const selectedLocation = ref('warehouse-a')
const selectedMultiple = ref([])

const locationOptions = [
  { value: 'warehouse-a', label: 'Склад А' },
  { value: 'warehouse-b', label: 'Склад Б' },
  { value: 'studio-1', label: 'Студия 1' },
  { value: 'studio-2', label: 'Студия 2' },
  { value: 'office', label: 'Офисное здание' }
]

const multipleOptions = [
  { value: 'cameras', label: 'Видеокамеры' },
  { value: 'audio', label: 'Аудио' },
  { value: 'lighting', label: 'Освещение' },
  { value: 'accessories', label: 'Аксессуары' }
]
</script>