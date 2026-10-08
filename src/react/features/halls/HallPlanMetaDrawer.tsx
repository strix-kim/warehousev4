import { CalendarDays, CircleAlert, Minus, Plus, Save, X } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useEffect, useState } from 'react'
import { hallPlanErrorText, type HallPlanInput } from './api'
import type { HallPlan } from './types'
import { AppDatePicker } from '../../components/AppDatePicker'
import { DrawerLayer } from '../../components/DrawerLayer'
import { ProjectChoiceField, useProjectChoice } from '../../components/ProjectChoiceField'
import { UnsavedPrompt } from '../../components/UnsavedPrompt'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'
import { useGuardedClose } from '../../lib/useGuardedClose'
import { useModalLayer } from '../../lib/useModalLayer'
import { projectErrorText } from '../projects/api'

// Сколько залов предлагаем по умолчанию и в каких границах. Двенадцать — не
// правило площадки, а предел разумного одним экраном: залов больше добавляются
// по одному кнопкой «+ Зал» в редакторе.
const MIN_HALL_COUNT = 1
const MAX_HALL_COUNT = 12
const DEFAULT_HALL_COUNT = 3

// Шапка плана: мероприятие, название и даты. Один дровер на создание и на правку — разъедься
// они, «Изменить» показывало бы не те поля, которые заполняли при создании.
// Отличие ровно одно: при создании здесь же спрашивается, сколько залов завести
// сразу, а у существующего плана залы уже есть и меняются в редакторе.
export function HallPlanMetaDrawer({ plan, initialProjectId, onClose, onSubmit }: {
  plan?: HallPlan
  // Мероприятие, с которым пришли создавать план (ссылка из мира). Только для
  // создания: у существующего плана привязка своя.
  initialProjectId?: string
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
    projectId: plan?.project_id ?? initialProjectId ?? null,
  }))
  // Свои поля плана. Мероприятие держит choice — тот же выбор «существующее /
  // новое», что в составе сотрудников и в списке машин, плюс «Без мероприятия».
  const [draft, setDraft] = useState({ name: initialDraft.name, eventFrom: initialDraft.eventFrom, eventTo: initialDraft.eventTo })
  const choice = useProjectChoice({
    allowNone: true,
    initialProjectId: initialDraft.projectId,
    // Новый план по умолчанию ждёт мероприятие; у существующего без привязки
    // честное начальное положение — «Без мероприятия».
    initialMode: isEditing && !initialDraft.projectId ? 'none' : 'existing',
    report: { route: '/halls', source: 'plan-projects' },
  })
  // Привязка, от которой считается «несохранённое». Отдельно от initialDraft
  // ради предвыбора из ссылки: снятый недоступный id (эффект ниже) — не правка
  // человека.
  const [baseProjectId, setBaseProjectId] = useState(initialDraft.projectId)
  // Предвыбор из адреса мог оказаться мусором, чужим или удалённым мероприятием.
  // Реестр загрузился и такого id в нём нет — выбор снимается: «существующее»
  // без значения честнее пункта «Мероприятие недоступно» в форме СОЗДАНИЯ.
  // Подсказка, а не защита: привязку держат внешний ключ и RLS hall_plans.
  // При правке не срабатывает — там недоступная привязка остаётся как есть.
  useEffect(() => {
    if (isEditing || !initialProjectId || choice.loadState !== 'ready') return
    if (choice.projectId !== initialProjectId) return
    if (choice.projects.some((project) => project.id === initialProjectId)) return
    choice.setProjectId('')
    setBaseProjectId(null)
    // Сверка один раз на каждую загрузку реестра; остальное — снимок открытия.
  }, [choice.loadState])

  // Что человек уже набрал руками. При создании нетронутое повторяет
  // мероприятие; при правке «тронуто» всё с самого начала: у плана свои
  // реквизиты, и смена мероприятия их не трогает (план event-s53, развилка 9).
  // Период — одной парой: начало из мероприятия при своём окончании дало бы
  // перевёрнутый диапазон.
  const [nameTouched, setNameTouched] = useState(isEditing)
  const [periodTouched, setPeriodTouched] = useState(isEditing)
  const [hallCount, setHallCount] = useState(DEFAULT_HALL_COUNT)
  const [isSaving, setIsSaving] = useState(false)
  // Текст отказа базы. Строка, а не флаг: она уже собрана hallPlanErrorText и
  // живёт до следующей попытки — язык за это время не сменится.
  const [errorText, setErrorText] = useState('')

  // Откуда подставлять нетронутое: выбранное мероприятие либо черновик нового —
  // второй раз те же название и даты никто не набирает. Вычисляется, а не
  // копируется эффектом: копия отстала бы от формы нового мероприятия на кадр.
  const source = choice.mode === 'new'
    ? { name: choice.draft.name, eventFrom: choice.draft.dateFrom, eventTo: choice.draft.dateTo }
    : choice.selected
      ? { name: choice.selected.name, eventFrom: choice.selected.date_from ?? '', eventTo: choice.selected.date_to ?? '' }
      : null
  const name = nameTouched || !source ? draft.name : source.name
  const eventFrom = periodTouched || !source ? draft.eventFrom : source.eventFrom
  const eventTo = periodTouched || !source ? draft.eventTo : source.eventTo

  function editName(next: string) {
    setNameTouched(true)
    setDraft((current) => ({ ...current, name: next }))
  }

  // Первая правка даты забирает в свои поля ОБЕ: вторая до этого момента
  // приходила из мероприятия и иначе пропала бы с экрана.
  function editPeriod(fields: { eventFrom?: string; eventTo?: string }) {
    setPeriodTouched(true)
    setDraft((current) => ({ ...current, eventFrom, eventTo, ...fields }))
  }

  // Привязка, которая уедет в базу. У «существующего» берём id, а не найденную
  // строку: привязанное мероприятие при отказавшем реестре остаётся привязанным.
  const linkedProjectId = choice.mode === 'existing' ? choice.projectId || null : null

  // Клиентская проверка здесь — подсказка, а не защита: даты держит
  // hall_plans_dates_check, и кнопку она не запирает. Запирает только заведомо
  // мёртвый запрос: пустое название либо «существующее» без выбора.
  const nameEmpty = !name.trim()
  const rangeError = Boolean(eventFrom && eventTo && eventTo < eventFrom)
  const endWithoutStart = Boolean(eventTo && !eventFrom)
  const projectMissing = choice.mode === 'existing' ? !linkedProjectId : !choice.isReady
  const canSave = !nameEmpty && !projectMissing

  // Название и период считаются только тронутыми: нетронутое подставлено из
  // мероприятия, и при предвыборе из ссылки «несохранённое» горело бы сразу
  // после открытия. Сама смена мероприятия ловится строкой привязки ниже; при
  // правке «тронуто» всё с начала, так что там сравнение прежнее.
  const isDirty = (nameTouched && name !== initialDraft.name)
    || (periodTouched && (eventFrom !== initialDraft.eventFrom || eventTo !== initialDraft.eventTo))
    || choice.isDirty
    || (choice.mode !== 'new' && linkedProjectId !== baseProjectId)
    || (!isEditing && hallCount !== DEFAULT_HALL_COUNT)
  // Пока идёт сохранение, защита снята — и после успеха тоже (isSaving остаётся
  // поднятым, см. save): HallPlansPage.createPlan уводит в редактор нового плана,
  // и этот переход — сам дровер, а не потеря ввода.
  const { requestClose, isPrompting, confirmClose, keepEditing } = useGuardedClose(isDirty && !isSaving, onClose)
  useModalLayer(requestClose)

  async function save() {
    if (!canSave || isSaving) return
    setIsSaving(true)
    setErrorText('')
    // Снимок полей ДО создания мероприятия: ensure очищает форму нового, и
    // нетронутые поля плана на этот кадр остались бы без источника.
    const fields = { name, eventFrom, eventTo }

    // Новое мероприятие создаётся первым и один раз (useProjectChoice.ensure):
    // откажи после него запись плана — повтор возьмёт уже созданное.
    let projectId = linkedProjectId
    try {
      const project = await choice.ensure()
      if (choice.mode === 'new') projectId = project?.id ?? null
    } catch (error) {
      reportAppError(error, { scope: 'loader', route: '/halls', detail: { source: 'plan-project' } })
      setErrorText(projectErrorText(error, tr))
      setIsSaving(false)
      return
    }

    try {
      await onSubmit({ ...fields, projectId }, hallCount)
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
          {/* Фокус при создании — на крестике, как в остальных дроверах с выбором
              мероприятия: название теперь не первое поле, и автофокус на нём
              прокручивал бы дровер мимо выбора. */}
          <button autoFocus={!isEditing} className="icon-button icon-button--bordered" onClick={requestClose} aria-label={tr('Закрыть', 'Yopish')}><X size={19} /></button>
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

      {/* Мероприятие — первым: от него подставляются название и период плана. */}
      <ProjectChoiceField choice={choice} groupLabel={tr('Мероприятие плана', 'Reja tadbiri')} disabled={isSaving}>
        {choice.mode !== 'none' && (
          <div className="field">
            <span>{tr('План залов', 'Zallar rejasi')}</span>
            <small className="field-hint">
              {isEditing
                ? tr('План появится на странице мероприятия. Название и даты плана остаются своими.', 'Reja tadbir sahifasida ko‘rinadi. Rejaning nomi va sanalari o‘zicha qoladi.')
                : tr('План появится на странице мероприятия. Название и даты подставляются из него — их можно поменять.', 'Reja tadbir sahifasida ko‘rinadi. Nom va sanalar tadbirdan olinadi — ularni o‘zgartirish mumkin.')}
            </small>
          </div>
        )}

        <label className="field">
          <span>{tr('Название плана', 'Reja nomi')} *</span>
          <input
            autoFocus={isEditing}
            value={name}
            onChange={(event) => editName(event.target.value)}
            placeholder={tr('Например, Форум в Hyatt', 'Masalan, Hyatt forumi')}
          />
        </label>

        <div className="field">
          <span><CalendarDays size={13} /> {tr('Дата начала', 'Boshlanish sanasi')}</span>
          <AppDatePicker
            value={eventFrom}
            onChange={(next) => editPeriod({ eventFrom: next })}
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
            value={eventTo}
            onChange={(next) => editPeriod({ eventTo: next })}
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
      </ProjectChoiceField>

      {errorText && <p className="form-error"><CircleAlert size={15} /> {errorText}</p>}

      <button className="button button--primary button--wide" disabled={!canSave || isSaving} onClick={() => void save()}>
        {isEditing ? <><Save size={17} /> {tr('Сохранить', 'Saqlash')}</> : <><Plus size={17} /> {tr('Создать план', 'Reja yaratish')}</>}
      </button>
      {!nameEmpty && projectMissing && (
        <small className="field-hint">
          {choice.mode === 'existing'
            ? tr('Выберите мероприятие или переключите на «Без мероприятия».', 'Tadbirni tanlang yoki «Tadbirsiz»ga o‘tkazing.')
            : tr('Укажите название нового мероприятия.', 'Yangi tadbir nomini kiriting.')}
        </small>
      )}
    </DrawerLayer>
  )
}
