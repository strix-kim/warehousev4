<template>
  <section>
    <h2 class="text-xl font-bold text-primary mb-6">🎨 Цветовая палитра</h2>
    <BentoGrid columns="auto" gap="4">
      <!-- Фирменные цвета -->
      <BentoCard size="1x1" title="Primary" class="bg-primary text-white">
        <p class="text-white">#2B2D42</p>
        <p class="text-white/80">Фирменные</p>
      </BentoCard>

      <BentoCard size="1x1" title="Secondary" class="bg-secondary text-white">
        <p class="text-white">#8D99AE</p>
        <p class="text-white/80">Фирменные</p>
      </BentoCard>

      <BentoCard size="1x1" title="Accent" class="bg-accent text-primary">
        <p class="text-primary">#EDF2F4</p>
        <p class="text-secondary">Фирменные</p>
      </BentoCard>

      <BentoCard size="1x1" title="Brand Red" class="bg-brand-red text-white">
        <p class="text-white">#EF233C</p>
        <p class="text-white/80">Фирменные</p>
      </BentoCard>

      <BentoCard size="1x1" title="Brand Deep Red" class="bg-brand-deep-red text-white">
        <p class="text-white">#D90429</p>
        <p class="text-white/80">Фирменные</p>
      </BentoCard>

      <!-- Семантические цвета -->
      <BentoCard size="1x1" title="Success" class="bg-success text-white">
        <p class="text-white">#22c55e</p>
        <p class="text-white/80">Семантические</p>
      </BentoCard>

      <BentoCard size="1x1" title="Warning" class="bg-warning text-white">
        <p class="text-white">#f59e0b</p>
        <p class="text-white/80">Семантические</p>
      </BentoCard>

      <BentoCard size="1x1" title="Error" class="bg-error text-white">
        <p class="text-white">#ef4444</p>
        <p class="text-white/80">Семантические</p>
      </BentoCard>

      <BentoCard size="1x1" title="Info" class="bg-info text-white">
        <p class="text-white">#3b82f6</p>
        <p class="text-white/80">Семантические</p>
      </BentoCard>
    </BentoGrid>
  </section>
</template>

<script setup>
import { BentoGrid, BentoCard } from '@/shared/ui-v2'
</script>