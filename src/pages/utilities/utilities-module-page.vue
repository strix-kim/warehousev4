<template>
  <div class="min-h-screen bg-accent">
    <!-- Header с Breadcrumbs -->
    <div class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 py-4">
        <BreadcrumbsV2 :items="breadcrumbs" variant="minimal" size="sm" />

        <div class="flex justify-between items-center mt-4">
          <div>
            <h1 class="text-2xl font-bold text-primary">Модуль утилит</h1>
            <p class="text-sm text-secondary mt-2">Системные инструменты и вспомогательные операции</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content в Bento Grid -->
    <div class="max-w-7xl mx-auto px-4 py-8"></div>

    
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { 
  BentoGrid, 
  BentoCard, 
  BreadcrumbsV2, 
  ButtonV2, 
  IconV2
} from '@/shared/ui-v2'

const breadcrumbs = [
  { label: 'Главная', href: '/', icon: 'home' },
  { label: 'Утилиты', disabled: true }
]

</script>


