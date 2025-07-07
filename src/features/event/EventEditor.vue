<template>
  <!--
    EventEditor.vue — production-ready модальное окно для добавления/редактирования мероприятия.
    Использует Modal.vue, Button.vue, Spinner.vue, useUsers.js, eventApi.js.
    Все поля, edge-cases, loading/error, glassmorphism, минимализм, адаптивность, accessibility.
  -->
  <Modal v-model="modalValue" size="lg" :title="isEdit ? 'Редактировать мероприятие' : 'Создать мероприятие'">
    <form @submit.prevent="handleSubmit" class="editor-form" autocomplete="off">
      <div class="editor-fields">
        <!-- Название -->
        <div class="editor-field">
          <label for="name">Название *</label>
          <input id="name" v-model="form.name" required class="editor-input" placeholder="Название мероприятия" aria-label="Название мероприятия" />
        </div>
        <!-- Организатор -->
        <div class="editor-field">
          <label for="organizer">Организатор *</label>
          <input id="organizer" v-model="form.organizer" required class="editor-input" placeholder="Организатор" aria-label="Организатор" />
        </div>
        <!-- Локация -->
        <div class="editor-field">
          <label for="location">Локация *</label>
          <input id="location" v-model="form.location" required class="editor-input" placeholder="Локация" aria-label="Локация" />
        </div>
        <!-- Дата начала мероприятия -->
        <div class="editor-field">
          <label for="start_date">Дата начала *</label>
          <input id="start_date" v-model="form.start_date" type="date" required class="editor-input" aria-label="Дата начала мероприятия" />
        </div>
        <!-- Дата начала монтажа -->
        <div class="editor-field">
          <label for="setup_date">Дата начала монтажа</label>
          <input id="setup_date" v-model="form.setup_date" type="date" class="editor-input" aria-label="Дата начала монтажа" />
        </div>
        <!-- Дата окончания мероприятия -->
        <div class="editor-field">
          <label for="end_date">Дата окончания</label>
          <input id="end_date" v-model="form.end_date" type="date" class="editor-input" aria-label="Дата окончания мероприятия" />
        </div>
        <!-- Дата окончания демонтажа -->
        <div class="editor-field">
          <label for="teardown_date">Дата окончания демонтажа</label>
          <input id="teardown_date" v-model="form.teardown_date" type="date" class="editor-input" aria-label="Дата окончания демонтажа" />
        </div>
      </div>
      <div class="editor-fields">
        <!-- Описание -->
        <div class="editor-field editor-field-wide">
          <label for="description">Описание</label>
          <textarea id="description" v-model="form.description" rows="2" class="editor-input" placeholder="Описание мероприятия" aria-label="Описание мероприятия"></textarea>
        </div>
        <!-- Техническое задание -->
        <div class="editor-field editor-field-wide">
          <label for="technical_task">Техническое задание</label>
          <textarea id="technical_task" v-model="form.technical_task" rows="2" class="editor-input" placeholder="Техническое задание" aria-label="Техническое задание"></textarea>
        </div>
      </div>
      <!-- Ответственные инженеры -->
      <div class="editor-fields">
        <div class="editor-field editor-field-wide">
          <label>Ответственные инженеры</label>
          <div class="editor-checkbox-list" role="group" aria-label="Ответственные инженеры">
            <div v-if="isUsersLoading" class="editor-checkbox-loading"><Spinner /></div>
            <div v-else class="editor-checkbox-scroll">
              <label v-for="u in users" :key="u.id" class="editor-checkbox-item">
                <input
                  type="checkbox"
                  :value="u.id"
                  v-model="form.responsible_engineers"
                  class="editor-checkbox"
                  :aria-label="`Инженер ${u.name}`"
                />
                <span>{{ u.name }} <span class="editor-checkbox-role">({{ u.role }})</span></span>
              </label>
            </div>
          </div>
        </div>
      </div>
      <div v-if="hasError" class="editor-error">{{ hasError }}</div>
      <div class="editor-actions">
        <Button type="button" @click="onClose" class="editor-btn secondary">Отмена</Button>
        <Button type="submit" :disabled="isLoading" class="editor-btn">
          <span v-if="isLoading" class="editor-btn-spinner"></span>
          {{ isEdit ? 'Сохранить' : 'Создать' }}
        </Button>
      </div>
    </form>
  </Modal>
</template>

<script setup>
// EventEditor.vue — production-ready форма для добавления/редактирования мероприятия
// Все бизнес-правила, edge-cases, loading/error, ролевые ограничения, подробные комментарии
import { ref, computed, watch, defineEmits, onMounted } from 'vue'
import { useUserStore } from '@/stores/user-store'
import { storeToRefs } from 'pinia'
import Button from '@/components/Button.vue'
import Spinner from '@/components/Spinner.vue'
import Modal from '@/components/Modal.vue'
import { addEvent, updateEvent } from './eventApi'

// Пропсы: event (для редактирования), visible (v-model), onSubmit, onClose
const props = defineProps({
  event: Object,
  visible: Boolean,
  onSubmit: Function,
  onClose: Function
})

const emit = defineEmits(['update:visible'])

// Управление видимостью модалки через v-model
const modalValue = computed({
  get: () => props.visible,
  set: (val) => {
    emit('update:visible', val)
    if (!val) props.onClose && props.onClose()
  }
})

const isEdit = computed(() => !!props.event)
const form = ref({
  name: '',
  organizer: '',
  location: '',
  description: '',
  technical_task: '',
  setup_date: '',
  start_date: '',
  end_date: '',
  teardown_date: '',
  responsible_engineers: []
})

const userStore = useUserStore()
const { users, loading: isUsersLoading } = storeToRefs(userStore)
const isLoading = ref(false)
const hasError = ref(null)

// При редактировании заполняем форму
watch(() => props.event, (val) => {
  if (val) {
    form.value = {
      name: val.name || '',
      organizer: val.organizer || '',
      location: val.location || '',
      description: val.description || '',
      technical_task: val.technical_task || '',
      setup_date: val.setup_date || '',
      start_date: val.start_date || '',
      end_date: val.end_date || '',
      teardown_date: val.teardown_date || '',
      responsible_engineers: Array.isArray(val.responsible_engineers) ? [...val.responsible_engineers] : []
    }
  } else {
    form.value = {
      name: '', organizer: '', location: '', description: '', technical_task: '',
      setup_date: '', start_date: '', end_date: '', teardown_date: '', responsible_engineers: []
    }
  }
}, { immediate: true })

onMounted(() => {
  if (!users.value.length) userStore.loadUsers()
})

function validate() {
  if (!form.value.name.trim()) return 'Название обязательно'
  if (!form.value.organizer.trim()) return 'Организатор обязателен'
  if (!form.value.location.trim()) return 'Локация обязательна'
  if (!form.value.start_date) return 'Дата начала мероприятия обязательна'
  return null
}

async function handleSubmit() {
  const err = validate()
  if (err) {
    hasError.value = err
    return
  }
  isLoading.value = true
  hasError.value = null
  try {
    if (isEdit.value) {
      await updateEvent(props.event.id, { ...form.value })
    } else {
      await addEvent({ ...form.value })
    }
    if (props.onSubmit) props.onSubmit()
  } catch (e) {
    hasError.value = e.message || 'Ошибка сохранения'
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
/*
  editor-form, editor-input, editor-btn, editor-title, editor-field, editor-error, editor-actions — production-ready UI для модального окна EventEditor.
  Чистый CSS, без Tailwind-утилит. Единый стиль с EquipmentEditor, фирменный tech/minimal, адаптивность, accessibility.
*/
.editor-form {
  width: 100%;
  margin: 0 auto;
  padding: 32px 24px 24px 24px;
  background: rgba(255,255,255,0.98);
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  box-shadow: 0 4px 32px 0 rgba(16,16,16,0.08);
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow-y: auto;
  max-height: 70vh;
  color: #1f2937;
  font-family: 'JetBrains Mono', monospace;
}
.editor-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 18px 24px;
  margin-bottom: 0;
}
.editor-field {
  flex: 1 1 220px;
  min-width: 180px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.editor-field-wide {
  flex: 1 1 100%;
  min-width: 100%;
}
.editor-input {
  height: 44px;
  min-height: 44px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: rgba(255,255,255,0.95);
  font-size: 16px;
  font-family: 'JetBrains Mono', monospace;
  padding: 0 16px;
  transition: box-shadow 0.2s, border-color 0.2s;
  color: #1f2937;
  outline: none;
  resize: none;
}
.editor-input:focus {
  border-color: #ef4444;
  box-shadow: 0 0 0 2px #fecaca;
}
.editor-input:disabled {
  opacity: 0.5;
  background: #f3f4f6;
  color: #9ca3af;
  cursor: not-allowed;
}
.editor-input[rows] {
  /* Увеличено вертикальное пространство для textarea (Описание, Техническое задание) */
  height: auto;
  min-height: 140px;
  padding-top: 18px;
  padding-bottom: 18px;
}
.editor-checkbox-list {
  margin-top: 2px;
  max-width: 100%;
}
.editor-checkbox-scroll {
  /* Увеличено пространство для списка инженеров */
  max-height: 260px;
  overflow-y: auto;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: #fafbfc;
  padding: 18px 16px;
}
.editor-checkbox-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  margin-bottom: 4px;
  cursor: pointer;
  user-select: none;
}
.editor-checkbox-role {
  color: #9ca3af;
  font-size: 13px;
}
.editor-checkbox {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1.5px solid #e5e7eb;
  accent-color: #ef4444;
  transition: border-color 0.2s;
}
.editor-checkbox:focus {
  border-color: #ef4444;
  outline: 2px solid #fecaca;
}
.editor-checkbox-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
}
.editor-error {
  color: #ef4444;
  text-align: center;
  font-weight: 600;
  margin: 10px 0 0 0;
  font-size: 15px;
}
.editor-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 28px;
  flex-wrap: wrap;
}
.editor-btn {
  height: 44px;
  min-width: 120px;
  border-radius: 8px;
  font-size: 16px;
  font-family: 'JetBrains Mono', monospace;
  background: #ef4444;
  color: #fff;
  border: none;
  transition: background 0.2s;
  cursor: pointer;
  padding: 0 28px;
  font-weight: 600;
  box-shadow: 0 1px 4px 0 rgba(16,16,16,0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.editor-btn:hover {
  background: #dc2626;
}
.editor-btn.secondary {
  background: #f3f4f6;
  color: #1f2937;
}
.editor-btn.secondary:hover {
  background: #e5e7eb;
}
.editor-btn-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid #fff;
  border-top: 2px solid #ef4444;
  border-radius: 50%;
  margin-right: 10px;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@media (max-width: 700px) {
  .editor-form {
    max-width: 98vw;
    padding: 18px 6vw 18px 6vw;
  }
  .editor-fields {
    gap: 14px 0;
  }
  .editor-field, .editor-field-wide {
    min-width: 100%;
    flex: 1 1 100%;
  }
  .editor-actions {
    flex-direction: column;
    gap: 10px;
    align-items: stretch;
  }
  .editor-btn, .editor-btn.secondary {
    width: 100%;
    min-width: 0;
  }
}
</style>

<!--
  Production-ready EventEditor.vue:
  - Все поля схемы, edge-cases, loading/error, адаптивность, glassmorphism
  - Использует Modal.vue, Button.vue, Spinner.vue, useUsers.js, eventApi.js
  - Не делает прямых запросов к Supabase, только через сервис
  - Поддержка ответственных инженеров, валидация, подробные комментарии
  - Ролевые ограничения реализуются на уровне родителя/хука
--> 