import { ArrowDown, CalendarDays, Hash } from 'lucide-react'
import type { RefObject } from 'react'
import { AppDatePicker } from '../../components/AppDatePicker'
import { useLanguage } from '../../lib/i18n'

// Реквизиты, без которых не собирается документ на согласование. Проверка
// клиентская и это UX: документ формируется здесь же, в браузере, пары в базе
// у неё быть не может.
export type RequisiteField = 'name' | 'clientName' | 'venue'

export type ListMetaField = RequisiteField | 'description' | 'eventDate'

export type ListMetaValues = Record<ListMetaField, string>

// Панель реквизитов документа: название, дата, заказчик, площадка, комментарий.
// Состояние живёт на странице — оно нужно и сохранению, и экспорту, и автосейву;
// панель только рисует поля и отдаёт правки наверх по имени поля.
export function ListEditorMeta({ panelRef, values, requisiteErrors, onChange, onGoToCatalog }: {
  panelRef: RefObject<HTMLElement | null>
  values: ListMetaValues
  requisiteErrors: Set<RequisiteField>
  onChange: (field: ListMetaField, value: string) => void
  onGoToCatalog: () => void
}) {
  const { tr, locale } = useLanguage()
  const requiredHint = <small className="field-hint field-hint--error">{tr('Обязательно для согласования', 'Kelishuv uchun majburiy')}</small>

  return (
    <section ref={panelRef} className="quick-list-meta data-panel">
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
      <div className="quick-list-hint"><Hash size={17} /><span>{tr('Добавляйте модели и количество. Серийные номера можно указать позже только там, где это нужно.', 'Modellar va miqdorni qo‘shing. Seriya raqamlarini keyin faqat kerak bo‘lgan joyda ko‘rsatish mumkin.')}</span></div>
      <div className="quick-list-next">
        <button className="button button--primary" type="button" onClick={onGoToCatalog}>
          {tr('Перейти к оборудованию', 'Uskunalarga o‘tish')} <ArrowDown size={17} />
        </button>
      </div>
    </section>
  )
}
