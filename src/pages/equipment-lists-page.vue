<script setup>
/**
 * Страница управления списками оборудования
 * Просмотр, создание, редактирование и экспорт списков
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useEquipmentListsStore } from '@/stores/equipment-lists-store'
import { useEquipmentStore } from '@/stores/equipment-store'

// Компоненты UI
import Button from '@/shared/ui/atoms/Button.vue'
import Card from '@/shared/ui/molecules/Card.vue'
import Icon from '@/shared/ui/atoms/Icon.vue'
import Spinner from '@/shared/ui/atoms/Spinner.vue'
import EmptyState from '@/shared/ui/templates/EmptyState.vue'
import ErrorState from '@/shared/ui/templates/ErrorState.vue'

const router = useRouter()
const equipmentListsStore = useEquipmentListsStore()
const equipmentStore = useEquipmentStore()

// Состояние
const activeTab = ref('active')
const selectedType = ref('all')
const searchQuery = ref('')

// Получаем реактивные данные из store
const { lists, loading, error, stats } = storeToRefs(equipmentListsStore)

// Computed свойства
const filteredLists = computed(() => {
  let filtered = lists.value

  // Фильтр по статусу (активные/архивированные)
  if (activeTab.value === 'active') {
    filtered = filtered.filter(list => !list.is_archived)
  } else {
    filtered = filtered.filter(list => list.is_archived)
  }

  // Фильтр по типу
  if (selectedType.value !== 'all') {
    filtered = filtered.filter(list => list.type === selectedType.value)
  }

  // Фильтр по поиску
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(list => 
      list.name.toLowerCase().includes(query) ||
      list.description?.toLowerCase().includes(query) ||
      list.events?.name?.toLowerCase().includes(query)
    )
  }

  return filtered
})

const typeLabels = {
  security: 'Охрана',
  report: 'Отчет',
  custom: 'Кастомный'
}

const typeColors = {
  security: 'bg-blue-100 text-blue-800 border-blue-200',
  report: 'bg-green-100 text-green-800 border-green-200',
  custom: 'bg-purple-100 text-purple-800 border-purple-200'
}

// Методы
const handleCreateSecurityList = async (eventId) => {
  const name = `Список охраны - ${new Date().toLocaleDateString()}`
  const result = await equipmentListsStore.generateSecurityList(eventId, name)
  
  if (result) {
    // Показываем уведомление об успехе
    console.log('Список охраны создан:', result)
  }
}

const handleViewList = (listId) => {
  router.push(`/equipment-lists/${listId}`)
}

const handleEditList = (listId) => {
  router.push(`/equipment-lists/${listId}/edit`)
}

const handleArchiveList = async (listId) => {
  await equipmentListsStore.archiveList(listId)
}

const handleDeleteList = async (listId) => {
  if (confirm('Вы уверены, что хотите удалить этот список?')) {
    await equipmentListsStore.deleteList(listId)
  }
}

const handleExportPDF = (listId) => {
  // TODO: Реализовать экспорт в PDF
  console.log('Экспорт в PDF для списка:', listId)
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Загрузка данных
onMounted(async () => {
  await equipmentListsStore.loadLists()
  await equipmentStore.loadAllEquipments()
})
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Заголовок страницы -->
    <div class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-gray-900">Списки оборудования</h1>
            <p class="mt-2 text-sm text-gray-600">
              Управление списками оборудования для охраны, отчетов и других целей
            </p>
          </div>
          
          <Button
            @click="router.push('/equipment-lists/create')"
            variant="primary"
            size="lg"
          >
            <Icon name="Plus" set="lucide" size="sm" class="mr-2" />
            Создать список
          </Button>
        </div>
      </div>
    </div>

    <!-- Основной контент -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Фильтры и поиск -->
      <div class="mb-8 space-y-4">
        <!-- Вкладки -->
        <div class="border-b border-gray-200">
          <nav class="-mb-px flex space-x-8">
            <button
              @click="activeTab = 'active'"
              :class="[
                'py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200',
                activeTab === 'active'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              ]"
            >
              Активные списки
            </button>
            <button
              @click="activeTab = 'archived'"
              :class="[
                'py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200',
                activeTab === 'archived'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              ]"
            >
              Архивированные
            </button>
          </nav>
        </div>

        <!-- Фильтры -->
        <div class="flex flex-col sm:flex-row gap-4">
          <!-- Поиск -->
          <div class="flex-1">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Поиск по названию, описанию или мероприятию..."
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <!-- Фильтр по типу -->
          <select
            v-model="selectedType"
            class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Все типы</option>
            <option value="security">Охрана</option>
            <option value="report">Отчет</option>
            <option value="custom">Кастомный</option>
          </select>
        </div>
      </div>

      <!-- Состояние загрузки -->
      <div v-if="loading" class="flex justify-center items-center py-12">
        <div class="text-center">
          <Spinner class="h-8 w-8 text-blue-600 mx-auto mb-4" />
          <p class="text-gray-600">Загрузка списков...</p>
        </div>
      </div>

      <!-- Состояние ошибки -->
      <ErrorState
        v-else-if="error"
        :message="error"
        description="Не удалось загрузить списки оборудования"
        class="my-12"
      >
        <Button
          @click="equipmentListsStore.loadLists()"
          variant="secondary"
          size="lg"
          class="mt-6"
        >
          Повторить попытку
        </Button>
      </ErrorState>

      <!-- Пустое состояние -->
      <EmptyState
        v-else-if="filteredLists.length === 0"
        message="Списки не найдены"
        description="Попробуйте изменить фильтры или создать новый список"
        icon="📋"
        class="my-12"
      />

      <!-- Список оборудования -->
      <div v-else class="grid gap-6">
        <Card
          v-for="list in filteredLists"
          :key="list.id"
          class="hover:shadow-lg transition-shadow duration-200"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-2">
                <h3 class="text-lg font-semibold text-gray-900">{{ list.name }}</h3>
                <span
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border"
                  :class="typeColors[list.type]"
                >
                  {{ typeLabels[list.type] }}
                </span>
              </div>
              
              <p v-if="list.description" class="text-sm text-gray-600 mb-3">
                {{ list.description }}
              </p>
              
              <div class="flex items-center gap-6 text-sm text-gray-500">
                <div class="flex items-center gap-1">
                  <Icon name="Calendar" set="lucide" size="sm" />
                  {{ formatDate(list.created_at) }}
                </div>
                <div class="flex items-center gap-1">
                  <Icon name="Package" set="lucide" size="sm" />
                  {{ list.equipment_ids?.length || 0 }} единиц
                </div>
                <div v-if="list.events?.name" class="flex items-center gap-1">
                  <Icon name="MapPin" set="lucide" size="sm" />
                  {{ list.events.name }}
                </div>
              </div>
            </div>
            
            <!-- Действия -->
            <div class="flex items-center gap-2">
              <Button
                @click="handleViewList(list.id)"
                variant="ghost"
                size="sm"
              >
                <Icon name="Eye" set="lucide" size="sm" />
              </Button>
              
              <Button
                @click="handleEditList(list.id)"
                variant="ghost"
                size="sm"
              >
                <Icon name="Edit" set="lucide" size="sm" />
              </Button>
              
              <Button
                @click="handleExportPDF(list.id)"
                variant="ghost"
                size="sm"
              >
                <Icon name="Download" set="lucide" size="sm" />
              </Button>
              
              <Button
                v-if="!list.is_archived"
                @click="handleArchiveList(list.id)"
                variant="ghost"
                size="sm"
              >
                <Icon name="Archive" set="lucide" size="sm" />
              </Button>
              
              <Button
                @click="handleDeleteList(list.id)"
                variant="ghost"
                size="sm"
                class="text-red-600 hover:text-red-700"
              >
                <Icon name="Trash2" set="lucide" size="sm" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template> 