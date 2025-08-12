<!--
  MountPointFormModal - модальная форма для создания/редактирования точки монтажа
  Современный дизайн, валидация, интеграция с Pinia store
  Поддержка технических заданий и назначения инженеров
-->
<template>
  <ModalV2
    :model-value="show"
    @update:modelValue="val => emit('update:show', val)"
    :title="isEdit ? 'Редактировать точку монтажа' : 'Создать точку монтажа'"
    size="lg"
    :show-close-button="true"
    @close="emit('close')"
  >
    <template #default>
      <FormV2
        ref="formRef"
        v-model="form"
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
              label="Название точки монтажа"
              label-icon="map-pin"
              :error="errors.name"
              required
              class="md:col-span-2"
              placeholder="Например: Главная сцена"
              @blur="validate('name')"
            />
            <FormField
              v-model="formData.location"
              type="input"
              label="Локация"
              label-icon="map"
              :error="errors.location"
              placeholder="Зал А, Фойе..."
            />
            <FormField
              v-model="formData.start_date"
              type="date"
              label="Дата начала работ"
              label-icon="calendar"
              :error="errors.start_date"
              :hint="!errors.start_date && defaultStartHint"
            />
          </div>

          <!-- Технические задания (опционально) -->
          <h3 class="text-lg font-semibold text-primary mb-2">Технические задания (опционально)</h3>
          <div class="space-y-3 mb-6 pb-6 border-b border-secondary/10">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
              <FormField
                :model-value="newDutyTitle"
                @update:modelValue="val => (newDutyTitle = val)"
                type="input"
                label="Название задания"
                placeholder="Например: Вывод на экраны"
              />
              <FormField
                :model-value="newDutyDescription"
                @update:modelValue="val => (newDutyDescription = val)"
                type="textarea"
                :rows="2"
                label="Описание (опционально)"
                placeholder="Кратко опишите задачу"
              />
              <div class="md:col-span-2 flex justify-end">
                <ButtonV2 variant="secondary" size="sm" :disabled="!newDutyTitle.trim()" @click="addDuty">Добавить</ButtonV2>
              </div>
            </div>

            <div v-if="form.technical_duties.length" class="space-y-2">
              <div
                v-for="(duty, index) in form.technical_duties"
                :key="duty.id || index"
                class="p-3 rounded-lg border border-secondary/20 bg-white"
              >
                <div class="flex items-start gap-2">
                  <div class="flex-1 min-w-0">
                    <FormField
                      v-model="duty.title"
                      type="input"
                      label="Название"
                      placeholder="Название задания"
                    />
                  </div>
                  <div class="flex items-center gap-2 flex-shrink-0 pt-6">
                    <StatusBadgeV2 size="xs" variant="warning" label="В работе" />
                    <ButtonV2 variant="ghost" size="sm" @click="removeDuty(index)">
                      <IconV2 name="trash" size="sm" />
                    </ButtonV2>
                  </div>
                </div>
                <div class="mt-2">
                  <FormField
                    v-model="duty.description"
                    type="textarea"
                    :rows="2"
                    label="Описание"
                    placeholder="Описание задания"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Ответственные инженеры -->
          <h3 class="text-lg font-semibold text-primary mb-2">Ответственные инженеры</h3>
          <div class="mb-6">
            <div v-if="isUsersLoading" class="text-secondary text-sm py-4">Загрузка списка инженеров...</div>
            <div v-else-if="!availableEngineers.length" class="text-secondary text-sm py-4">Нет доступных инженеров</div>
            <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                v-for="u in availableEngineers"
                :key="u.id"
                type="button"
                class="w-full text-left rounded-lg border transition-all duration-200 bg-accent/50 hover:bg-accent/70"
                :class="(form.responsible_engineers || []).includes(u.id) ? 'border-primary ring-1 ring-primary/20' : 'border-secondary/30 hover:border-secondary/50'"
                @click="setField('responsible_engineers', toggleValue(form.responsible_engineers, u.id))"
                :aria-pressed="(form.responsible_engineers || []).includes(u.id)"
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
                    <span class="inline-flex items-center justify-center w-6 h-6 rounded-full border"
                          :class="(form.responsible_engineers || []).includes(u.id) ? 'bg-primary text-accent border-primary' : 'border-secondary/40 text-secondary'">
                      <IconV2 v-if="(form.responsible_engineers || []).includes(u.id)" name="check" size="xs" />
                    </span>
                  </div>
                </div>
              </button>
            </div>
            <div v-if="errors.responsible_engineers" class="text-xs text-error mt-1">{{ errors.responsible_engineers }}</div>
          </div>
        </template>

        <template #actions="{ submit, isValid, isLoading }">
          <div class="flex justify-end gap-3">
            <ButtonV2 variant="ghost" @click="emit('update:show', false)">Отмена</ButtonV2>
            <ButtonV2 variant="primary" :loading="isSubmitting || isLoading" :disabled="!isValid || isSubmitting || isLoading" @click="submit">
              {{ isEdit ? 'Сохранить изменения' : 'Создать точку монтажа' }}
            </ButtonV2>
          </div>
        </template>
      </FormV2>
    </template>
  </ModalV2>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/app/store/user-store'
import { useMountPointStore } from '@/app/store/mount-point-store'
import { ModalV2, FormV2, FormFieldV2 as FormField, ButtonV2, IconV2, StatusBadgeV2 } from '@/shared/ui-v2'

const props = defineProps({
  show: { type: Boolean, default: false },
  eventId: { type: String, required: true },
  mountPoint: { type: Object, default: null },
  event: { type: Object, default: null }
})
const emit = defineEmits(['update:show', 'success', 'error', 'close'])

const userStore = useUserStore()
const mountPointStore = useMountPointStore()
const { users, loading: isUsersLoading } = storeToRefs(userStore)

const formRef = ref(null)
const form = ref({
  name: '',
  location: '',
  start_date: '',
  technical_duties: [],
  responsible_engineers: [],
  equipment_plan: [],
  equipment_fact: []
})
const newDutyTitle = ref('')
const newDutyDescription = ref('')
const isSubmitting = ref(false)

const isEdit = computed(() => !!props.mountPoint)
const defaultStartHint = computed(() => props.event?.setup_date ? `По умолчанию: ${new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short' }).format(new Date(props.event.setup_date))}` : '')

const availableEngineers = computed(() => {
  if (!props.event?.responsible_engineers) return []
  return users.value.filter(u => props.event.responsible_engineers.includes(u.id))
})

watch(() => props.show, (val) => {
  if (val) {
    resetForm()
  }
})

onMounted(() => {
  if (!users.value.length) userStore.loadUsers?.()
})

function resetForm() {
  if (props.mountPoint) {
    form.value = {
      name: props.mountPoint.name || '',
      location: props.mountPoint.location || '',
      start_date: props.mountPoint.start_date || (props.event?.setup_date || ''),
      technical_duties: ensureTechnicalDutiesFormat(props.mountPoint.technical_duties || []),
      responsible_engineers: [...(props.mountPoint.responsible_engineers || [])],
      equipment_plan: [...(props.mountPoint.equipment_plan || [])],
      equipment_fact: [...(props.mountPoint.equipment_fact || [])]
    }
  } else {
    form.value = {
      name: '',
      location: '',
      start_date: props.event?.setup_date || '',
      technical_duties: [],
      responsible_engineers: [],
      equipment_plan: [],
      equipment_fact: []
    }
  }
  newDutyTitle.value = ''
  newDutyDescription.value = ''
}

function ensureTechnicalDutiesFormat(list) {
  return Array.isArray(list) ? list.map(item => {
    if (item && typeof item === 'object' && item.title) return { id: item.id || crypto.randomUUID(), title: item.title, description: item.description || '', status: item.status || 'в работе' }
    if (typeof item === 'string') return { id: crypto.randomUUID(), title: item, description: '', status: 'в работе' }
    return { id: crypto.randomUUID(), title: String(item || ''), description: '', status: 'в работе' }
  }) : []
}

function addDuty() {
  const title = newDutyTitle.value.trim()
  const desc = newDutyDescription.value.trim()
  if (!title) return
  const current = Array.isArray(form.value.technical_duties) ? [...form.value.technical_duties] : []
  if (current.some(d => d.title === title)) return
  current.push({ id: crypto.randomUUID(), title, description: desc, status: 'в работе' })
  formRef.value?.setField?.('technical_duties', current)
  newDutyTitle.value = ''
  newDutyDescription.value = ''
}

function removeDuty(index) {
  const current = Array.isArray(form.value.technical_duties) ? [...form.value.technical_duties] : []
  if (index < 0 || index >= current.length) return
  current.splice(index, 1)
  formRef.value?.setField?.('technical_duties', current)
}

function toggleValue(list, id) {
  const current = Array.isArray(list) ? [...list] : []
  const idx = current.indexOf(id)
  if (idx === -1) current.push(id)
  else current.splice(idx, 1)
  return current
}

const validationRules = {
  name: [{ rule: 'required', message: 'Название обязательно' }],
  responsible_engineers: [{ rule: (val) => Array.isArray(val) && val.length > 0, message: 'Назначьте хотя бы одного инженера' }]
}

async function handleSubmit(data) {
  try {
    isSubmitting.value = true
    if (isEdit.value && props.mountPoint?.id) {
      const updates = {
        name: data.name?.trim(),
        location: data.location?.trim() || null,
        start_date: data.start_date || null,
        technical_duties: (data.technical_duties || []).map(d => ({ id: d.id, title: d.title?.trim(), description: (d.description || '').trim(), status: d.status || 'в работе' })),
        responsible_engineers: Array.isArray(data.responsible_engineers) ? data.responsible_engineers : [],
        equipment_plan: Array.isArray(data.equipment_plan) ? data.equipment_plan : [],
        equipment_fact: Array.isArray(data.equipment_fact) ? data.equipment_fact : []
      }
      const result = await mountPointStore.editMountPoint(props.mountPoint.id, updates)
      if (result?.error) throw new Error(result.error)
      emit('success', result?.data || null)
      emit('update:show', false)
      return
    }

    const payload = {
      ...data,
      name: data.name?.trim(),
      location: data.location?.trim() || null,
      start_date: data.start_date || null,
      technical_duties: (data.technical_duties || []).map(d => ({ id: d.id, title: d.title?.trim(), description: (d.description || '').trim(), status: d.status || 'в работе' })),
      event_id: props.eventId
    }

    const result = await mountPointStore.createMountPoint(payload)
    if (result?.error) throw new Error(result.error)

    emit('success', result?.data || null)
    emit('update:show', false)
  } catch (e) {
    emit('error', e?.message || (isEdit.value ? 'Ошибка обновления точки монтажа' : 'Ошибка создания точки монтажа'))
  } finally {
    isSubmitting.value = false
  }
}
</script> 