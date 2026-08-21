import { CalendarDays, ChevronDown } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'
import { AppDatePicker } from '../../components/AppDatePicker'
import { formatEventDate, parseDateValue } from '../../lib/date'
import { useLanguage } from '../../lib/i18n'

// Реквизиты, без которых не собирается документ на согласование. Проверка
// клиентская и это UX: документ формируется здесь же, в браузере, пары в базе
// у неё быть не может.
export type RequisiteField = 'name' | 'clientName' | 'venue'

export type ListMetaField = RequisiteField | 'description' | 'eventDate'

export type ListMetaValues = Record<ListMetaField, string>

// Панель реквизитов документа: свёрнута в полосу «Название · дата · заказчик ·
// площадка · Реквизиты ⌄», по нажатию раскрывается в сетку полей. Реквизиты не
// нужны, чтобы собрать список, — они нужны документу на согласование, поэтому
// по умолчанию не занимают первый экран. Состояние значений живёт на странице
// (его читают сохранение, экспорт и автосейв), раскрытие — тоже: страница
// раскрывает панель сама, когда экспорт на согласование упёрся в пустое поле.
export function ListEditorMeta({ panelRef, values, requisiteErrors, open, onToggle, onChange }: {
  panelRef: RefObject<HTMLElement | null>
  values: ListMetaValues
  requisiteErrors: Set<RequisiteField>
  open: boolean
  onToggle: () => void
  onChange: (field: ListMetaField, value: string) => void
}) {
  const { tr, locale } = useLanguage()
  const eventDate = parseDateValue(values.eventDate)
  const dateLabel = eventDate ? formatEventDate(eventDate, locale) : tr('дата не выбрана', 'sana tanlanmagan')
  const empty = (text: ReactNode) => <span className="quick-list-strip__empty">{text}</span>
  const requiredHint = <small className="field-hint field-hint--error">{tr('Обязательно для согласования', 'Kelishuv uchun majburiy')}</small>
  // Незаполненные реквизиты обязаны быть видны и на СВЁРНУТОЙ полосе: поля с
  // подсветкой размонтированы, и без этого модификатора требование, на которое
  // указал экспорт, исчезало бы с экрана, не будучи выполненным.
  const invalid = requisiteErrors.size > 0

  return (
    <section ref={panelRef} className={`quick-list-meta data-panel ${open ? 'quick-list-meta--open' : ''} ${invalid ? 'quick-list-meta--invalid' : ''}`}>
      {/* aria-controls не ставим: поля существуют только в раскрытом состоянии,
          ссылка на отсутствующий id хуже, чем её отсутствие. */}
      <button className="quick-list-strip" type="button" onClick={onToggle} aria-expanded={open}>
        <span className="quick-list-strip__summary">
          <strong>{values.name.trim() || empty(tr('Без названия — подставится дата', 'Nomsiz — sana qo‘yiladi'))}</strong>
          <small>
            <span>{dateLabel}</span>
            <span>{values.clientName.trim() || empty(tr('заказчик не указан', 'buyurtmachi ko‘rsatilmagan'))}</span>
            <span>{values.venue.trim() || empty(tr('площадка не указана', 'maydon ko‘rsatilmagan'))}</span>
          </small>
        </span>
        <span className="quick-list-strip__toggle">
          {invalid ? tr('Заполнить', 'To‘ldirish') : tr('Реквизиты', 'Rekvizitlar')} <ChevronDown size={16} />
        </span>
      </button>

      {open && (
        <div className="quick-list-meta__fields">
          <label className="field quick-list-meta__name">
            <span>{tr('Проект или мероприятие', 'Loyiha yoki tadbir')} <small>{tr('необязательно: подставится дата', 'ixtiyoriy: sana qo‘yiladi')}</small></span>
            <input
              id="quick-list-name"
              className={requisiteErrors.has('name') ? 'input-error' : ''}
              value={values.name}
              onChange={(event) => onChange('name', event.target.value)}
              placeholder={tr('Например, Форум в Hyatt', 'Masalan, Hyatt forumi')}
            />
            {requisiteErrors.has('name') && requiredHint}
          </label>
          <div className="field">
            <span><CalendarDays size={13} /> {tr('Дата', 'Sana')} <small>{tr('сегодня по умолчанию', 'standart — bugun')}</small></span>
            <AppDatePicker
              value={values.eventDate}
              onChange={(value) => onChange('eventDate', value)}
              locale={locale}
              placeholder={tr('Выберите дату', 'Sanani tanlang')}
              ariaLabel={tr('Дата мероприятия', 'Tadbir sanasi')}
              todayLabel={tr('Сегодня', 'Bugun')}
              clearLabel={tr('Очистить', 'Tozalash')}
              previousMonthLabel={tr('Предыдущий месяц', 'Oldingi oy')}
              nextMonthLabel={tr('Следующий месяц', 'Keyingi oy')}
            />
          </div>
          <label className="field quick-list-meta__client">
            <span>{tr('Заказчик / организатор', 'Buyurtmachi / tashkilotchi')} <small>{tr('нужно для документа на согласование', 'kelishuv hujjati uchun kerak')}</small></span>
            <input
              id="quick-list-clientName"
              className={requisiteErrors.has('clientName') ? 'input-error' : ''}
              value={values.clientName}
              onChange={(event) => onChange('clientName', event.target.value)}
              placeholder={tr('Например, ARGO Media', 'Masalan, ARGO Media')}
            />
            {requisiteErrors.has('clientName') && requiredHint}
          </label>
          <label className="field quick-list-meta__venue">
            <span>{tr('Площадка / локация', 'Maydon / joylashuv')} <small>{tr('нужно для документа на согласование', 'kelishuv hujjati uchun kerak')}</small></span>
            <input
              id="quick-list-venue"
              className={requisiteErrors.has('venue') ? 'input-error' : ''}
              value={values.venue}
              onChange={(event) => onChange('venue', event.target.value)}
              placeholder={tr('Например, Hyatt Regency', 'Masalan, Hyatt Regency')}
            />
            {requisiteErrors.has('venue') && requiredHint}
          </label>
          <label className="field quick-list-meta__notes">
            <span>{tr('Комментарий к документу', 'Hujjatga izoh')}</span>
            <input value={values.description} onChange={(event) => onChange('description', event.target.value)} placeholder={tr('Необязательно: зал, время, особенности комплекта', 'Ixtiyoriy: zal, vaqt, jamlanma xususiyatlari')} />
          </label>
        </div>
      )}
    </section>
  )
}
