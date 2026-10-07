import { CalendarDays } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { AppDatePicker } from './AppDatePicker'
import { AppSelect } from './AppSelect'
import { RetryButton } from './ErrorState'
import { VenueField } from './VenueField'
import { createProject, fetchProjectBriefs } from '../features/projects/api'
import { formatProjectPeriod, type ProjectBrief, type ProjectInput } from '../features/projects/types'
import { useLanguage } from '../lib/i18n'
import { reportAppError } from '../lib/reportAppError'

// «Без мероприятия» бывает не у всех: состав и документ машин без мероприятия
// не собираются, а план залов — может.
export type ProjectChoiceMode = 'existing' | 'new' | 'none'

const EMPTY_DRAFT: ProjectInput = { name: '', clientName: '', dateFrom: '', dateTo: '', venueId: null, description: '' }

/**
 * Выбор мероприятия «существующее либо новое» — один на состав сотрудников,
 * план залов и список машин: разъехавшись, три формы учили бы человека трём
 * способам сделать одно и то же. Состояние держит хук (хозяину формы нужны
 * выбранное мероприятие, черновик нового и «есть несохранённое»), разметку —
 * ProjectChoiceField ниже.
 *
 * Реестр хук грузит сам, тем же приёмом, что VenueField: источник один
 * (projects/api, кэш `projects:list`), и отказ загрузки — его забота.
 */
export function useProjectChoice({ allowNone = false, initialProjectId = null, initialMode, report }: {
  allowNone?: boolean
  // Мероприятие, уже привязанное к правимой записи (план залов).
  initialProjectId?: string | null
  // По умолчанию — «существующее»; хозяин задаёт 'none' записи без мероприятия.
  initialMode?: ProjectChoiceMode
  // Куда докладывать отказ загрузки реестра: экран и источник у каждого свои.
  report: { route: string; source: string }
}) {
  const [projects, setProjects] = useState<ProjectBrief[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [reloadKey, setReloadKey] = useState(0)
  const [mode, setMode] = useState<ProjectChoiceMode>(initialMode ?? 'existing')
  const [projectId, setProjectId] = useState(initialProjectId ?? '')
  const [draft, setDraft] = useState<ProjectInput>(EMPTY_DRAFT)
  const { route, source } = report

  useEffect(() => {
    let isCurrent = true
    setLoadState('loading')
    fetchProjectBriefs()
      .then((rows) => {
        if (!isCurrent) return
        setProjects(rows)
        setLoadState('ready')
        // Выбирать не из чего — сразу форма нового: пустой список с подписью
        // «мероприятий нет» был бы лишним шагом. «Без мероприятия» и уже
        // привязанное мероприятие не трогаем: это выбор, а не пустое место.
        if (rows.length === 0 && !initialProjectId) setMode((current) => (current === 'existing' ? 'new' : current))
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        setLoadState('failed')
        reportAppError(error, { scope: 'loader', route, detail: { source } })
      })
    return () => { isCurrent = false }
    // initialProjectId, route и source — снимок открытия формы, за время её
    // жизни не меняются.
  }, [reloadKey])

  const patchDraft = (fields: Partial<ProjectInput>) => setDraft((current) => ({ ...current, ...fields }))
  const selected = mode === 'existing' ? projects.find((project) => project.id === projectId) ?? null : null

  // Клиентская проверка здесь — подсказка, а не защита: период держит
  // projects_dates_check, дубль — projects_identity_key. Запирать кнопку хозяину
  // стоит только на заведомо мёртвом запросе: мероприятие не выбрано либо у
  // нового нет названия.
  const isReady = mode === 'none' || (mode === 'existing' ? Boolean(selected) : Boolean(draft.name.trim()))
  // Документу нужна дата начала: из неё складывается фраза периода в шапке
  // (EventDocumentMeta.dateFrom обязателен).
  const hasDate = mode === 'existing' ? Boolean(selected?.date_from) : mode === 'new' && Boolean(draft.dateFrom)

  // Терять есть что, пока набранные реквизиты нового мероприятия не записаны:
  // после создания черновик очищается (см. ensure). Выбор из списка — выбор, а
  // не набранная работа.
  const isDirty = (Object.keys(EMPTY_DRAFT) as Array<keyof ProjectInput>).some((key) => draft[key] !== EMPTY_DRAFT[key])

  // Мероприятие, с которым работает форма. Новое создаётся ОДИН раз: после
  // создания оно встаёт в список выбранным, а форма очищается — иначе повтор
  // после отказа следующей записи создавал бы его снова и упирался в
  // projects_identity_key. null — «без мероприятия» либо ничего не выбрано.
  async function ensure(): Promise<ProjectBrief | null> {
    if (mode !== 'new') return selected
    const created = await createProject(draft)
    setProjects((current) => [created, ...current])
    setProjectId(created.id)
    setMode('existing')
    setDraft(EMPTY_DRAFT)
    return created
  }

  return {
    allowNone, mode, setMode, projects, loadState, projectId, setProjectId, draft, patchDraft,
    selected, isReady, hasDate, isDirty, ensure,
    reload: () => setReloadKey((value) => value + 1),
  }
}

export type ProjectChoice = ReturnType<typeof useProjectChoice>

// Разметка выбора: переключатель и под ним либо список мероприятий, либо форма
// нового. children — поля хозяина в том же блоке (язык документа, реквизиты
// плана): так у трёх дроверов один ритм отступов.
export function ProjectChoiceField({ choice, groupLabel, disabled = false, children }: {
  choice: ProjectChoice
  // Подпись группы переключателя для скринридера: «куда» у каждой формы своё.
  groupLabel: string
  disabled?: boolean
  children?: ReactNode
}) {
  const { tr, locale } = useLanguage()
  const { mode, draft, patchDraft, projects, loadState, projectId } = choice

  const rangeError = Boolean(draft.dateFrom && draft.dateTo && draft.dateTo < draft.dateFrom)
  const endWithoutStart = Boolean(draft.dateTo && !draft.dateFrom)

  const datePickerLabels = {
    locale,
    placeholder: tr('Не указана', 'Ko‘rsatilmagan'),
    todayLabel: tr('Сегодня', 'Bugun'),
    clearLabel: tr('Очистить', 'Tozalash'),
    previousMonthLabel: tr('Предыдущий месяц', 'Oldingi oy'),
    nextMonthLabel: tr('Следующий месяц', 'Keyingi oy'),
  }

  const modes: { value: ProjectChoiceMode; label: string }[] = [
    { value: 'existing', label: tr('Существующее', 'Mavjud') },
    // С третьим пунктом полная подпись не помещается в 390 px без прокрутки
    // переключателя — слово «мероприятие» там уже несёт сосед.
    { value: 'new', label: choice.allowNone ? tr('Новое', 'Yangi') : tr('Новое мероприятие', 'Yangi tadbir') },
    ...(choice.allowNone ? [{ value: 'none' as const, label: tr('Без мероприятия', 'Tadbirsiz') }] : []),
  ]

  const promptLabel = loadState === 'loading' ? tr('Загружаем мероприятия…', 'Tadbirlar yuklanmoqda…') : tr('Выберите мероприятие', 'Tadbirni tanlang')
  const isKnown = projects.some((project) => project.id === projectId)
  // Первый пункт — приглашение: AppSelect показывает options[0], когда значения
  // нет в списке, и чужое мероприятие «по умолчанию» было бы враньём.
  const projectOptions = projectId && !isKnown && loadState !== 'ready'
    // Привязанное мероприятие при недогруженном реестре: единственный пункт
    // несёт его id — иначе касание селекта молча сняло бы привязку.
    ? [{ value: projectId, label: loadState === 'loading' ? promptLabel : tr('Мероприятия не загрузились', 'Tadbirlar yuklanmadi') }]
    : [
      { value: '', label: promptLabel },
      // Период в подписи: ежегодный форум с тем же названием в реестре не один.
      ...projects.map((project) => ({ value: project.id, label: `${project.name} · ${formatProjectPeriod(project.date_from, project.date_to, locale, tr)}` })),
      // Привязанного мероприятия нет в реестре — честный пункт вместо
      // молчаливой подмены приглашением.
      ...(projectId && !isKnown ? [{ value: projectId, label: tr('Мероприятие недоступно', 'Tadbir mavjud emas') }] : []),
    ]

  return (
    <>
      <div className="segmented" role="group" aria-label={groupLabel}>
        {modes.map((item) => (
          <button key={item.value} type="button" aria-pressed={mode === item.value} disabled={disabled} onClick={() => choice.setMode(item.value)}>
            {mode === item.value && <span className="segmented__thumb" />}
            {item.label}
          </button>
        ))}
      </div>

      <div className="event-document-fields">
        {mode === 'existing' && (
          <div className="field">
            <span>{tr('Мероприятие', 'Tadbir')} *</span>
            <AppSelect value={projectId} options={projectOptions} onChange={choice.setProjectId} ariaLabel={tr('Мероприятие', 'Tadbir')} />
            {loadState === 'failed' && (
              <>
                <small className="field-hint field-hint--error">{tr('Не удалось загрузить мероприятия.', 'Tadbirlarni yuklab bo‘lmadi.')}</small>
                <RetryButton onClick={choice.reload} />
              </>
            )}
            {loadState === 'ready' && projects.length === 0 && (
              <small className="field-hint">{tr('Мероприятий пока нет — заведите новое.', 'Hozircha tadbirlar yo‘q — yangisini yarating.')}</small>
            )}
          </div>
        )}

        {mode === 'new' && (
          <>
            <label className="field">
              <span>{tr('Название', 'Nomi')} *</span>
              <input
                value={draft.name}
                disabled={disabled}
                onChange={(event) => patchDraft({ name: event.target.value })}
                placeholder={tr('Например, Форум в Hyatt', 'Masalan, Hyatt forumi')}
              />
            </label>

            <label className="field">
              <span>{tr('Заказчик', 'Buyurtmachi')}</span>
              <input
                value={draft.clientName}
                disabled={disabled}
                onChange={(event) => patchDraft({ clientName: event.target.value })}
                placeholder={tr('Компания или человек', 'Kompaniya yoki shaxs')}
              />
            </label>

            <div className="field">
              <span><CalendarDays size={13} /> {tr('Дата начала', 'Boshlanish sanasi')}</span>
              <AppDatePicker
                value={draft.dateFrom}
                onChange={(next) => patchDraft({ dateFrom: next })}
                ariaLabel={tr('Дата начала', 'Boshlanish sanasi')}
                {...datePickerLabels}
              />
            </div>

            <div className="field">
              <span>{tr('Дата окончания', 'Tugash sanasi')} <small>{tr('Один день — оставьте пустым', 'Bir kun bo‘lsa — bo‘sh qoldiring')}</small></span>
              <AppDatePicker
                value={draft.dateTo}
                onChange={(next) => patchDraft({ dateTo: next })}
                ariaLabel={tr('Дата окончания', 'Tugash sanasi')}
                {...datePickerLabels}
              />
              {rangeError && <small className="field-hint field-hint--error">{tr('Окончание раньше начала', 'Tugash sanasi boshlanishdan oldin')}</small>}
              {endWithoutStart && <small className="field-hint field-hint--error">{tr('Сначала укажите дату начала', 'Avval boshlanish sanasini ko‘rsating')}</small>}
            </div>

            <VenueField value={draft.venueId} onChange={(venueId) => patchDraft({ venueId })} disabled={disabled} />
          </>
        )}

        {children}
      </div>
    </>
  )
}
