<script setup>
// Страница мероприятий (events-page.vue)
// Использует EventList.vue для отображения списка мероприятий
import EventList from '@/features/event/EventList.vue'
</script>

<template>
  <div class="min-h-screen py-8 px-2 md:px-4 relative" style="background: #f8fafc;">
    <div class="absolute inset-0 w-full h-full pointer-events-none select-none opacity-60" aria-hidden="true" style="z-index:0;">
      <div style="width:100%;height:100%;background-image:url('data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' viewBox=\'0 0 40 40\' fill=\'none\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Crect x=\'0\' y=\'0\' width=\'40\' height=\'40\' fill=\'none\'/%3E%3Cpath d=\'M 40 0 L 0 0 0 40\' stroke=\'%23e5e7eb\' stroke-width=\'1\'/%3E%3C/svg%3E');background-size:40px 40px;background-repeat:repeat;"></div>
    </div>
    <div class="w-full max-w-5xl mx-auto relative z-10">
      <EventList />
    </div>
  </div>
</template>

// ... (стили больше не нужны, фон реализован через inline style и абсолютный div)
// ... существующий код ... 