import { CircleAlert, Maximize2, Presentation, WifiOff, X } from 'lucide-react'
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

  // Сотрудников грузим сразу, как это делает редактор: на планёрке первый клик в
  // клетку не должен упираться в загрузку списка. Повторов не боимся —
  // loadCandidates держит свой ref (StrictMode монтирует эффект дважды).
  useEffect(() => {
    if (editor.loadState === 'ready') editor.loadCandidates()
  }, [editor.loadState])

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

  // Отказ браузера гасим молча: полноэкранный режим — удобство, а не условие
  // работы экрана, и модалка «не получилось» на витрине в зале лишняя.
  // Оптический обрыв цепочки на `?.` уносит и .catch — старым движкам без
  // requestFullscreen кнопка просто ничего не делает.
  function goFullscreen() {
    rootRef.current?.requestFullscreen?.().catch(() => {})
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
        <div className="hall-tv__head-side">
          {editor.loadState === 'ready' && <TvSaveState editor={editor} />}
          {editor.loadState === 'ready' && (
            <p className={`hall-tv__refreshed ${isStale ? 'is-stale' : ''}`} role="status">
              {isStale
                ? <><WifiOff size={13} aria-hidden="true" />{tr(`Нет связи · ${time}`, `Aloqa yo‘q · ${time}`)}</>
                : tr(`Обновлено ${time}`, `${time} da yangilandi`)}
            </p>
          )}
          <button type="button" className="hall-tv__button" onClick={goFullscreen}>
            <Maximize2 size={15} aria-hidden="true" /> {tr('Во весь экран', 'To‘liq ekran')}
          </button>
        </div>
      </header>

      {editor.loadState === 'loading' && (
        <div className="hall-tv__state"><span>{tr('Загружаем план…', 'Reja yuklanmoqda…')}</span></div>
      )}

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

      {editor.loadState === 'ready' && (
        <footer className="hall-tv__foot">
          <span>{tr('Людей:', 'Odamlar:')} <strong>{editor.counts.totalPeople.toLocaleString(locale)}</strong></span>
          <span>{tr('Видеоинженеры:', 'Videoinjenerlar:')} <strong>{editor.counts.technicians.toLocaleString(locale)}</strong></span>
          <span>{tr('Операторы:', 'Operatorlar:')} <strong>{editor.counts.operators.toLocaleString(locale)}</strong></span>
          {/* Наём — только при N > 0: это не бригада, а сколько внешних ещё
              предстоит взять, и нуля в строке быть не должно. */}
          {editor.counts.hired > 0 && (
            <span>{tr('Наём:', 'Yollash:')} <strong>{editor.counts.hired.toLocaleString(locale)}</strong></span>
          )}
        </footer>
      )}
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
              hallId={hall.id}
              positionId={position.id}
              // Имена нужны клетке только для aria-label: на экране пересечение
              // видно глазами, скринридеру пересечения не видно.
              positionName={position.name}
              // Роль СТРОКИ: кнопка «Наём» появляется только у операторов —
              // то же правило, что в редакторе, и живёт оно на клиенте.
              positionRole={position.role}
              hallName={hall.name}
              hallColor={hall.color}
              cell={editor.cellMap.get(cellKeyOf({ hallId: hall.id, positionId: position.id }))}
              editor={editor}
            />
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
function TvCell({ hallId, positionId, positionName, positionRole, hallName, hallColor, cell, editor }: {
  hallId: string
  positionId: string
  positionName: string
  positionRole: string
  hallName: string
  hallColor: string
  cell: AssignmentWithEmployee | undefined
  editor: HallPlanEditor
}) {
  const { tr } = useLanguage()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const armed = useArmedAction()
  const isBusy = editor.addingCell === cellKeyOf({ hallId, positionId })
  const tint = { '--hall-color': hallColor } as CSSProperties

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
      <div className="hall-tv__cell" style={tint}>
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
      <div className={`hall-tv__cell ${armed.armed ? 'is-armed' : ''}`} style={tint}>
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

  return (
    <div className={`hall-tv__cell ${armed.armed ? 'is-armed' : ''}`} style={tint}>
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
            <>
              <span className="hall-tv__name-row">
                <span className="hall-tv__first">{first}</span>
                {planCount > 1 && (
                  // ×N — по ВСЕМУ плану: страховка на четыре зала это одна
                  // фамилия в четырёх клетках разных залов, и на планёрке это
                  // единственный способ увидеть перегруженного человека.
                  <span className="hall-tv__badge" title={tr(`В плане ${planCount} раз`, `Rejada ${planCount} marta`)}>×{planCount}</span>
                )}
              </span>
              {last && <span className="hall-tv__last">{last}</span>}
            </>
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
