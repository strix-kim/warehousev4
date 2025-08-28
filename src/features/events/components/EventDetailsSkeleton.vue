<template>
  <div class="max-w-7xl mx-auto">
    <!-- Header Skeleton -->
    <div class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 py-4">
        <div class="flex items-center gap-2 mb-4">
          <SkeletonV2 variant="circular" width="16" height="16" />
          <SkeletonV2 width="60" height="16" />
          <span class="text-secondary/50">/</span>
          <SkeletonV2 width="80" height="16" />
          <span class="text-secondary/50">/</span>
          <SkeletonV2 width="120" height="16" />
        </div>
      </div>
    </div>

    <!-- Content Skeleton -->
    <div class="px-4 py-6">
      <BentoGrid columns="1" gap="4" class="sm:columns-2 sm:gap-6" minRowHeight="md">
        <!-- Hero Card Skeleton -->
        <BentoCard size="2x1" variant="primary">
          <template #header>
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <SkeletonV2 variant="circular" width="24" height="24" />
                <SkeletonV2 width="300" height="28" />
              </div>
              <div class="flex items-center gap-2">
                <SkeletonV2 width="80" height="24" variant="rounded" />
                <SkeletonV2 width="120" height="32" variant="rounded" />
              </div>
            </div>
          </template>
          <div class="space-y-4">
            <!-- Timeline Skeleton -->
            <div class="hidden sm:flex items-center gap-2">
              <template v-for="i in 4" :key="i">
                <div class="flex items-center gap-2 w-24 flex-shrink-0">
                  <SkeletonV2 variant="circular" width="10" height="10" />
                  <SkeletonV2 width="60" height="12" />
                </div>
                <SkeletonV2 v-if="i < 4" width="20" height="2" />
              </template>
            </div>
            
            <!-- Mobile Timeline Skeleton -->
            <div class="sm:hidden space-y-3">
              <template v-for="i in 4" :key="i">
                <div class="flex items-center gap-3">
                  <SkeletonV2 variant="circular" width="12" height="12" />
                  <div class="flex-1 space-y-1">
                    <SkeletonV2 width="80" height="14" />
                    <SkeletonV2 width="120" height="12" />
                  </div>
                </div>
              </template>
            </div>
            
            <!-- Stats Skeleton -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div class="flex flex-wrap gap-2">
                <SkeletonV2 width="100" height="28" variant="rounded" />
                <SkeletonV2 width="120" height="28" variant="rounded" />
              </div>
              <SkeletonV2 width="100%" height="80" variant="rounded" />
              <SkeletonV2 width="100%" height="80" variant="rounded" />
            </div>
            
            <!-- Accent bar skeleton -->
            <SkeletonV2 width="100%" height="4" variant="rounded" />
          </div>
        </BentoCard>

        <!-- Overview Card Skeleton -->
        <BentoCard size="1x1" variant="default">
          <template #header>
            <div class="flex items-center gap-2">
              <SkeletonV2 variant="circular" width="20" height="20" />
              <SkeletonV2 width="80" height="20" />
            </div>
          </template>
          <div class="space-y-3">
            <SkeletonV2 width="100%" height="16" />
            <SkeletonV2 width="85%" height="16" />
            <SkeletonV2 width="70%" height="16" />
          </div>
        </BentoCard>

        <!-- Technical Task Card Skeleton -->
        <BentoCard size="1x1" variant="minimal">
          <template #header>
            <div class="flex items-center justify-between gap-2 w-full">
              <div class="flex items-center gap-2">
                <SkeletonV2 variant="circular" width="20" height="20" />
                <SkeletonV2 width="100" height="20" />
              </div>
              <SkeletonV2 width="80" height="32" variant="rounded" />
            </div>
          </template>
          <div class="bg-accent/50 border border-secondary/20 rounded-lg p-3">
            <div class="space-y-2">
              <SkeletonV2 width="100%" height="12" />
              <SkeletonV2 width="90%" height="12" />
              <SkeletonV2 width="95%" height="12" />
              <SkeletonV2 width="80%" height="12" />
              <SkeletonV2 width="85%" height="12" />
            </div>
          </div>
        </BentoCard>

        <!-- Mount Points Skeleton -->
        <BentoCard size="2x2" variant="default">
          <template #header>
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <SkeletonV2 variant="circular" width="20" height="20" />
                  <SkeletonV2 width="150" height="20" />
                  <SkeletonV2 width="30" height="20" variant="rounded" />
                </div>
                <!-- Mobile stats skeleton -->
                <div class="flex sm:hidden items-center gap-4 mt-2">
                  <SkeletonV2 width="80" height="12" />
                  <SkeletonV2 width="90" height="12" />
                </div>
              </div>
              <div class="flex items-center gap-4">
                <!-- Desktop stats skeleton -->
                <div class="hidden sm:flex items-center gap-4">
                  <SkeletonV2 width="80" height="14" />
                  <SkeletonV2 width="90" height="14" />
                </div>
                <SkeletonV2 width="180" height="40" variant="rounded" />
              </div>
            </div>
          </template>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            <template v-for="i in 6" :key="i">
              <SkeletonV2 width="100%" height="120" variant="rounded" />
            </template>
          </div>
        </BentoCard>

        <!-- Team Card Skeleton -->
        <BentoCard size="1x1" variant="default">
          <template #header>
            <div class="flex items-center gap-2">
              <SkeletonV2 variant="circular" width="20" height="20" />
              <SkeletonV2 width="120" height="20" />
            </div>
          </template>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <template v-for="i in 4" :key="i">
              <div class="flex items-center gap-3 p-3 rounded-xl border border-secondary/20">
                <SkeletonV2 variant="circular" width="36" height="36" />
                <div class="flex-1 space-y-1">
                  <SkeletonV2 width="100" height="16" />
                  <SkeletonV2 width="140" height="12" />
                </div>
              </div>
            </template>
          </div>
        </BentoCard>

        <!-- Equipment Lists Card Skeleton -->
        <BentoCard size="1x1" variant="secondary">
          <template #header>
            <div class="flex items-center gap-2">
              <SkeletonV2 variant="circular" width="20" height="20" />
              <SkeletonV2 width="140" height="20" />
            </div>
          </template>
          <div class="space-y-3">
            <SkeletonV2 width="100%" height="16" />
            <SkeletonV2 width="80%" height="16" />
          </div>
        </BentoCard>
      </BentoGrid>
    </div>
  </div>
</template>

<script setup>
/**
 * EventDetailsSkeleton - skeleton loading состояние для страницы деталей мероприятия
 * Повторяет структуру основной страницы для плавного UX
 */
import { 
  BentoGrid, 
  BentoCard, 
  SkeletonV2 
} from '@/shared/ui-v2'

// Компонент не принимает props - он статичный
// Анимация и стили управляются через SkeletonV2
</script>

<style scoped>
/* Дополнительные стили при необходимости */
</style>
