<template>
  <!-- Skeleton-карточка точки монтажа для отображения во время загрузки. Использует только Tailwind CSS. -->
  <div class="animate-pulse bg-white rounded-2xl border border-gray-200 p-4 flex flex-col gap-3 shadow-sm min-h-[110px]">
    <!-- Заголовок -->
    <div class="h-5 w-1/2 bg-gray-200 rounded"></div>
    <!-- Ответственные -->
    <div class="h-4 w-1/3 bg-gray-100 rounded"></div>
    <!-- Оборудование -->
    <div class="h-4 w-2/3 bg-gray-100 rounded"></div>
  </div>
</template>

<script setup>
// MountPointSkeleton.vue — атомарный skeleton-компонент для карточки точки монтажа
// Используется для плавного UX при загрузке точек монтажа (state: loading)
// Верстка только через Tailwind CSS, цвета — нейтральные, анимация — animate-pulse
// Не содержит логики, только визуальный placeholder
</script> 