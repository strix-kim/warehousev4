import { ArrowLeft, Check, CircleAlert, Copy, LayoutGrid, MonitorPlay, Pencil, Plus, Presentation } from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { HallMatrix } from './HallMatrix'
import { HallPlanMetaDrawer } from './HallPlanMetaDrawer'
import { buildPlanText, copyText } from './planText'
import { useHallPlanEditor, type HallPlanEditor } from './useHallPlanEditor'
import { formatPlanPeriod } from './types'
import { employeeDisplayName } from '../employees/types'
import { formatTime } from '../../lib/date'
import { useDocumentTitle, useLanguage } from '../../lib/i18n'
import './halls.css'

// Редактор плана: матрица «позиции × залы» (с20, по образцу прораба). Кнопки
// «Сохранить» здесь нет — каждое действие уходит в базу само
// (useHallPlanEditor), а шапка показывает, чем это кончилось.
export function HallPlanPage() {
  const navigate = useNavigate()
  const { tr, locale } = useLanguage()
  const { planId } = useParams<{ planId: string }>()
  const editor = useHallPlanEditor(planId)
  const [isMetaOpen, setMetaOpen] = useState(false)

  // Имя плана в заголовке вкладки. Это не украшение: из document.title браузер
  // берёт колонтитул печатного листа и подставляет его в имя файла при
  // «Сохранить как PDF» — без этого расстановка сохранялась как «Учёт
  // оборудования» (с22).
  useDocumentTitle(editor.plan
    ? tr(`${editor.plan.name} — план залов`, `${editor.plan.name} — zallar rejasi`)
    : '')

  // Печать плана — единственная в системе, и по природе она глобальна: гасит
  // сайдбар, перекрашивает серую шкалу всего документа, кладёт лист на бок.
  // Раньше эти правила стояли в halls.css без ограничителя, а <style> ленивого
  // чанка при уходе со страницы НЕ удаляется — и печать каталога портилась
  // после любого захода в «Залы» (регрессия с22, найдена аудитом с23).
  // Маркер на body включает блок @media print ровно на время жизни страницы.
  //
  // @page едет отдельной таблицей стилей не для красоты: правило страничного
  // бокса селекторов не принимает вовсе — ни классом, ни маркером его не
  // ограничить, и снять его можно только вместе с самой таблицей.
  useEffect(() => {
    document.body.classList.add('hall-print')
    const pageStyle = document.createElement('style')
    // Поле сверху 14 мм, а не 8: часть принтеров физически не печатает у края,
    // плюс браузер ставит туда свою строку с датой и адресом (с22).
    pageStyle.textContent = '@media print { @page { size: A4 landscape; margin: 14mm 10mm 10mm } }'
    document.head.append(pageStyle)
    return () => {
      document.body.classList.remove('hall-print')
      pageStyle.remove()
    }
  }, [])

  if (editor.loadState !== 'ready' || !editor.plan) {
    return (
      // Поля панели (--halls) нужны только болванке матрицы: отказ и «не найден»
      // это .state-block, он центрирует себя сам.
      <section className={editor.loadState === 'loading' ? 'data-panel data-panel--halls' : 'data-panel'}>
        {editor.loadState === 'loading' && <MatrixSkeleton />}
        {/* 'missing' — строки нет (или её не видно политикой): честное состояние,
            а не пустая шапка, иначе ссылка на удалённый план выглядела бы рабочей. */}
        {editor.loadState === 'missing' && (
          <div className="state-block">
            <Presentation size={27} />
            <strong>{tr('План не найден', 'Reja topilmadi')}</strong>
            <span>{tr('Возможно, план удалили или ссылка устарела.', 'Ehtimol, reja o‘chirilgan yoki havola eskirgan.')}</span>
            <button className="button button--primary" onClick={() => navigate('/halls')}>{tr('К списку планов', 'Rejalar ro‘yxatiga')}</button>
          </div>
        )}
        {editor.loadState === 'failed' && (
          <div className="state-block state-block--error">
            <CircleAlert size={24} />
            <strong>{tr('Ошибка загрузки', 'Yuklash xatosi')}</strong>
            <span>{tr('Не удалось загрузить план залов.', 'Zallar rejasini yuklab bo‘lmadi.')}</span>
            <button className="button button--secondary" onClick={editor.reload}>{tr('Повторить', 'Qayta urinish')}</button>
          </div>
        )}
      </section>
    )
  }

  const plan = editor.plan

  return (
    <>
      {/* Шапка редактора, а не .page-header: у раздела с адресом внутри есть
          возврат кнопкой-стрелкой — тот же приём, что у форм машины и сотрудника.
          Период стоит в надстрочнике: h1 здесь однострочный с многоточием. */}
      <header className="editor-header editor-header--hall">
        <button type="button" className="icon-button icon-button--bordered" onClick={() => navigate('/halls')} aria-label={tr('Назад к планам', 'Rejalarga qaytish')}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="eyebrow">{tr('План залов', 'Zallar rejasi')} · {formatPlanPeriod(plan, locale, tr)}</p>
          <h1>{plan.name}</h1>
        </div>
        <div className="editor-header__actions">
          <SaveState
            state={editor.saveState}
            savedAt={editor.savedAt}
            errorText={editor.errorText}
            onRetry={editor.reload}
          />
          <CopyPlanButton editor={editor} />
          <button className="button button--secondary" onClick={() => setMetaOpen(true)}>
            <Pencil size={16} /> {tr('Изменить', 'O‘zgartirish')}
          </button>
          {/* Обычная навигация, не новая вкладка: на самом ТВ адрес открывают
              браузером телевизора, а здесь кнопка нужна, чтобы посмотреть
              витрину и вернуться Esc-ом. */}
          <button className="button button--secondary" onClick={() => navigate(`/halls/${plan.id}/tv`)}>
            <MonitorPlay size={16} /> {tr('ТВ', 'TV')}
          </button>
        </div>
      </header>

      {/* Одна полоса вместо двух голых абзацев между шапкой и панелью (с25):
          в доме сводки живут либо в тулбаре, либо в подвале панели, третьего
          места нет. На печати полоса снимается display: contents — правила
          листа адресованы .hall-counts и .hall-free, и они остаются на месте. */}
      <div className="hall-summary">
        <PlanCounts counts={editor.counts} />
        <FreeEmployees editor={editor} />
      </div>

      <section className="data-panel data-panel--halls">
        {editor.positions.length === 0
          ? (
            // Пустая матрица без строк — не ошибка, а незаполненный план: залы
            // уже стоят, ставить в них некого. Строки берут из справочника
            // чипами под матрицей или вписывают свои.
            <div className="state-block">
              <LayoutGrid size={27} />
              <strong>{tr('В плане нет позиций', 'Rejada lavozimlar yo‘q')}</strong>
              <span>{tr(
                'Выберите позицию из готовых под матрицей или впишите свою.',
                'Matritsa ostidagi tayyor lavozimlardan tanlang yoki o‘zingiznikini kiriting.',
              )}</span>
              <button className="button button--primary" onClick={focusPositionInput}>
                <Plus size={17} /> {tr('Добавить позицию', 'Lavozim qo‘shish')}
              </button>
            </div>
          )
          : null}
        <HallMatrix editor={editor} />
      </section>

      {isMetaOpen && (
        <HallPlanMetaDrawer
          plan={plan}
          onClose={() => setMetaOpen(false)}
          onSubmit={async (input) => {
            // Отказ наверх не глотаем: его показывает сам дровер и оставляет
            // форму открытой с набранными полями.
            await editor.updateMeta(input)
            setMetaOpen(false)
          }}
        />
      )}
    </>
  )
}

// Единственное действие пустого плана — поле «Добавить позицию», а лежит оно
// ПОД матрицей, ниже сгиба: пустое состояние звало сделать то, чего не видно.
// Поле живёт внутри HallMatrix, и тянуть ref через два компонента ради одного
// клика незачем — берём его из DOM, как ListEditorPage берёт поля раскрытой
// панели по id.
//
// preventScroll обязателен: обычный фокус прыгает к полю мгновенно и обрывает
// плавную прокрутку (та же грабля, что в редакторе списков).
function focusPositionInput() {
  const input = document.querySelector<HTMLInputElement>('.hall-add-position input')
  if (!input) return
  input.scrollIntoView({ block: 'center', behavior: 'smooth' })
  input.focus({ preventScroll: true })
}

// Болванка матрицы на время загрузки. Строка «Загружаем план…» стояла в
// .state-block на 260 px, а приезжала на её место сетка в пол-экрана — контент
// прыгал ровно в тот момент, когда на него начинали смотреть.
//
// Числа взяты типовые и НЕ угадывают конкретный план: болванка обязана совпасть
// с матрицей площадью, а не составом — сколько в плане залов и позиций, до
// ответа базы неизвестно в принципе.
const SKELETON_HALLS = 4
const SKELETON_ROWS = 5

function MatrixSkeleton() {
  const { tr } = useLanguage()

  return (
    <div className="hall-matrix-scroll hall-skeleton" role="status" aria-label={tr('Загружаем план…', 'Reja yuklanmoqda…')}>
      <div className="hall-skeleton__grid">
        <div className="hall-skeleton__corner" />
        {Array.from({ length: SKELETON_HALLS }, (_, index) => (
          <div className="hall-skeleton__colhead" key={index}><span /></div>
        ))}
        {Array.from({ length: SKELETON_ROWS }, (_, row) => (
          <Fragment key={row}>
            <div className="hall-skeleton__rowhead"><span /></div>
            {Array.from({ length: SKELETON_HALLS }, (_, column) => (
              <div className="hall-skeleton__cell" key={column}><span /></div>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

// Расстановка текстом в буфер — её вставляют в группу с сотрудниками (с22).
// Кнопка не ведёт ни в какой экран и ничего не сохраняет, поэтому весь её
// результат — подтверждение на самой кнопке: без него нажатие выглядит как
// промах мимо кнопки.
function CopyPlanButton({ editor }: { editor: HallPlanEditor }) {
  const { tr, locale } = useLanguage()
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle')
  // Таймер сбрасываем при размонтировании и перед новым нажатием: два клика
  // подряд иначе гасили бы подтверждение по первому таймеру.
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = async () => {
    if (!editor.plan) return
    const ok = await copyText(buildPlanText({
      plan: editor.plan,
      halls: editor.halls,
      positions: editor.positions,
      cellMap: editor.cellMap,
      counts: editor.counts,
      locale,
      tr,
    }))
    window.clearTimeout(timer.current)
    setState(ok ? 'done' : 'failed')
    timer.current = window.setTimeout(() => setState('idle'), 2000)
  }

  return (
    <button
      className="button button--secondary"
      onClick={() => { void copy() }}
      title={tr('Скопировать расстановку текстом — для чата', 'Joylashuvni matn ko‘rinishida nusxalash — chat uchun')}
    >
      {state === 'done' ? <Check size={16} /> : <Copy size={16} />}
      {state === 'done' && tr('Скопировано', 'Nusxalandi')}
      {state === 'failed' && tr('Не вышло', 'Bo‘lmadi')}
      {state === 'idle' && tr('Копировать', 'Nusxalash')}
    </button>
  )
}

// Статус автосохранения. До первой правки времени ещё нет — вместо «Сохранено
// —:—» человеку объясняют правило: сохранять руками ничего не нужно.
function SaveState({ state, savedAt, errorText, onRetry }: {
  state: 'saved' | 'saving' | 'failed'
  savedAt: number
  errorText: string
  onRetry: () => void
}) {
  const { tr, locale } = useLanguage()

  if (state === 'failed') {
    return (
      <p className="hall-save hall-save--failed" role="status" title={errorText}>
        <CircleAlert size={14} />
        {tr('Не сохранилось', 'Saqlanmadi')}
        {/* «Повторить» — полная перезагрузка плана, а не повтор упавшего запроса:
            после отказа локальная копия разошлась с базой, и вернуть их в одно
            состояние может только чтение. */}
        <button type="button" onClick={onRetry}>{tr('Повторить', 'Qayta urinish')}</button>
      </p>
    )
  }

  return (
    <p className="hall-save" role="status">
      {state === 'saving' && tr('Сохраняем…', 'Saqlanmoqda…')}
      {state === 'saved' && (savedAt
        ? tr(`Сохранено ${formatTime(savedAt, locale)}`, `${formatTime(savedAt, locale)} da saqlandi`)
        : tr('Сохраняется автоматически', 'Avtomatik saqlanadi'))}
    </p>
  )
}

// Счётчики плана. Люди уникальные, а не ячейки: страховка одного человека на
// четыре зала — один техник в бригаде (см. countPlan). «Свободно» отсюда ушло
// вместе с вакансиями-записями (миграция 20260824140000): пустая клетка теперь
// это отсутствие записи, и её видно в самой матрице прочерком.
//
// «Наём» стоит отдельным пунктом и только при N > 0: это не люди бригады, а
// сколько внешних операторов ещё предстоит взять. Пока слотов нет, лишнего
// нуля в строке быть не должно.
function PlanCounts({ counts }: { counts: { technicians: number; operators: number; others: number; totalPeople: number; hired: number } }) {
  const { tr, locale } = useLanguage()

  return (
    // Форма «метка: число», а не «7 видеоинженеров»: на единице выходило
    // «1 операторов». Своего словаря окончаний в проекте нет намеренно
    // (lib/date.ts, formatAge) — вести его на два языка дороже, чем набрать
    // сводку формой, которая не склоняется вовсе. Ровно так же подписан
    // подвал ТВ, и теперь эти две сводки читаются одинаково.
    <div className="hall-counts">
      <span>{tr('Людей', 'Odamlar')}: <strong>{counts.totalPeople.toLocaleString(locale)}</strong></span>
      <span>{tr('Видеоинженеры', 'Videoinjenerlar')}: <strong>{counts.technicians.toLocaleString(locale)}</strong></span>
      <span>{tr('Операторы', 'Operatorlar')}: <strong>{counts.operators.toLocaleString(locale)}</strong></span>
      {counts.others > 0 && <span>{tr('Прочие', 'Boshqalar')}: <strong>{counts.others.toLocaleString(locale)}</strong></span>}
      {counts.hired > 0 && <span>{tr('Наём', 'Yollash')}: <strong>{counts.hired.toLocaleString(locale)}</strong></span>}
    </div>
  )
}

// Сколько имён показывает строка «Свободны» до разворота. Шесть — столько
// влезает в одну строку на типовом ноутбуке, не отжимая матрицу вниз.
const VISIBLE_FREE = 6

// Кто из сотрудников не стоит в плане ни разу (с21). Счётчики говорят, сколько
// человек набрано, эта строка — кем добирать: иначе ответ на «кто ещё свободен»
// собирается открытием пикера в каждой клетке.
//
// Свободные считаются от ВСЕХ сотрудников, а не от тех, кого видно в матрице:
// список кандидатов ровно тот же, что отдаёт пикер, и разойтись они не могут.
function FreeEmployees({ editor }: { editor: HallPlanEditor }) {
  const { tr, locale } = useLanguage()
  const [isExpanded, setExpanded] = useState(false)

  const free = useMemo(
    () => editor.candidates.filter((candidate) => !editor.planCountByEmployee.has(candidate.id)),
    [editor.candidates, editor.planCountByEmployee],
  )

  // Кандидаты ещё в пути — строки нет вовсе: «Свободных нет» на недогруженном
  // списке было бы враньём, а скелет ради одной серой строки избыточен.
  if (editor.candidatesState !== 'ready') return null

  const all = free.map(employeeDisplayName)
  const names = all.join(', ')
  const count = free.length.toLocaleString(locale)

  if (free.length === 0) return <p className="hall-free">{tr('Свободных нет', 'Bo‘sh xodim yo‘q')}</p>

  // На экране список обрезан: на полном штате он выдавливал матрицу вниз, и
  // расстановка начиналась ниже сгиба. На БУМАГЕ обрезать нельзя — лист несут
  // на планёрку, и «и ещё 9» там ничего не значит. Поэтому вариантов два, и
  // печать показывает свой (см. @media print).
  const shown = isExpanded ? all : all.slice(0, VISIBLE_FREE)
  const rest = all.length - shown.length

  return (
    <p className="hall-free" title={names}>
      <span className="hall-free__screen">
        {tr(`Свободны: ${count} — `, `Bo‘sh: ${count} — `)}
        {shown.join(', ')}
        {rest > 0 && (
          <button type="button" className="hall-free__more" onClick={() => setExpanded(true)}>
            {tr(`и ещё ${rest}`, `va yana ${rest}`)}
          </button>
        )}
      </span>
      <span className="hall-free__print">{tr(`Свободны: ${count} — ${names}`, `Bo‘sh: ${count} — ${names}`)}</span>
    </p>
  )
}
