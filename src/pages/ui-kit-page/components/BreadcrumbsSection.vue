<template>
  <section>
    <h2 class="text-xl font-bold text-primary mb-6">🍞 BreadcrumbsV2 - Smart Navigation</h2>
    <BentoCard title="Навигация">
      <BreadcrumbsV2 :items="breadcrumbItems" variant="default" />
    </BentoCard>
  </section>
</template>

<script setup>
import { BentoCard, BreadcrumbsV2 } from '@/shared/ui-v2'

const breadcrumbItems = [
  { label: 'Главная', href: '/' },
  { label: 'Оборудование', href: '/equipment' },
  { label: 'Текущая страница', disabled: true }
]
</script>