<template>
  <section>
    <h2 class="text-xl font-bold text-primary mb-6">📊 Карточки данных (EPR Stats)</h2>
    <BentoGrid columns="auto" gap="6">
      <BentoCard size="1x1" title="Всего оборудования" :interactive="true">
        <div class="flex items-center justify-between">
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <span class="text-2xl font-bold text-primary">1,247</span>
              <StatusBadgeV2 size="xs" label="Актуально" variant="success" />
            </div>
            <p class="text-sm text-secondary">Единиц техники в системе</p>
          </div>
          <IconV2 name="package" size="lg" color="secondary" />
        </div>
        <div class="mt-4 flex items-center gap-2">
          <span class="text-sm font-medium text-success">+12%</span>
          <span class="text-xs text-secondary">За месяц</span>
        </div>
      </BentoCard>

      <BentoCard size="1x1" title="Доступно сейчас" :interactive="true">
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <span class="text-xl font-bold text-primary">892</span>
            <StatusBadgeV2 size="xs" label="Доступно" variant="success" />
          </div>
          <p class="text-sm text-secondary">Готово к использованию</p>
        </div>
        <div class="mt-4 flex items-center gap-2">
          <span class="text-sm text-secondary">3%</span>
          <span class="text-xs text-secondary">За неделю</span>
        </div>
      </BentoCard>
    </BentoGrid>
  </section>
</template>

<script setup>
import { BentoGrid, BentoCard, StatusBadgeV2, IconV2 } from '@/shared/ui-v2'
</script>