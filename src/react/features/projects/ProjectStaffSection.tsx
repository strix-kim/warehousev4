import { CircleAlert, FileSpreadsheet, Users, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { addProjectStaffMember, fetchProjectStaff, fetchProjectStaffEmployees, projectStaffErrorText, removeProjectStaffMember, sortStaff, STAFF_DELETE_NOT_APPLIED, type ProjectStaffMember } from './staffApi'
import type { Project } from './types'
import { EmployeePicker } from '../../components/EmployeePicker'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState, RetryButton } from '../../components/ErrorState'
import { PhotoThumb } from '../../components/PhotoThumb'
import { fetchEmployeeBriefs, fetchEmployeePhotos, getSignedUrls, pickDocumentPhoto, type EmployeePhotoRef } from '../employees/api'
import { downloadEmployeeEventXlsx, loadEventPhotos } from '../employees/eventExport'
import { employeeDepartmentLabel, employeeFullName, hiredMarkLabel, isHiredEmployee, type EmployeeBrief, type EmployeeListItem } from '../employees/types'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'
import type { EventDocumentMeta } from '../../lib/xlsx/eventDocument'

const ROUTE = '/projects/:projectId'

// Фаза одной сборки документа — тем же союзом, что в окне выгрузки сотрудников:
// «готовим» без счётчика и «готово» без числа непрочитанных фото не бывает.
type ExportPhase =
  | { kind: 'idle' }
  | { kind: 'preparing'; done: number; total: number }
  | { kind: 'done'; failed: number }
  | { kind: 'error' }

// Строка под полем добавления. Союзом, а не готовым текстом там, где фразу
// собирает эффект: tr в зависимостях эффекта перезагружал бы состав на смену
// языка. Отказ записи приходит уже фразой — ей нужен сам объект ошибки.
type Notice =
  | { kind: 'duplicate'; name: string }
  | { kind: 'refresh-failed' }
  | { kind: 'error'; text: string }

// Инициалы для аватара без фото: первые буквы фамилии и имени.
function employeeInitials(employee: EmployeeListItem) {
  return [employee.last_name, employee.first_name].map((part) => part?.trim().slice(0, 1).toUpperCase() ?? '').join('')
}

// Блок «Состав» на странице мероприятия: кто едет, добавить, убрать, выгрузить
// список в Excel. Данные блок грузит сам и НЕ кэширует: состав правят с двух
// вкладок, а полные строки с паспортом приезжают только в момент выгрузки.
// Каждая правка — сразу запись в базу, кнопки «Сохранить» у блока нет.
export function ProjectStaffSection({ project }: {
  // Реквизиты нужны шапке документа; при правке мероприятия страница отдаёт
  // сюда уже обновлённую строку.
  project: Pick<Project, 'id' | 'name' | 'date_from' | 'date_to'>
}) {
  const { tr, locale } = useLanguage()
  const projectId = project.id
  const [members, setMembers] = useState<ProjectStaffMember[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [reloadKey, setReloadKey] = useState(0)
  // Кандидаты пикера грузятся по первому фокусу, а не с блоком: большинство
  // заходов на страницу состав не правят.
  const [candidates, setCandidates] = useState<EmployeeBrief[]>([])
  const [candidatesState, setCandidatesState] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle')
  // Кого сейчас добавляем и убираем. Множествами: людей набирают подряд, не
  // дожидаясь ответа на предыдущего, и поле на время запроса не запирается.
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set())
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())
  const [notice, setNotice] = useState<Notice | null>(null)
  // Миниатюры — как в реестре сотрудников: карта фото из общего кэша памяти и
  // подписанные ссылки. Их отказ состав не роняет.
  const [photos, setPhotos] = useState<Map<string, EmployeePhotoRef[]>>(new Map())
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map())
  // Язык документа по умолчанию UZ — как в окне выгрузки сотрудников: бумагу на
  // объект подают по-узбекски, с языком интерфейса он не связан.
  const [language, setLanguage] = useState<EventDocumentMeta['language']>('uz')
  // Графа «Место жительства» — по выбору, по умолчанию выключена (решение
  // прораба с53, п. 8): образец документа — восемь граф.
  const [includeAddress, setIncludeAddress] = useState(false)
  const [phase, setPhase] = useState<ExportPhase>({ kind: 'idle' })
  // Уход со страницы обязан гасить очередь загрузок фото.
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => () => abortRef.current?.abort(), [])

  useEffect(() => {
    let isCurrent = true
    // Скелет — только на первой загрузке и после «Повторить»; тихое перечитывание
    // (reloadKey > 0 при живом списке) список с экрана не снимает.
    setLoadState((current) => (current === 'ready' ? current : 'loading'))
    fetchProjectStaff(projectId)
      .then((rows) => {
        if (!isCurrent) return
        setMembers(rows)
        setLoadState('ready')
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        // Пустой список и провал загрузки — разные состояния (gotchas §11): без
        // показанного состава рисуем отказ, а не «никого нет»; при показанном —
        // говорим, что обновить не вышло.
        setLoadState((current) => (current === 'ready' ? current : 'failed'))
        setNotice({ kind: 'refresh-failed' })
        reportAppError(error, { scope: 'loader', route: ROUTE, detail: { source: 'staff' } })
      })
    return () => { isCurrent = false }
  }, [projectId, reloadKey])

  useEffect(() => {
    let isCurrent = true
    fetchEmployeePhotos()
      .then((byEmployee) => { if (isCurrent) setPhotos(byEmployee) })
      .catch((error: unknown) => reportAppError(error, { scope: 'loader', route: ROUTE, detail: { source: 'staff-photos' } }))
    return () => { isCurrent = false }
  }, [])

  // Подписываем только фото для документов людей состава. Кэш ссылок общий на
  // бакет, поэтому повтор на каждое добавление стоит одного нового пути.
  useEffect(() => {
    let isCurrent = true
    const paths = members
      .map((member) => pickDocumentPhoto(member.employee, photos.get(member.employee_id))?.storage_path)
      .filter((path): path is string => Boolean(path))
    if (paths.length === 0) return
    getSignedUrls(paths)
      .then((urls) => { if (isCurrent) setPhotoUrls(urls) })
      .catch((error: unknown) => reportAppError(error, { scope: 'loader', route: ROUTE, detail: { source: 'staff-photos' } }))
    return () => { isCurrent = false }
  }, [members, photos])

  function loadCandidates() {
    setCandidatesState('loading')
    fetchEmployeeBriefs()
      .then((rows) => {
        setCandidates(rows)
        setCandidatesState('ready')
      })
      .catch((error: unknown) => {
        setCandidatesState('failed')
        reportAppError(error, { scope: 'loader', route: ROUTE, detail: { source: 'staff-candidates' } })
      })
  }

  // Из выдачи пикера убраны и уже добавленные, и те, чья вставка ещё в пути:
  // второй клик по тому же человеку иначе ушёл бы вторым запросом.
  const exclude = useMemo(() => new Set([...members.map((member) => member.employee_id), ...addingIds]), [members, addingIds])

  async function add(employee: EmployeeBrief) {
    setNotice(null)
    setAddingIds((current) => new Set(current).add(employee.id))
    try {
      const member = await addProjectStaffMember(projectId, employee.id)
      if (member) {
        setMembers((current) => (current.some((item) => item.id === member.id) ? current : sortStaff([...current, member])))
      } else {
        // Человека уже добавили из другой вкладки: не ошибка, но наш список
        // устарел — перечитываем его целиком.
        setNotice({ kind: 'duplicate', name: employeeFullName(employee) })
        setReloadKey((current) => current + 1)
      }
    } catch (error) {
      setNotice({ kind: 'error', text: projectStaffErrorText(error, tr) })
      reportAppError(error, { scope: 'loader', route: ROUTE, detail: { source: 'staff-add' } })
    } finally {
      setAddingIds((current) => {
        const next = new Set(current)
        next.delete(employee.id)
        return next
      })
    }
  }

  async function remove(member: ProjectStaffMember) {
    setNotice(null)
    setRemovingIds((current) => new Set(current).add(member.id))
    try {
      await removeProjectStaffMember(member.id)
      setMembers((current) => current.filter((item) => item.id !== member.id))
    } catch (error) {
      setNotice({ kind: 'error', text: projectStaffErrorText(error, tr) })
      // Ноль удалённых строк — список на экране разошёлся с базой.
      if (error instanceof Error && error.message === STAFF_DELETE_NOT_APPLIED) setReloadKey((current) => current + 1)
      reportAppError(error, { scope: 'loader', route: ROUTE, detail: { source: 'staff-remove' } })
    } finally {
      setRemovingIds((current) => {
        const next = new Set(current)
        next.delete(member.id)
        return next
      })
    }
  }

  const hiredCount = members.filter((member) => isHiredEmployee(member.employee)).length
  // Сколько портретов предстоит скачать — тем же правилом, что миниатюры:
  // знаменатель прогресса известен до первого ответа, без «0 из 0».
  const withPhotoCount = members.filter((member) => pickDocumentPhoto(member.employee, photos.get(member.employee_id))).length

  // Дата начала в документе обязательна: её печатает заголовок бумаги
  // (EventDocumentMeta.dateFrom). Проверка — про документ, а не про право.
  const dateFrom = project.date_from
  const canExport = Boolean(dateFrom) && members.length > 0 && phase.kind !== 'preparing'

  // Сборка документа — та же последовательность, что exportEventList на странице
  // сотрудников, но состав и карта фото перечитываются В МОМЕНТ нажатия: бумага
  // обязана совпасть с базой, а не с экраном, который могла обогнать вторая вкладка.
  async function runExport() {
    if (!canExport || !dateFrom) return
    const controller = new AbortController()
    abortRef.current = controller
    setPhase({ kind: 'preparing', done: 0, total: withPhotoCount })
    try {
      const [full, photoMap] = await Promise.all([fetchProjectStaffEmployees(projectId), fetchEmployeePhotos()])
      if (controller.signal.aborted) return
      if (full.length === 0) {
        // Состав успели опустошить: пустую бумагу не отдаём, показываем правду.
        setPhase({ kind: 'idle' })
        setReloadKey((current) => current + 1)
        return
      }
      const refs = full
        .map((employee) => ({ employeeId: employee.id, photo: pickDocumentPhoto(employee, photoMap.get(employee.id)) }))
        .filter((item): item is { employeeId: string; photo: EmployeePhotoRef } => Boolean(item.photo))
        .map((item) => ({ employeeId: item.employeeId, storage_path: item.photo.storage_path }))
      const { photos: loaded, failed } = await loadEventPhotos(refs, {
        signal: controller.signal,
        onProgress: (done, total) => {
          if (!controller.signal.aborted) setPhase({ kind: 'preparing', done, total })
        },
      })
      // Отменённый прогон файл не отдаёт: человек уже ушёл со страницы.
      if (controller.signal.aborted) return
      const meta: EventDocumentMeta = { name: project.name, dateFrom, dateTo: project.date_to, language }
      downloadEmployeeEventXlsx({ employees: full, meta, photos: loaded, includeAddress })
      setPhase({ kind: 'done', failed })
    } catch (error) {
      if (controller.signal.aborted) return
      reportAppError(error, { scope: 'loader', route: ROUTE, detail: { source: 'staff-export' } })
      setPhase({ kind: 'error' })
    }
  }

  const noticeText = !notice
    ? ''
    : notice.kind === 'duplicate'
      ? tr(`${notice.name} уже в составе — список обновлён.`, `${notice.name} allaqachon tarkibda — ro‘yxat yangilandi.`)
      : notice.kind === 'refresh-failed'
        ? tr('Не удалось обновить состав — проверьте интернет и обновите страницу.', 'Tarkibni yangilab bo‘lmadi — internetni tekshirib, sahifani yangilang.')
        : notice.text

  return (
    <section className="data-panel project-section project-section--staff">
      <header className="project-section__head">
        <h2>{tr('Состав', 'Tarkib')}</h2>
        {loadState === 'ready' && <span className="project-section__count">{members.length.toLocaleString(locale)}</span>}
      </header>

      {loadState === 'loading' && <div className="project-skeleton" role="status" aria-label={tr('Загружаем состав…', 'Tarkib yuklanmoqda…')}><span /><span /></div>}

      {loadState === 'failed' && (
        <ErrorState
          title={tr('Не удалось загрузить состав', 'Tarkibni yuklab bo‘lmadi')}
          text={tr('Проверьте интернет и повторите. Сам состав не изменился.', 'Internetni tekshiring va qayta urinib ko‘ring. Tarkibning o‘zi o‘zgarmadi.')}
          action={<RetryButton onClick={() => { setNotice(null); setReloadKey((current) => current + 1) }} />}
        />
      )}

      {loadState === 'ready' && (
        <>
          <div className="project-staff-tools">
            <EmployeePicker
              candidates={candidates}
              candidatesState={candidatesState}
              onLoad={loadCandidates}
              exclude={exclude}
              onPick={(employee) => { void add(employee) }}
              label={tr('Добавить в состав', 'Tarkibga qo‘shish')}
              placeholder={tr('Фамилия или имя — добавится сразу', 'Familiya yoki ism — darhol qo‘shiladi')}
              renderOption={(employee) => (
                <>
                  {/* Метка только у наёмного: штат — значение по умолчанию. */}
                  <span className="registry-name">
                    <span>{employeeFullName(employee)}</span>
                    {isHiredEmployee(employee) && <span className="badge badge--neutral">{hiredMarkLabel(tr)}</span>}
                  </span>
                  <small>{employee.position || tr('Должность не указана', 'Lavozim ko‘rsatilmagan')}</small>
                </>
              )}
            />
            {notice && (notice.kind === 'duplicate'
              ? <p className="project-staff-notice" role="status">{noticeText}</p>
              : <p className="form-error project-error" role="alert"><CircleAlert size={15} /> {noticeText}</p>)}
            {members.length > 0 && (
              <p className="project-staff-summary">
                {tr('В составе', 'Tarkibda')}: {members.length.toLocaleString(locale)}
                {/* Разбивка — только когда есть наёмные: «штат 12 · наёмные 0» шум. */}
                {hiredCount > 0 && ` · ${employeeDepartmentLabel('staff', tr)}: ${(members.length - hiredCount).toLocaleString(locale)} · ${employeeDepartmentLabel('hired', tr)}: ${hiredCount.toLocaleString(locale)}`}
              </p>
            )}
          </div>

          {members.length === 0
            ? (
              <EmptyState
                icon={<Users size={27} />}
                title={tr('В составе пока никого', 'Tarkibda hozircha hech kim yo‘q')}
                text={tr('Найдите сотрудника в поле выше — он добавится сразу. Потом список можно скачать в Excel.', 'Yuqoridagi maydonda xodimni toping — u darhol qo‘shiladi. Keyin ro‘yxatni Excelga yuklab olish mumkin.')}
              />
            )
            : (
              <>
                <div className="project-staff-export">
                  {/* Язык бумаги, а не интерфейса — та же пара кнопок, что в
                      дроверах «на мероприятие» (состав, машины). */}
                  <span className="project-staff-export__lang">
                    {tr('Язык документа', 'Hujjat tili')}
                    <span className="language-switch" role="group" aria-label={tr('Язык документа', 'Hujjat tili')}>
                      <button type="button" className={language === 'ru' ? 'active' : ''} aria-pressed={language === 'ru'} onClick={() => setLanguage('ru')}>RU</button>
                      <button type="button" className={language === 'uz' ? 'active' : ''} aria-pressed={language === 'uz'} onClick={() => setLanguage('uz')}>UZ</button>
                    </span>
                  </span>
                  <label className="project-staff-export__option" title={tr('Добавить в документ графу «Место жительства»', 'Hujjatga «Yashash joyi» ustunini qo‘shish')}>
                    <input type="checkbox" checked={includeAddress} onChange={(event) => setIncludeAddress(event.target.checked)} />
                    <span>{tr('С адресом', 'Manzil bilan')}</span>
                  </label>
                  <button className="button button--primary" disabled={!canExport} onClick={() => void runExport()}>
                    <FileSpreadsheet size={17} /> {tr('Скачать Excel', 'Excel yuklab olish')}
                  </button>
                  {!dateFrom && (
                    <small className="field-hint field-hint--error">
                      {tr('Укажите дату мероприятия («Изменить» вверху страницы) — без неё документ не собрать.', 'Tadbir sanasini ko‘rsating (sahifa tepasidagi «O‘zgartirish») — usiz hujjat yig‘ilmaydi.')}
                    </small>
                  )}
                  {phase.kind === 'preparing' && (
                    <small className="field-hint" role="status">
                      {phase.total > 0
                        ? tr(`Готовим фото ${phase.done} из ${phase.total}…`, `Suratlar tayyorlanmoqda: ${phase.done} / ${phase.total}…`)
                        : tr('Готовим документ…', 'Hujjat tayyorlanmoqda…')}
                    </small>
                  )}
                  {phase.kind === 'done' && (
                    <small className="field-hint" role="status">
                      {tr('Файл скачан', 'Fayl yuklab olindi')}
                      {phase.failed > 0 && ` · ${tr(`Не удалось получить фото: ${phase.failed} — в документе прочерк`, `Suratlarni olib bo‘lmadi: ${phase.failed} — hujjatda chiziqcha`)}`}
                    </small>
                  )}
                  {phase.kind === 'error' && (
                    <small className="field-hint field-hint--error" role="alert">
                      {tr('Не удалось собрать файл. Повторите попытку.', 'Faylni yig‘ib bo‘lmadi. Qayta urinib ko‘ring.')}
                    </small>
                  )}
                </div>

                <ul className="project-rows">
                  {members.map((member) => {
                    const employee = member.employee
                    const photo = pickDocumentPhoto(employee, photos.get(member.employee_id))
                    const fullName = employeeFullName(employee)
                    return (
                      <li key={member.id} className="project-staff-row">
                        <div className="equipment-cell">
                          <PhotoThumb className="registry-avatar" url={photo ? photoUrls.get(photo.storage_path) : undefined} placeholder={<span aria-hidden="true">{employeeInitials(employee)}</span>} />
                          <span>
                            <span className="registry-name">
                              <strong title={fullName}>{fullName}</strong>
                              {isHiredEmployee(employee) && <span className="badge badge--neutral">{hiredMarkLabel(tr)}</span>}
                            </span>
                            <small>{employee.position || tr('Должность не указана', 'Lavozim ko‘rsatilmagan')}</small>
                          </span>
                        </div>
                        {/* Один клик без подтверждения: убрать из состава обратимо
                            — человека возвращает то же поле добавления. */}
                        <button
                          type="button"
                          className="icon-button icon-button--bordered"
                          disabled={removingIds.has(member.id)}
                          onClick={() => { void remove(member) }}
                          aria-label={tr(`Убрать из состава: ${fullName}`, `Tarkibdan olib tashlash: ${fullName}`)}
                          title={tr('Убрать из состава', 'Tarkibdan olib tashlash')}
                        >
                          <X size={16} />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
        </>
      )}
    </section>
  )
}
