<template>
  <section>
    <h2 class="text-xl font-bold text-primary mb-6">📏 Тест адаптивности контента</h2>
    <BentoGrid columns="auto" gap="6">
      <BentoCard size="1x1" title="Короткий контент">
        <p class="text-secondary">Краткий текст</p>
      </BentoCard>
      
      <BentoCard size="2x1" title="Длинный контент">
        <div class="space-y-2">
          <p class="text-secondary">Это карточка с длинным контентом, который должен правильно отображаться без обрезания.</p>
          <p class="text-secondary">Дополнительная строка для проверки.</p>
        </div>
      </BentoCard>
    </BentoGrid>
  </section>
</template>

<script setup>
import { BentoGrid, BentoCard } from '@/shared/ui-v2'
</script>