<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useEventStore } from '@/features/events/store/event-store'
import { useUserStore } from '@/app/store/user-store'
import { storeToRefs } from 'pinia'
// UI Kit v2
import { ModalV2, FormV2, FormFieldV2 as FormField, InputV2, DropdownV2, ButtonV2 } from '@/shared/ui-v2'

// Props / Emits
const props = defineProps({
  show: Boolean,
  event: { type: Object, default: null }
})
const emit = defineEmits(['update:show', 'success', 'close'])

// Stores
const eventStore = useEventStore()
const { loadingCreate, loadingUpdate } = storeToRefs(eventStore)
const userStore = useUserStore()
const { users, loading: usersLoading } = storeToRefs(userStore)

onMounted(() => {
  if (users.value.length === 0 && !usersLoading.value) userStore.loadUsers?.()
})

const isEdit = computed(() => !!props.event)

// Form data
const formData = ref({
  name: '',
  organizer: '',
  location: '',
  start_date: '',
  end_date: '',
  setup_date: '',
  teardown_date: '',
  description: '',
  technical_task: '',
  responsible_engineers: []
})
watch(() => props.event, (val) => { if (val) formData.value = { ...val } }, { immediate: true })

// Users options
const engineerOptions = computed(() => users.value.map(u => ({ 
  label: u.name || u.email, 
  value: u.id,
  icon: 'user'
})))

// Validation rules
const validationRules = {
  name: [{ rule: 'required', message: 'Название обязательно' }],
  organizer: [{ rule: 'required', message: 'Организатор обязателен' }],
  location: [{ rule: 'required', message: 'Локация обязательна' }],
  start_date: [{ rule: 'required', message: 'Дата начала обязательна' }]
}

// Submit
const handleSubmit = async (data,{reset})=>{
  try{
    if(isEdit.value){await eventStore.updateEvent(props.event.id,data)}
    else{await eventStore.createEvent(data)}
    emit('success');emit('update:show',false);reset()
  }catch(e){console.error(e)}
}
</script>
<template>
  <ModalV2
    :model-value="props.show"
    @update:modelValue="val=>emit('update:show',val)"
    :title="isEdit ? 'Редактировать мероприятие' : 'Создать мероприятие'"
    :show-close-button="true"
    @close="emit('close')"
    :loading="loadingCreate || loadingUpdate"
  >
    <template #default>
      <FormV2
        :model-value="formData"
        :validation-rules="validationRules"
        layout="vertical"
        @submit="handleSubmit"
      >
        <template #default="{ formData, errors, validate }">
          <!-- Основная информация -->
          <h3 class="text-lg font-semibold text-primary mb-2">Основная информация</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 pb-6 border-b border-secondary/10">
            <FormField label="Название" :error="errors.name" required class="md:col-span-2">
              <InputV2 v-model="formData.name" @blur="validate('name')" />
            </FormField>
            <FormField label="Организатор" :error="errors.organizer" required>
              <InputV2 v-model="formData.organizer" @blur="validate('organizer')" />
            </FormField>
            <FormField label="Локация" :error="errors.location" required>
              <InputV2 v-model="formData.location" @blur="validate('location')" />
            </FormField>
          </div>

          <!-- Календарный план -->
          <h3 class="text-lg font-semibold text-primary mb-2">Календарный план</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 pb-6 border-b border-secondary/10">
            <FormField label="Дата начала" :error="errors.start_date" required>
              <InputV2 v-model="formData.start_date" type="date" @blur="validate('start_date')" placeholder="Выберите дату" />
            </FormField>
            <FormField label="Дата окончания" :error="errors.end_date">
              <InputV2 v-model="formData.end_date" type="date" placeholder="Выберите дату" />
            </FormField>
            <FormField label="Дата начала монтажа" :error="errors.setup_date">
              <InputV2 v-model="formData.setup_date" type="date" placeholder="Выберите дату" />
            </FormField>
            <FormField label="Дата окончания демонтажа" :error="errors.teardown_date">
              <InputV2 v-model="formData.teardown_date" type="date" placeholder="Выберите дату" />
            </FormField>
          </div>

          <!-- Дополнительная информация -->
          <h3 class="text-lg font-semibold text-primary mb-2">Дополнительная информация</h3>
          <div class="space-y-4 mb-6 pb-6 border-b border-secondary/10">
            <FormField label="Описание" :error="errors.description">
              <textarea v-model="formData.description" rows="3" class="w-full bg-accent/50 border border-secondary/20 rounded-lg p-3 text-sm placeholder:text-secondary/60" placeholder="Опишите мероприятие..." />
            </FormField>
            <FormField label="Техническое задание" :error="errors.technical_task">
              <textarea v-model="formData.technical_task" rows="3" class="w-full bg-accent/50 border border-secondary/20 rounded-lg p-3 text-sm placeholder:text-secondary/60" placeholder="Укажите технические требования..." />
            </FormField>
          </div>

          <!-- Ответственные инженеры -->
          <h3 class="text-lg font-semibold text-primary mb-2">Ответственные инженеры</h3>
          <div class="mb-6">
            <FormField label="Инженеры" helper="Выберите нескольких" :error="errors.responsible_engineers">
              <DropdownV2
                v-model="formData.responsible_engineers"
                :items="engineerOptions"
                trigger-text="Выберите инженеров"
                :multiple="true"
              />
            </FormField>
          </div>
        </template>

        <template #actions="{ submit, isValid, isLoading }">
          <div class="flex justify-end gap-3 mt-4">
            <ButtonV2 variant="ghost" @click="emit('update:show', false)" :disabled="isLoading">Отмена</ButtonV2>
            <ButtonV2 variant="primary" @click="submit" :loading="isLoading" :disabled="!isValid || isLoading">
              {{ isEdit ? 'Сохранить изменения' : 'Создать' }}
            </ButtonV2>
          </div>
        </template>
      </FormV2>
    </template>
  </ModalV2>
</template>
