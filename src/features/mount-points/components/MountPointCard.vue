<!--
  MountPointCard - карточка точки монтажа (новый UI/UX)
  Крупный заголовок, статус, локация, команда (аватарки/инициалы), оборудование (цветные маркеры), прогрессбар по техзаданиям
  Адаптивная, устойчива к длинным данным, много whitespace, явные разделители
-->
<template>
  <div
    class="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 flex flex-col gap-4 hover:shadow-2xl transition cursor-pointer w-full max-w-md mx-auto min-h-[260px]"
    @click="$emit('click')"
  >
    <!-- Верх: иконка, название, статус -->
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-2 min-w-0">
        <!-- Иконка точки монтажа -->
        <svg class="w-7 h-7 text-blue-500 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25a7.5 7.5 0 1115 0z"/>
        </svg>
        <!-- Название -->
        <span class="text-xl font-bold truncate max-w-[160px]" :title="mountPoint.name">{{ mountPoint.name }}</span>
      </div>
      <!-- Статус -->
      <span :class="['px-3 py-1 rounded-full text-xs font-semibold', progressTextColor, 'bg-blue-50']">{{ progressLabel }}</span>
    </div>

    <!-- Локация -->
    <div class="flex items-center gap-2 text-gray-500 text-sm truncate">
      <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
      </svg>
      <span v-if="mountPoint.location">{{ mountPoint.location }}</span>
      <span v-else class="text-gray-400 italic flex items-center gap-1">
        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        ещё не заполнено
      </span>
    </div>

    <!-- Разделитель -->
    <div class="border-t border-gray-100 my-2"></div>

    <!-- Блоки: команда и оборудование -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Команда -->
      <div>
        <div class="text-xs text-gray-400 mb-1">Команда</div>
        <div class="flex items-center gap-2 flex-wrap">
          <template v-if="engineersArr.length">
            <!-- Показываем только имена инженеров, без аватаров/инициалов -->
            <span
              v-for="(name, idx) in engineersArr.slice(0,3)"
              :key="name"
              class="text-xs text-gray-700 truncate max-w-[90px]"
              :title="name"
            >
              {{ name }}
            </span>
            <span v-if="engineersArr.length > 3" class="text-xs text-gray-500" :title="engineersArr.join(', ')">
              +{{ engineersArr.length - 3 }}
            </span>
          </template>
          <span v-else class="text-gray-400 italic flex items-center gap-1">
            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            ещё не заполнено
          </span>
        </div>
      </div>
      <!-- Оборудование -->
      <div>
        <div class="text-xs text-gray-400 mb-1">Оборудование</div>
        <div class="flex items-center gap-3 flex-wrap">
          <span class="flex items-center gap-1"><span class="w-2 h-2 bg-blue-400 rounded-full"></span> {{ mountPoint.equipment_plan?.length || 0 }} <span class="text-xs text-gray-400 ml-1">план</span></span>
          <span class="flex items-center gap-1"><span class="w-2 h-2 bg-green-400 rounded-full"></span> {{ mountPoint.equipment_final?.length || 0 }} <span class="text-xs text-gray-400 ml-1">финал</span></span>
          <span class="flex items-center gap-1"><span class="w-2 h-2 bg-gray-400 rounded-full"></span> {{ mountPoint.equipment_fact?.length || 0 }} <span class="text-xs text-gray-400 ml-1">факт</span></span>
        </div>
      </div>
    </div>

    <!-- Разделитель -->
    <div class="border-t border-gray-100 my-2"></div>

    <!-- Техзадания -->
    <div>
      <div class="flex items-center gap-2 mb-1">
        <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        <span class="text-xs text-gray-400">Техзадания</span>
      </div>
      <div class="flex items-center gap-3">
        <!-- Прогрессбар -->
        <div class="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden max-w-[120px]">
          <div :class="progressBarColor" class="h-2 rounded-full transition-all duration-500" :style="`width: ${progressPercent}%`"></div>
        </div>
        <span class="text-sm text-gray-700 min-w-[70px] text-right">{{ completed }}/{{ total }} выполнено</span>
      </div>
      <div v-if="!total" class="text-gray-400 italic flex items-center gap-1 mt-1">
        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        ещё не заполнено
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * MountPointCard - карточка точки монтажа (новый UI/UX)
 * Крупный заголовок, статус, локация, команда (аватарки/инициалы), оборудование (цветные маркеры), прогрессбар по техзаданиям
 * Все поля всегда видны, незаполненные — серый курсив с иконкой
 * Адаптивная, устойчива к длинным данным, много whitespace, явные разделители
 */
import { computed } from 'vue'
import { useUserStore } from '@/app/store/user-store'
import { storeToRefs } from 'pinia'

// Пропсы
const props = defineProps({
  mountPoint: {
    type: Object,
    required: true
  }
})

defineEmits(['click'])

// Store пользователей для получения имен инженеров
const userStore = useUserStore()
const { users } = storeToRefs(userStore)

// Массив имён инженеров
const engineersArr = computed(() => {
  const engineerIds = props.mountPoint.responsible_engineers || []
  if (!engineerIds.length) return []
  return engineerIds
    .map(id => {
      const user = users.value.find(u => u.id === id)
      return user ? user.name : 'Неизвестный инженер'
    })
})

// Получить инициалы по имени
function getInitials(name) {
  if (!name) return ''
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)
}

// Техзадания
const duties = props.mountPoint.technical_duties || []
const total = duties.length
const completed = duties.filter(d => d.status === 'выполнено').length
const inProgress = duties.filter(d => d.status === 'в работе').length
const problem = duties.filter(d => d.status === 'проблема').length

const progressPercent = total ? Math.round((completed / total) * 100) : 0
const progressLabel = total
  ? completed === total
    ? `Готово`
    : inProgress > 0
      ? `В работе`
      : problem > 0
        ? `Проблемы`
        : `Не начато`
  : 'Нет заданий'

const progressBarColor = computed(() => completed === total
  ? 'bg-green-500'
  : problem > 0
    ? 'bg-red-400'
    : inProgress > 0
      ? 'bg-yellow-400'
      : 'bg-gray-300')

const progressTextColor = computed(() => completed === total
  ? 'text-green-800'
  : problem > 0
    ? 'text-red-800'
    : inProgress > 0
      ? 'text-yellow-800'
      : 'text-gray-500')
</script> 