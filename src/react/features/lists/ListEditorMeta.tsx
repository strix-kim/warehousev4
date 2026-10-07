import { CalendarDays, ChevronDown } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode, type RefObject } from 'react'
import { AppDatePicker } from '../../components/AppDatePicker'
import { AppSelect, type AppSelectOption } from '../../components/AppSelect'
import { VenueField } from '../../components/VenueField'
import { todayDateValue } from '../../lib/date'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'
import { fetchProjectBriefs } from '../projects/api'
import { formatProjectPeriod, type ProjectBrief } from '../projects/types'
import type { ListProjectDraft } from './api'
import { projectDraftFrom } from './listDocument'
import './list-editor-meta.css'

// Реквизиты, без которых не собирается документ на согласование. Проверка
// клиентская и это UX: документ формируется здесь же, в браузере, пары в базе
// у неё быть не может. Все три — реквизиты МЕРОПРИЯТИЯ: своих у списка нет.
export type RequisiteField = 'projectName' | 'clientName' | 'venue'

// Собственные поля списка: подпись и комментарий к документу.
export type ListMetaField = 'name' | 'description'

export type ListMetaValues = Record<ListMetaField, string> & { project: ListProjectDraft | null }

export type ListProjectFields = Partial<Pick<ListProjectDraft, 'name' | 'clientName' | 'dateFrom' | 'dateTo' | 'venue'>>

// Служебные значения селекта мероприятия. Настоящие — uuid, с ними не пересекутся.
const NONE = ''
const CREATE = '__create__'

// Панель реквизитов документа: свёрнута в полосу «Мероприятие · Дата · Заказчик ·
// Площадка · Реквизиты ⌄», по нажатию раскрывается в сетку полей. Реквизиты не
// нужны, чтобы собрать список, — они нужны документу на согласование, поэтому
// по умолчанию не занимают первый экран. Состояние значений живёт на странице
// (его читают сохранение, экспорт и автосейв), раскрытие — тоже: страница
// раскрывает панель сама, когда экспорт на согласование упёрся в пустое поле.
//
// Реквизиты принадлежат мероприятию (с54): список либо стоит на существующем,
// либо заводит новое тем же сохранением, либо живёт без мероприятия — черновым
// набором без даты и площадки.
export function ListEditorMeta({ panelRef, values, requisiteErrors, open, onToggle, onChange, onProjectPick, onProjectChange }: {
  panelRef: RefObject<HTMLElement | null>
  values: ListMetaValues
  requisiteErrors: Set<RequisiteField>
  open: boolean
  onToggle: () => void
  onChange: (field: ListMetaField, value: string) => void
  // Выбор в поле «Мероприятие»: существующее, новое (id === null) или null — без него.
  onProjectPick: (project: ListProjectDraft | null) => void
  // Правка реквизитов выбранного или нового мероприятия.
  onProjectChange: (fields: ListProjectFields) => void
}) {
  const { tr, locale } = useLanguage()
  const { project } = values
  // Реестр мероприятий для выбора. Грузится при первом раскрытии панели, а не с
  // редактором: полоса показывает уже выбранное из стейта страницы, и собирать
  // список можно, ни разу сюда не заглянув.
  const [projects, setProjects] = useState<ProjectBrief[]>([])
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!open) return
    let isCurrent = true
    setLoadState((current) => current === 'ready' ? current : 'loading')
    fetchProjectBriefs()
      .then((rows) => {
        if (!isCurrent) return
        setProjects(rows)
        setLoadState('ready')
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        setLoadState('failed')
        reportAppError(error, { scope: 'loader', detail: { source: 'list-editor-projects' } })
      })
    return () => { isCurrent = false }
  }, [open, reloadKey])

  const selectValue = !project ? NONE : project.id ?? CREATE

  const projectOptions = useMemo<AppSelectOption<string>[]>(() => {
    // Пока реестр в пути, единственный пункт — текущее значение: AppSelect
    // показывает options[0], когда значения нет в списке, и «Без мероприятия»
    // при выбранном мероприятии было бы враньём (тот же приём, что в VenueField).
    if (loadState !== 'ready') {
      return [{ value: selectValue, label: loadState === 'failed' ? tr('Мероприятия не загрузились', 'Tadbirlar yuklanmadi') : tr('Загружаем мероприятия…', 'Tadbirlar yuklanmoqda…') }]
    }
    const list: AppSelectOption<string>[] = [
      { value: NONE, label: tr('Без мероприятия', 'Tadbirsiz') },
      ...projects.map((item) => ({
        value: item.id,
        label: item.date_from ? `${item.name} · ${formatProjectPeriod(item.date_from, item.date_to, locale, tr)}` : item.name,
      })),
    ]
    // Выбранного мероприятия нет в реестре (удалили или реестр в кэше старше
    // него) — пункт с его же названием вместо молчаливой подмены первым.
    if (project?.id && !projects.some((item) => item.id === project.id)) {
      list.push({ value: project.id, label: project.name.trim() || tr('Мероприятие', 'Tadbir') })
    }
    list.push({ value: CREATE, label: tr('+ Новое мероприятие…', '+ Yangi tadbir…') })
    return list
  }, [loadState, locale, project?.id, project?.name, projects, selectValue, tr])

  function pickProject(next: string) {
    if (loadState !== 'ready' || next === selectValue) return
    if (next === NONE) {
      onProjectPick(null)
      return
    }
    if (next === CREATE) {
      // Дата нового мероприятия — сегодня по умолчанию: то же умолчание, что было
      // у даты списка до переезда реквизитов.
      onProjectPick({ id: null, name: '', clientName: '', dateFrom: todayDateValue(), dateTo: '', venue: null, edited: false })
      return
    }
    const picked = projects.find((item) => item.id === next)
    if (picked) onProjectPick(projectDraftFrom(picked))
  }

  const empty = (text: ReactNode) => <b className="quick-list-strip__empty">{text}</b>
  const requiredHint = <small className="field-hint field-hint--error">{tr('Обязательно для согласования', 'Kelishuv uchun majburiy')}</small>
  // Незаполненные реквизиты обязаны быть видны и на СВЁРНУТОЙ полосе: поля с
  // подсветкой размонтированы, и без этого модификатора требование, на которое
  // указал экспорт, исчезало бы с экрана, не будучи выполненным.
  const invalid = requisiteErrors.size > 0
  // Подсказки, а не защита: период держит projects_dates_check в базе.
  const rangeError = Boolean(project?.dateFrom && project.dateTo && project.dateTo < project.dateFrom)
  const endWithoutStart = Boolean(project?.dateTo && !project.dateFrom)

  const datePickerLabels = {
    locale,
    placeholder: tr('Не указана', 'Ko‘rsatilmagan'),
    todayLabel: tr('Сегодня', 'Bugun'),
    clearLabel: tr('Очистить', 'Tozalash'),
    previousMonthLabel: tr('Предыдущий месяц', 'Oldingi oy'),
    nextMonthLabel: tr('Следующий месяц', 'Keyingi oy'),
  }

  return (
    <section ref={panelRef} className={`quick-list-meta data-panel ${open ? 'quick-list-meta--open' : ''} ${invalid ? 'quick-list-meta--invalid' : ''}`}>
      {/* aria-controls не ставим: поля существуют только в раскрытом состоянии,
          ссылка на отсутствующий id хуже, чем её отсутствие. */}
      <button className="quick-list-strip" type="button" onClick={onToggle} aria-expanded={open}>
        {/* Пары «подпись — значение» по макету с31. Без мероприятия пара одна:
            даты, заказчика и площадки у чернового набора нет, и три «не указано»
            подряд читались бы как недоделанная форма. */}
        <span className="quick-list-strip__summary">
          <span className="quick-list-strip__pair"><span>{tr('Мероприятие', 'Tadbir')}</span>{project
            ? project.name.trim() ? <b>{project.name.trim()}</b> : empty(tr('без названия', 'nomsiz'))
            : empty(tr('без мероприятия', 'tadbirsiz'))}</span>
          {project && (
            <>
              <span className="quick-list-strip__pair"><span>{tr('Дата', 'Sana')}</span>{project.dateFrom ? <b>{formatProjectPeriod(project.dateFrom, project.dateTo || null, locale, tr)}</b> : empty(tr('не указана', 'ko‘rsatilmagan'))}</span>
              <span className="quick-list-strip__pair"><span>{tr('Заказчик', 'Buyurtmachi')}</span>{project.clientName.trim() ? <b>{project.clientName.trim()}</b> : empty(tr('не указан', 'ko‘rsatilmagan'))}</span>
              <span className="quick-list-strip__pair"><span>{tr('Площадка', 'Maydon')}</span>{project.venue ? <b>{project.venue.name}</b> : empty(tr('не указана', 'ko‘rsatilmagan'))}</span>
            </>
          )}
        </span>
        <span className="quick-list-strip__toggle">
          {invalid ? tr('Заполнить', 'To‘ldirish') : tr('Реквизиты', 'Rekvizitlar')} <ChevronDown size={16} />
        </span>
      </button>

      {open && (
        <div className="quick-list-meta__fields">
          <div className="field">
            <span>{tr('Мероприятие', 'Tadbir')} <small>{tr('от него дата, заказчик и площадка', 'sana, buyurtmachi va maydon shundan')}</small></span>
            {loadState === 'ready'
              ? <AppSelect value={selectValue} options={projectOptions} onChange={pickProject} ariaLabel={tr('Мероприятие', 'Tadbir')} />
              // Недогруженный реестр — та же кнопка селекта без попапа.
              : <div className="app-select"><button className="app-select__trigger" type="button" disabled aria-label={tr('Мероприятие', 'Tadbir')}><span>{projectOptions[0]?.label}</span></button></div>}
            {loadState === 'failed' && (
              <small className="field-hint field-hint--error">
                {tr('Не удалось загрузить мероприятия.', 'Tadbirlarni yuklab bo‘lmadi.')}{' '}
                <button type="button" className="quick-list-meta__retry" onClick={() => setReloadKey((current) => current + 1)}>{tr('Повторить', 'Qayta urinish')}</button>
              </small>
            )}
            {/* Согласование требует реквизитов, а брать их неоткуда: говорим это у
                самого выбора, полей с подсветкой здесь нет. */}
            {!project && invalid && <small className="field-hint field-hint--error">{tr('Для согласования выберите или создайте мероприятие', 'Kelishuv uchun tadbirni tanlang yoki yarating')}</small>}
          </div>
          {/* Подпись списка, а не название мероприятия: у одного мероприятия бывает
              несколько списков («Свет», «Звук»). */}
          <label className="field quick-list-meta__notes">
            <span>{tr('Название списка', 'Ro‘yxat nomi')} <small>{project
              ? tr('необязательно: возьмётся название мероприятия', 'ixtiyoriy: tadbir nomi olinadi')
              : tr('необязательно: подставится дата', 'ixtiyoriy: sana qo‘yiladi')}</small></span>
            <input
              id="quick-list-name"
              value={values.name}
              onChange={(event) => onChange('name', event.target.value)}
              placeholder={tr('Например, Свет', 'Masalan, Yorug‘lik')}
            />
          </label>

          {project && (
            <>
              {/* Реквизиты общие: их же показывают другие списки, состав и планы
                  залов этого мероприятия. Говорим это словами ДО правки — иначе
                  смена заказчика «в списке» неожиданно меняет чужой документ. */}
              <p className="quick-list-meta__full quick-list-meta__shared-note">{project.id
                ? tr('Реквизиты общие: правка здесь изменит мероприятие целиком — для всех его списков, состава и планов залов.', 'Rekvizitlar umumiy: bu yerdagi tahrir tadbirni butunlay o‘zgartiradi — uning barcha ro‘yxatlari, tarkibi va zal rejalari uchun.')
                : tr('Новое мероприятие появится при сохранении списка — потом к нему добавляют состав, залы и другие списки.', 'Yangi tadbir ro‘yxat saqlanganda paydo bo‘ladi — keyin unga tarkib, zallar va boshqa ro‘yxatlar qo‘shiladi.')}</p>
              <label className="field">
                <span>{tr('Название мероприятия', 'Tadbir nomi')}</span>
                <input
                  id="quick-list-projectName"
                  className={requisiteErrors.has('projectName') ? 'input-error' : ''}
                  value={project.name}
                  onChange={(event) => onProjectChange({ name: event.target.value })}
                  placeholder={tr('Например, Форум в Hyatt', 'Masalan, Hyatt forumi')}
                />
                {requisiteErrors.has('projectName') && requiredHint}
              </label>
              <div className="field">
                <span><CalendarDays size={13} /> {tr('Дата начала', 'Boshlanish sanasi')}</span>
                <AppDatePicker
                  value={project.dateFrom}
                  onChange={(value) => onProjectChange({ dateFrom: value })}
                  ariaLabel={tr('Дата начала', 'Boshlanish sanasi')}
                  {...datePickerLabels}
                />
              </div>
              <div className="field">
                <span><CalendarDays size={13} /> {tr('Дата окончания', 'Tugash sanasi')} <small>{tr('один день — оставьте пустым', 'bir kun bo‘lsa — bo‘sh qoldiring')}</small></span>
                <AppDatePicker
                  value={project.dateTo}
                  onChange={(value) => onProjectChange({ dateTo: value })}
                  ariaLabel={tr('Дата окончания', 'Tugash sanasi')}
                  {...datePickerLabels}
                />
                {rangeError && <small className="field-hint field-hint--error">{tr('Окончание раньше начала', 'Tugash sanasi boshlanishdan oldin')}</small>}
                {endWithoutStart && <small className="field-hint field-hint--error">{tr('Сначала укажите дату начала', 'Avval boshlanish sanasini ko‘rsating')}</small>}
              </div>
              <label className="field quick-list-meta__client">
                <span>{tr('Заказчик / организатор', 'Buyurtmachi / tashkilotchi')} <small>{tr('нужно для документа на согласование', 'kelishuv hujjati uchun kerak')}</small></span>
                <input
                  id="quick-list-clientName"
                  className={requisiteErrors.has('clientName') ? 'input-error' : ''}
                  value={project.clientName}
                  onChange={(event) => onProjectChange({ clientName: event.target.value })}
                  placeholder={tr('Например, ARGO Media', 'Masalan, ARGO Media')}
                />
                {requisiteErrors.has('clientName') && requiredHint}
              </label>
              {/* Обёртка держит место в сетке: VenueField раскрывает под собой форму
                  нового места, и в узкой средней колонке ей было бы тесно. */}
              <div className="quick-list-meta__notes">
                <VenueField
                  value={project.venue?.id ?? null}
                  onChange={(_venueId, venue) => onProjectChange({ venue })}
                  label={tr('Площадка / локация', 'Maydon / joylashuv')}
                />
                {requisiteErrors.has('venue') && requiredHint}
              </div>
            </>
          )}

          <label className="field quick-list-meta__full">
            <span>{tr('Комментарий к документу', 'Hujjatga izoh')}</span>
            <input value={values.description} onChange={(event) => onChange('description', event.target.value)} placeholder={tr('Необязательно: зал, время, особенности комплекта', 'Ixtiyoriy: zal, vaqt, jamlanma xususiyatlari')} />
          </label>
        </div>
      )}
    </section>
  )
}
