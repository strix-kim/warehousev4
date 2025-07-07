<template>
  <!-- table-eq — production-таблица с единым стилем для всех страниц, без Tailwind-утилит -->
  <table class="table-eq">
    <thead>
      <tr>
        <slot name="head" />
      </tr>
    </thead>
    <tbody>
      <slot />
    </tbody>
  </table>
</template>

<script setup>
// Простой компонент таблицы для production-UI, без Tailwind-утилит
</script>

<style scoped>
tbody tr:nth-child(even) {
  background: #f3f4f6;
}
</style> 