import { CircleAlert, Maximize2, Presentation, WifiOff } from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchHallAssignments, fetchHallPlan, fetchPlanPositions, type HallBrief, type HallPlanWithHalls } from './api'
import {
  countPlan,
  formatPlanPeriod,
  sortHalls,
  sortPositions,
  type AssignmentWithEmployee,
  type PlanPosition,
} from './types'
import { formatTime } from '../../lib/date'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'
import './halls-tv.css'

// ТВ-режим плана (с21, Ш2): витрина «кто где» на экране в зале. Только чтение,
// и редакторского хука здесь нет намеренно — мутации, кандидаты и справочник
// витрине не нужны, а тянуть их значило бы грузить на телевизор весь редактор.
//
// Страница живёт ВНЕ AppShell (сиблинг-маршрут в App.tsx): на ТВ не нужны ни
// сайдбар, ни отступы приложения — экран занимает матрица.

// Пауза поллинга. Тридцать секунд — это «расстановку поправили в кабинете, зал
// увидел это, пока никто не смотрел»: чаще незачем, реже уже врёт.
const POLL_MS = 30_000

type TvLoadState = 'loading' | 'ready' | 'missing' | 'failed'

// Ключ клетки собирается здесь, а не берётся из useHallPlanEditor: раскладка
// целиком локальна для этой страницы, а импорт ради одной строки утащил бы в
// чанк ТВ весь редактор с его зависимостями.
function cellKey(positionId: string, hallId: string): string {
  return `${positionId}:${hallId}`
}

function useHallTvBoard(planId: string | undefined) {
  const [plan, setPlan] = useState<HallPlanWithHalls | null>(null)
  const [positions, setPositions] = useState<PlanPosition[]>([])
  const [assignments, setAssignments] = useState<AssignmentWithEmployee[]>([])
  const [state, setState] = useState<TvLoadState>('loading')
  const [reloadKey, setReloadKey] = useState(0)
  // Время последнего УСПЕШНОГО ответа: его показывает и «обновлено», и бейдж
  // «нет связи» — во втором случае оно и есть возраст того, что на экране.
  const [refreshedAt, setRefreshedAt] = useState(0)
  const [isStale, setStale] = useState(false)

  useEffect(() => {
    if (!planId) {
      setState('missing')
      return
    }
    let isCurrent = true
    // Полёт отслеживаем локальным флагом: на медленной сети тик интервала не
    // должен становиться в очередь за предыдущим — экран от этого свежее не
    // станет, а запросы сложатся стопкой.
    let inFlight = false

    async function refresh(isFirst: boolean) {
      if (inFlight || !planId) return
      inFlight = true
      try {
        const [row, positionRows, assignmentRows] = await Promise.all([
          fetchHallPlan(planId),
          fetchPlanPositions(planId),
          fetchHallAssignments(planId),
        ])
        if (!isCurrent) return
        // План исчез, пока экран висел: показывать старую расстановку удалённого
        // плана нельзя — она уже ничья.
        if (!row) {
          setState('missing')
          return
        }
        setPlan(row)
        setPositions(sortPositions(positionRows))
        setAssignments(assignmentRows)
        setRefreshedAt(Date.now())
        setStale(false)
        setState('ready')
      } catch (error) {
        if (!isCurrent) return
        reportAppError(error, { scope: 'loader', route: '/halls/:planId/tv', detail: { plan: planId, first: isFirst } })
        // Первый заход показывать нечего — экран отказа. Дальше на экране лежат
        // старые, но НАСТОЯЩИЕ данные: гасить их из-за одного провала поллинга
        // хуже, чем оставить и честно сказать, что связи нет и с какого времени.
        if (isFirst) setState('failed')
        else setStale(true)
      } finally {
        inFlight = false
      }
    }

    setState('loading')
    void refresh(true)
    const timer = window.setInterval(() => { void refresh(false) }, POLL_MS)
    return () => {
      isCurrent = false
      window.clearInterval(timer)
    }
  }, [planId, reloadKey])

  const halls = useMemo<HallBrief[]>(() => plan ? sortHalls(plan.halls) : [], [plan])
  const counts = useMemo(() => countPlan(positions, assignments), [positions, assignments])
  const cellMap = useMemo(() => {
    const map = new Map<string, AssignmentWithEmployee>()
    for (const cell of assignments) map.set(cellKey(cell.position_id, cell.hall_id), cell)
    return map
  }, [assignments])

  return {
    plan,
    halls,
    positions,
    cellMap,
    counts,
    state,
    refreshedAt,
    isStale,
    reload: () => setReloadKey((value) => value + 1),
  }
}

export function HallTvPage() {
  const navigate = useNavigate()
  const { tr, locale } = useLanguage()
  const { planId } = useParams<{ planId: string }>()
  const board = useHallTvBoard(planId)
  const rootRef = useRef<HTMLDivElement>(null)

  // Esc — выход в редактор плана. В полноэкранном режиме первый Esc забирает
  // себе браузер, поэтому сюда событие доходит уже из обычного состояния;
  // проверка fullscreenElement страхует движки, которые событие всё же отдают.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || document.fullscreenElement) return
      navigate(planId ? `/halls/${planId}` : '/halls')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate, planId])

  // Отказ браузера гасим молча: полноэкранный режим — удобство, а не условие
  // работы экрана, и модалка «не получилось» на витрине в зале лишняя.
  // Оптический обрыв цепочки на `?.` уносит и .catch — старым движкам без
  // requestFullscreen кнопка просто ничего не делает.
  function goFullscreen() {
    rootRef.current?.requestFullscreen?.().catch(() => {})
  }

  const time = board.refreshedAt ? formatTime(board.refreshedAt, locale) : ''

  return (
    <div
      ref={rootRef}
      className="hall-tv"
      role="region"
      aria-label={tr('Распределение по залам на ТВ', 'Zallar bo‘yicha taqsimot — TV')}
    >
      <header className="hall-tv__head">
        <div className="hall-tv__title">
          <h1>{board.plan?.name ?? tr('План залов', 'Zallar rejasi')}</h1>
          {board.plan && <p>{formatPlanPeriod(board.plan, locale, tr)}</p>}
        </div>
        <div className="hall-tv__head-side">
          {board.state === 'ready' && (
            <p className={`hall-tv__refreshed ${board.isStale ? 'is-stale' : ''}`} role="status">
              {board.isStale
                ? <><WifiOff size={13} aria-hidden="true" />{tr(`Нет связи · ${time}`, `Aloqa yo‘q · ${time}`)}</>
                : tr(`Обновлено ${time}`, `${time} da yangilandi`)}
            </p>
          )}
          <button type="button" className="hall-tv__button" onClick={goFullscreen}>
            <Maximize2 size={15} aria-hidden="true" /> {tr('Во весь экран', 'To‘liq ekran')}
          </button>
        </div>
      </header>

      {board.state === 'loading' && (
        <div className="hall-tv__state"><span>{tr('Загружаем план…', 'Reja yuklanmoqda…')}</span></div>
      )}

      {/* «План закрыт», а не «не найден»: на ТВ этот экран видят те, кто смотрел
          рабочую расстановку минуту назад, — для них план именно закрыли. */}
      {board.state === 'missing' && (
        <div className="hall-tv__state">
          <Presentation size={34} aria-hidden="true" />
          <strong>{tr('План закрыт', 'Reja yopilgan')}</strong>
          <span>{tr('Плана больше нет — расстановка показана не будет.', 'Reja endi yo‘q — taqsimot ko‘rsatilmaydi.')}</span>
          <button type="button" className="hall-tv__button" onClick={() => navigate('/halls')}>
            {tr('К списку планов', 'Rejalar ro‘yxatiga')}
          </button>
        </div>
      )}

      {board.state === 'failed' && (
        <div className="hall-tv__state">
          <CircleAlert size={30} aria-hidden="true" />
          <strong>{tr('Ошибка загрузки', 'Yuklash xatosi')}</strong>
          <span>{tr('Не удалось загрузить план залов.', 'Zallar rejasini yuklab bo‘lmadi.')}</span>
          <button type="button" className="hall-tv__button" onClick={board.reload}>
            {tr('Повторить', 'Qayta urinish')}
          </button>
        </div>
      )}

      {board.state === 'ready' && (board.halls.length === 0 || board.positions.length === 0
        ? (
          <div className="hall-tv__state">
            <Presentation size={34} aria-hidden="true" />
            <strong>{tr('План пока пустой', 'Reja hozircha bo‘sh')}</strong>
            <span>{tr('Расстановку заполняют в редакторе плана.', 'Taqsimot reja tahrirlagichida to‘ldiriladi.')}</span>
          </div>
        )
        : <TvBoard halls={board.halls} positions={board.positions} cellMap={board.cellMap} />)}

      {board.state === 'ready' && (
        <footer className="hall-tv__foot">
          <span>{tr('Людей:', 'Odamlar:')} <strong>{board.counts.totalPeople.toLocaleString(locale)}</strong></span>
          <span>{tr('Видеоинженеры:', 'Videoinjenerlar:')} <strong>{board.counts.technicians.toLocaleString(locale)}</strong></span>
          <span>{tr('Операторы:', 'Operatorlar:')} <strong>{board.counts.operators.toLocaleString(locale)}</strong></span>
          {/* Наём — только при N > 0: это не бригада, а сколько внешних ещё
              предстоит взять, и нуля в строке быть не должно. */}
          {board.counts.hired > 0 && (
            <span>{tr('Наём:', 'Yollash:')} <strong>{board.counts.hired.toLocaleString(locale)}</strong></span>
          )}
        </footer>
      )}
    </div>
  )
}

// Сама матрица. Прокрутки нет: число строк и колонок уезжает в CSS-переменные,
// и кегль считается от них — сетка обязана поместиться в экран целиком, потому
// что крутить её на телевизоре некому.
function TvBoard({ halls, positions, cellMap }: {
  halls: HallBrief[]
  positions: PlanPosition[]
  cellMap: Map<string, AssignmentWithEmployee>
}) {
  const { tr } = useLanguage()

  const layout = {
    gridTemplateColumns: `minmax(0, .72fr) repeat(${halls.length}, minmax(0, 1fr))`,
    gridTemplateRows: `auto repeat(${positions.length}, minmax(0, 1fr))`,
    // Делитель формулы кегля: ноль строк сюда не приходит (пустой план отбит
    // выше), но деление на ноль обнулило бы весь расчёт молча.
    '--rows': Math.max(positions.length, 1),
    '--cols': Math.max(halls.length, 1),
  } as CSSProperties

  return (
    <div className="hall-tv__board" style={layout}>
      <div className="hall-tv__corner">{tr('Позиция', 'Lavozim')}</div>

      {halls.map((hall, index) => (
        <div key={hall.id} className="hall-tv__colhead" style={{ '--hall-color': hall.color } as CSSProperties}>
          <span className="hall-tv__number">{index + 1}</span>
          <span className="hall-tv__hall-name">{hall.name}</span>
        </div>
      ))}

      {positions.map((position) => (
        <Fragment key={position.id}>
          <div className="hall-tv__rowhead"><span>{position.name}</span></div>
          {halls.map((hall) => (
            <TvCell
              key={hall.id}
              hallColor={hall.color}
              cell={cellMap.get(cellKey(position.id, hall.id))}
            />
          ))}
        </Fragment>
      ))}
    </div>
  )
}

// Клетка витрины: человек, слот «Наём» или пустота. ×N и скрепки здесь нет
// намеренно (решение прораба с21) — зрителю в зале нужен ответ «кто стоит», а
// не служебные пометки планировщика.
function TvCell({ hallColor, cell }: { hallColor: string; cell: AssignmentWithEmployee | undefined }) {
  const { tr } = useLanguage()
  const tint = { '--hall-color': hallColor } as CSSProperties

  if (!cell) {
    return <div className="hall-tv__cell" style={tint}><span className="hall-tv__dash" aria-hidden="true">—</span></div>
  }

  if (cell.employee_id === null) {
    return (
      <div className="hall-tv__cell" style={tint}>
        <span className="hall-tv__slot">{tr('Наём', 'Yollash')}</span>
      </div>
    )
  }

  const person = cell.employees
  if (!person) {
    // Строку сотрудника не отдала политика чтения. Молчать нельзя: пустая клетка
    // читалась бы как «места нет», а место занято.
    return (
      <div className="hall-tv__cell" style={tint}>
        <span className="hall-tv__hidden">{tr('Сотрудник скрыт', 'Xodim yashirin')}</span>
      </div>
    )
  }

  // Две строки, а не employeeDisplayName: имя на ТВ читают первым и крупным,
  // фамилия под ним мельче — с трёх метров различают именно имя.
  // У человека без имени в базе первую строку занимает фамилия: пустая верхняя
  // строка выглядела бы обрывом.
  const first = person.first_name || person.last_name
  const last = person.first_name ? person.last_name : ''

  return (
    <div className="hall-tv__cell" style={tint}>
      <span className="hall-tv__first">{first}</span>
      {last && <span className="hall-tv__last">{last}</span>}
    </div>
  )
}
