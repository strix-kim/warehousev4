import { MonitorOff } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'
// Общие стили — раньше компонентов: world-venues.css и world-archive.css (их тянут
// панели зон) правят общие классы и обязаны встать в бандл после world-hud.css
import './world.css'
import './hud/world-hud.css'
import { useWorldActions } from './actions/useWorldActions'
import { WorldActions } from './actions/WorldActions'
import type { Quest } from './data/quests'
import { LOT_MAX } from './data/splitProjects'
import { useQuests } from './data/useQuests'
import { useWorldData } from './data/useWorldData'
import { ArchivePanel } from './hud/ArchivePanel'
import { DayCap } from './hud/DayCap'
import { Dock } from './hud/Dock'
import { GaragePanel } from './hud/GaragePanel'
import { NameChip } from './hud/NameChip'
import { Plus } from './hud/Plus'
import { QuestBoard } from './hud/QuestBoard'
import { ruPlural } from './hud/plural'
import { Sign } from './hud/Sign'
import { Toast, useWorldToast } from './hud/Toast'
import { useGarage } from './hud/useGarage'
import { VenuePanel } from './hud/VenuePanel'
import { ZoneSwitch } from './hud/ZoneSwitch'
import type { World } from './engine/createWorld'
import { loadWorld } from './loadWorld'
import type { WorldLook } from './settings'
import { hasWebGL2, prefersReducedMotion } from './support'
import { savePose, takePose } from './worldMemory'
import { ADD_LOT_ID, createWorldStore, isAddId, isWorldZone, lotPartId, parseLotId, useWorldState, WORLD_SITES, type CameraPose, type WorldSiteId, type WorldTexts, type WorldZone } from './worldStore'

// unsupported — WebGL2 нет; failed — чанк не приехал или мир не собрался;
// lost — браузер отобрал контекст у живого мира
type Status = 'loading' | 'ready' | 'unsupported' | 'failed' | 'lost'

// HMR: правка модуля движка доходит сюда (ближайшая граница Fast Refresh), эффект
// ниже сносит мир и собирает новый. Чтобы прораб после каждой правки не возвращался
// в стартовый кадр, поза камеры переезжает через import.meta.hot.data. Флаг swapping
// отличает замену модуля от обычного ухода со страницы: возврат на маршрут обязан
// начинаться с рабочего ракурса, как в проде.
const hot = import.meta.hot
if (hot) hot.dispose((data) => { data.swapping = true })

// Зоны, которые в dev по ?mock=on наполняет макет (fixtures.dev.ts) вместо реестра
const MOCK_ZONES: readonly WorldZone[] = ['venues', 'archive']
const NO_ZONES: readonly WorldZone[] = []

type Props = {
  // Облик мира: палитра и тон контура. Смена на живом мире — без перезагрузки
  look: WorldLook
  // Миллисекунды от запроса чанка до первого кадра — цифра для dev-стенда
  onFirstFrame?: (ms: number) => void
  // Сцены нет и не будет (unsupported, failed, lost). Главная по нему возвращает
  // плитки; без колбэка (/world) остаётся запасной вид самой сцены.
  onUnavailable?: () => void
}

export function WorldStage({ look, onFirstFrame, onUnavailable }: Props) {
  const { tr, locale } = useLanguage()
  // Зона живёт в адресе (?zone=): хозяин — адрес, мир только догоняет. Незнакомое
  // значение — кампус; зона без данных — тоже кампус (решает движок), адрес не трогаем:
  // данные могут ещё прийти.
  const [params, setParams] = useSearchParams()
  const zoneParam = params.get('zone')
  // Выбранный участок — тоже в адресе (?lot=<id мероприятия>). Участки стоят только на
  // «Площадках»: с параметром камера идёт туда, что бы ни стояло в zone.
  const lotParam = params.get('lot') || null
  const wantedZone: WorldZone = lotParam ? 'venues' : isWorldZone(zoneParam) ? zoneParam : 'campus'
  // Запись истории, на которой стоит мир: по её ключу worldMemory держит позу камеры.
  // Каждый replace зоны и участка даёт записи новый ключ — помним последний.
  const { key: entryKey, pathname } = useLocation()
  const entryRef = useRef(entryKey)
  useEffect(() => { entryRef.current = entryKey }, [entryKey])
  const slotRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [store] = useState(createWorldStore)
  // Одна ссылка и движку, и HUD: машины в сцене, числа вывесок и имена — из одного
  // объекта. null — данных нет, вывески стоят без чисел.
  const { data, reload, expiries, today, vehicles } = useWorldData()
  const worldRef = useRef<Pick<World, 'setStyle' | 'setData' | 'setTexts' | 'goZone' | 'focus' | 'goInside' | 'dispose'> | null>(null)
  // Гараж изнутри — третий параметр адреса (?in=garage); адрес ↔ движок ведёт hud/useGarage.ts
  const garage = useGarage({ store, worldRef, campus: wantedZone === 'campus' })
  const garageRef = useRef(garage)
  useEffect(() => { garageRef.current = garage })
  const { action, run, close, leaveTo, activate, runQuest, building, setBuilding } = useWorldActions({ store, mock: data?.mock ?? false, today, onGarage: garage.enter })
  // Дела доски и маркеры обедов — из тех же данных, что участки (data/useQuests.ts)
  const { quests, mealAlerts, said: questsSaid } = useQuests({ venues: data?.venues ?? null, mock: data?.mock ?? false, cars: data?.cars ?? null, expiries, today })
  const { toast, show, hide } = useWorldToast()
  // Новое мероприятие записано, реестр перечитан: id ждёт посадки (эффект ниже, после
  // setData). titleFor — участок, в заголовок карточки которого уйдёт фокус.
  const [landing, setLanding] = useState<string | null>(null)
  // Запись по участку из дровера действия (план, состав) легла, реестр перечитан:
  // участок ждёт возврата фокуса в свою карточку (эффект ниже, после setData)
  const [settled, setSettled] = useState<string | null>(null)
  const [titleFor, setTitleFor] = useState<string | null>(null)
  const hover = useWorldState(store, (state) => state.hover)
  const zone = useWorldState(store, (state) => state.zone)
  const zones = useWorldState(store, (state) => state.zones)
  const labels = useWorldState(store, (state) => state.labels)
  const hudCompact = useWorldState(store, (state) => state.hudCompact)
  // Мероприятие выбранного участка; часть участка (truck, plan…) в адрес не идёт
  const pickLot = useWorldState(store, (state) => parseLotId(state.pick)?.venueId ?? null)
  const [status, setStatus] = useState<Status>(() => (hasWebGL2() ? 'loading' : 'unsupported'))
  const onFirstFrameRef = useRef(onFirstFrame)
  useEffect(() => { onFirstFrameRef.current = onFirstFrame }, [onFirstFrame])
  const onUnavailableRef = useRef(onUnavailable)
  useEffect(() => { onUnavailableRef.current = onUnavailable }, [onUnavailable])
  useEffect(() => {
    if (status === 'unsupported' || status === 'failed' || status === 'lost') onUnavailableRef.current?.()
  }, [status])
  const { palette, ink } = look
  // Мир собирается после загрузки чанка — к тому моменту облик мог смениться, поэтому
  // стартовое значение читается из ref. Живому миру смену передаёт эффект ниже.
  const lookRef = useRef<WorldLook>({ palette, ink })
  // То же с данными: к моменту сборки мира они могли прийти, а могли и нет
  const dataRef = useRef(data)
  const wantedRef = useRef(wantedZone)

  // Текстовый путь вместо сцены в запасных состояниях: участки мира — это мероприятия
  const projectsLink = <Link className="button button--secondary" to="/projects">{tr('Мероприятия', 'Tadbirlar')}</Link>
  const names: Record<WorldSiteId, string> = { office: tr('Офис', 'Ofis'), warehouse: tr('Склад', 'Ombor'), garage: tr('Гараж', 'Garaj') }
  // Имена зон и подстрочники с числами: их же движок рисует на кнопках на земле.
  // Числа нет (источник не ответил) — подстрочника нет.
  const listCount = data?.sites.office ?? null, venueCount = data?.venues?.length ?? null, placeCount = data?.archive?.length ?? null
  const texts = useMemo<WorldTexts>(() => {
    const count = (n: number | null, ru: [string, string, string], uz: string) => n === null ? '' : `${n.toLocaleString(locale)} ${tr(ruPlural(n, ...ru), uz)}`
    return {
      zones: {
        campus: { name: tr('Кампус', 'Kampus'), sub: count(listCount, ['список', 'списка', 'списков'], 'ro‘yxat') },
        venues: { name: tr('Площадки', 'Maydonlar'), sub: count(venueCount, ['мероприятие', 'мероприятия', 'мероприятий'], 'tadbir') },
        archive: { name: tr('Где работали', 'Qayerda ishlaganmiz'), sub: count(placeCount, ['место', 'места', 'мест'], 'joy') },
      },
    }
  }, [tr, locale, listCount, venueCount, placeCount])
  const textsRef = useRef(texts)
  // Зона — в адрес через replace: переезды по карте историю не плодят, «назад» уводит
  // со страницы мира, а не по зонам (gotchas §7). Участок остаётся на «Площадках»:
  // с ним в адресе камера с них не уехала бы. Гараж переезд закрывает всегда — и на
  // кампус тоже: «Кампус» в переключателе изнутри гаража значит «выйти».
  const goZone = (next: WorldZone) => {
    setParams((prev) => {
      const query = new URLSearchParams(prev)
      if (next === 'campus') query.delete('zone')
      else query.set('zone', next)
      if (next !== 'venues') query.delete('lot')
      query.delete('in')
      return query
    }, { replace: true })
  }
  const goZoneRef = useRef(goZone)
  useEffect(() => { goZoneRef.current = goZone })
  // Разбор активированного id (выбор, переход, «плюс») — в useWorldActions. Движку
  // колбэк уходит через ref: navigate и язык меняются между рендерами, а мир из-за них
  // пересоздаваться не должен.
  const activateRef = useRef(activate)
  useEffect(() => { activateRef.current = activate })

  // Участок: адрес ↔ стор. Хозяин — адрес, но выбирает человек в сцене, то есть через
  // стор. Кто из двоих сменился, решает память о прошлом значении стора (gotchas §7):
  // сменился стор — это выбор человека, он уходит в адрес; стор прежний, а с адресом
  // не сходится — догоняет стор. Каждая сторона пишет только при расхождении, поэтому
  // своя же запись, вернувшись вторым рендером, ничего не будит — петли нет.
  const venues = data?.venues ?? null
  const pickLotRef = useRef<string | null>(null)
  useEffect(() => {
    const picked = pickLot !== pickLotRef.current
    pickLotRef.current = pickLot
    // replace: выбор участков историю не плодит, «назад» уводит со страницы мира
    const writeLot = (id: string | null) => setParams((prev) => {
      const query = new URLSearchParams(prev)
      if (id === null) query.delete('lot')
      else { query.set('zone', 'venues'); query.set('lot', id); query.delete('in') }
      return query
    }, { replace: true })
    if (picked) {
      // Закрытая панель, клик по пустой земле и Esc приходят сюда же: pick снят
      if (pickLot !== lotParam) writeLot(pickLot)
      return
    }
    if (lotParam === null) {
      // Параметр ушёл из адреса не выбором (переезд в зону, шаг по истории)
      if (pickLot !== null) store.setState({ pick: null })
      return
    }
    // Реестр ещё не ответил — существует ли участок, неизвестно
    if (!venues) return
    if (!venues.some((lot) => lot.id === lotParam)) {
      // Мероприятия нет (чужая или устаревшая ссылка, ушло в прошлое) — параметр молча снимается
      writeLot(null)
      if (pickLot === lotParam) store.setState({ pick: null })
      return
    }
    // Ссылка с одним ?lot=: зону дописываем, иначе закрытие панели увело бы камеру на кампус
    if (zoneParam !== 'venues') writeLot(lotParam)
    // Вход в зону снимает pick (движок), поэтому ставим его, только когда камера уже на ней
    else if (pickLot !== lotParam && zone === 'venues') store.setState({ pick: lotPartId('lot', lotParam) })
  }, [lotParam, pickLot, zoneParam, zone, venues, store, setParams])

  useEffect(() => {
    const slot = slotRef.current
    if (!slot || !hasWebGL2()) return
    // StrictMode монтирует эффект дважды, а чанк приезжает позже cleanup: без флага
    // второй мир встал бы в слот рядом с первым
    let cancelled = false
    let dispose: (() => void) | null = null
    let getPose: (() => CameraPose) | null = null
    const startedAt = performance.now()

    loadWorld().then((engine) => {
      if (cancelled) return
      try {
        const world = engine.createWorld(slot, {
          store,
          look: lookRef.current,
          data: dataRef.current,
          reducedMotion: prefersReducedMotion(),
          // Поза: после замены модуля — прежняя; при возврате на ту же запись истории —
          // та, с которой ушли (worldMemory); иначе рабочий ракурс
          pose: (hot?.data.pose as CameraPose | undefined) ?? takePose(entryRef.current),
          texts: textsRef.current,
          zone: wantedRef.current,
          onActivate: (id) => activateRef.current(id),
          onZone: (next) => goZoneRef.current(next),
          onFirstFrame: () => {
            setStatus('ready')
            onFirstFrameRef.current?.(Math.round(performance.now() - startedAt))
          },
          onContextLost: () => {
            world.dispose()
            setStatus('lost')
          },
        })
        dispose = world.dispose
        getPose = world.getPose
        worldRef.current = world
        // Гараж из адреса: эффект адреса отработал раньше, чем приехал чанк
        garageRef.current.attach()
      } catch (error) {
        reportAppError(error, { scope: 'loader', route: window.location.pathname, detail: { batch: 'world-create' } })
        setStatus('failed')
      } finally {
        if (hot) { hot.data.pose = null; hot.data.swapping = false }
      }
    }, () => {
      // След уже оставил loadWorld
      if (!cancelled) setStatus('failed')
    })

    return () => {
      cancelled = true
      if (hot?.data.swapping && getPose) hot.data.pose = getPose()
      // Уход со страницы мира: позу помним за записью истории, с которой ушли
      else if (getPose) savePose(entryRef.current, getPose())
      worldRef.current = null
      dispose?.()
    }
  }, [store])

  useEffect(() => {
    lookRef.current = { palette, ink }
    const world = worldRef.current
    if (!world) return
    try {
      world.setStyle({ palette, ink })
    } catch (error) {
      // Пересборка упала на полпути — сцена в неизвестном состоянии, показываем запасной вид
      reportAppError(error, { scope: 'loader', route: window.location.pathname, detail: { batch: 'world-restyle' } })
      world.dispose()
      setStatus('failed')
    }
  }, [palette, ink])

  useEffect(() => {
    dataRef.current = data
    const world = worldRef.current
    if (!world) return
    try {
      world.setData(data)
    } catch (error) {
      reportAppError(error, { scope: 'loader', route: window.location.pathname, detail: { batch: 'world-refill' } })
      world.dispose()
      setStatus('failed')
    }
  }, [data])

  // Посадка нового мероприятия. Стоит ПОСЛЕ эффекта данных: setLanding приходит тем же
  // рендером, что и свежий реестр (хост зовёт его следом за reload), и к этому месту
  // мир уже пересобран — у нового участка есть корень, к которому едет камера.
  useEffect(() => {
    if (landing === null) return
    setLanding(null)
    const done = tr('Мероприятие создано', 'Tadbir yaratildi')
    // В сетке первые LOT_MAX по дате; мероприятие могло уйти в прошлое или встать
    // седьмым (а реестр — не перечитаться): участка в сцене нет, остаётся ссылка
    if (!venues?.slice(0, LOT_MAX).some((lot) => lot.id === landing)) {
      show(done, { link: { to: `/projects/${landing}`, label: tr('Открыть мероприятие', 'Tadbirni ochish') } })
      return
    }
    // Карточку откроет механизм ?lot= выше; replace — как у любого выбора участка (gotchas §7)
    setParams((prev) => {
      const query = new URLSearchParams(prev)
      query.set('zone', 'venues')
      query.set('lot', landing)
      return query
    }, { replace: true })
    worldRef.current?.focus(lotPartId('lot', landing))
    setTitleFor(landing)
    show(done)
  }, [landing, venues, setParams, show, tr])

  // Запись по участку из дровера действия. Тем же порядком, что посадка: к этому месту
  // мир уже пересобран. Камера не едет — человек и так смотрит на участок.
  useEffect(() => {
    if (settled === null) return
    setSettled(null)
    // Участка в сетке нет (мероприятие ушло из реестра или привязку сменили на то,
    // что вне сетки) — карточки нет, фокус ставить некуда
    if (!venues?.slice(0, LOT_MAX).some((lot) => lot.id === settled)) return
    setParams((prev) => {
      const query = new URLSearchParams(prev)
      query.set('zone', 'venues')
      query.set('lot', settled)
      return query
    }, { replace: true })
    setTitleFor(settled)
  }, [settled, venues, setParams])

  // Фокус после создания. «Плюс»-открыватель исчез вместе с якорями пересборки, и
  // useModalLayer дровера фокус вернуть не может — ставим его в заголовок карточки
  // участка. Карточка монтируется тем же проходом, которым стор отдаёт pick, и её
  // эффекты (дочерние) уже отработали — заголовок в DOM.
  useEffect(() => {
    // Ждём именно свой участок: до посадки в сторе может стоять выбор другого
    if (titleFor === null || pickLot !== titleFor) return
    stageRef.current?.querySelector<HTMLElement>('[data-w-lot-title]')?.focus({ preventScroll: true })
    setTitleFor(null)
  }, [titleFor, pickLot])

  // Строка доски «Дела». Дело про участок в сетке: участок встаёт в адрес (карточку
  // откроет механизм ?lot= выше), камера едет к объекту дела — из другой зоны движок сам
  // просит переезд и подводит после посадки, — и тем же ходом открывается действие.
  // Порядок важен: focus из кампуса пишет в адрес зону (onZone), наша запись идёт следом
  // и несёт и зону, и участок — setParams очереди не ведёт, остаётся последняя.
  // Макетных участков (?mock=on) в базе нет: их дела уводят в реестр без посадки.
  const openQuest = (quest: Quest) => {
    if (!quest.lot || quest.part === null || data?.mock) {
      // «Нет мероприятий впереди»: объект дела — пустая ячейка с «плюсом» на «Площадках»
      if (quest.kind === 'no-lots' && !data?.mock) worldRef.current?.focus(ADD_LOT_ID)
      runQuest(quest)
      return
    }
    const query = new URLSearchParams(params)
    query.set('zone', 'venues')
    query.set('lot', quest.lot.id)
    worldRef.current?.focus(lotPartId(quest.part, quest.lot.id))
    // replace — как у любого выбора участка (gotchas §7)
    setParams(query, { replace: true })
    // Интерьеру — уже новый адрес мира: «Назад в мир» вернёт на карточку этого участка
    runQuest(quest, `${pathname}?${query}`)
  }

  useEffect(() => {
    textsRef.current = texts
    worldRef.current?.setTexts(texts)
  }, [texts])

  useEffect(() => {
    wantedRef.current = wantedZone
    worldRef.current?.goZone(wantedZone)
  }, [wantedZone])

  return (
    <div className={`w-stage${palette === 'night' ? ' is-dark' : ''}${hudCompact ? ' is-sm' : ''}`} ref={stageRef}>
      {/* Без aria-hidden: внутри слота живут вывески — настоящие кнопки с именем */}
      <div className="w-scene" ref={slotRef} />
      {/* Вывески и чипы — порталами в якоря движка; якорей нет (мир не собран или снесён) — пусто */}
      {WORLD_SITES.map((id) => (
        <Sign key={id} store={store} id={id} name={names[id]} count={data?.sites[id] ?? null} onActivate={activate} />
      ))}
      {data?.people.map((person) => <NameChip key={person.id} store={store} person={person} />)}
      {[...labels.keys()].filter(isAddId).map((id) => <Plus key={id} store={store} id={id} busy={building && id === ADD_LOT_ID} onActivate={activate} />)}
      {/* HUD зоны живёт, пока камера стоит на ней; якоря чужих зон движок прячет сам.
          Макетных мероприятий (?mock=on) в базе нет — действий у панели участка тоже нет */}
      {zone === 'venues' && data?.venues && <VenuePanel store={store} venues={data.venues} onAction={data.mock ? undefined : run} mealAlerts={mealAlerts} />}
      {zone === 'archive' && data?.archive && <ArchivePanel store={store} places={data.archive} />}
      {/* Гараж изнутри: таблички машин, выход и карточка выбранной — по прибытии камеры */}
      {garage.wanted && data && <GaragePanel store={store} cars={data.cars} vehicles={vehicles} onAction={run} onLeave={garage.leave} />}
      {status === 'ready' && (
        <>
          <DayCap />
          <Toast toast={toast} onClose={hide} />
          {/* Один кампус (зон нет) — переключать нечего */}
          {zones.length > 1 && <ZoneSwitch store={store} texts={texts} mockZones={data?.mock ? MOCK_ZONES : NO_ZONES} onGo={goZone} />}
          {/* Клавиши — дубли зданий кампуса */}
          {zone === 'campus' && !garage.inside && <Dock store={store} names={names} onActivate={activate} />}
          {/* Доска «Дела» — на всех зонах; пока реестр не ответил, дел про участки нет и доски нет */}
          {data?.venues && <QuestBoard store={store} quests={quests} onQuest={openQuest} />}
        </>
      )}
      {/* Дроверы действий поверх сцены */}
      <WorldActions store={store} action={action} venues={data?.venues ?? null} vehicles={vehicles} onClose={close} onLeave={leaveTo} reload={reload} onCreated={setLanding} onSettled={setSettled} onBuilding={setBuilding} toast={show} />
      {/* Скринридеру: имя здания под указателем или в фокусе клавиши */}
      <p className="w-live" aria-live="polite">{hover !== null && WORLD_SITES.includes(hover as WorldSiteId) ? names[hover as WorldSiteId] : ''}</p>
      {/* Число дел при его смене — своей областью: имя здания выше оно не затирает */}
      <p className="w-live" aria-live="polite">
        {questsSaid === null ? '' : questsSaid === 0 ? tr('Всё собрано', 'Hammasi tayyor') : tr(`Дел: ${questsSaid.toLocaleString(locale)}`, `Ishlar: ${questsSaid.toLocaleString(locale)}`)}
      </p>
      {status === 'loading' && <p className="w-stage__state w-stage__loading" role="status">{tr('Загружаем мир…', 'Dunyo yuklanmoqda…')}</p>}
      {status === 'unsupported' && (
        <div className="w-stage__state">
          <EmptyState
            icon={<MonitorOff size={22} />}
            title={tr('3D-вид недоступен', '3D ko‘rinish mavjud emas')}
            text={tr('Браузер или устройство не поддерживает WebGL2. Все разделы открываются из меню.', 'Brauzer yoki qurilma WebGL2 ni qo‘llab-quvvatlamaydi. Barcha bo‘limlar menyudan ochiladi.')}
            action={projectsLink}
          />
        </div>
      )}
      {status === 'failed' && (
        <div className="w-stage__state">
          <ErrorState
            inline
            title={tr('Не удалось загрузить 3D-вид', '3D ko‘rinishni yuklab bo‘lmadi')}
            text={tr('Проверьте соединение и обновите страницу. Все разделы открываются из меню.', 'Aloqani tekshirib, sahifani yangilang. Barcha bo‘limlar menyudan ochiladi.')}
            action={projectsLink}
          />
        </div>
      )}
      {status === 'lost' && (
        <div className="w-stage__state">
          <ErrorState
            inline
            title={tr('3D-вид остановлен', '3D ko‘rinish to‘xtatildi')}
            text={tr('Браузер отключил графику на этой вкладке. Обновите страницу, чтобы вернуть мир.', 'Brauzer bu varaqda grafikani o‘chirdi. Dunyoni qaytarish uchun sahifani yangilang.')}
            action={projectsLink}
          />
        </div>
      )}
    </div>
  )
}
