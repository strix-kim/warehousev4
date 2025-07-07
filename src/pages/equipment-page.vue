<script setup>
// equipment-page.vue — страница оборудования
// Интегрирует production-ready компонент EquipmentTable.vue
// Все бизнес-логика и состояния реализуются через EquipmentTable.vue и хуки/сервисы
</script>

<template>
  <!-- Светлый SVG-паттерн на фоне страницы -->
  <div class="min-h-screen py-8 px-2 md:px-4 relative" style="background: #f8fafc;">
    <div class="absolute inset-0 w-full h-full pointer-events-none select-none opacity-60" aria-hidden="true" style="z-index:0;">
      <div style="width:100%;height:100%;background-image:url('data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' viewBox=\'0 0 40 40\' fill=\'none\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Crect x=\'0\' y=\'0\' width=\'40\' height=\'40\' fill=\'none\'/%3E%3Cpath d=\'M 40 0 L 0 0 0 40\' stroke=\'%23e5e7eb\' stroke-width=\'1\'/%3E%3C/svg%3E');background-size:40px 40px;background-repeat:repeat;"></div>
    </div>
    <div class="max-w-5xl mx-auto relative z-10">
      <h1 class="text-2xl font-bold mb-6 text-gray-900">Оборудование</h1>
      <EquipmentTable />
    </div>
  </div>
</template>

<script>
import EquipmentTable from '@/features/equipment/EquipmentTable.vue'
export default {
  components: { EquipmentTable }
}
</script>

<!--
  Подробные комментарии на русском языке объясняют назначение и реализацию каждого блока.
  Все стили — только через Tailwind CSS.
--> 