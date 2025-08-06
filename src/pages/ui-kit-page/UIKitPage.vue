<template>
  <div class="min-h-screen bg-accent">
    <!-- Header -->
    <div class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 py-6">
        <div class="text-center">
          <h1 class="text-3xl font-bold text-primary mb-2">UI Kit v2 - Bento Design System</h1>
          <p class="text-secondary">Демонстрация компонентов новой UI-системы</p>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 py-6 space-y-8">
      <!-- Цветовая палитра -->
      <ColorsSection />

      <!-- Кнопки -->
      <ButtonsSection />

      <!-- Поля ввода -->
      <InputsSection />

      <!-- Bento Cards -->
      <BentoCardsSection />

      <!-- Селекторы и статусы -->
      <SelectorsSection />

      <!-- Карточки данных -->
      <DataCardsSection />

      <!-- Индикаторы и иконки -->
      <IndicatorsSection />

      <!-- Тесты адаптивности -->
      <ResponsiveTestSection />

      <!-- Модальные окна -->
      <ModalsSection />

      <!-- Modal Test Section -->
      <ModalTestSection />

      <!-- Таблицы -->
      <TablesSection />

      <!-- Формы -->
      <FormsSection />

      <!-- Поиск -->
      <SearchSection />

      <!-- Дополнительные компоненты -->
      <AdditionalComponentsSection />

      <!-- Breadcrumbs -->
      <BreadcrumbsSection />

      <!-- Практический пример -->
      <PracticalExampleSection />
    </main>
  </div>
</template>

<script setup>
import ColorsSection from './components/ColorsSection.vue'
import ButtonsSection from './components/ButtonsSection.vue'
import InputsSection from './components/InputsSection.vue'
import BentoCardsSection from './components/BentoCardsSection.vue'
import SelectorsSection from './components/SelectorsSection.vue'
import DataCardsSection from './components/DataCardsSection.vue'
import IndicatorsSection from './components/IndicatorsSection.vue'
import ResponsiveTestSection from './components/ResponsiveTestSection.vue'
import ModalsSection from './components/ModalsSection.vue'
import ModalTestSection from './components/ModalTestSection.vue'
import TablesSection from './components/TablesSection.vue'
import FormsSection from './components/FormsSection.vue'
import SearchSection from './components/SearchSection.vue'
import AdditionalComponentsSection from './components/AdditionalComponentsSection.vue'
import BreadcrumbsSection from './components/BreadcrumbsSection.vue'
import PracticalExampleSection from './components/PracticalExampleSection.vue'
</script>