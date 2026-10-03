import { CircleAlert, Maximize2, Minimize2, Presentation, WifiOff, X } from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CellPicker } from './CellPicker'
import { cellKeyOf, useHallPlanEditor, type HallPlanEditor } from './useHallPlanEditor'
import { formatPlanPeriod, type AssignmentWithEmployee } from './types'
import { employeeFullName, type EmployeeBrief } from '../employees/types'
import { formatTime } from '../../lib/date'
import { useLanguage } from '../../lib/i18n'
import { useArmedAction } from '../../lib/useArmedAction'
// halls.css нужен ровно ради ОДНОГО куска — панели пикера (.hall-cell-picker):
// с с21 (Ш3) её открывает и клетка витрины, и порталом она уезжает из тёмного
// поддерева наружу, где тёмная палитра на неё уже не действует. Стили редактора
// с витриной не спорят: у неё все классы свои, .hall-tv__*. Порядок импорта
// важен — halls-tv.css идёт последним и выигрывает при любом совпадении.
import './halls.css'
import './halls-tv.css'

// ТВ-режим плана (с21, Ш2): витрина «кто где» на экране в зале. С Ш3 она ещё и
// ИНСТРУМЕНТ ПЛАНЁРКИ — ноутбук подключён к большому экрану, мышь есть, и людей
// назначают кликом прямо здесь. Поэтому под ней тот же useHallPlanEditor, что и
// под редактором: свой хук чтения тут был, пока витрина была только чтением, а
// две реализации назначений разъехались бы на первой же правке.
//
// СТРУКТУРА на витрине не правится: ни строк, ни залов, ни имён, ни цветов —
// это остаётся в редакторе. Здесь меняются только люди в клетках.
//
// Страница живёт ВНЕ AppShell (сиблинг-маршрут в App.tsx): на ТВ не нужны ни
// сайдбар, ни отступы приложения — экран занимает матрица.

// Пауза поллинга. Тридцать секунд — это «расстановку поправили в кабинете, зал
// увидел это, пока никто не смотрел»: чаще незачем, реже уже врёт.
const POLL_MS = 30_000

export function HallTvPage() {
  const navigate = useNavigate()
  const { tr, locale } = useLanguage()
  const { planId } = useParams<{ planId: string }>()
  const editor = useHallPlanEditor(planId)
  const rootRef = useRef<HTMLDivElement>(null)

  // Возраст данных на экране держит СТРАНИЦА, а не хук: редактору «обновлено» не
  // нужно вовсе, а здесь это единственное, чем зритель отличает живую витрину от
  // забытой вкладки. Время последнего УСПЕХА показывают оба состояния — и
  // «обновлено», и «нет связи»: во втором случае оно и есть возраст картинки.
  const [refreshedAt, setRefreshedAt] = useState(0)
  const [isStale, setStale] = useState(false)

  // Свежая ссылка на тихое обновление: интервал заводится один раз на загрузку,
  // а функция пересоздаётся каждым рендером — замкнув её, тик читал бы pending и
  // addingCell тридцатисекундной давности и перетирал бы правку, которую сам же
  // обязан пропустить.
  const refreshRef = useRef(editor.silentRefresh)
  refreshRef.current = editor.silentRefresh

  // Точка отсчёта «обновлено» — первая удачная загрузка и каждая перезагрузка по
  // «Повторить»: loadState меняется на ready ровно раз за круг чтения.
  useEffect(() => {
    if (editor.loadState !== 'ready') return
    setRefreshedAt(Date.now())
    setStale(false)
  }, [editor.loadState])

  // Поллинг живёт здесь, а не в хуке: перечитывать план по таймеру нужно только
  // витрине. Тикаем ТОЛЬКО по рабочему экрану — отказ и удалённый план лечатся
  // кнопкой, и молча подкладывать данные под сообщение об ошибке нельзя.
  useEffect(() => {
    if (editor.loadState !== 'ready') return
    const timer = window.setInterval(() => {
      void refreshRef.current().then((result) => {
        // Пропуск — не отказ: тик пришёлся на несохранённую правку, сети никто
        // не касался, и жёлтое «Нет связи» тут было бы враньём.
        if (result === 'skipped') return
        if (result === 'failed') {
          setStale(true)
          return
        }
        setRefreshedAt(Date.now())
        setStale(false)
      })
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [editor.loadState])

  // Esc — выход в редактор плана. В полноэкранном режиме первый Esc забирает
  // себе браузер, поэтому сюда событие доходит уже из обычного состояния;
  // проверка fullscreenElement страхует движки, которые событие всё же отдают.
  // Открытый пикер клавишу забирает себе (usePopoverLayer слушает в фазе
  // перехвата и гасит распространение), так что Esc при выборе человека закроет
  // выдачу, а не уведёт с витрины.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || document.fullscreenElement) return
      navigate(planId ? `/halls/${planId}` : '/halls')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate, planId])

  // Состояние читаем из события, а не ведём сами: из полноэкранного режима
  // выходят и мимо кнопки — Esc, F11, жест системы. Без него кнопка в уже
  // развёрнутом окне звала развернуть ещё раз и выглядела сломанной (с41).
  const [isFullscreen, setFullscreen] = useState(() => Boolean(document.fullscreenElement))
  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  // Отказ браузера гасим молча: полноэкранный режим — удобство, а не условие
  // работы экрана, и модалка «не получилось» на витрине в зале лишняя.
  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    else void rootRef.current?.requestFullscreen().catch(() => {})
  }

  const time = refreshedAt ? formatTime(refreshedAt, locale) : ''

  return (
    <div
      ref={rootRef}
      className="hall-tv"
      role="region"
      aria-label={tr('Распределение по залам на ТВ', 'Zallar bo‘yicha taqsimot — TV')}
    >
      <header className="hall-tv__head">
        <div className="hall-tv__title">
          <h1>{editor.plan?.name ?? tr('План залов', 'Zallar rejasi')}</h1>
          {editor.plan && <p>{formatPlanPeriod(editor.plan, locale, tr)}</p>}
        </div>
        {editor.loadState === 'ready' && (
          <div className="hall-tv__counts">
            <TvCount value={editor.counts.totalPeople} label={tr('Людей', 'Odamlar')} />
            <TvCount value={editor.counts.technicians} label={tr('Видеоинженеры', 'Videoinjenerlar')} />
            <TvCount value={editor.counts.operators} label={tr('Операторы', 'Operatorlar')} />
            {/* Наём — только при N > 0: это не бригада, а сколько внешних ещё
                предстоит взять, и нуля в шапке быть не должно. */}
            {editor.counts.hired > 0 && (
              <TvCount value={editor.counts.hired} label={tr('Наём', 'Yollash')} hire />
            )}
          </div>
        )}
        <div className="hall-tv__head-side">
          {editor.loadState === 'ready' && <TvSaveState editor={editor} />}
          {editor.loadState === 'ready' && (
            <p className={`hall-tv__refreshed ${isStale ? 'is-stale' : ''}`} role="status">
              {isStale
                ? <><WifiOff size={13} aria-hidden="true" />{tr(`Нет связи · ${time}`, `Aloqa yo‘q · ${time}`)}</>
                : tr(`Обновлено ${time}`, `${time} da yangilandi`)}
            </p>
          )}
          {/* Движок без Fullscreen API (iPhone, встроенные браузеры мессенджеров)
              кнопку не получает: мёртвая кнопка хуже отсутствующей. */}
          {document.fullscreenEnabled && (
            <button type="button" className="hall-tv__button" onClick={toggleFullscreen}>
              {isFullscreen
                ? <><Minimize2 size={15} aria-hidden="true" /> {tr('Свернуть', 'Kichraytirish')}</>
                : <><Maximize2 size={15} aria-hidden="true" /> {tr('Во весь экран', 'To‘liq ekran')}</>}
            </button>
          )}
        </div>
      </header>

      {editor.loadState === 'loading' && <TvBoardSkeleton />}

      {/* «План закрыт», а не «не найден»: на ТВ этот экран видят те, кто смотрел
          рабочую расстановку минуту назад, — для них план именно закрыли. */}
      {editor.loadState === 'missing' && (
        <div className="hall-tv__state">
          <Presentation size={34} aria-hidden="true" />
          <strong>{tr('План закрыт', 'Reja yopilgan')}</strong>
          <span>{tr('Плана больше нет — расстановка показана не будет.', 'Reja endi yo‘q — taqsimot ko‘rsatilmaydi.')}</span>
          <button type="button" className="hall-tv__button" onClick={() => navigate('/halls')}>
            {tr('К списку планов', 'Rejalar ro‘yxatiga')}
          </button>
        </div>
      )}

      {editor.loadState === 'failed' && (
        <div className="hall-tv__state">
          <CircleAlert size={30} aria-hidden="true" />
          <strong>{tr('Ошибка загрузки', 'Yuklash xatosi')}</strong>
          <span>{tr('Не удалось загрузить план залов.', 'Zallar rejasini yuklab bo‘lmadi.')}</span>
          <button type="button" className="hall-tv__button" onClick={editor.reload}>
            {tr('Повторить', 'Qayta urinish')}
          </button>
        </div>
      )}

      {editor.loadState === 'ready' && (editor.halls.length === 0 || editor.positions.length === 0
        ? (
          // Структуру на витрине не заводят: пустой план чинится в редакторе, и
          // кнопки «добавить зал» здесь нет намеренно.
          <div className="hall-tv__state">
            <Presentation size={34} aria-hidden="true" />
            <strong>{tr('План пока пустой', 'Reja hozircha bo‘sh')}</strong>
            <span>{tr('Расстановку заполняют в редакторе плана.', 'Taqsimot reja tahrirlagichida to‘ldiriladi.')}</span>
          </div>
        )
        : <TvBoard editor={editor} />)}
    </div>
  )
}

// Счётчик шапки: число крупно, подпись под ним. «Наём» — янтарным числом, как
// слот на доске: это не люди бригады, а сколько ещё предстоит взять.
function TvCount({ value, label, hire = false }: { value: number, label: string, hire?: boolean }) {
  const { locale } = useLanguage()

  return (
    <div className={`hall-tv__count ${hire ? 'hall-tv__count--hire' : ''}`}>
      <strong>{value.toLocaleString(locale)}</strong>
      <span>{label}</span>
    </div>
  )
}

// Статус автосохранения на витрине. В покое здесь НЕТ ничего: «Сохранено 14:03»
// на экране в зале — служебный шум, зрителю нужна расстановка. Голос подаётся
// только пока идёт запись и когда она не прошла.
function TvSaveState({ editor }: { editor: HallPlanEditor }) {
  const { tr } = useLanguage()

  if (editor.saveState === 'saving') {
    return <p className="hall-tv__save" role="status">{tr('Сохраняем…', 'Saqlanmoqda…')}</p>
  }

  if (editor.saveState === 'failed') {
    return (
      <p className="hall-tv__save is-failed" role="status" title={editor.errorText}>
        <CircleAlert size={13} aria-hidden="true" />
        <span className="hall-tv__save-text">{editor.errorText}</span>
        {/* «Повторить» — полная перезагрузка плана, а не повтор упавшего
            запроса: после отказа локальная копия разошлась с базой, и вернуть их
            в одно состояние может только чтение. */}
        <button type="button" onClick={editor.reload}>{tr('Повторить', 'Qayta urinish')}</button>
      </p>
    )
  }

  return null
}

// Сама матрица. Прокрутки нет: число строк и колонок уезжает в CSS-переменные,
// и кегль считается от них — сетка обязана поместиться в экран целиком, потому
// что крутить её на телевизоре некому.
function TvBoard({ editor }: { editor: HallPlanEditor }) {
  const { tr } = useLanguage()
  const { halls, positions } = editor

  const layout = {
    // Колонка позиций — по длиннейшему названию, но не шире 5.4 кегля (с36):
    // .72fr резал «Операторы», а шире — не влезал «Александр» в колонку зала на
    // 1280 (Samarkand); длинное название переносится на вторую строку.
    gridTemplateColumns: `fit-content(5.4em) repeat(${halls.length}, minmax(0, 1fr))`,
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
              hallId={hall.id}
              positionId={position.id}
              // Имена нужны клетке только для aria-label: на экране пересечение
              // видно глазами, скринридеру пересечения не видно.
              positionName={position.name}
              // Роль СТРОКИ: кнопка «Наём» появляется только у операторов —
              // то же правило, что в редакторе, и живёт оно на клиенте.
              positionRole={position.role}
              hallName={hall.name}
              cell={editor.cellMap.get(cellKeyOf({ hallId: hall.id, positionId: position.id }))}
              editor={editor}
            />
          ))}
        </Fragment>
      ))}
    </div>
  )
}

// Болванка доски на время чтения (с25). Строка «Загружаем план…» посреди
// чёрного экрана в зале читалась как «экран сломался»; каркас сетки читается
// как «сейчас будет расстановка». Реальных чисел до ответа базы нет, поэтому
// размер типовой — четыре зала на пять позиций: столько же занимает и средний
// план, так что подмена каркаса настоящей доской не бросается в глаза.
const SKELETON_COLS = 4
const SKELETON_ROWS = 5

function TvBoardSkeleton() {
  const { tr } = useLanguage()

  // Раскладка ровно та же, что у настоящей доски: те же доли колонок и строк и
  // те же --rows/--cols, от которых считается кегль.
  // Кроме первой колонки: у настоящей она по длине названий (fit-content), а у
  // болванки названий нет. Трек в vw, а не в em: кегль болванки считается от её
  // четырёх колонок и крупнее настоящего, и em уводил бы колонку на +75 px.
  // 8.68vw — замер колонки Samarkand (5.4 кегля при восьми залах) на 1280/1920/2560.
  const layout = {
    gridTemplateColumns: `8.68vw repeat(${SKELETON_COLS}, minmax(0, 1fr))`,
    gridTemplateRows: `auto repeat(${SKELETON_ROWS}, minmax(0, 1fr))`,
    '--rows': SKELETON_ROWS,
    '--cols': SKELETON_COLS,
  } as CSSProperties

  return (
    <div
      className="hall-tv__board hall-tv__board--skeleton"
      style={layout}
      role="status"
      aria-label={tr('Загружаем план…', 'Reja yuklanmoqda…')}
    >
      <div className="hall-tv__skeleton-corner" />
      {Array.from({ length: SKELETON_COLS }, (_, index) => (
        <div key={index} className="hall-tv__skeleton-colhead"><span /></div>
      ))}
      {Array.from({ length: SKELETON_ROWS }, (_, row) => (
        <Fragment key={row}>
          <div className="hall-tv__skeleton-rowhead"><span /></div>
          {Array.from({ length: SKELETON_COLS }, (_, col) => (
            <div key={col} className="hall-tv__skeleton-cell"><span /></div>
          ))}
        </Fragment>
      ))}
    </div>
  )
}

// Клетка витрины: человек, слот «Наём» или пустота — и всё это кликабельно
// (с21, Ш3). Скрепки связки здесь по-прежнему нет: на планёрке смотрят «кто
// стоит», а связка внутри зала — деталь планировщика. А вот бейдж ×N вернулся
// решением прораба: перегруженного человека нужно увидеть именно на общем
// экране, до того как его поставят в четвёртый зал.
function TvCell({ hallId, positionId, positionName, positionRole, hallName, cell, editor }: {
  hallId: string
  positionId: string
  positionName: string
  positionRole: string
  hallName: string
  cell: AssignmentWithEmployee | undefined
  editor: HallPlanEditor
}) {
  const { tr } = useLanguage()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const armed = useArmedAction()
  const isBusy = editor.addingCell === cellKeyOf({ hallId, positionId })

  // Слот узнаём по отсутствию человека, а не по is_external: равенство держит
  // CHECK базы, а TS сужает тип именно по null.
  const isSlot = Boolean(cell) && cell?.employee_id === null

  // Человек этой клетки убран из выдачи замены: выбрать того же — это ничего не
  // менять. У слота исключать некого.
  const excluded = useMemo(() => new Set(cell?.employee_id ? [cell.employee_id] : []), [cell])

  function pick(employee: EmployeeBrief) {
    setAnchor(null)
    void editor.assign({ hallId, positionId }, employee)
  }

  // Кнопка наёма — только там, где слот вообще уместен: строка операторов и
  // клетка, в которой слота ещё нет. Поверх слота ставить слот нечем.
  const hire = positionRole === 'operator' && !isSlot
    ? () => { setAnchor(null); void editor.assignSlot({ hallId, positionId }) }
    : undefined

  function togglePicker(event: { currentTarget: HTMLElement }) {
    const target = event.currentTarget
    setAnchor((current) => current === target ? null : target)
  }

  const picker = anchor && (
    <CellPicker anchor={anchor} exclude={excluded} editor={editor} onPick={pick} onHire={hire} onClose={() => setAnchor(null)} />
  )

  if (!cell) {
    return (
      <div className="hall-tv__cell hall-tv__cell--none">
        {/* Вся пустая клетка — одна кнопка: целиться в маленький «+» на экране
            за несколько метров от мыши человек будет дольше, чем расставлять. */}
        <button
          type="button"
          className="hall-tv__empty"
          disabled={Boolean(editor.addingCell) && !isBusy}
          onClick={togglePicker}
          aria-label={tr(`Назначить: ${positionName}, ${hallName}`, `Tayinlash: ${positionName}, ${hallName}`)}
        >
          {isBusy
            ? <span className="hall-tv__busy">{tr('Добавляем…', 'Qo‘shilmoqda…')}</span>
            : <span className="hall-tv__dash" aria-hidden="true">—</span>}
        </button>
        {picker}
      </div>
    )
  }

  if (cell.employee_id === null) {
    return (
      <div className={`hall-tv__cell hall-tv__cell--hire ${armed.armed ? 'is-armed' : ''}`}>
        <button
          type="button"
          className="hall-tv__pick"
          disabled={Boolean(editor.addingCell) && !isBusy}
          onClick={togglePicker}
          aria-label={tr(`Наём: ${positionName}, ${hallName}`, `Yollash: ${positionName}, ${hallName}`)}
        >
          <span className="hall-tv__slot">
            {isBusy ? tr('Меняем…', 'O‘zgartirilmoqda…') : tr('Наём', 'Yollash')}
          </span>
        </button>
        <TvClearButton
          armed={armed}
          onFire={() => editor.clearCell(cell.id)}
          label={tr('Убрать слот наёма', 'Yollash slotini olib tashlash')}
        />
        {picker}
      </div>
    )
  }

  const person = cell.employees
  const planCount = editor.planCountByEmployee.get(cell.employee_id) ?? 1

  // Две строки, а не employeeDisplayName: имя на ТВ читают первым и крупным,
  // фамилия под ним мельче — с трёх метров различают именно имя.
  // У человека без имени в базе первую строку занимает фамилия: пустая верхняя
  // строка выглядела бы обрывом.
  //
  // Строку сотрудника могла не отдать политика чтения. Молчать нельзя: пустая
  // клетка читалась бы как «места нет», а место занято.
  const first = person ? (person.first_name || person.last_name) : tr('Сотрудник скрыт', 'Xodim yashirin')
  const last = person && person.first_name ? person.last_name : ''
  const fullName = person ? employeeFullName(person) : first

  // ×N — по ВСЕМУ плану: страховка на четыре зала это одна фамилия в четырёх
  // клетках разных залов, и на планёрке это единственный способ увидеть
  // перегруженного человека. Стоит в строке фамилии, нет фамилии — в строке имени.
  const badge = planCount > 1 && (
    <span className="hall-tv__badge" title={tr(`В плане ${planCount} раз`, `Rejada ${planCount} marta`)}>×{planCount}</span>
  )

  return (
    <div className={`hall-tv__cell ${armed.armed ? 'is-armed' : ''}`}>
      {/* Имя занимает всю клетку и само же открывает замену: клик по человеку в
          расстановке всегда означает «поставить сюда другого». */}
      <button
        type="button"
        className={`hall-tv__pick ${person ? '' : 'is-hidden-person'}`}
        disabled={Boolean(editor.addingCell) && !isBusy}
        onClick={togglePicker}
        aria-label={tr(`Заменить ${fullName}`, `${fullName} o‘rniga boshqa`)}
        title={fullName}
      >
        {isBusy
          ? <span className="hall-tv__busy">{tr('Меняем…', 'O‘zgartirilmoqda…')}</span>
          : (
            last
              ? (
                <>
                  <span className="hall-tv__first">{first}</span>
                  <span className="hall-tv__last-row">
                    <span className="hall-tv__last">{last}</span>
                    {badge}
                  </span>
                </>
              )
              : (
                <span className="hall-tv__name-row">
                  <span className="hall-tv__first">{first}</span>
                  {badge}
                </span>
              )
          )}
      </button>
      <TvClearButton
        armed={armed}
        onFire={() => editor.clearCell(cell.id)}
        label={tr('Снять сотрудника', 'Xodimni olib tashlash')}
      />
      {picker}
    </div>
  )
}

// Крестик снятия: до наведения его нет вовсе — на витрине он бы висел мусором
// поверх каждой фамилии. Подтверждение взводом, как везде в редакторе: первый
// клик красит клетку, второй снимает.
function TvClearButton({ armed, onFire, label }: {
  armed: ReturnType<typeof useArmedAction>
  onFire: () => void
  label: string
}) {
  const { tr } = useLanguage()
  const confirmLabel = tr('Точно снять?', 'Aniq olib tashlansinmi?')

  return (
    <button
      type="button"
      className="hall-tv__clear"
      onClick={() => armed.fire(onFire)}
      onBlur={armed.disarm}
      // Safari: mousedown по кнопке не фокусирует её, но блюрит текущий фокус —
      // то есть ЕЁ САМУ: onBlur гасил взвод раньше click, и подтверждение не
      // срабатывало (найдено прорабом, с21).
      onMouseDown={(event) => { if (armed.armed) event.preventDefault() }}
      aria-label={armed.armed ? confirmLabel : label}
      title={armed.armed ? confirmLabel : label}
    >
      <X size={12} />
    </button>
  )
}
