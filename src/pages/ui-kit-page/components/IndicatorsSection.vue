<template>
  <section>
    <h2 class="text-xl font-bold text-primary mb-6">⚡ Иконки и индикаторы</h2>
    
    <BentoGrid columns="auto" gap="6">
      <!-- Спиннеры загрузки -->
      <BentoCard title="Спиннеры загрузки" size="1x1">
        <div class="flex gap-4 items-center">
          <SpinnerV2 size="sm" />
          <SpinnerV2 size="md" />
          <SpinnerV2 size="lg" />
        </div>
      </BentoCard>

      <!-- Skeleton loading states -->
      <BentoCard title="Skeleton Loading States" size="2x1">
        <div class="space-y-4">
          <!-- Text skeletons -->
          <div class="space-y-2">
            <p class="text-sm text-secondary mb-2">Текстовые placeholder'ы:</p>
            <SkeletonV2 variant="text" width="100%" />
            <SkeletonV2 variant="text" width="80%" />
            <SkeletonV2 variant="text" width="60%" />
          </div>

          <!-- Card skeleton -->
          <div class="space-y-2">
            <p class="text-sm text-secondary mb-2">Карточки и контент:</p>
            <div class="flex items-start gap-3">
              <SkeletonV2 variant="circular" width="40" height="40" />
              <div class="flex-1 space-y-2">
                <SkeletonV2 variant="text" width="70%" />
                <SkeletonV2 variant="text" width="50%" />
              </div>
            </div>
          </div>

          <!-- Различные варианты -->
          <div class="space-y-2">
            <p class="text-sm text-secondary mb-2">Варианты форм:</p>
            <div class="flex gap-3 items-center">
              <SkeletonV2 variant="rectangular" width="60" height="40" />
              <SkeletonV2 variant="rounded" width="80" height="40" />
              <SkeletonV2 variant="circular" width="40" height="40" />
            </div>
          </div>

          <!-- Анимации -->
          <div class="space-y-2">
            <p class="text-sm text-secondary mb-2">Анимации:</p>
            <div class="space-y-2">
              <SkeletonV2 variant="text" animation="pulse" width="90%" />
              <SkeletonV2 variant="text" animation="wave" width="75%" />
              <SkeletonV2 variant="text" animation="none" width="85%" />
            </div>
          </div>
        </div>
      </BentoCard>

      <!-- Применение в UI -->
      <BentoCard title="Применение в интерфейсе" size="1x1">
        <div class="space-y-3">
          <p class="text-sm text-secondary">Для замены контента во время загрузки:</p>
          <ul class="text-sm space-y-1">
            <li>• Списки данных</li>
            <li>• Карточки товаров</li>
            <li>• Профили пользователей</li>
            <li>• Формы и таблицы</li>
          </ul>
          <div class="pt-2">
            <StatusBadgeV2 size="xs" label="UX Improvement" variant="success" />
          </div>
        </div>
      </BentoCard>
    </BentoGrid>
  </section>
</template>

<script setup>
import { 
  BentoGrid,
  BentoCard,
  SpinnerV2, 
  SkeletonV2,
  StatusBadgeV2 
} from '@/shared/ui-v2'
</script>