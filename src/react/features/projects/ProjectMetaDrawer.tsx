import { CalendarDays, CircleAlert, Plus, Save, X } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useState } from 'react'
import { projectErrorText } from './api'
import type { ProjectInput, ProjectWithVenue } from './types'
import { AppDatePicker } from '../../components/AppDatePicker'
import { DrawerLayer } from '../../components/DrawerLayer'
import { UnsavedPrompt } from '../../components/UnsavedPrompt'
import { VenueField } from '../../components/VenueField'
import { useLanguage } from '../../lib/i18n'
import { useGuardedClose } from '../../lib/useGuardedClose'
import { useModalLayer } from '../../lib/useModalLayer'

// Реквизиты мероприятия: название, заказчик, период, площадка, описание. Один
// дровер на создание и на правку — разъедься они, «Изменить» показывало бы не те
// поля, которые заполняли при создании (тот же довод, что у HallPlanMetaDrawer).
export function ProjectMetaDrawer({ project, onClose, onSubmit }: {
  project?: ProjectWithVenue
  onClose: () => void
  onSubmit: (input: ProjectInput) => Promise<void>
}) {
  const { tr, locale } = useLanguage()
  const isEditing = Boolean(project)

  // Снимок на момент открытия, а не живой project: страница может обновить
  // мероприятие, пока дровер открыт, и «несохранённое» не должно от этого
  // появляться или исчезать.
  const [initialDraft] = useState<ProjectInput>(() => ({
    name: project?.name ?? '',
    clientName: project?.client_name ?? '',
    dateFrom: project?.date_from ?? '',
    dateTo: project?.date_to ?? '',
    venueId: project?.venue_id ?? null,
    description: project?.description ?? '',
  }))
  const [draft, setDraft] = useState<ProjectInput>(initialDraft)
  const [isSaving, setIsSaving] = useState(false)
  // Текст отказа базы. Строка, а не флаг: она уже собрана projectErrorText и
  // живёт до следующей попытки — язык за это время не сменится.
  const [errorText, setErrorText] = useState('')

  const patch = (fields: Partial<ProjectInput>) => setDraft((current) => ({ ...current, ...fields }))

  // Клиентская проверка здесь — подсказка, а не защита: период держит
  // projects_dates_check, дубль — projects_identity_key, и кнопку они не
  // запирают. Запирает только пустое название: отправлять заведомо мёртвый
  // запрос незачем.
  const nameEmpty = !draft.name.trim()
  const rangeError = Boolean(draft.dateFrom && draft.dateTo && draft.dateTo < draft.dateFrom)
  const endWithoutStart = Boolean(draft.dateTo && !draft.dateFrom)

  const isDirty = (Object.keys(initialDraft) as Array<keyof ProjectInput>).some((key) => draft[key] !== initialDraft[key])
  // Пока идёт сохранение, защита снята — и после успеха тоже (isSaving остаётся
  // поднятым, см. save): страница уводит на новое мероприятие либо закрывает
  // дровер, и этот уход — не потеря ввода.
  const { requestClose, isPrompting, confirmClose, keepEditing } = useGuardedClose(isDirty && !isSaving, onClose)
  useModalLayer(requestClose)

  async function save() {
    if (nameEmpty || isSaving) return
    setIsSaving(true)
    setErrorText('')
    try {
      await onSubmit(draft)
    } catch (error) {
      setErrorText(projectErrorText(error, tr))
      setIsSaving(false)
    }
    // Успех оставляет isSaving поднятым намеренно: кнопка не должна ожить на
    // кадр перед уходом дровера.
  }

  const datePickerLabels = {
    locale,
    placeholder: tr('Не указана', 'Ko‘rsatilmagan'),
    todayLabel: tr('Сегодня', 'Bugun'),
    clearLabel: tr('Очистить', 'Tozalash'),
    previousMonthLabel: tr('Предыдущий месяц', 'Oldingi oy'),
    nextMonthLabel: tr('Следующий месяц', 'Keyingi oy'),
  }

  return (
    <DrawerLayer
      ariaLabel={isEditing ? tr('Изменить мероприятие', 'Tadbirni o‘zgartirish') : tr('Новое мероприятие', 'Yangi tadbir')}
      onRequestClose={requestClose}
      className="drawer project-drawer"
    >
      <div className="drawer__header">
        <div>
          <p className="eyebrow">{tr('Мероприятие', 'Tadbir')}</p>
          <h2>{isEditing ? tr('Изменить реквизиты', 'Rekvizitlarni o‘zgartirish') : tr('Новое мероприятие', 'Yangi tadbir')}</h2>
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

      {/* Реквизиты общие: их же показывают списки, состав и планы залов этого
          мероприятия. При правке говорим об этом словами — иначе смена
          заказчика «здесь» неожиданно меняет шапку чужого документа. */}
      {isEditing && (
        <p className="project-drawer__note">{tr('Реквизиты общие: они изменятся в списках оборудования, составе и документах этого мероприятия.', 'Rekvizitlar umumiy: ular ushbu tadbirning uskunalar ro‘yxatlari, tarkibi va hujjatlarida ham o‘zgaradi.')}</p>
      )}

      <label className="field">
        <span>{tr('Название', 'Nomi')} *</span>
        <input
          autoFocus
          value={draft.name}
          onChange={(event) => patch({ name: event.target.value })}
          placeholder={tr('Например, Форум в Hyatt', 'Masalan, Hyatt forumi')}
        />
      </label>

      <label className="field">
        <span>{tr('Заказчик', 'Buyurtmachi')}</span>
        <input
          value={draft.clientName}
          onChange={(event) => patch({ clientName: event.target.value })}
          placeholder={tr('Компания или человек', 'Kompaniya yoki shaxs')}
        />
      </label>

      <div className="field">
        <span><CalendarDays size={13} /> {tr('Дата начала', 'Boshlanish sanasi')}</span>
        <AppDatePicker
          value={draft.dateFrom}
          onChange={(next) => patch({ dateFrom: next })}
          ariaLabel={tr('Дата начала', 'Boshlanish sanasi')}
          {...datePickerLabels}
        />
      </div>

      <div className="field">
        <span>{tr('Дата окончания', 'Tugash sanasi')} <small>{tr('Один день — оставьте пустым', 'Bir kun bo‘lsa — bo‘sh qoldiring')}</small></span>
        <AppDatePicker
          value={draft.dateTo}
          onChange={(next) => patch({ dateTo: next })}
          ariaLabel={tr('Дата окончания', 'Tugash sanasi')}
          {...datePickerLabels}
        />
        {rangeError && <small className="field-hint field-hint--error">{tr('Окончание раньше начала', 'Tugash sanasi boshlanishdan oldin')}</small>}
        {endWithoutStart && <small className="field-hint field-hint--error">{tr('Сначала укажите дату начала', 'Avval boshlanish sanasini ko‘rsating')}</small>}
      </div>

      <VenueField value={draft.venueId} onChange={(venueId) => patch({ venueId })} disabled={isSaving} />

      <label className="field">
        <span>{tr('Описание', 'Tavsif')}</span>
        <textarea
          rows={3}
          value={draft.description}
          onChange={(event) => patch({ description: event.target.value })}
          placeholder={tr('Что важно знать о мероприятии', 'Tadbir haqida nimani bilish muhim')}
        />
      </label>

      {errorText && <p className="form-error"><CircleAlert size={15} /> {errorText}</p>}

      <button className="button button--primary button--wide" disabled={nameEmpty || isSaving} onClick={() => void save()}>
        {isEditing ? <><Save size={17} /> {tr('Сохранить', 'Saqlash')}</> : <><Plus size={17} /> {tr('Создать мероприятие', 'Tadbir yaratish')}</>}
      </button>
    </DrawerLayer>
  )
}
