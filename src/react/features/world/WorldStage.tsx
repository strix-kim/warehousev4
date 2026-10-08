import { MonitorOff } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'
// Общие стили — раньше компонентов: world-venues.css и world-archive.css (их тянут
// панели зон) правят общие классы и обязаны встать в бандл после world-hud.css
import './world.css'
import './hud/world-hud.css'
import { useWorldData } from './data/useWorldData'
import { ArchivePanel } from './hud/ArchivePanel'
import { DayCap } from './hud/DayCap'
import { Dock } from './hud/Dock'
import { NameChip } from './hud/NameChip'
import { Plus } from './hud/Plus'
import { ruPlural } from './hud/plural'
import { Sign } from './hud/Sign'
import { VenuePanel } from './hud/VenuePanel'
import { ZoneSwitch } from './hud/ZoneSwitch'
import type { World } from './engine/createWorld'
import { loadWorld } from './loadWorld'
import type { WorldLook } from './settings'
import { hasWebGL2, prefersReducedMotion } from './support'
import { ADD_LOT_ID, createWorldStore, isAddId, isWorldZone, parseLotId, useWorldState, WORLD_SITES, type CameraPose, type WorldSiteId, type WorldTexts, type WorldZone } from './worldStore'

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
// Раздел продукта за каждым зданием
const SITE_ROUTES: Record<WorldSiteId, string> = { office: '/lists', warehouse: '/equipment', garage: '/vehicles' }

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
  const navigate = useNavigate()
  // Зона живёт в адресе (?zone=): хозяин — адрес, мир только догоняет. Незнакомое
  // значение — кампус; зона без данных — тоже кампус (решает движок), адрес не трогаем:
  // данные могут ещё прийти.
  const [params, setParams] = useSearchParams()
  const zoneParam = params.get('zone')
  const wantedZone: WorldZone = isWorldZone(zoneParam) ? zoneParam : 'campus'
  const slotRef = useRef<HTMLDivElement>(null)
  const [store] = useState(createWorldStore)
  // Одна ссылка и движку, и HUD: машины в сцене, числа вывесок и имена — из одного
  // объекта. null — данных нет, вывески стоят без чисел.
  const data = useWorldData()
  const hover = useWorldState(store, (state) => state.hover)
  const zone = useWorldState(store, (state) => state.zone)
  const zones = useWorldState(store, (state) => state.zones)
  const labels = useWorldState(store, (state) => state.labels)
  const hudCompact = useWorldState(store, (state) => state.hudCompact)
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
  const worldRef = useRef<Pick<World, 'setStyle' | 'setData' | 'setTexts' | 'goZone' | 'dispose'> | null>(null)
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
  // со страницы мира, а не по зонам (gotchas §7)
  const goZone = (next: WorldZone) => {
    setParams((prev) => {
      const query = new URLSearchParams(prev)
      if (next === 'campus') query.delete('zone')
      else query.set('zone', next)
      return query
    }, { replace: true })
  }
  const goZoneRef = useRef(goZone)
  useEffect(() => { goZoneRef.current = goZone })
  // Выбор и переход — один путь для вывески, клавиши и клика по зданию в сцене.
  // Движок к этому моменту pick уже поставил: повторная запись того же id стор не будит.
  // Участки и места — выбор без перехода: их показывают панели зон по pick из стора.
  // «Плюс» ведёт туда, где недостающее создаётся: записи в базу из мира нет.
  const activate = (id: string) => {
    if (isAddId(id)) {
      const lot = parseLotId(id)
      // Макетного мероприятия (?mock=on) в базе нет — вести некуда, кроме реестра
      if (id === ADD_LOT_ID || !lot || data?.mock) navigate('/projects')
      // Параметр project читает ListEditorPage: новый список сразу на мероприятии
      else if (lot.part === 'addtruck') navigate(`/lists/new?project=${lot.venueId}`)
      // HallPlansPage по new=1 открывает дровер нового плана с этим мероприятием
      else navigate(`/halls?new=1&project=${lot.venueId}`)
      return
    }
    if (!WORLD_SITES.includes(id as WorldSiteId)) return
    store.setState({ pick: id })
    navigate(SITE_ROUTES[id as WorldSiteId])
  }
  // Движку колбэк уходит через ref: navigate и язык меняются между рендерами, а мир
  // из-за них пересоздаваться не должен
  const activateRef = useRef(activate)
  useEffect(() => { activateRef.current = activate })

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
          pose: (hot?.data.pose as CameraPose | undefined) ?? null,
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

  useEffect(() => {
    textsRef.current = texts
    worldRef.current?.setTexts(texts)
  }, [texts])

  useEffect(() => {
    wantedRef.current = wantedZone
    worldRef.current?.goZone(wantedZone)
  }, [wantedZone])

  return (
    <div className={`w-stage${palette === 'night' ? ' is-dark' : ''}${hudCompact ? ' is-sm' : ''}`}>
      {/* Без aria-hidden: внутри слота живут вывески — настоящие кнопки с именем */}
      <div className="w-scene" ref={slotRef} />
      {/* Вывески и чипы — порталами в якоря движка; якорей нет (мир не собран или снесён) — пусто */}
      {WORLD_SITES.map((id) => (
        <Sign key={id} store={store} id={id} name={names[id]} count={data?.sites[id] ?? null} onActivate={activate} />
      ))}
      {data?.people.map((person) => <NameChip key={person.id} store={store} person={person} />)}
      {[...labels.keys()].filter(isAddId).map((id) => <Plus key={id} store={store} id={id} onActivate={activate} />)}
      {/* HUD зоны живёт, пока камера стоит на ней; якоря чужих зон движок прячет сам */}
      {zone === 'venues' && data?.venues && <VenuePanel store={store} venues={data.venues} />}
      {zone === 'archive' && data?.archive && <ArchivePanel store={store} places={data.archive} />}
      {status === 'ready' && (
        <>
          <DayCap />
          {/* Один кампус (зон нет) — переключать нечего */}
          {zones.length > 1 && <ZoneSwitch store={store} texts={texts} mockZones={data?.mock ? MOCK_ZONES : NO_ZONES} onGo={goZone} />}
          {/* Клавиши — дубли зданий кампуса */}
          {zone === 'campus' && <Dock store={store} names={names} onActivate={activate} />}
        </>
      )}
      {/* Скринридеру: имя здания под указателем или в фокусе клавиши */}
      <p className="w-live" aria-live="polite">{hover !== null && WORLD_SITES.includes(hover as WorldSiteId) ? names[hover as WorldSiteId] : ''}</p>
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
