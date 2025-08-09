<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useEventStore } from '@/features/events/store/event-store'
import { useUserStore } from '@/app/store/user-store'
import { storeToRefs } from 'pinia'
// UI Kit v2
import { ModalV2, FormV2, FormFieldV2 as FormField, ButtonV2, IconV2 } from '@/shared/ui-v2'

// Props / Emits
const props = defineProps({
  show: Boolean,
  event: { type: Object, default: null }
})
const emit = defineEmits(['update:show', 'success', 'close', 'error'])

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

// Синхронизация при редактировании
watch(
  () => props.event,
  (val) => {
    if (val) {
      formData.value = {
        name: val.name ?? '',
        organizer: val.organizer ?? '',
        location: val.location ?? '',
        start_date: val.start_date ?? '',
        end_date: val.end_date ?? '',
        setup_date: val.setup_date ?? '',
        teardown_date: val.teardown_date ?? '',
        description: val.description ?? '',
        technical_task: val.technical_task ?? '',
        responsible_engineers: Array.isArray(val.responsible_engineers) ? val.responsible_engineers : []
      }
    }
  },
  { immediate: true }
)

// Users options
const engineerOptions = computed(() => users.value.map(u => ({ 
  label: u.name || u.email, 
  value: u.id,
  icon: 'user'
})))

// Выбор инженеров (карточки)
function isEngineerSelected(id) {
  return Array.isArray(formData.value.responsible_engineers) && formData.value.responsible_engineers.includes(id)
}

function toggleEngineer(id) {
  const current = Array.isArray(formData.value.responsible_engineers) ? [...formData.value.responsible_engineers] : []
  const idx = current.indexOf(id)
  if (idx === -1) current.push(id)
  else current.splice(idx, 1)
  formData.value.responsible_engineers = current
}

function toggleValue(list, id) {
  const current = Array.isArray(list) ? [...list] : []
  const idx = current.indexOf(id)
  if (idx === -1) current.push(id)
  else current.splice(idx, 1)
  return current
}

function getEngineerNames(ids) {
  const list = Array.isArray(ids) ? ids : []
  if (!list.length) return '—'
  const names = list
    .map(id => users.value.find(u => u.id === id))
    .filter(Boolean)
    .map(u => u.name || u.email)
  return names.join(', ')
}


// Validation rules
const validationRules = {
  name: [{ rule: 'required', message: 'Название обязательно' }],
  organizer: [{ rule: 'required', message: 'Организатор обязателен' }],
  location: [{ rule: 'required', message: 'Локация обязательна' }],
  start_date: [{ rule: 'required', message: 'Дата начала обязательна' }]
}

// Ref to form for programmatic reset
const formRef = ref(null)

// Submit
const handleSubmit = async (data) => {
  try {
    const prepared = { ...data }
    if (!isEdit.value) {
      prepared.is_archived = false
      prepared.mount_points_count = 0
    }
    if (isEdit.value) {
      await eventStore.updateEvent(props.event.id, prepared)
    } else {
      await eventStore.createEvent(prepared)
    }
    emit('success')
    emit('update:show', false)
    formRef.value?.resetForm?.()
  } catch (e) {
    console.error(e)
    const message = e?.message || (isEdit.value ? 'Ошибка обновления мероприятия' : 'Ошибка создания мероприятия')
    emit('error', message)
  }
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
        ref="formRef"
        :model-value="formData"
        :validation-rules="validationRules"
        layout="vertical"
        @submit="handleSubmit"
      >
        <template #default="{ formData, errors, validate, setField }">
          <!-- Основная информация -->
          <h3 class="text-lg font-semibold text-primary mb-2">Основная информация</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 pb-6 border-b border-secondary/10">
            <FormField
              v-model="formData.name"
              type="input"
              label="Название"
              label-icon="type"
              :error="errors.name"
              required
              class="md:col-span-2"
              @blur="validate('name')"
            />
            <FormField
              v-model="formData.organizer"
              type="input"
              label="Организатор"
              label-icon="user"
              :error="errors.organizer"
              required
              @blur="validate('organizer')"
            />
            <FormField
              v-model="formData.location"
              type="input"
              label="Локация"
              label-icon="map-pin"
              :error="errors.location"
              required
              @blur="validate('location')"
            />
          </div>

          <!-- Календарный план -->
          <h3 class="text-lg font-semibold text-primary mb-2">Календарный план</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 pb-6 border-b border-secondary/10">
            <FormField
              v-model="formData.start_date"
              type="date"
              label="Дата начала"
              label-icon="calendar"
              :error="errors.start_date"
              required
              :hint="!errors.start_date ? 'Обязательно' : ''"
              placeholder="Выберите дату"
              @blur="validate('start_date')"
            />
            <FormField
              v-model="formData.end_date"
              type="date"
              label="Дата окончания"
              label-icon="calendar"
              :error="errors.end_date"
              :hint="!errors.end_date ? 'Опционально' : ''"
              placeholder="Выберите дату"
            />
            <FormField
              v-model="formData.setup_date"
              type="date"
              label="Дата начала монтажа"
              label-icon="wrench"
              :error="errors.setup_date"
              :hint="!errors.setup_date ? 'Опционально' : ''"
              placeholder="Выберите дату"
            />
            <FormField
              v-model="formData.teardown_date"
              type="date"
              label="Дата окончания демонтажа"
              label-icon="package"
              :error="errors.teardown_date"
              :hint="!errors.teardown_date ? 'Опционально' : ''"
              placeholder="Выберите дату"
            />
          </div>

          <!-- Дополнительная информация -->
          <h3 class="text-lg font-semibold text-primary mb-2">Дополнительная информация</h3>
          <div class="space-y-4 mb-6 pb-6 border-b border-secondary/10">
            <FormField
              v-model="formData.description"
              type="textarea"
              label="Описание"
              :error="errors.description"
              :rows="3"
              placeholder="Опишите мероприятие..."
            />
            <FormField
              v-model="formData.technical_task"
              type="textarea"
              label="Техническое задание"
              :error="errors.technical_task"
              :rows="3"
              placeholder="Укажите технические требования..."
            />
          </div>

          <!-- Ответственные инженеры -->
          <h3 class="text-lg font-semibold text-primary mb-2">Ответственные инженеры</h3>
          <div class="mb-6">
            <div class="flex items-center justify-between mb-3">
              <div class="text-sm text-secondary">Выбрано: <span class="text-primary font-medium">{{ (formData.responsible_engineers || []).length }}</span></div>
            </div>
            <div v-if="usersLoading" class="text-secondary text-sm py-4">Загрузка списка инженеров...</div>
            <div v-else-if="!users?.length" class="text-secondary text-sm py-4">Инженеры не найдены</div>
            <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                v-for="u in users"
                :key="u.id"
                type="button"
                class="w-full text-left rounded-lg border transition-all duration-200 bg-accent/50 hover:bg-accent/70"
                :class="((formData.responsible_engineers || []).includes(u.id)) ? 'border-primary ring-1 ring-primary/20' : 'border-secondary/30 hover:border-secondary/50'"
                @click="setField('responsible_engineers', toggleValue(formData.responsible_engineers, u.id))"
                :aria-pressed="(formData.responsible_engineers || []).includes(u.id)"
              >
                <div class="p-3 flex items-center gap-3">
                  <div class="w-9 h-9 rounded-full bg-secondary/20 flex items-center justify-center">
                    <IconV2 name="user" size="sm" class="text-secondary" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm text-primary truncate">{{ u.name || u.email }}</div>
                    <div class="text-xs text-secondary truncate">{{ u.email }}</div>
                  </div>
                  <div class="flex-shrink-0">
                    <span
                      class="inline-flex items-center justify-center w-6 h-6 rounded-full border"
                      :class="((formData.responsible_engineers || []).includes(u.id)) ? 'bg-primary text-accent border-primary' : 'border-secondary/40 text-secondary'"
                    >
                      <IconV2 v-if="(formData.responsible_engineers || []).includes(u.id)" name="check" size="xs" />
                    </span>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <!-- Предпросмотр -->
          <h3 class="text-lg font-semibold text-primary mb-2">Предпросмотр</h3>
          <div class="rounded-lg border border-secondary/20 bg-accent/40 p-4 mb-2">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div class="flex items-center gap-2 truncate">
                <IconV2 name="type" size="xs" class="text-secondary" />
                <span class="text-secondary">Название:</span>
                <span class="text-primary truncate">{{ formData.name || '—' }}</span>
              </div>
              <div class="flex items-center gap-2 truncate">
                <IconV2 name="map-pin" size="xs" class="text-secondary" />
                <span class="text-secondary">Локация:</span>
                <span class="text-primary truncate">{{ formData.location || '—' }}</span>
              </div>
              <div class="flex items-center gap-2 truncate">
                <IconV2 name="user" size="xs" class="text-secondary" />
                <span class="text-secondary">Организатор:</span>
                <span class="text-primary truncate">{{ formData.organizer || '—' }}</span>
              </div>
              <div class="flex items-center gap-2 truncate">
                <IconV2 name="calendar" size="xs" class="text-secondary" />
                <span class="text-secondary">Период:</span>
                <span class="text-primary truncate">{{ formData.start_date || '—' }} → {{ formData.end_date || '—' }}</span>
              </div>
              <div class="flex items-center gap-2 truncate">
                <IconV2 name="wrench" size="xs" class="text-secondary" />
                <span class="text-secondary">Монтаж:</span>
                <span class="text-primary truncate">{{ formData.setup_date || '—' }}</span>
              </div>
              <div class="flex items-center gap-2 truncate">
                <IconV2 name="package" size="xs" class="text-secondary" />
                <span class="text-secondary">Демонтаж:</span>
                <span class="text-primary truncate">{{ formData.teardown_date || '—' }}</span>
              </div>
              <div class="flex items-center gap-2 truncate md:col-span-2">
                <IconV2 name="users" size="xs" class="text-secondary" />
                <span class="text-secondary">Инженеры:</span>
                <span class="text-primary truncate">{{ getEngineerNames(formData.responsible_engineers) }}</span>
              </div>
            </div>
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
