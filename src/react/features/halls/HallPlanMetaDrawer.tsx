import { CalendarDays, CircleAlert, Minus, Plus, Save, X } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useState } from 'react'
import { hallPlanErrorText, type HallPlanInput } from './api'
import { PlanProjectField } from './PlanProjectField'
import type { HallPlan } from './types'
import { AppDatePicker } from '../../components/AppDatePicker'
import { DrawerLayer } from '../../components/DrawerLayer'
import { UnsavedPrompt } from '../../components/UnsavedPrompt'
import { useLanguage } from '../../lib/i18n'
import { useGuardedClose } from '../../lib/useGuardedClose'
import { useModalLayer } from '../../lib/useModalLayer'

// Сколько залов предлагаем по умолчанию и в каких границах. Двенадцать — не
// правило площадки, а предел разумного одним экраном: залов больше добавляются
// по одному кнопкой «+ Зал» в редакторе.
const MIN_HALL_COUNT = 1
const MAX_HALL_COUNT = 12
const DEFAULT_HALL_COUNT = 3

// Шапка плана: название, даты и мероприятие. Один дровер на создание и на правку — разъедься
// они, «Изменить» показывало бы не те поля, которые заполняли при создании.
// Отличие ровно одно: при создании здесь же спрашивается, сколько залов завести
// сразу, а у существующего плана залы уже есть и меняются в редакторе.
export function HallPlanMetaDrawer({ plan, onClose, onSubmit }: {
  plan?: HallPlan
  onClose: () => void
  onSubmit: (input: HallPlanInput, hallCount: number) => Promise<void>
}) {
  const { tr, locale } = useLanguage()
  const isEditing = Boolean(plan)

  // Снимок на момент открытия, а не живой plan: план в редакторе может
  // обновиться, пока дровер открыт, и «несохранённое» не должно от этого
  // появляться или исчезать.
  const [initialDraft] = useState<HallPlanInput>(() => ({
    name: plan?.name ?? '',
    eventFrom: plan?.event_from ?? '',
    eventTo: plan?.event_to ?? '',
    projectId: plan?.project_id ?? null,
  }))
  const [draft, setDraft] = useState<HallPlanInput>(initialDraft)
  const [hallCount, setHallCount] = useState(DEFAULT_HALL_COUNT)
  const [isSaving, setIsSaving] = useState(false)
  // Текст отказа базы. Строка, а не флаг: она уже собрана hallPlanErrorText и
  // живёт до следующей попытки — язык за это время не сменится.
  const [errorText, setErrorText] = useState('')

  const patch = (fields: Partial<HallPlanInput>) => setDraft((current) => ({ ...current, ...fields }))

  // Клиентская проверка здесь — подсказка, а не защита: даты держит
  // hall_plans_dates_check, и кнопку она не запирает. Запирает только пустое
  // название: отправлять заведомо мёртвый запрос незачем.
  const nameEmpty = !draft.name.trim()
  const rangeError = Boolean(draft.eventFrom && draft.eventTo && draft.eventTo < draft.eventFrom)
  const endWithoutStart = Boolean(draft.eventTo && !draft.eventFrom)

  const isDirty = draft.name !== initialDraft.name
    || draft.eventFrom !== initialDraft.eventFrom
    || draft.eventTo !== initialDraft.eventTo
    || draft.projectId !== initialDraft.projectId
    || (!isEditing && hallCount !== DEFAULT_HALL_COUNT)
  // Пока идёт сохранение, защита снята — и после успеха тоже (isSaving остаётся
  // поднятым, см. save): HallPlansPage.createPlan уводит в редактор нового плана,
  // и этот переход — сам дровер, а не потеря ввода.
  const { requestClose, isPrompting, confirmClose, keepEditing } = useGuardedClose(isDirty && !isSaving, onClose)
  useModalLayer(requestClose)

  async function save() {
    if (nameEmpty || isSaving) return
    setIsSaving(true)
    setErrorText('')
    try {
      await onSubmit(draft, hallCount)
    } catch (error) {
      setErrorText(hallPlanErrorText(error, tr))
      setIsSaving(false)
    }
    // Успех оставляет isSaving поднятым намеренно: страница уводит в редактор
    // или закрывает дровер, и «Создать план» не должен ожить на кадр перед этим.
  }

  return (
    <DrawerLayer
      ariaLabel={isEditing ? tr('Изменить план', 'Rejani o‘zgartirish') : tr('Новый план залов', 'Yangi zallar rejasi')}
      onRequestClose={requestClose}
      className="drawer"
    >
      <div className="drawer__header">
        <div>
          <p className="eyebrow">{tr('Распределение по залам', 'Zallar bo‘yicha taqsimlash')}</p>
          <h2>{isEditing ? tr('Изменить план', 'Rejani o‘zgartirish') : tr('Новый план', 'Yangi reja')}</h2>
        </div>
        <div className="drawer__header-actions">
          <button className="icon-button icon-button--bordered" onClick={requestClose} aria-label={tr('Закрыть', 'Yopish')}><X size={19} /></button>
        </div>
      </div>

      <AnimatePresence>
        {isPrompting && (
          <UnsavedPrompt
            key="unsaved"
            message={tr('Есть несохранённые изменения.', 'Saqlanmagan o‘zgarishlar bor.')}
            stayLabel={tr('Продолжить правку', 'Tahrirni davom ettirish')}
            leaveLabel={tr('Закрыть без сохранения', 'Saqlamasdan yopish')}
            onStay={keepEditing}
            onLeave={confirmClose}
          />
        )}
      </AnimatePresence>

      <label className="field">
        <span>{tr('Название', 'Nomi')} *</span>
        <input
          autoFocus
          value={draft.name}
          onChange={(event) => patch({ name: event.target.value })}
          placeholder={tr('Например, Форум в Hyatt', 'Masalan, Hyatt forumi')}
        />
      </label>

      <div className="field">
        <span><CalendarDays size={13} /> {tr('Дата начала', 'Boshlanish sanasi')}</span>
        <AppDatePicker
          value={draft.eventFrom}
          onChange={(next) => patch({ eventFrom: next })}
          locale={locale}
          placeholder={tr('Не указана', 'Ko‘rsatilmagan')}
          ariaLabel={tr('Дата начала', 'Boshlanish sanasi')}
          todayLabel={tr('Сегодня', 'Bugun')}
          clearLabel={tr('Очистить', 'Tozalash')}
          previousMonthLabel={tr('Предыдущий месяц', 'Oldingi oy')}
          nextMonthLabel={tr('Следующий месяц', 'Keyingi oy')}
        />
      </div>

      <div className="field">
        <span>{tr('Дата окончания', 'Tugash sanasi')} <small>{tr('Один день — оставьте пустым', 'Bir kun bo‘lsa — bo‘sh qoldiring')}</small></span>
        <AppDatePicker
          value={draft.eventTo}
          onChange={(next) => patch({ eventTo: next })}
          locale={locale}
          placeholder={tr('Не указана', 'Ko‘rsatilmagan')}
          ariaLabel={tr('Дата окончания', 'Tugash sanasi')}
          todayLabel={tr('Сегодня', 'Bugun')}
          clearLabel={tr('Очистить', 'Tozalash')}
          previousMonthLabel={tr('Предыдущий месяц', 'Oldingi oy')}
          nextMonthLabel={tr('Следующий месяц', 'Keyingi oy')}
        />
        {rangeError && <small className="field-hint field-hint--error">{tr('Окончание раньше начала', 'Tugash sanasi boshlanishdan oldin')}</small>}
        {endWithoutStart && <small className="field-hint field-hint--error">{tr('Сначала укажите дату начала', 'Avval boshlanish sanasini ko‘rsating')}</small>}
      </div>

      <PlanProjectField value={draft.projectId} onChange={(projectId) => patch({ projectId })} disabled={isSaving} />

      {!isEditing && (
        <div className="field">
          <span>{tr('Сколько залов', 'Nechta zal')} <small>{tr('Потом можно добавить ещё', 'Keyin yana qo‘shish mumkin')}</small></span>
          <div className="hall-count-stepper">
            <button
              type="button"
              onClick={() => setHallCount((current) => Math.max(MIN_HALL_COUNT, current - 1))}
              disabled={hallCount <= MIN_HALL_COUNT}
              aria-label={tr('Меньше залов', 'Kamroq zal')}
            >
              <Minus size={16} />
            </button>
            {/* Число только показывается: ввод с клавиатуры пустил бы в поле
                «0» и «100», а границы у количества залов жёсткие. */}
            <output aria-live="polite">{hallCount}</output>
            <button
              type="button"
              onClick={() => setHallCount((current) => Math.min(MAX_HALL_COUNT, current + 1))}
              disabled={hallCount >= MAX_HALL_COUNT}
              aria-label={tr('Больше залов', 'Ko‘proq zal')}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      )}


      {errorText && <p className="form-error"><CircleAlert size={15} /> {errorText}</p>}

      <button className="button button--primary button--wide" disabled={nameEmpty || isSaving} onClick={() => void save()}>
        {isEditing ? <><Save size={17} /> {tr('Сохранить', 'Saqlash')}</> : <><Plus size={17} /> {tr('Создать план', 'Reja yaratish')}</>}
      </button>
    </DrawerLayer>
  )
}
