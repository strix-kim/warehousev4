<template>
  <div class="min-h-screen bg-accent">
    <!-- Header с Breadcrumbs -->
    <div class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 py-4">
        <BreadcrumbsV2 :items="breadcrumbs" variant="minimal" size="sm" />
        <div class="flex justify-between items-center mt-4">
          <div>
            <h1 class="text-2xl font-bold text-primary">Модуль мероприятий</h1>
            <p class="text-sm text-secondary mt-2">Управление мероприятиями и создание новых событий</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 py-8">
      <BentoGrid columns="auto" gap="6">
        <!-- Статистика мероприятий -->
        <BentoCard title="Всего мероприятий" size="1x1" variant="minimal">
          <div class="flex flex-col items-center justify-center h-full">
            <span class="text-2xl font-bold text-primary">{{ totalCount }}</span>
            <span class="text-sm text-secondary">Всего</span>
          </div>
        </BentoCard>
        <BentoCard title="Активные мероприятия" size="1x1" variant="minimal">
          <div class="flex flex-col items-center justify-center h-full">
            <span class="text-2xl font-bold text-primary">{{ activeCount }}</span>
            <span class="text-sm text-secondary">Активные</span>
          </div>
        </BentoCard>
        <BentoCard title="Архивные мероприятия" size="1x1" variant="minimal">
          <div class="flex flex-col items-center justify-center h-full">
            <span class="text-2xl font-bold text-primary">{{ archivedCount }}</span>
            <span class="text-sm text-secondary">Архивные</span>
          </div>
        </BentoCard>

        <!-- Навигационные карточки -->
        <BentoCard
          title="Управление мероприятиями"
          size="2x1"
          variant="primary"
          :interactive="true"
          @click="navigateToList"
        >
          <div class="flex flex-col justify-between h-full">
            <p class="text-sm text-secondary p-4">Просмотр, фильтрация и сортировка мероприятий (активные/архивные).</p>
            <div class="flex items-center justify-between px-4 pb-4">
              <span class="text-sm text-secondary">Перейти к списку</span>
              <IconV2 name="list" size="sm" color="current" />
            </div>
          </div>
        </BentoCard>

        <BentoCard
          title="Создание мероприятия"
          size="2x1"
          variant="default"
          :interactive="true"
          @click="navigateToCreate"
        >
          <div class="flex flex-col justify-between h-full">
            <p class="text-sm text-secondary p-4">Создание нового мероприятия.</p>
            <div class="flex items-center justify-between px-4 pb-4">
              <span class="text-sm text-secondary">Создать</span>
              <IconV2 name="plus" size="sm" color="current" />
            </div>
          </div>
        </BentoCard>
      </BentoGrid>
    </div>

    <!-- Notification System -->
    <NotificationV2 ref="notificationSystem" position="top-right" />
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { computed, onMounted } from 'vue'
import { useEventStore } from '@/features/events/store/event-store'
import {
  BreadcrumbsV2,
  BentoGrid,
  BentoCard,
  NotificationV2,
  IconV2
} from '@/shared/ui-v2'

const router = useRouter()
const eventStore = useEventStore()

// Метрики мероприятий
const totalCount = computed(() => eventStore.eventsStats.total)
const activeCount = computed(() => eventStore.eventsStats.active)
const archivedCount = computed(() => eventStore.eventsStats.archived)

// Загружаем мероприятия для расчёта статистики
onMounted(() => {
  eventStore.loadEvents()
})

const breadcrumbs = [
  { label: 'Главная', href: '/', icon: 'home' },
  { label: 'Мероприятия', disabled: true }
]

const navigateToList = () => router.push('/events/list')
const navigateToCreate = () => router.push('/events/list')
</script>