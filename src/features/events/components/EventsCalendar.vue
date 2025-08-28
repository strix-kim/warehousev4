<script setup>
import { computed, ref } from 'vue'
import { StatusBadgeV2, ModalV2, ButtonV2 } from '@/shared/ui-v2'

const props = defineProps({
  events: { type: Array, default: () => [] },
  modelValue: { type: String, default: '' }, // YYYY-MM for выбранного месяца
  showRanges: { type: Boolean, default: true },
  rangeMode: { type: String, default: 'phases' } // 'event' | 'phases'
})
const emit = defineEmits(['event-click', 'update:modelValue'])

// Текущий месяц в формате YYYY-MM
const today = new Date()
const initialMonth = props.modelValue || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
const monthModel = ref(initialMonth)

const monthDate = computed(() => {
  const [y, m] = monthModel.value.split('-').map(Number)
  return new Date(y, (m || 1) - 1, 1)
})

// Mobile detection (no longer used for branching behaviour)

const monthLabel = computed(() =>
  monthDate.value.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
)

const daysInMonth = computed(() => {
  const year = monthDate.value.getFullYear()
  const month = monthDate.value.getMonth()
  const lastDay = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: lastDay }, (_, i) => new Date(year, month, i + 1))
})

const startOffset = computed(() => {
  const firstDay = new Date(monthDate.value.getFullYear(), monthDate.value.getMonth(), 1).getDay() // 0-6
  // делаем понедельник первым днём недели
  return (firstDay + 6) % 7
})

// Индексация событий по дню (точечные даты)
function normalizeDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const dayToEvents = computed(() => {
  const map = new Map()
  props.events.forEach((ev) => {
    const points = [
      { date: normalizeDate(ev.setup_date), kind: 'setup' },
      { date: normalizeDate(ev.start_date), kind: 'start' },
      { date: normalizeDate(ev.end_date), kind: 'end' },
      { date: normalizeDate(ev.teardown_date), kind: 'teardown' }
    ].filter(p => !!p.date)

    points.forEach((p) => {
      if (!map.has(p.date)) map.set(p.date, [])
      map.get(p.date).push({ ...ev, _kind: p.kind })
    })
  })
  return map
})

const kindMeta = {
  setup: { label: 'Монтаж', variant: 'info' },
  start: { label: 'Старт', variant: 'success' },
  event: { label: 'Идёт', variant: 'success' },
  end: { label: 'Финиш', variant: 'inactive' },
  teardown: { label: 'Демонтаж', variant: 'warning' }
}

// v2: диапазонные сегменты
function toDateOrNull(value) {
  const d = value ? new Date(value) : null
  return d && !Number.isNaN(d.getTime()) ? d : null
}

function isWithin(day, start, end) {
  if (!start || !end) return false
  const ds = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const de = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  const dd = new Date(day.getFullYear(), day.getMonth(), day.getDate())
  return dd >= ds && dd <= de
}

// Упрощённые "сигналы" фаз на день (вместо полос): набор точек setup/event/teardown
const dayPhases = computed(() => {
  const map = new Map()
  const year = monthDate.value.getFullYear()
  const month = monthDate.value.getMonth()
  const monthStart = new Date(year, month, 1)
  const monthEnd = new Date(year, month + 1, 0)

  props.events.forEach((ev) => {
    const setup = toDateOrNull(ev.setup_date)
    const start = toDateOrNull(ev.start_date)
    const end = toDateOrNull(ev.end_date)
    const teardown = toDateOrNull(ev.teardown_date)

    // Для простоты: если нет пары дат, считаем одиночный день как присутствие фазы
    const ranges = []
    if (props.rangeMode === 'event') {
      if (start && end) {
        ranges.push({ from: start, to: end, type: 'event' })
      } else if (start) {
        ranges.push({ from: start, to: start, type: 'event' })
      }
    } else {
      if (setup && start) ranges.push({ from: setup, to: start, type: 'setup' })
      else if (setup) ranges.push({ from: setup, to: setup, type: 'setup' })

      if (start && end) ranges.push({ from: start, to: end, type: 'event' })
      else if (start) ranges.push({ from: start, to: start, type: 'event' })

      if (end && teardown) ranges.push({ from: end, to: teardown, type: 'teardown' })
      else if (teardown) ranges.push({ from: teardown, to: teardown, type: 'teardown' })
    }

    for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
      const key = dayKey(d)
      ranges.forEach((r) => {
        if (isWithin(d, r.from, r.to)) {
          if (!map.has(key)) map.set(key, new Set())
          map.get(key).add(r.type)
        }
      })
    }
  })
  return map
})

// Отображаемые события по дням, включая диапазон проведения мероприятия (start..end),
// чтобы в ячейке был не только индикатор, но и название мероприятия
const dayToEventsDisplay = computed(() => {
  const map = new Map()
  const year = monthDate.value.getFullYear()
  const month = monthDate.value.getMonth()
  const monthStart = new Date(year, month, 1)
  const monthEnd = new Date(year, month + 1, 0)

  props.events.forEach((ev) => {
    const setup = toDateOrNull(ev.setup_date)
    const start = toDateOrNull(ev.start_date)
    const end = toDateOrNull(ev.end_date)
    const teardown = toDateOrNull(ev.teardown_date)

    for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
      const key = dayKey(d)
      const keyStr = key
      const isSetupDay = setup && normalizeDate(ev.setup_date) === keyStr
      const isStartDay = start && normalizeDate(ev.start_date) === keyStr
      const isEndDay = end && normalizeDate(ev.end_date) === keyStr
      const isTeardownDay = teardown && normalizeDate(ev.teardown_date) === keyStr

      let kind = null
      if (isSetupDay) kind = 'setup'
      else if (isStartDay) kind = 'start'
      else if (isEndDay) kind = 'end'
      else if (isWithin(d, start, end)) kind = 'event'
      else if (isTeardownDay) kind = 'teardown'

      if (kind) {
        if (!map.has(key)) map.set(key, [])
        const arr = map.get(key)
        if (!arr.some(e => e.id === ev.id)) {
          arr.push({ ...ev, _kind: kind })
        }
      }
    }
  })

  return map
})

function segmentStyle(type) {
  const colorVar = type === 'setup'
    ? 'var(--color-info)'
    : type === 'event'
      ? 'var(--color-success)'
      : 'var(--color-warning)'
  return { backgroundColor: colorVar }
}

function tooltipContent(ev, kind) {
  const parts = []
  if (ev?.name) parts.push(ev.name)
  const meta = [ev?.location, ev?.organizer].filter(Boolean).join(' • ')
  if (meta) parts.push(meta)
  if (kind && kindMeta[kind]?.label) parts.push(kindMeta[kind].label)
  return parts.join(' — ')
}

function prevMonth() {
  const d = monthDate.value
  const y = d.getFullYear()
  const m = d.getMonth()
  const nd = new Date(y, m - 1, 1)
  monthModel.value = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}`
  emit('update:modelValue', monthModel.value)
}

function nextMonth() {
  const d = monthDate.value
  const y = d.getFullYear()
  const m = d.getMonth()
  const nd = new Date(y, m + 1, 1)
  monthModel.value = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}`
  emit('update:modelValue', monthModel.value)
}

// (mobile preview удален)

// Desktop/Mobile: модал информации по дню (список событий дня)
const showDayPreview = ref(false)
const previewDayKey = ref(null)
const previewDayLabel = computed(() => {
  if (!previewDayKey.value) return ''
  const [y, m, d] = previewDayKey.value.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
})
// Для модала используем тот же источник, что и для ячеек
const dayPreviewEvents = computed(() => dayToEventsDisplay.value.get(previewDayKey.value) || [])

// Клики по событию внутри ячейки теперь не навигируют напрямую —
// мы открываем превью дня, а переход в событие осуществляется из модального окна.

function openDayPreview(day) {
  const key = dayKey(day)
  // Открываем модал даже если событий нет — для единообразия поведения
  previewDayKey.value = key
  showDayPreview.value = true
}
function getKindVariant(kind) {
  switch (kind) {
    case 'setup': return 'info'
    case 'start': return 'success'
    case 'end': return 'info'
    case 'teardown': return 'warning'
    case 'event': return 'success'
    default: return 'info'
  }
}

function getKindLabel(kind) {
  return kindMeta[kind]?.label || 'Событие'
}

function closeDayPreview() {
  showDayPreview.value = false
  previewDayKey.value = null
}

function isDayActive(day) {
  return previewDayKey.value && dayKey(day) === previewDayKey.value
}

// Today highlight
const todayKeyStr = computed(() => {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
})

function isToday(day) {
  return dayKey(day) === todayKeyStr.value
}
</script>

<template>
  <div class="w-full">
    <!-- Header навигации календаря -->
    <div class="flex items-center justify-between mb-3 px-1">
      <button 
        class="text-secondary hover:text-primary px-2 py-1 rounded transition-colors duration-150 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]/30" 
        @click="prevMonth"
      >
        ‹ Пред
      </button>
      <div class="text-primary font-semibold text-center flex-1 px-2">{{ monthLabel }}</div>
      <button 
        class="text-secondary hover:text-primary px-2 py-1 rounded transition-colors duration-150 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]/30" 
        @click="nextMonth"
      >
        След ›
      </button>
    </div>

    <!-- Сетка дней недели -->
    <div class="grid grid-cols-7 gap-1 sm:gap-2 text-xs text-secondary mb-1 sm:mb-2">
      <div>Пн</div>
      <div>Вт</div>
      <div>Ср</div>
      <div>Чт</div>
      <div>Пт</div>
      <div>Сб</div>
      <div>Вс</div>
    </div>

    <!-- Сетка месяца -->
    <div class="grid grid-cols-7 gap-1 sm:gap-2 gap-y-1 sm:gap-y-2">
      <!-- Пустые offset-ячейки -->
      <div v-for="i in startOffset" :key="`o-${i}`" class="aspect-[6/5] md:aspect-[4/3] bg-white border border-gray-200 rounded-lg"></div>

      <!-- Дни -->
      <button
        v-for="d in daysInMonth"
        :key="dayKey(d)"
        type="button"
        class="aspect-[6/5] md:aspect-[4/3] border rounded-lg p-1 sm:p-2 flex flex-col overflow-hidden transition-colors duration-150 ease-out hover:border-[var(--color-secondary)] hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-secondary)]"
        :class="{
          'bg-[var(--color-success)] border-green-600': isToday(d) && !isDayActive(d),
          'bg-[var(--color-success)] border-[var(--color-secondary)]': isToday(d) && isDayActive(d),
          'border-[var(--color-secondary)]': !isToday(d) && isDayActive(d),
          'bg-white border-gray-200': !isToday(d) && !isDayActive(d)
        }"
        @click="openDayPreview(d)"
      >
        <div class="text-xs mb-1" :class="isToday(d) ? 'text-white' : 'text-secondary'">{{ d.getDate() }}</div>

        <!-- Упрощённые индикаторы фаз дня: точки setup/event/teardown -->
        <div v-if="showRanges" class="flex items-center gap-1 mb-1">
          <span v-if="dayPhases.get(dayKey(d))?.has('setup')" class="inline-block w-2 h-2 rounded-full" :style="segmentStyle('setup')" />
          <span v-if="dayPhases.get(dayKey(d))?.has('event')" class="inline-block w-2 h-2 rounded-full" :style="segmentStyle('event')" />
          <span v-if="dayPhases.get(dayKey(d))?.has('teardown')" class="inline-block w-2 h-2 rounded-full" :style="segmentStyle('teardown')" />
        </div>

        <!-- Заполнитель, чтобы список был внизу (только ≥ sm) -->
        <div class="flex-1 hidden sm:block"></div>
        <!-- Список мероприятий дня (внизу ячейки, скрыт на мобильных) -->
        <div class="pt-1 hidden sm:block" :class="isToday(d) ? 'border-t border-white/40' : 'border-t border-gray-100/80'">
          <div class="flex flex-col gap-1 overflow-hidden">
            <template v-if="dayToEventsDisplay.get(dayKey(d))?.length">
              <template v-for="(ev, idx) in dayToEventsDisplay.get(dayKey(d)).slice(0, 3)" :key="ev.id + '-' + idx">
                <div class="w-full text-left text-[11px] flex items-center gap-1 truncate">
                  <StatusBadgeV2 :label="getKindLabel(ev._kind)" :variant="getKindVariant(ev._kind)" size="xs" />
                  <span class="truncate" :class="isToday(d) ? 'text-white' : 'text-primary/90'">{{ ev.name }}</span>
                </div>
              </template>
              <div v-if="dayToEventsDisplay.get(dayKey(d)).length > 3" class="text-[10px]" :class="isToday(d) ? 'text-white/80' : 'text-secondary'">+{{ dayToEventsDisplay.get(dayKey(d)).length - 3 }} ещё</div>
            </template>
          </div>
        </div>
      </button>
    </div>
  </div>
  
  

  <!-- Day Preview Modal (Desktop + Mobile) -->
  <ModalV2
    :model-value="showDayPreview"
    @update:modelValue="val => (showDayPreview = val)"
    :title="previewDayLabel || 'День'"
    :show-close-button="true"
    @close="closeDayPreview"
  >
    <template #default>
      <div v-if="dayPreviewEvents.length === 0" class="text-secondary text-sm">Нет событий</div>
      <div v-else class="space-y-2">
        <div
          v-for="ev in dayPreviewEvents"
          :key="ev.id + '-' + ev._kind"
          class="p-3 rounded-lg border border-gray-200 bg-white flex items-start gap-2"
        >
          <StatusBadgeV2 :variant="getKindVariant(ev._kind === 'start' || ev._kind === 'end' ? 'event' : ev._kind)" :label="getKindLabel(ev._kind)" size="xs" />
          <div class="flex-1 min-w-0">
            <div class="text-primary font-medium truncate">{{ ev.name }}</div>
            <div class="text-xs text-secondary truncate">{{ [ev.location, ev.organizer].filter(Boolean).join(' • ') }}</div>
          </div>
          <ButtonV2 variant="minimal" size="sm" @click="$emit('event-click', ev)">Открыть</ButtonV2>
        </div>
      </div>
    </template>
    <template #actions>
      <div class="flex justify-end gap-2">
        <ButtonV2 variant="ghost" @click="closeDayPreview">Закрыть</ButtonV2>
      </div>
    </template>
  </ModalV2>

</template>

<style scoped>
</style>


