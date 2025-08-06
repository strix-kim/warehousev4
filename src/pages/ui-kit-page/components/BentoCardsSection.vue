<template>
  <section>
    <h2 class="text-xl font-bold text-primary mb-6">🎯 Bento Cards</h2>
    <BentoGrid columns="auto" gap="6">
      <BentoCard size="1x1" title="Default Card">
        <p class="text-secondary">Обычная карточка с базовым стилем</p>
      </BentoCard>

      <BentoCard size="1x1" title="Primary Card" variant="primary">
        <p class="text-white">Главная карточка для важного контента</p>
      </BentoCard>

      <BentoCard size="1x1" title="Secondary Card" variant="secondary">
        <p class="text-white">Вторичная карточка для дополнительной информации</p>
      </BentoCard>

      <BentoCard size="1x1" title="Danger Card" variant="danger">
        <p class="text-white">Карточка для предупреждений и ошибок</p>
      </BentoCard>

      <BentoCard size="1x1" title="Interactive Card" :interactive="true" @click="handleCardClick">
        <div>
          <h3 class="font-semibold text-primary mb-2">Интерактивная карточка</h3>
          <p class="text-secondary mb-4">Наведите курсор для эффекта</p>
          <ButtonV2 variant="primary" size="sm">Действие</ButtonV2>
        </div>
      </BentoCard>

      <BentoCard size="2x1" title="Wide Card">
        <p class="text-secondary">Широкая карточка для контента в одну строку</p>
      </BentoCard>
    </BentoGrid>
  </section>
</template>

<script setup>
import { BentoGrid, BentoCard, ButtonV2 } from '@/shared/ui-v2'

const handleCardClick = () => {
  alert('Карточка нажата!')
}
</script>