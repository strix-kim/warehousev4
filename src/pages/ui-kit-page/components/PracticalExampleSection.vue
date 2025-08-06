<template>
  <section>
    <h2 class="text-xl font-bold text-primary mb-6">🚀 Практический пример</h2>
    <BentoGrid columns="auto" gap="6">
      <BentoCard size="1x1" title="Статистика">
        <div class="space-y-2">
          <div class="text-2xl font-bold text-primary">1,247</div>
          <div class="text-sm text-secondary">Всего пользователей</div>
        </div>
      </BentoCard>
      
      <BentoCard size="1x1" title="Быстрые действия">
        <div class="space-y-3">
          <p class="text-secondary">Выберите действие для выполнения</p>
          <div class="flex gap-2">
            <ButtonV2 variant="primary" size="sm">Создать</ButtonV2>
            <ButtonV2 variant="secondary" size="sm">Отмена</ButtonV2>
          </div>
        </div>
      </BentoCard>
    </BentoGrid>
  </section>
</template>

<script setup>
import { BentoGrid, BentoCard, ButtonV2 } from '@/shared/ui-v2'
</script>