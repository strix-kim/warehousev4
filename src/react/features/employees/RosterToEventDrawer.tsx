import { CircleAlert, FileSpreadsheet, Save, X } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { pickDocumentPhoto, type EmployeePhotoRef } from './api'
import { addEmployeesToProject, fetchProjectStaffCount, rosterErrorText } from './rosterApi'
import { employeeFullName, type EmployeeListItem } from './types'
import { DrawerLayer } from '../../components/DrawerLayer'
import { ProjectChoiceField, useProjectChoice } from '../../components/ProjectChoiceField'
import { UnsavedPrompt } from '../../components/UnsavedPrompt'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'
import { useGuardedClose } from '../../lib/useGuardedClose'
import { useModalLayer } from '../../lib/useModalLayer'
import type { EventDocumentMeta } from '../../lib/xlsx/eventDocument'
import { projectErrorText } from '../projects/api'
import type { ProjectBrief } from '../projects/types'

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
  // Выбор «существующее / новое» — общий с планом залов и списком машин.
  const choice = useProjectChoice({ report: { route: '/employees', source: 'roster-projects' } })
  const { mode, projectId, selected, hasDate } = choice
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
    if (!projectId) return
    let isCurrent = true
    setStaffCount(null)
    fetchProjectStaffCount(projectId)
      .then((count) => { if (isCurrent) setStaffCount(count) })
      // Число — справка к подписи: без него она остаётся общей фразой.
      .catch((error: unknown) => reportAppError(error, { scope: 'loader', route: '/employees', detail: { source: 'roster-count' } }))
    return () => { isCurrent = false }
  }, [projectId])

  // Клиентская проверка здесь — подсказка, а не защита: период держит
  // projects_dates_check, дубль — projects_identity_key, повтор человека —
  // project_staff_member_key. Кнопку запирает только заведомо мёртвый запрос:
  // мероприятие не выбрано либо у нового нет названия.
  const isBusy = phase.kind === 'saving' || phase.kind === 'preparing'
  // Состав сохраняется и без даты начала; Excel без неё не собрать (hasDate).
  const canSave = employees.length > 0 && choice.isReady

  // Терять есть что, пока набранные реквизиты нового мероприятия не записаны.
  // Выбор из списка, язык и галка — выбор, а не набранная работа.
  const isDirty = choice.isDirty
  // Во время записи и сборки не спрашиваем: закрытие здесь — отмена скачивания,
  // а уход на мероприятие после записи — не потеря ввода.
  const { requestClose, isPrompting, confirmClose, keepEditing } = useGuardedClose(isDirty && !isBusy, onClose)
  useModalLayer(requestClose)

  // Кого в документе покажет пустая рамка вместо лица — считаем тем же правилом,
  // что и миниатюры списка, чтобы сводка не расходилась с бумагой.
  const withoutPhoto = employees.filter((employee) => !pickDocumentPhoto(employee, photos.get(employee.id)))

  async function run(withFile: boolean) {
    if (!canSave || isBusy || (withFile && !hasDate)) return
    const controller = new AbortController()
    abortRef.current = controller
    setPhase({ kind: 'saving' })

    // Новое мероприятие создаётся здесь и один раз — см. useProjectChoice.ensure.
    let project: ProjectBrief | null
    try {
      project = await choice.ensure()
    } catch (error) {
      if (controller.signal.aborted) return
      reportAppError(error, { scope: 'loader', route: '/employees', detail: { source: 'roster-project' } })
      setPhase({ kind: 'error', text: projectErrorText(error, tr) })
      return
    }
    // canSave такого не пускает; ветка — для типа, а не для человека.
    if (!project) {
      setPhase({ kind: 'idle' })
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

      <ProjectChoiceField choice={choice} groupLabel={tr('Куда записать состав', 'Tarkibni qayerga yozish')} disabled={isBusy}>
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
      </ProjectChoiceField>

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
