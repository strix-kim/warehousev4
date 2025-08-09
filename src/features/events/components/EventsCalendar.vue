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

// Mobile detection
const isMobile = ref(false)
function updateIsMobile() {
  isMobile.value = window.innerWidth < 640
}
if (typeof window !== 'undefined') {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
}

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

// Индексация событий по дню
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

// Mobile preview modal state
const showMobilePreview = ref(false)
const mobileEvent = ref(null)

function handleEventClick(ev) {
  if (isMobile.value) {
    mobileEvent.value = ev
    showMobilePreview.value = true
  } else {
    emit('event-click', ev)
  }
}

function closeMobilePreview() {
  showMobilePreview.value = false
  mobileEvent.value = null
}

function openEventFromPreview() {
  if (mobileEvent.value) emit('event-click', mobileEvent.value)
  closeMobilePreview()
}
</script>

<template>
  <div class="w-full">
    <!-- Header навигации календаря -->
    <div class="flex items-center justify-between mb-3">
      <button class="text-secondary hover:text-primary" @click="prevMonth">‹ Пред</button>
      <div class="text-primary font-semibold">{{ monthLabel }}</div>
      <button class="text-secondary hover:text-primary" @click="nextMonth">След ›</button>
    </div>

    <!-- Сетка дней недели -->
    <div class="grid grid-cols-7 gap-2 text-xs text-secondary mb-2">
      <div>Пн</div>
      <div>Вт</div>
      <div>Ср</div>
      <div>Чт</div>
      <div>Пт</div>
      <div>Сб</div>
      <div>Вс</div>
    </div>

    <!-- Сетка месяца -->
    <div class="grid grid-cols-7 gap-2">
      <!-- Пустые offset-ячейки -->
      <div v-for="i in startOffset" :key="`o-${i}`" class="h-24 bg-white border border-gray-200 rounded-lg"></div>

      <!-- Дни -->
      <div v-for="d in daysInMonth" :key="dayKey(d)" class="h-24 bg-white border border-gray-200 rounded-lg p-2 flex flex-col overflow-hidden">
        <div class="text-xs text-secondary mb-1">{{ d.getDate() }}</div>

        <!-- Упрощённые индикаторы фаз дня: точки setup/event/teardown -->
        <div v-if="showRanges" class="flex items-center gap-1 mb-1">
          <span v-if="dayPhases.get(dayKey(d))?.has('setup')" class="inline-block w-2 h-2 rounded-full" :style="segmentStyle('setup')" />
          <span v-if="dayPhases.get(dayKey(d))?.has('event')" class="inline-block w-2 h-2 rounded-full" :style="segmentStyle('event')" />
          <span v-if="dayPhases.get(dayKey(d))?.has('teardown')" class="inline-block w-2 h-2 rounded-full" :style="segmentStyle('teardown')" />
        </div>

        <!-- Точечные маркеры дней -->
        <div class="flex flex-col gap-1 overflow-hidden">
          <template v-if="dayToEvents.get(dayKey(d))?.length">
            <template v-for="(ev, idx) in dayToEvents.get(dayKey(d)).slice(0, 3)" :key="ev.id + '-' + idx">
              <button type="button" class="w-full text-left text-xs flex items-center gap-1 truncate" :title="tooltipContent(ev, ev._kind)" @click="handleEventClick(ev)">
                <span class="inline-block w-2 h-2 rounded-full" :style="segmentStyle(ev._kind === 'start' || ev._kind === 'end' ? 'event' : ev._kind)" />
                <span class="truncate text-primary">{{ ev.name }}</span>
              </button>
            </template>
            <div v-if="dayToEvents.get(dayKey(d)).length > 3" class="text-[10px] text-secondary">+{{ dayToEvents.get(dayKey(d)).length - 3 }} ещё</div>
          </template>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Mobile Preview Modal -->
  <ModalV2
    v-if="isMobile"
    :model-value="showMobilePreview"
    @update:modelValue="val => (showMobilePreview = val)"
    :title="mobileEvent?.name || 'Мероприятие'"
    :show-close-button="true"
    @close="closeMobilePreview"
  >
    <template #default>
      <div class="space-y-3 text-sm">
        <div v-if="mobileEvent?.organizer" class="flex justify-between">
          <span class="text-secondary">Организатор</span>
          <span class="text-primary">{{ mobileEvent.organizer }}</span>
        </div>
        <div v-if="mobileEvent?.location" class="flex justify-between">
          <span class="text-secondary">Локация</span>
          <span class="text-primary">{{ mobileEvent.location }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-secondary">Даты</span>
          <span class="text-primary">{{ mobileEvent?.start_date || '—' }} → {{ mobileEvent?.end_date || '—' }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-secondary">Монтаж</span>
          <span class="text-primary">{{ mobileEvent?.setup_date || '—' }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-secondary">Демонтаж</span>
          <span class="text-primary">{{ mobileEvent?.teardown_date || '—' }}</span>
        </div>
      </div>
    </template>
    <template #actions>
      <div class="flex justify-end gap-2">
        <ButtonV2 variant="ghost" @click="closeMobilePreview">Закрыть</ButtonV2>
        <ButtonV2 variant="primary" @click="openEventFromPreview">Открыть</ButtonV2>
      </div>
    </template>
  </ModalV2>

</template>

<style scoped>
</style>


