<template>
  <ModalV2
    :model-value="show"
    @update:modelValue="val => emit('update:show', val)"
    :title="isEditing ? 'Редактировать техническое задание' : 'Добавить техническое задание'"
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
              {{ isEditing ? 'Сохранить' : 'Добавить' }}
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
  mountPoint: { type: Object, required: true },
  editingDuty: { type: Object, default: null }
})
const emit = defineEmits(['update:show', 'success', 'error'])

const formRef = ref(null)
const form = ref({
  title: '',
  description: ''
})
const titleFieldRef = ref(null)

const isEditing = computed(() => !!props.editingDuty)

const validationRules = {
  title: [
    { rule: 'required', message: 'Укажите название задания' },
    { rule: 'minLength', value: 2, message: 'Минимум 2 символа' }
  ]
}

// Отслеживаем изменения показа модального окна
watch(() => props.show, (val) => {
  if (val) {
    nextTick(() => {
      const el = titleFieldRef.value?.$el?.querySelector('input')
      el && el.focus()
    })
  }
})

// Отслеживаем изменения editingDuty отдельно
watch(() => props.editingDuty, (duty) => {
  if (props.show) {
    if (duty) {
      // Заполняем форму данными для редактирования
      form.value = {
        title: duty.title || '',
        description: duty.description || ''
      }
    } else {
      // Очищаем форму для нового задания
      form.value = { title: '', description: '' }
    }
  }
}, { immediate: true })

// Также отслеживаем комбинацию show + editingDuty
watch([() => props.show, () => props.editingDuty], ([show, duty]) => {
  if (show) {
    if (duty) {
      // Заполняем форму данными для редактирования
      form.value = {
        title: duty.title || '',
        description: duty.description || ''
      }
    } else {
      // Очищаем форму для нового задания
      form.value = { title: '', description: '' }
    }
  }
})

const isSubmitting = ref(false)
const mountPointStore = useMountPointStore()

async function handleSubmit(data) {
  try {
    isSubmitting.value = true
    
    const dutyData = {
      title: String(data.title || '').trim(),
      description: String(data.description || '').trim()
    }
    
    let result
    if (isEditing.value) {
      // Редактируем существующее задание
      result = await mountPointStore.updateTechnicalDuty(
        props.mountPoint.id, 
        props.editingDuty.id, 
        dutyData
      )
    } else {
      // Добавляем новое задание
      result = await mountPointStore.addTechnicalDuty(props.mountPoint.id, dutyData)
    }
    
    if (result?.error) throw new Error(result.error)
    emit('success')
    emit('update:show', false)
  } catch (e) {
    const action = isEditing.value ? 'обновления' : 'добавления'
    emit('error', e?.message || `Ошибка ${action} задания`)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
</style>
