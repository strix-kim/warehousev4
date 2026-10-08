// Хост действий мира: по action из useWorldActions рисует дровер поверх сцены (план
// world-game-s59.md, решения 2–4). Своих форм и проверок у мира нет: монтируется тот же
// дровер или блок, что на страницах продукта, и запись идёт теми же функциями под теми
// же политиками. Отказ базы показывает сам донор своим текстом.
import { AnimatePresence } from 'motion/react'
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type FunctionComponent } from 'react'
import { useLanguage } from '../../../lib/i18n'
import { reportAppError } from '../../../lib/reportAppError'
import type { HallPlanInput } from '../../halls/api'
import { createProject, fetchProject, updateProject } from '../../projects/api'
import type { ProjectInput, ProjectWithVenue } from '../../projects/types'
import type { WorldLot } from '../data/types'
import { ruPlural } from '../hud/plural'
import type { WorldStore } from '../worldStore'
import type { WorldAction } from './useWorldActions'

// onDown — для заглушки ниже: доноры его не читают
type Down = { onDown: () => void }

// Чанк формы не приехал: рисовать нечего, остаётся сообщить хосту — он закроет действие
function DrawerDown({ onDown }: Down) {
  useEffect(() => { onDown() }, [onDown])
  return null
}

// Дровер действия — своим чанком: донор не входит ни во входной чанк, ни в чанк сцены.
// Не lazyWithReload: тот при провале чанка перезагружает страницу, а перезагрузка убила
// бы мир. Отказ оставляет след и отдаёт заглушку-вестника (как сцена на главной).
function lazyDrawer<P>(chunk: string, load: () => Promise<FunctionComponent<P>>) {
  return lazy((): Promise<{ default: FunctionComponent<P & Down> }> => load().then(
    (Drawer) => ({ default: Drawer }),
    (error: unknown) => {
      reportAppError(error, { scope: 'chunk', route: window.location.pathname, detail: { chunk } })
      return { default: DrawerDown }
    },
  ))
}

// Стили доноров лежат в css своих страниц (projects.css, halls.css — у дровера плана
// оттуда счётчик залов), а их тянут только эти страницы — в мире едут тем же запросом.
const ProjectDrawer = lazyDrawer('world-project-drawer', () => Promise.all([
  import('../../projects/ProjectMetaDrawer'),
  import('../../projects/projects.css'),
]).then(([module]) => module.ProjectMetaDrawer))
const PlanDrawer = lazyDrawer('world-plan-drawer', () => Promise.all([
  import('../../halls/HallPlanMetaDrawer'),
  import('../../halls/halls.css'),
]).then(([module]) => module.HallPlanMetaDrawer))
// Блок состава статически тянет xlsx-сборщик: в чанк сцены он попасть не должен
const StaffDrawer = lazyDrawer('world-staff-drawer', () => Promise.all([
  import('./StaffDrawer'),
  import('../../projects/projects.css'),
]).then(([module]) => module.StaffDrawer))

// Серия правок состава — одна пересборка сцены: реестр перечитывается, когда после
// последней записи прошло столько миллисекунд
const STAFF_RELOAD_MS = 400

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
  // Участки реестра (WorldData.venues): дровер состава берёт реквизиты мероприятия отсюда
  venues: WorldLot[] | null
  onClose: () => void
  // Перечитать реестр мероприятий мимо кэша (useWorldData): мир узнаёт о записи явно
  reload: () => Promise<void>
  // Новое мероприятие записано и реестр перечитан: посадку (адрес, камера, фокус, тост)
  // ведёт сцена — она знает, встал ли участок в сетку
  onCreated: (projectId: string) => void
  // Запись по участку легла, реестр перечитан: «плюс»-открыватель мог исчезнуть вместе
  // с якорями пересборки — сцена открывает карточку участка и ставит фокус в её заголовок
  onSettled: (lotId: string) => void
  // «Плюс» пустой ячейки стоит в состоянии «строится»
  onBuilding: (on: boolean) => void
  toast: (text: string, opts?: { link?: { to: string; label: string } }) => void
}

export function WorldActions({ store, action, venues, onClose, reload, onCreated, onSettled, onBuilding, toast }: Props) {
  const { tr, locale } = useLanguage()
  // Колбэки и язык меняются между рендерами, а запрос строки, заглушка чанка и таймер
  // состава из-за них перезапускаться не должны — читают свежее через ref
  const liveRef = useRef({ tr, toast, onClose, action, reload, onSettled })
  useEffect(() => { liveRef.current = { tr, toast, onClose, action, reload, onSettled } })
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

  // Чанк донора не приехал: действие закрывается, а тост ведёт туда, где то же самое
  // делается страницей — в реестр, к дроверу нового плана или на страницу мероприятия
  const down = useCallback(() => {
    const live = liveRef.current
    const { tr } = live
    const lotId = live.action?.lotId
    const form = tr('Форма не загрузилась. Проверьте интернет.', 'Shakl yuklanmadi. Internetni tekshiring.')
    if (live.action?.kind === 'plan-new' && lotId) live.toast(form, { link: { to: `/halls?new=1&project=${lotId}`, label: tr('Планы залов', 'Zallar rejalari') } })
    else if (live.action?.kind === 'staff' && lotId) live.toast(tr('Состав не загрузился. Проверьте интернет.', 'Tarkib yuklanmadi. Internetni tekshiring.'), { link: { to: `/projects/${lotId}`, label: tr('Открыть мероприятие', 'Tadbirni ochish') } })
    else live.toast(form, { link: { to: '/projects', label: tr('Мероприятия', 'Tadbirlar') } })
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

  const planLotId = action?.kind === 'plan-new' ? action.lotId ?? null : null
  // Новый план залов — по образцу createPlan в HallPlansPage, но в матрицу не уводим:
  // на участке вырастает стол, а к плану ведёт ссылка тоста. Отказ первой записи уходит
  // наружу (его показывает дровер); отказ залов значит, что план уже в базе, — след и
  // дальше как при успехе.
  async function createPlan(lotId: string, input: HallPlanInput, hallCount: number) {
    // Модуль залов в чанк сцены не идёт: к этому месту он уже загружен дровером плана
    const { createHallPlan } = await import('../../halls/api')
    const { plan, hallsError } = await createHallPlan(input, hallCount, tr)
    if (hallsError) {
      reportAppError(hallsError, { scope: 'loader', route: window.location.pathname, detail: { source: 'world-create-halls', plan: plan.id } })
    }
    onClose()
    await reload()
    // Мероприятие в дровере могли сменить: стол вырос на его участке
    onSettled(input.projectId ?? lotId)
    toast(tr('План создан', 'Reja yaratildi'), { link: { to: `/halls/${plan.id}`, label: tr('Открыть план', 'Rejani ochish') } })
  }

  // Состав: реквизиты мероприятия — из участка реестра, отдельного запроса строки нет
  const staffId = action?.kind === 'staff' ? action.lotId ?? null : null
  const staffLot = staffId ? venues?.find((lot) => lot.id === staffId) ?? null : null
  // Участка нет (мероприятие ушло из реестра после перечитывания) — править нечего
  useEffect(() => {
    if (staffId && !staffLot) liveRef.current.onClose()
  }, [staffId, staffLot])

  // Перечитывание реестра после правок состава. Таймер живёт в хосте, а не в дровере:
  // закрытие дровера его не теряет. touched — участок, состав которого меняли с момента
  // открытия: после закрытия сцена вернёт фокус в его карточку.
  const staffTimer = useRef(0)
  const staffTouched = useRef<string | null>(null)
  const staffChanged = useCallback(() => {
    staffTouched.current = liveRef.current.action?.lotId ?? null
    window.clearTimeout(staffTimer.current)
    staffTimer.current = window.setTimeout(() => {
      staffTimer.current = 0
      void liveRef.current.reload()
    }, STAFF_RELOAD_MS)
  }, [])
  // Дровер закрылся: запланированное перечитывание выполняется сразу, не дожидаясь
  // таймера, — иначе сцена отстала бы от базы. Снимается таймер только вместе с хостом
  // (уход со страницы мира): там пересобирать уже нечего.
  useEffect(() => {
    if (staffId) return
    const lotId = staffTouched.current
    if (!lotId) return
    staffTouched.current = null
    if (!staffTimer.current) { liveRef.current.onSettled(lotId); return }
    window.clearTimeout(staffTimer.current)
    staffTimer.current = 0
    void liveRef.current.reload().then(() => liveRef.current.onSettled(lotId))
  }, [staffId])
  useEffect(() => () => window.clearTimeout(staffTimer.current), [])

  // Скринридеру: число людей после перечитывания реестра — то же, что встало в сцену.
  // Первое значение открытого дровера не объявляется: это ещё не правка.
  const staffCount = staffLot?.staff ?? null
  const [said, setSaid] = useState<number | null>(null)
  const saidRef = useRef<{ id: string | null; count: number | null }>({ id: null, count: null })
  useEffect(() => {
    const prev = saidRef.current
    saidRef.current = { id: staffId, count: staffCount }
    if (staffId === null || staffCount === null) setSaid(null)
    else if (prev.id === staffId && prev.count !== null && prev.count !== staffCount) setSaid(staffCount)
  }, [staffId, staffCount])

  return (
    <div className="w-acts w-acts--soft">
      <Suspense fallback={<Wait text={tr('Открываем форму…', 'Shakl ochilmoqda…')} onCancel={cancel} />}>
        <AnimatePresence>
          {action?.kind === 'project-new' && <ProjectDrawer key="project-new" onClose={onClose} onSubmit={createNew} onDown={down} />}
          {project && (
            <ProjectDrawer key={`project-edit:${project.id}`} project={project} onClose={onClose} onSubmit={(input) => saveEdit(project.id, input)} onDown={down} />
          )}
          {planLotId && (
            <PlanDrawer key={`plan-new:${planLotId}`} initialProjectId={planLotId} onClose={onClose} onSubmit={(input, hallCount) => createPlan(planLotId, input, hallCount)} onDown={down} />
          )}
          {/* При записи не закрывается: людей набирают подряд */}
          {staffLot && <StaffDrawer key={`staff:${staffLot.id}`} lot={staffLot} onClose={onClose} onChanged={staffChanged} onDown={down} />}
        </AnimatePresence>
      </Suspense>
      <p className="w-live" aria-live="polite">
        {said === null ? '' : `${tr('Состав', 'Tarkib')}: ${said.toLocaleString(locale)} ${tr(ruPlural(said, 'человек', 'человека', 'человек'), 'kishi')}`}
      </p>
      {editId && !project && <Wait text={tr('Загружаем мероприятие…', 'Tadbir yuklanmoqda…')} onCancel={cancel} />}
    </div>
  )
}
