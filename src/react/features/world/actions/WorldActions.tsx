// Хост действий мира: по action из useWorldActions рисует дровер поверх сцены (план
// world-game-s59.md, решения 2–4). Своих форм и проверок у мира нет: монтируется тот же
// дровер, что на страницах мероприятий, и запись идёт теми же функциями под теми же
// политиками. Отказ базы показывает сам дровер своим текстом (projectErrorText).
import { AnimatePresence } from 'motion/react'
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import { useLanguage } from '../../../lib/i18n'
import { reportAppError } from '../../../lib/reportAppError'
import { createProject, fetchProject, updateProject } from '../../projects/api'
import type { ProjectInput, ProjectWithVenue } from '../../projects/types'
import type { WorldStore } from '../worldStore'
import type { WorldAction } from './useWorldActions'

// Пропсы донора (ProjectMetaDrawer) и onDown — для заглушки ниже; донор его не читает
type DrawerProps = {
  project?: ProjectWithVenue
  onClose: () => void
  onSubmit: (input: ProjectInput) => Promise<void>
  onDown: () => void
}

// Чанк формы не приехал: рисовать нечего, остаётся сообщить хосту — он закроет действие
function DrawerDown({ onDown }: DrawerProps) {
  useEffect(() => { onDown() }, [onDown])
  return null
}

// Дровер мероприятия — своим чанком: форма не входит ни во входной чанк, ни в чанк
// сцены. Не lazyWithReload: тот при провале чанка перезагружает страницу, а перезагрузка
// убила бы мир. Отказ оставляет след и отдаёт заглушку-вестника (как сцена на главной).
// Стили дровера лежат в projects.css, а его тянут только страницы мероприятий — в мире
// едут тем же запросом.
const ProjectDrawer = lazy((): Promise<{ default: ComponentType<DrawerProps> }> => Promise.all([
  import('../../projects/ProjectMetaDrawer'),
  import('../../projects/projects.css'),
]).then(
  ([module]) => ({ default: module.ProjectMetaDrawer }),
  (error: unknown) => {
    reportAppError(error, { scope: 'chunk', route: window.location.pathname, detail: { chunk: 'world-project-drawer' } })
    return { default: DrawerDown }
  },
))

// Ожидание перед дровером: пелена на сцене и плашка со словами. Клик по пелене и Esc
// отменяют действие. Слушатель на window, как у useModalLayer: панель участка под
// флагом modal свой Esc пропускает.
function Wait({ text, onCancel }: { text: string; onCancel: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])
  return (
    <div className="w-acts__wait" onClick={onCancel}>
      <p className="w-plaque" role="status">{text}</p>
    </div>
  )
}

type Props = {
  store: WorldStore
  action: WorldAction
  onClose: () => void
  // Перечитать реестр мероприятий мимо кэша (useWorldData): мир узнаёт о записи явно
  reload: () => Promise<void>
  // Новое мероприятие записано и реестр перечитан: посадку (адрес, камера, фокус, тост)
  // ведёт сцена — она знает, встал ли участок в сетку
  onCreated: (projectId: string) => void
  // «Плюс» пустой ячейки стоит в состоянии «строится»
  onBuilding: (on: boolean) => void
  toast: (text: string, opts?: { link?: { to: string; label: string } }) => void
}

export function WorldActions({ store, action, onClose, reload, onCreated, onBuilding, toast }: Props) {
  const { tr } = useLanguage()
  // Колбэки и язык меняются между рендерами, а запрос строки и заглушка чанка из-за них
  // перезапускаться не должны — читают свежее через ref
  const liveRef = useRef({ tr, toast, onClose })
  useEffect(() => { liveRef.current = { tr, toast, onClose } })
  const cancel = useCallback(() => liveRef.current.onClose(), [])

  // Флаг modal (контракт — worldStore.ts): пока действие открыто, панель участка не
  // слушает Esc. Снимается при закрытии и при размонтировании хоста.
  const open = action !== null
  useEffect(() => {
    if (!open) return
    store.setState({ modal: true })
    return () => store.setState({ modal: false })
  }, [open, store])

  // Правка: строка мероприятия читается при открытии, по id и мимо кэша — как на
  // странице мероприятия. В реестре мира её полей (описание, venue_id) нет.
  const editId = action?.kind === 'project-edit' ? action.lotId ?? null : null
  const [loaded, setLoaded] = useState<ProjectWithVenue | null>(null)
  // Строка прошлого открытия — не этого мероприятия: ждём свою
  const project = loaded && loaded.id === editId ? loaded : null
  useEffect(() => {
    if (!editId) return
    let isCurrent = true
    fetchProject(editId).then((row) => {
      if (!isCurrent) return
      if (row) { setLoaded(row); return }
      // Строки нет или её не видно политикой — это не отказ запроса (gotchas §11)
      const live = liveRef.current
      live.toast(live.tr('Мероприятие не найдено: возможно, его удалили', 'Tadbir topilmadi: ehtimol, u o‘chirilgan'))
      live.onClose()
    }, (error: unknown) => {
      if (!isCurrent) return
      reportAppError(error, { scope: 'loader', route: window.location.pathname, detail: { source: 'world-project-edit' } })
      const live = liveRef.current
      live.toast(live.tr('Не удалось открыть мероприятие. Проверьте интернет и повторите.', 'Tadbirni ochib bo‘lmadi. Internetni tekshirib, qayta urinib ko‘ring.'))
      live.onClose()
    })
    // Следующее открытие читает строку заново: форма снимает черновик один раз, при монтаже
    return () => { isCurrent = false; setLoaded(null) }
  }, [editId])

  // Чанк формы не приехал: действие закрывается, форма остаётся доступной в реестре
  const down = useCallback(() => {
    const live = liveRef.current
    live.toast(live.tr('Форма не загрузилась. Проверьте интернет.', 'Shakl yuklanmadi. Internetni tekshiring.'), { link: { to: '/projects', label: live.tr('Мероприятия', 'Tadbirlar') } })
    live.onClose()
  }, [])

  // Отказ записи уходит наружу — его показывает дровер и оставляет форму заполненной.
  // Успех: дровер закрывается сразу, а мир перечитывает реестр — объект в сцене
  // появляется только после ответа базы (решение 4), до него «плюс» строится.
  async function createNew(input: ProjectInput) {
    // «Строится…» — только после ответа вставки: при отказе записи плюс не мигает,
    // а под открытым дровером стройки не видно
    const created = await createProject(input)
    onBuilding(true)
    try {
      onClose()
      await reload()
      onCreated(created.id)
    } finally {
      onBuilding(false)
    }
  }

  async function saveEdit(id: string, input: ProjectInput) {
    await updateProject(id, input)
    onClose()
    await reload()
    toast(tr('Сохранено', 'Saqlandi'))
  }

  return (
    <div className="w-acts w-acts--soft">
      <Suspense fallback={<Wait text={tr('Открываем форму…', 'Shakl ochilmoqda…')} onCancel={cancel} />}>
        <AnimatePresence>
          {action?.kind === 'project-new' && <ProjectDrawer key="project-new" onClose={onClose} onSubmit={createNew} onDown={down} />}
          {project && (
            <ProjectDrawer key={`project-edit:${project.id}`} project={project} onClose={onClose} onSubmit={(input) => saveEdit(project.id, input)} onDown={down} />
          )}
        </AnimatePresence>
      </Suspense>
      {editId && !project && <Wait text={tr('Загружаем мероприятие…', 'Tadbir yuklanmoqda…')} onCancel={cancel} />}
    </div>
  )
}
