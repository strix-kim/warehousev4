<template>
  <div class="space-y-6">
    <div class="bg-white border border-gray-200 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-primary mb-4">🎯 Тест модальных окон ModalV2</h3>
      <p class="text-sm text-secondary mb-6">
        Проверьте все размеры и адаптивность модальных окон. Каждый размер имеет свои оптимизированные ширины.
      </p>

      <!-- Кнопки для тестирования -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <ButtonV2 variant="primary" size="md" @click="openModal('sm')">
          Размер SM
        </ButtonV2>
        <ButtonV2 variant="secondary" size="md" @click="openModal('md')">
          Размер MD
        </ButtonV2>
        <ButtonV2 variant="success" size="md" @click="openModal('lg')">
          Размер LG
        </ButtonV2>
        <ButtonV2 variant="warning" size="md" @click="openModal('xl')">
          Размер XL
        </ButtonV2>
      </div>

      <!-- Информация о размерах -->
      <div class="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 class="font-semibold text-blue-800 mb-2">📏 Размеры по устройствам:</h4>
        <div class="text-sm text-blue-700 space-y-1">
          <div><strong>Desktop (1025px+):</strong> SM=500px, MD=650px, LG=800px, XL=1000px</div>
          <div><strong>Tablet (641-1024px):</strong> SM=450px, MD=550px, LG=650px, XL=750px</div>
          <div><strong>Mobile (до 640px):</strong> Все размеры = 380px</div>
          <div><strong>Small Mobile (до 480px):</strong> Все размеры = 340px</div>
        </div>
      </div>
    </div>

    <!-- Модальные окна для тестирования -->
    <ModalV2
      v-model="showModal"
      :title="`Тест размера ${currentSize.toUpperCase()}`"
      :description="`Модальное окно размера ${currentSize} - проверьте ширину и скролл`"
      :size="currentSize"
      variant="default"
      scrollable
      @close="handleClose"
    >
      <!-- Контент для тестирования скролла -->
      <div class="space-y-4">
        <div v-for="section in testSections" :key="section.id" class="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 class="font-semibold text-primary mb-2">{{ section.title }}</h4>
          <p class="text-sm text-secondary mb-3">{{ section.description }}</p>
          
          <!-- Тестовые поля -->
          <div class="space-y-3">
            <InputV2 
              v-model="section.field1" 
              :label="`Поле 1 - ${section.title}`" 
              placeholder="Введите текст..." 
            />
            <InputV2 
              v-model="section.field2" 
              :label="`Поле 2 - ${section.title}`" 
              placeholder="Еще одно поле..." 
            />
            <SelectV2 
              v-model="section.selected" 
              :label="`Выбор - ${section.title}`" 
              :options="selectOptions"
              placeholder="Выберите опцию"
            />
          </div>
        </div>

        <!-- Дополнительный контент для проверки скролла -->
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 class="font-semibold text-yellow-800 mb-2">⚠️ Проверка скролла</h4>
          <p class="text-sm text-yellow-700">
            Этот блок находится внизу для проверки работы скролла. 
            Если вы видите этот текст, значит скролл работает корректно!
          </p>
          <div class="mt-3 space-y-2">
            <div v-for="i in 5" :key="i" class="p-2 bg-yellow-100 border border-yellow-300 rounded text-xs">
              Дополнительная строка {{ i }} для увеличения высоты контента
            </div>
          </div>
        </div>
      </div>

      <!-- Footer с кнопками -->
      <template #footer>
        <div class="flex items-center justify-between">
          <div class="text-sm text-secondary">
            Размер: <strong>{{ currentSize.toUpperCase() }}</strong> | 
            Устройство: <strong>{{ deviceType }}</strong>
          </div>
          <div class="flex items-center gap-2">
            <ButtonV2 variant="ghost" size="md" @click="handleClose">
              Закрыть
            </ButtonV2>
            <ButtonV2 variant="primary" size="md" @click="switchSize">
              Следующий размер
            </ButtonV2>
          </div>
        </div>
      </template>
    </ModalV2>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ButtonV2, ModalV2, InputV2, SelectV2 } from '@/shared/ui-v2'

// Состояние модального окна
const showModal = ref(false)
const currentSize = ref('sm')

// Определение типа устройства
const deviceType = computed(() => {
  if (typeof window === 'undefined') return 'Unknown'
  const width = window.innerWidth
  if (width >= 1025) return 'Desktop'
  if (width >= 641) return 'Tablet'
  if (width >= 481) return 'Mobile'
  return 'Small Mobile'
})

// Тестовые секции для проверки скролла
const testSections = ref([
  {
    id: 1,
    title: 'Основная информация',
    description: 'Заполните основные данные для тестирования',
    field1: '',
    field2: '',
    selected: null
  },
  {
    id: 2,
    title: 'Дополнительные данные',
    description: 'Еще больше полей для проверки скролла',
    field1: '',
    field2: '',
    selected: null
  },
  {
    id: 3,
    title: 'Финальная секция',
    description: 'Последняя секция для полной проверки',
    field1: '',
    field2: '',
    selected: null
  },
  {
    id: 4,
    title: 'Очень длинная секция',
    description: 'Эта секция добавлена специально для того, чтобы проверить как работает скролл в модальном окне при большом количестве контента',
    field1: '',
    field2: '',
    selected: null
  }
])

// Опции для селекта
const selectOptions = [
  { label: 'Опция 1', value: '1' },
  { label: 'Опция 2', value: '2' },
  { label: 'Опция 3', value: '3' },
  { label: 'Очень длинная опция с большим количеством текста', value: '4' }
]

// Размеры для переключения
const sizes = ['sm', 'md', 'lg', 'xl']

// Методы
const openModal = (size) => {
  currentSize.value = size
  showModal.value = true
}

const handleClose = () => {
  showModal.value = false
}

const switchSize = () => {
  const currentIndex = sizes.indexOf(currentSize.value)
  const nextIndex = (currentIndex + 1) % sizes.length
  currentSize.value = sizes[nextIndex]
}
</script>