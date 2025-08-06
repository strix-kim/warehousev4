<script setup>
import { TabsV2 } from '@/shared/ui-v2'

const props = defineProps({
  modelValue: {
    type: String,
    required: true
  },
  tabs: {
    type: Array,
    required: true
  }
})
const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <TabsV2
    :items="tabs"
    :model-value="modelValue"
    @update:modelValue="val => emit('update:modelValue', val)"
  />
</template>

<style scoped></style>
