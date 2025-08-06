<template>
  <section>
    <h2 class="text-xl font-bold text-primary mb-6">🔍 SearchInput v2 - Smart Search System</h2>
    <BentoCard title="Поиск">
      <SearchInputV2 
        v-model="searchQuery"
        placeholder="Поиск..."
      />
    </BentoCard>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import { BentoCard, SearchInputV2 } from '@/shared/ui-v2'

const searchQuery = ref('')
</script>