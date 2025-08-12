<script setup>
// Главный компонент приложения. Вся маршрутизация осуществляется через <router-view />.
import Layout from './app/layout.vue'
import { useRoute } from 'vue-router'
import { computed } from 'vue'

const route = useRoute()

// Определяем, нужно ли показывать Layout
const shouldShowLayout = computed(() => {
  // Не показываем Layout для публичных страниц (например, login)
  return !route.meta.public
})
</script>

<template>
  <template v-if="shouldShowLayout">
    <Layout>
      <router-view />
    </Layout>
  </template>
  <template v-else>
    <router-view />
  </template>
</template>

<style scoped>

</style>
