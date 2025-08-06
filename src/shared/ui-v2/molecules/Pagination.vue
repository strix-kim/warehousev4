<template>
  <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
    <!-- Информация о записях -->
    <div class="text-sm text-secondary order-2 sm:order-1">
      {{ startRecord }}-{{ endRecord }} из {{ totalItems }}
    </div>

    <!-- Навигация -->
    <div class="flex items-center gap-2 order-1 sm:order-2">
      <!-- Предыдущая страница -->
      <ButtonV2
        variant="ghost"
        size="sm"
        :disabled="currentPage <= 1"
        @click="previousPage"
  
        class="h-8 w-8 p-0 rounded-full"
      >
        <IconV2 name="chevron-left" size="xs" />
      </ButtonV2>

      <!-- Страницы -->
      <div class="flex items-center gap-1">
        <!-- Первая страница -->
        <ButtonV2
          v-if="showFirstPage"
          :variant="currentPage === 1 ? 'primary' : 'ghost'"
          size="sm"
          @click="goToPage(1)"
          class="h-8 w-8 p-0 rounded-full text-xs"
        >
          1
        </ButtonV2>

        <!-- Левое многоточие -->
        <span v-if="showLeftEllipsis" class="px-1 text-secondary text-xs">...</span>

        <!-- Видимые страницы -->
        <ButtonV2
          v-for="page in visiblePages"
          :key="page"
          :variant="currentPage === page ? 'primary' : 'ghost'"
          size="sm"
          @click="goToPage(page)"
          class="h-8 w-8 p-0 rounded-full text-xs"
        >
          {{ page }}
        </ButtonV2>

        <!-- Правое многоточие -->
        <span v-if="showRightEllipsis" class="px-1 text-secondary text-xs">...</span>

        <!-- Последняя страница -->
        <ButtonV2
          v-if="showLastPage"
          :variant="currentPage === totalPages ? 'primary' : 'ghost'"
          size="sm"
          @click="goToPage(totalPages)"
          class="h-8 w-8 p-0 rounded-full text-xs"
        >
          {{ totalPages }}
        </ButtonV2>
      </div>

      <!-- Следующая страница -->
      <ButtonV2
        variant="ghost"
        size="sm"
        :disabled="currentPage >= totalPages"
        @click="nextPage"
  
        class="h-8 w-8 p-0 rounded-full"
      >
        <IconV2 name="chevron-right" size="xs" />
      </ButtonV2>
    </div>

    <!-- Выбор количества на странице -->
    <div v-if="showItemsPerPage" class="flex items-center gap-2 text-sm order-3">
      <span class="text-secondary whitespace-nowrap">Показывать:</span>
      <SelectV2
        :model-value="itemsPerPage"
        :options="itemsPerPageOptions"
        size="sm"
        class="w-16"
        @update:modelValue="changeItemsPerPage"
      />
    </div>
  </div>
</template>

<script setup>
/**
 * PaginationV2 - Чистый и современный компонент пагинации
 * Минималистичный дизайн с круглыми кнопками
 */
import { computed } from 'vue'
import ButtonV2 from '../atoms/Button.vue'
import IconV2 from '../atoms/Icon.vue'
import SelectV2 from '../atoms/Select.vue'

const props = defineProps({
  currentPage: {
    type: Number,
    default: 1
  },
  totalPages: {
    type: Number,
    required: true
  },
  totalItems: {
    type: Number,
    required: true
  },
  itemsPerPage: {
    type: Number,
    default: 10
  },
  showItemsPerPage: {
    type: Boolean,
    default: true
  },
  itemsPerPageOptions: {
    type: Array,
    default: () => [
      { label: '5', value: 5 },
      { label: '10', value: 10 },
      { label: '20', value: 20 },
      { label: '50', value: 50 }
    ]
  }
})

const emit = defineEmits([
  'update:currentPage',
  'update:itemsPerPage'
])

// Computed свойства
const startRecord = computed(() => {
  return (props.currentPage - 1) * props.itemsPerPage + 1
})

const endRecord = computed(() => {
  return Math.min(props.currentPage * props.itemsPerPage, props.totalItems)
})

// Логика видимых страниц (показываем максимум 5 страниц)
const visiblePages = computed(() => {
  const pages = []
  const total = props.totalPages
  const current = props.currentPage
  
  // Если страниц мало, показываем все
  if (total <= 5) {
    for (let i = 1; i <= total; i++) {
      pages.push(i)
    }
    return pages
  }
  
  // Иначе показываем текущую и по 2 с каждой стороны
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  
  return pages
})

const showFirstPage = computed(() => {
  return props.totalPages > 5 && !visiblePages.value.includes(1)
})

const showLastPage = computed(() => {
  return props.totalPages > 5 && !visiblePages.value.includes(props.totalPages)
})

const showLeftEllipsis = computed(() => {
  return showFirstPage.value && visiblePages.value[0] > 2
})

const showRightEllipsis = computed(() => {
  return showLastPage.value && visiblePages.value[visiblePages.value.length - 1] < props.totalPages - 1
})

// Методы
const goToPage = (page) => {
  if (page >= 1 && page <= props.totalPages) {
    emit('update:currentPage', page)
  }
}

const previousPage = () => {
  goToPage(props.currentPage - 1)
}

const nextPage = () => {
  goToPage(props.currentPage + 1)
}

const changeItemsPerPage = (value) => {
  emit('update:itemsPerPage', value)
  // Корректируем текущую страницу если нужно
  const maxPage = Math.ceil(props.totalItems / value)
  if (props.currentPage > maxPage) {
    emit('update:currentPage', maxPage || 1)
  }
}
</script>