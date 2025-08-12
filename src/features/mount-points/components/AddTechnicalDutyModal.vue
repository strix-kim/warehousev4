<template>
  <ModalV2
    :model-value="show"
    @update:modelValue="val => emit('update:show', val)"
    title="Добавить техническое задание"
    size="md"
    :show-close-button="true"
    :require-close-confirm="true"
    @close="emit('update:show', false)"
  >
    <template #default>
      <FormV2
        ref="formRef"
        v-model="form"
        :validation-rules="validationRules"
        layout="vertical"
        @submit="handleSubmit"
      >
        <template #default="{ formData, errors, validate }">
          <FormFieldV2
            ref="titleFieldRef"
            v-model="formData.title"
            type="input"
            label="Название задания"
            label-icon="check-circle"
            placeholder="Например: Вывод на экраны"
            :error="errors.title"
            required
            @blur="validate('title')"
          />
          <FormFieldV2
            v-model="formData.description"
            type="textarea"
            :rows="3"
            label="Описание (опционально)"
            placeholder="Кратко опишите задачу"
            class="mt-3"
          />
        </template>

        <template #actions="{ isValid, isLoading }">
          <div class="flex justify-end gap-3">
            <ButtonV2 variant="ghost" @click="emit('update:show', false)">Отмена</ButtonV2>
            <ButtonV2 type="submit" variant="primary" :loading="isSubmitting || isLoading" :disabled="!isValid || isSubmitting || isLoading">
              Добавить
            </ButtonV2>
          </div>
        </template>
      </FormV2>
    </template>
  </ModalV2>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useMountPointStore } from '@/app/store/mount-point-store'
import { ModalV2, FormV2, FormFieldV2, ButtonV2 } from '@/shared/ui-v2'

const props = defineProps({
  show: { type: Boolean, default: false },
  mountPoint: { type: Object, required: true }
})
const emit = defineEmits(['update:show', 'success', 'error'])

const formRef = ref(null)
const form = ref({
  title: '',
  description: ''
})
const titleFieldRef = ref(null)

const validationRules = {
  title: [
    { rule: 'required', message: 'Укажите название задания' },
    { rule: 'minLength', value: 2, message: 'Минимум 2 символа' }
  ]
}

watch(() => props.show, (val) => {
  if (val) {
    form.value = { title: '', description: '' }
    nextTick(() => {
      const el = titleFieldRef.value?.$el?.querySelector('input')
      el && el.focus()
    })
  }
})

const isSubmitting = ref(false)
const mountPointStore = useMountPointStore()

async function handleSubmit(data) {
  try {
    isSubmitting.value = true
    const { error } = await mountPointStore.addTechnicalDuty(props.mountPoint.id, {
      title: String(data.title || '').trim(),
      description: String(data.description || '').trim()
    })
    if (error) throw new Error(error)
    emit('success')
    emit('update:show', false)
  } catch (e) {
    emit('error', e?.message || 'Ошибка добавления задания')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
</style>
