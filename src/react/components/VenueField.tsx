import { CircleAlert, MapPin, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AppSelect, type AppSelectOption } from './AppSelect'
import { createVenue, fetchVenues, venueErrorText } from '../features/projects/api'
import { venueLabel, type Venue, type VenueBrief } from '../features/projects/types'
import { useLanguage } from '../lib/i18n'
import { reportAppError } from '../lib/reportAppError'
import './venue-field.css'

// Служебные значения селекта. Настоящие — uuid места, с ними не пересекутся.
const NONE = ''
const CREATE = '__create__'

// Значения по умолчанию для нового места. Это ДАННЫЕ, а не интерфейс, поэтому
// мимо tr: «Ташкент» и «Toshkent» по venues_identity_key — два разных места, и
// каждый язык интерфейса плодил бы свой дубль одной площадки.
const DEFAULT_CITY = 'Ташкент'
const DEFAULT_COUNTRY = 'Узбекистан'

/**
 * Поле «Площадка»: выбрать место из справочника либо завести новое тут же.
 * Контролируемое — хранит выбор вызывающий (мероприятие, редактор списка).
 * Справочник поле грузит само: источник у мест один (projects/api, кэш
 * `projects:venues`), и каждой форме незачем повторять загрузку и её отказ.
 *
 * Новое место создаётся СРАЗУ, отдельной записью, а не вместе с формой: место —
 * самостоятельная сущность, и «Отмена» формы его не откатывает. Дубль не
 * ошибка — createVenue подхватывает существующее место.
 */
export function VenueField({ value, onChange, label, disabled = false }: {
  value: string | null
  // Вторым аргументом — само место: вызывающему, которому нужна подпись
  // (шапка документа), не приходится искать его в справочнике повторно.
  onChange: (venueId: string | null, venue: VenueBrief | null) => void
  label?: string
  disabled?: boolean
}) {
  const { tr } = useLanguage()
  const [venues, setVenues] = useState<Venue[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [reloadKey, setReloadKey] = useState(0)
  const [isCreating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [city, setCity] = useState(DEFAULT_CITY)
  const [country, setCountry] = useState(DEFAULT_COUNTRY)
  const [isSaving, setIsSaving] = useState(false)
  const [errorText, setErrorText] = useState('')

  useEffect(() => {
    let isCurrent = true
    setLoadState('loading')
    fetchVenues({ bypassCache: reloadKey > 0 })
      .then((rows) => {
        if (!isCurrent) return
        setVenues(rows)
        setLoadState('ready')
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        setLoadState('failed')
        reportAppError(error, { scope: 'loader', detail: { source: 'venues' } })
      })
    return () => { isCurrent = false }
  }, [reloadKey])

  const options = useMemo<AppSelectOption<string>[]>(() => {
    // Пока справочник в пути, единственный пункт — текущее значение: AppSelect
    // показывает options[0], когда значения нет в списке, и «Не указана» при
    // выбранной площадке была бы враньём.
    if (loadState !== 'ready') {
      return [{ value: value ?? NONE, label: loadState === 'loading' ? tr('Загружаем места…', 'Joylar yuklanmoqda…') : tr('Места не загрузились', 'Joylar yuklanmadi') }]
    }
    const list: AppSelectOption<string>[] = [
      { value: NONE, label: tr('Не указана', 'Ko‘rsatilmagan') },
      ...venues.map((venue) => ({ value: venue.id, label: venueLabel(venue) })),
    ]
    // Выбранного места нет в справочнике (удалили или не отдала политика) —
    // честный пункт вместо молчаливой подмены первым.
    if (value && !venues.some((venue) => venue.id === value)) {
      list.push({ value, label: tr('Место недоступно', 'Joy mavjud emas') })
    }
    list.push({ value: CREATE, label: tr('+ Новое место…', '+ Yangi joy…') })
    return list
  }, [loadState, tr, value, venues])

  function select(next: string) {
    if (loadState !== 'ready') return
    if (next === CREATE) {
      setCreating(true)
      return
    }
    setCreating(false)
    setErrorText('')
    if (next === NONE) {
      onChange(null, null)
      return
    }
    const venue = venues.find((item) => item.id === next)
    if (venue) onChange(venue.id, venue)
  }

  function cancelCreate() {
    setCreating(false)
    setErrorText('')
    setName('')
    setCity(DEFAULT_CITY)
    setCountry(DEFAULT_COUNTRY)
  }

  // Пустые поля запирают кнопку — заведомо мёртвый запрос слать незачем; сами
  // правила (не пусто, длина, уникальность) держит база.
  const canSave = Boolean(name.trim() && city.trim() && country.trim()) && !isSaving

  async function saveVenue() {
    if (!canSave) return
    setIsSaving(true)
    setErrorText('')
    try {
      const venue = await createVenue({ name, city, country })
      // В локальный список кладём строку из ответа, а не перезапрашиваем
      // справочник: createVenue уже сбросил кэш, следующий экран прочитает базу.
      setVenues((current) => (current.some((item) => item.id === venue.id)
        ? current
        : [...current, venue].sort((left, right) => left.name.localeCompare(right.name) || left.city.localeCompare(right.city) || left.id.localeCompare(right.id))))
      onChange(venue.id, venue)
      cancelCreate()
    } catch (error) {
      setErrorText(venueErrorText(error, tr))
      reportAppError(error, { scope: 'loader', detail: { source: 'venue-create' } })
    } finally {
      setIsSaving(false)
    }
  }

  const fieldLabel = label ?? tr('Площадка', 'Maydon')

  return (
    <div className="field venue-field">
      <span><MapPin size={13} /> {fieldLabel}</span>
      {disabled || loadState !== 'ready'
        // Выключенное и недогруженное поле — та же кнопка селекта без попапа.
        ? <div className="app-select"><button className="app-select__trigger" type="button" disabled aria-label={fieldLabel}><span>{options.find((option) => option.value === (value ?? NONE))?.label ?? options[0]?.label}</span></button></div>
        : <AppSelect value={isCreating ? CREATE : value ?? NONE} options={options} onChange={select} ariaLabel={fieldLabel} />}

      {loadState === 'failed' && (
        <small className="field-hint field-hint--error">
          {tr('Не удалось загрузить места.', 'Joylarni yuklab bo‘lmadi.')}{' '}
          <button type="button" className="venue-field__retry" onClick={() => setReloadKey((current) => current + 1)}>{tr('Повторить', 'Qayta urinish')}</button>
        </small>
      )}

      {isCreating && !disabled && (
        // div, а не form: поле живёт внутри чужих форм и дроверов, вложенная
        // форма перехватила бы их Enter.
        <div className="venue-field__new">
          <label className="field">
            <span>{tr('Название места', 'Joy nomi')} *</span>
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void saveVenue() } }}
              placeholder={tr('Например, Hyatt Regency', 'Masalan, Hyatt Regency')}
            />
          </label>
          <div className="venue-field__place">
            <label className="field">
              <span>{tr('Город', 'Shahar')} *</span>
              <input value={city} onChange={(event) => setCity(event.target.value)} />
            </label>
            <label className="field">
              <span>{tr('Страна', 'Mamlakat')} *</span>
              <input value={country} onChange={(event) => setCountry(event.target.value)} />
            </label>
          </div>
          {errorText && <p className="form-error"><CircleAlert size={15} /> {errorText}</p>}
          <div className="venue-field__actions">
            <button type="button" className="button button--secondary" disabled={!canSave} onClick={() => void saveVenue()}>
              <Plus size={16} /> {isSaving ? tr('Добавляем…', 'Qo‘shilmoqda…') : tr('Добавить место', 'Joyni qo‘shish')}
            </button>
            <button type="button" className="button button--secondary" disabled={isSaving} onClick={cancelCreate}>{tr('Отмена', 'Bekor qilish')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
