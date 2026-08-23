import { CalendarDays } from 'lucide-react'
import { AppDatePicker } from './AppDatePicker'
import { useLanguage } from '../lib/i18n'
import type { EventDocumentMeta } from '../lib/xlsx/eventDocument'

// Реквизиты документа «на мероприятие»: название, даты и язык бумаги. Общий блок
// на сотрудников и на машины — разъехавшись, эти две формы дали бы два разных
// набора полей в одном и том же документе.
//
// Подсветку ошибок решает хозяин формы: он же держит кнопку «Скачать» и знает,
// когда человек уже потрогал поле, а когда ещё нет.
export function EventDocumentFields({ value, onChange, nameError = false, rangeError = false }: {
  value: EventDocumentMeta
  onChange: (next: EventDocumentMeta) => void
  nameError?: boolean
  rangeError?: boolean
}) {
  const { tr, locale } = useLanguage()
  const patch = (fields: Partial<EventDocumentMeta>) => onChange({ ...value, ...fields })

  return (
    <div className="event-document-fields">
      <label className="field">
        <span>{tr('Название мероприятия', 'Tadbir nomi')} *</span>
        <input
          className={nameError ? 'input-error' : ''}
          value={value.name}
          onChange={(event) => patch({ name: event.target.value })}
          placeholder={tr('Например, Форум в Hyatt', 'Masalan, Hyatt forumi')}
        />
        {nameError && <small className="field-hint field-hint--error">{tr('Без названия документ не собрать', 'Nomsiz hujjat yig‘ilmaydi')}</small>}
      </label>

      <div className="field">
        <span><CalendarDays size={13} /> {tr('Дата начала', 'Boshlanish sanasi')} *</span>
        <AppDatePicker
          value={value.dateFrom}
          onChange={(next) => patch({ dateFrom: next })}
          locale={locale}
          placeholder={tr('Выберите дату', 'Sanani tanlang')}
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
          value={value.dateTo ?? ''}
          onChange={(next) => patch({ dateTo: next || null })}
          locale={locale}
          placeholder={tr('Не указана', 'Ko‘rsatilmagan')}
          ariaLabel={tr('Дата окончания', 'Tugash sanasi')}
          todayLabel={tr('Сегодня', 'Bugun')}
          clearLabel={tr('Очистить', 'Tozalash')}
          previousMonthLabel={tr('Предыдущий месяц', 'Oldingi oy')}
          nextMonthLabel={tr('Следующий месяц', 'Keyingi oy')}
        />
        {rangeError && <small className="field-hint field-hint--error">{tr('Окончание раньше начала', 'Tugash sanasi boshlanishdan oldin')}</small>}
      </div>

      {/* Язык бумаги, а не интерфейса: в UZ-документ уходят узбекские заголовки,
          даже если человек работает в русском интерфейсе. Отсюда и своя пара
          кнопок вместо LanguageSwitcher — тот переключает весь экран. */}
      <div className="field">
        <span>{tr('Язык документа', 'Hujjat tili')}</span>
        <div className="language-switch" role="group" aria-label={tr('Язык документа', 'Hujjat tili')}>
          <button type="button" className={value.language === 'ru' ? 'active' : ''} aria-pressed={value.language === 'ru'} onClick={() => patch({ language: 'ru' })}>RU</button>
          <button type="button" className={value.language === 'uz' ? 'active' : ''} aria-pressed={value.language === 'uz'} onClick={() => patch({ language: 'uz' })}>UZ</button>
        </div>
      </div>
    </div>
  )
}
