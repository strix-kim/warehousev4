import { CalendarDays, CircleAlert, FileSpreadsheet, Save, X } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { pickDocumentPhoto, type EmployeePhotoRef } from './api'
import { addEmployeesToProject, fetchProjectStaffCount, rosterErrorText } from './rosterApi'
import { employeeFullName, type EmployeeListItem } from './types'
import { AppDatePicker } from '../../components/AppDatePicker'
import { AppSelect } from '../../components/AppSelect'
import { DrawerLayer } from '../../components/DrawerLayer'
import { RetryButton } from '../../components/ErrorState'
import { UnsavedPrompt } from '../../components/UnsavedPrompt'
import { VenueField } from '../../components/VenueField'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'
import { useGuardedClose } from '../../lib/useGuardedClose'
import { useModalLayer } from '../../lib/useModalLayer'
import type { EventDocumentMeta } from '../../lib/xlsx/eventDocument'
import { createProject, fetchProjectBriefs, projectErrorText } from '../projects/api'
import { formatProjectPeriod, type ProjectBrief, type ProjectInput } from '../projects/types'

// Фаза одного нажатия. Союзом, а не флагами: «готовим» без счётчика и «готово»
// без числа непрочитанных фото — состояния, которых не бывает.
type RosterPhase =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'preparing'; done: number; total: number }
  | { kind: 'done'; failed: number }
  | { kind: 'error'; text: string }

export type RosterExportRun = (meta: EventDocumentMeta, options: {
  includeAddress: boolean
  onProgress: (done: number, total: number) => void
  signal: AbortSignal
}) => Promise<{ failed: number }>

const EMPTY_DRAFT: ProjectInput = { name: '', clientName: '', dateFrom: '', dateTo: '', venueId: null, description: '' }

// «Состав на мероприятие»: отмеченных в реестре людей записываем в состав
// выбранного либо тут же заведённого мероприятия. Разовой выгрузки без записи
// больше нет (решение прораба с53, п. 9) — документ собирается из реквизитов
// мероприятия, и второй раз их никто не набирает. Выбор остаётся на странице:
// дровер его не копирует и при закрытии не сбрасывает.
export function RosterToEventDrawer({ employees, photos, photosKnown, onClose, onSaved, onExport }: {
  // Строки РЕЕСТРА: дровер печатает имена и считает, у кого нет фото, — паспорт
  // ему не нужен. Полные строки страница дотягивает в момент сборки файла.
  employees: EmployeeListItem[]
  photos: Map<string, EmployeePhotoRef[]>
  // Карта фото загружена. false — запрос не ответил: «фото есть у всех» тогда
  // было бы не сводкой, а выдумкой (gotchas §11).
  photosKnown: boolean
  onClose: () => void
  // Состав записан — страница уводит на мероприятие.
  onSaved: (projectId: string) => void
  onExport: RosterExportRun
}) {
  const { tr, locale } = useLanguage()
  const [projects, setProjects] = useState<ProjectBrief[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [reloadKey, setReloadKey] = useState(0)
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [projectId, setProjectId] = useState('')
  const [draft, setDraft] = useState<ProjectInput>(EMPTY_DRAFT)
  // Язык документа по умолчанию UZ: бумагу на объект подают по-узбекски, а
  // интерфейс у большинства русский — совпадать этим двум незачем.
  const [language, setLanguage] = useState<EventDocumentMeta['language']>('uz')
  // Графа «Место жительства» выключена по умолчанию: образец принимающей стороны —
  // восемь граф (решение прораба с53, п. 8).
  const [includeAddress, setIncludeAddress] = useState(false)
  const [phase, setPhase] = useState<RosterPhase>({ kind: 'idle' })
  // Мероприятие, в состав которого этот дровер уже записал людей. Пока оно
  // есть, внизу висит прямая ссылка: файл мог не собраться, а состав — на месте.
  const [savedProjectId, setSavedProjectId] = useState('')
  // Сколько людей в выбранном мероприятии уже есть. null — не знаем (ещё не
  // ответило или отказало): подпись тогда остаётся без числа, а не исчезает.
  const [staffCount, setStaffCount] = useState<number | null>(null)
  // Закрытие дровера обязано гасить очередь загрузок: без этого человек, закрыв
  // документ на тридцати портретах, продолжал бы качать их в фоне.
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => () => abortRef.current?.abort(), [])

  useEffect(() => {
    let isCurrent = true
    setLoadState('loading')
    fetchProjectBriefs()
      .then((rows) => {
        if (!isCurrent) return
        setProjects(rows)
        setLoadState('ready')
        // Выбирать не из чего — сразу форма нового: пустой список с подписью
        // «мероприятий нет» был бы лишним шагом.
        if (rows.length === 0) setMode('new')
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        setLoadState('failed')
        reportAppError(error, { scope: 'loader', route: '/employees', detail: { source: 'roster-projects' } })
      })
    return () => { isCurrent = false }
  }, [reloadKey])

  useEffect(() => {
    if (!projectId) return
    let isCurrent = true
    setStaffCount(null)
    fetchProjectStaffCount(projectId)
      .then((count) => { if (isCurrent) setStaffCount(count) })
      // Число — справка к подписи: без него она остаётся общей фразой.
      .catch((error: unknown) => reportAppError(error, { scope: 'loader', route: '/employees', detail: { source: 'roster-count' } }))
    return () => { isCurrent = false }
  }, [projectId])

  const patch = (fields: Partial<ProjectInput>) => setDraft((current) => ({ ...current, ...fields }))
  const selected = mode === 'existing' ? projects.find((project) => project.id === projectId) ?? null : null

  // Клиентская проверка здесь — подсказка, а не защита: период держит
  // projects_dates_check, дубль — projects_identity_key, повтор человека —
  // project_staff_member_key. Кнопку запирает только заведомо мёртвый запрос:
  // мероприятие не выбрано либо у нового нет названия.
  const nameEmpty = !draft.name.trim()
  const rangeError = Boolean(draft.dateFrom && draft.dateTo && draft.dateTo < draft.dateFrom)
  const endWithoutStart = Boolean(draft.dateTo && !draft.dateFrom)
  const isBusy = phase.kind === 'saving' || phase.kind === 'preparing'
  const canSave = employees.length > 0 && (mode === 'existing' ? Boolean(selected) : !nameEmpty)
  // Документу нужна дата начала: из неё складывается фраза периода в шапке
  // (EventDocumentMeta.dateFrom обязателен). Состав сохраняется и без даты.
  const hasDate = mode === 'existing' ? Boolean(selected?.date_from) : Boolean(draft.dateFrom)

  // Терять есть что, пока набранные реквизиты нового мероприятия не записаны:
  // после создания черновик очищается (см. resolveProject). Выбор из списка,
  // язык и галка — выбор, а не набранная работа.
  const isDirty = (Object.keys(EMPTY_DRAFT) as Array<keyof ProjectInput>).some((key) => draft[key] !== EMPTY_DRAFT[key])
  // Во время записи и сборки не спрашиваем: закрытие здесь — отмена скачивания,
  // а уход на мероприятие после записи — не потеря ввода.
  const { requestClose, isPrompting, confirmClose, keepEditing } = useGuardedClose(isDirty && !isBusy, onClose)
  useModalLayer(requestClose)

  // Кого в документе покажет пустая рамка вместо лица — считаем тем же правилом,
  // что и миниатюры списка, чтобы сводка не расходилась с бумагой.
  const withoutPhoto = employees.filter((employee) => !pickDocumentPhoto(employee, photos.get(employee.id)))

  // Мероприятие, в которое пишем. Новое создаётся ОДИН раз: после создания оно
  // встаёт в список выбранным, а форма очищается — иначе повтор после отказа
  // записи состава создавал бы его снова и упирался в projects_identity_key.
  async function resolveProject(): Promise<ProjectBrief> {
    if (selected) return selected
    const created = await createProject(draft)
    setProjects((current) => [created, ...current])
    setProjectId(created.id)
    setMode('existing')
    setDraft(EMPTY_DRAFT)
    return created
  }

  async function run(withFile: boolean) {
    if (!canSave || isBusy || (withFile && !hasDate)) return
    const controller = new AbortController()
    abortRef.current = controller
    setPhase({ kind: 'saving' })

    let project: ProjectBrief
    try {
      project = await resolveProject()
    } catch (error) {
      if (controller.signal.aborted) return
      reportAppError(error, { scope: 'loader', route: '/employees', detail: { source: 'roster-project' } })
      setPhase({ kind: 'error', text: projectErrorText(error, tr) })
      return
    }

    try {
      await addEmployeesToProject(project.id, employees.map((employee) => employee.id))
    } catch (error) {
      if (controller.signal.aborted) return
      reportAppError(error, { scope: 'loader', route: '/employees', detail: { source: 'roster-save' } })
      setPhase({ kind: 'error', text: rosterErrorText(error, tr) })
      return
    }
    // Дровер закрыли, пока шла запись: состав сохранён, но уводить человека со
    // страницы, на которой он остался, уже нельзя.
    if (controller.signal.aborted) return
    setSavedProjectId(project.id)

    if (!withFile || !project.date_from) {
      onSaved(project.id)
      return
    }

    // Знаменатель известен заранее — по той же сводке «без фото», что ниже:
    // иначе первая секунда показывала бы «0 из 0».
    setPhase({ kind: 'preparing', done: 0, total: employees.length - withoutPhoto.length })
    try {
      const result = await onExport({ name: project.name, dateFrom: project.date_from, dateTo: project.date_to, language }, {
        includeAddress,
        signal: controller.signal,
        onProgress: (done, total) => {
          if (!controller.signal.aborted) setPhase({ kind: 'preparing', done, total })
        },
      })
      if (controller.signal.aborted) return
      // Часть фото не приехала — остаёмся: уход на мероприятие унёс бы с экрана
      // единственное сообщение о прочерках в документе.
      if (result.failed > 0) setPhase({ kind: 'done', failed: result.failed })
      else onSaved(project.id)
    } catch (error) {
      // Отмена — не отказ: дровер уже закрыт, показывать некому и незачем.
      if (controller.signal.aborted) return
      reportAppError(error, { scope: 'loader', route: '/employees', detail: { source: 'event-export' } })
      setPhase({ kind: 'error', text: tr('Состав сохранён, но файл собрать не удалось. Повторите попытку.', 'Tarkib saqlandi, lekin faylni yig‘ib bo‘lmadi. Qayta urinib ko‘ring.') })
    }
  }

  const datePickerLabels = {
    locale,
    placeholder: tr('Не указана', 'Ko‘rsatilmagan'),
    todayLabel: tr('Сегодня', 'Bugun'),
    clearLabel: tr('Очистить', 'Tozalash'),
    previousMonthLabel: tr('Предыдущий месяц', 'Oldingi oy'),
    nextMonthLabel: tr('Следующий месяц', 'Keyingi oy'),
  }

  const modes: { value: 'existing' | 'new'; label: string }[] = [
    { value: 'existing', label: tr('Существующее', 'Mavjud') },
    { value: 'new', label: tr('Новое мероприятие', 'Yangi tadbir') },
  ]

  // Первый пункт — приглашение: AppSelect показывает options[0], когда значения
  // нет в списке, и чужое мероприятие «по умолчанию» было бы враньём.
  const projectOptions = [
    { value: '', label: loadState === 'loading' ? tr('Загружаем мероприятия…', 'Tadbirlar yuklanmoqda…') : tr('Выберите мероприятие', 'Tadbirni tanlang') },
    ...projects.map((project) => ({ value: project.id, label: `${project.name} · ${formatProjectPeriod(project.date_from, project.date_to, locale, tr)}` })),
  ]

  return (
    <DrawerLayer ariaLabel={tr('Состав на мероприятие', 'Tadbir tarkibi')} onRequestClose={requestClose} className="drawer">
      <div className="drawer__header">
        <div>
          <p className="eyebrow">{tr('Мероприятие', 'Tadbir')}</p>
          <h2>{tr('Состав на мероприятие', 'Tadbir tarkibi')}</h2>
          <p className="drawer__lead">{tr('Сотрудников', 'Xodimlar')}: {employees.length.toLocaleString(locale)}</p>
        </div>
        <div className="drawer__header-actions">
          <button autoFocus className="icon-button icon-button--bordered" onClick={requestClose} aria-label={tr('Закрыть', 'Yopish')}><X size={19} /></button>
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

      <div className="segmented" role="group" aria-label={tr('Куда записать состав', 'Tarkibni qayerga yozish')}>
        {modes.map((item) => (
          <button key={item.value} type="button" aria-pressed={mode === item.value} disabled={isBusy} onClick={() => setMode(item.value)}>
            {mode === item.value && <span className="segmented__thumb" />}
            {item.label}
          </button>
        ))}
      </div>

      <div className="event-document-fields">
        {mode === 'existing' ? (
          <div className="field">
            <span>{tr('Мероприятие', 'Tadbir')} *</span>
            <AppSelect value={projectId} options={projectOptions} onChange={setProjectId} ariaLabel={tr('Мероприятие', 'Tadbir')} />
            {loadState === 'failed' && (
              <>
                <small className="field-hint field-hint--error">{tr('Не удалось загрузить мероприятия.', 'Tadbirlarni yuklab bo‘lmadi.')}</small>
                <RetryButton onClick={() => setReloadKey((value) => value + 1)} />
              </>
            )}
            {loadState === 'ready' && projects.length === 0 && (
              <small className="field-hint">{tr('Мероприятий пока нет — заведите новое.', 'Hozircha tadbirlar yo‘q — yangisini yarating.')}</small>
            )}
          </div>
        ) : (
          <>
            <label className="field">
              <span>{tr('Название', 'Nomi')} *</span>
              <input
                value={draft.name}
                disabled={isBusy}
                onChange={(event) => patch({ name: event.target.value })}
                placeholder={tr('Например, Форум в Hyatt', 'Masalan, Hyatt forumi')}
              />
            </label>

            <label className="field">
              <span>{tr('Заказчик', 'Buyurtmachi')}</span>
              <input
                value={draft.clientName}
                disabled={isBusy}
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

            <VenueField value={draft.venueId} onChange={(venueId) => patch({ venueId })} disabled={isBusy} />
          </>
        )}

        {/* Язык бумаги, а не интерфейса: в UZ-документ уходят узбекские заголовки,
            даже если человек работает в русском интерфейсе. */}
        <div className="field">
          <span>{tr('Язык документа', 'Hujjat tili')}</span>
          <div className="language-switch" role="group" aria-label={tr('Язык документа', 'Hujjat tili')}>
            <button type="button" className={language === 'ru' ? 'active' : ''} aria-pressed={language === 'ru'} onClick={() => setLanguage('ru')}>RU</button>
            <button type="button" className={language === 'uz' ? 'active' : ''} aria-pressed={language === 'uz'} onClick={() => setLanguage('uz')}>UZ</button>
          </div>
        </div>

        <div className="field">
          <label className="select-all">
            <input type="checkbox" checked={includeAddress} onChange={(event) => setIncludeAddress(event.target.checked)} />
            <span>{tr('С адресом — графа «Место жительства» в Excel', 'Manzil bilan — Excelda «Yashash manzili» ustuni')}</span>
          </label>
        </div>
      </div>

      <div className="event-export-summary">
        {/* В файл идут отмеченные сейчас люди, а не весь состав: говорим это
            словами там, где состав у мероприятия уже есть (или мы не знаем). */}
        {selected && !savedProjectId && staffCount !== 0 && (
          <small>
            {staffCount !== null && `${tr('В составе мероприятия уже', 'Tadbir tarkibida allaqachon')}: ${staffCount.toLocaleString(locale)}. `}
            {tr('Отмеченные добавятся к составу; в Excel попадут только отмеченные сейчас, а не весь состав.', 'Belgilanganlar tarkibga qo‘shiladi; Excelga butun tarkib emas, faqat hozir belgilanganlar tushadi.')}
          </small>
        )}
        {!photosKnown
          ? <strong>{tr('Фото проверить не удалось — обновите страницу', 'Fotolarni tekshirib bo‘lmadi — sahifani yangilang')}</strong>
          : withoutPhoto.length === 0
            ? <strong>{tr('Фото есть у всех', 'Hammada foto bor')}</strong>
            : <>
              <strong>{tr('Без фото', 'Fotosiz')}: {withoutPhoto.length.toLocaleString(locale)}</strong>
              <small>{withoutPhoto.map((employee) => employeeFullName(employee)).join(', ')}</small>
            </>}
      </div>

      <div className="event-export-actions">
        {phase.kind === 'error' && <p className="form-error"><CircleAlert size={15} /> {phase.text}</p>}
        <button className="button button--primary button--wide" disabled={!canSave || isBusy} onClick={() => void run(false)}>
          <Save size={17} /> {tr('Сохранить состав', 'Tarkibni saqlash')}
        </button>
        <button className="button button--secondary button--wide" disabled={!canSave || !hasDate || isBusy} onClick={() => void run(true)}>
          <FileSpreadsheet size={17} /> {tr('Сохранить и скачать Excel', 'Saqlash va Excel yuklab olish')}
        </button>
        {canSave && !hasDate && (
          <small className="field-hint">
            {mode === 'existing'
              ? tr('У мероприятия нет даты начала — без неё Excel не собрать. Состав сохранить можно; дату укажите на странице мероприятия.', 'Tadbirning boshlanish sanasi yo‘q — usiz Excel yig‘ilmaydi. Tarkibni saqlash mumkin; sanani tadbir sahifasida ko‘rsating.')
              : tr('Чтобы скачать Excel, укажите дату начала. Состав сохранить можно и без неё.', 'Excel yuklab olish uchun boshlanish sanasini ko‘rsating. Tarkibni usiz ham saqlash mumkin.')}
          </small>
        )}
        {phase.kind === 'saving' && <small className="field-hint">{tr('Сохраняем состав…', 'Tarkib saqlanmoqda…')}</small>}
        {phase.kind === 'preparing' && (
          <small className="field-hint">
            {tr(`Состав сохранён. Готовим фото ${phase.done} из ${phase.total}…`, `Tarkib saqlandi. Suratlar tayyorlanmoqda: ${phase.done} / ${phase.total}…`)}
          </small>
        )}
        {phase.kind === 'done' && (
          <small className="field-hint">
            {tr('Состав сохранён, файл скачан', 'Tarkib saqlandi, fayl yuklab olindi')}
            {` · ${tr(`Не удалось получить фото: ${phase.failed} — в документе прочерк`, `Suratlarni olib bo‘lmadi: ${phase.failed} — hujjatda chiziqcha`)}`}
          </small>
        )}
        {/* Состав уже в базе, а дровер остался (фото не приехали или файл не
            собрался) — даём уйти на мероприятие руками. */}
        {savedProjectId && !isBusy && (
          <button className="button button--secondary button--wide" onClick={() => onSaved(savedProjectId)}>
            {tr('Открыть мероприятие', 'Tadbirni ochish')}
          </button>
        )}
      </div>
    </DrawerLayer>
  )
}
