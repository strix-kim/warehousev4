import { ArrowLeft, Check, CircleAlert, Copy, LayoutGrid, MonitorPlay, Pencil, Presentation } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
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
      <section className="data-panel">
        {editor.loadState === 'loading' && (
          <div className="state-block"><span>{tr('Загружаем план…', 'Reja yuklanmoqda…')}</span></div>
        )}
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

      <PlanCounts counts={editor.counts} />
      <FreeEmployees editor={editor} />

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
    <div className="hall-counts">
      <span><strong>{counts.totalPeople.toLocaleString(locale)}</strong> {tr('человек', 'kishi')}</span>
      <span><strong>{counts.technicians.toLocaleString(locale)}</strong> {tr('видеоинженеров', 'videoinjener')}</span>
      <span><strong>{counts.operators.toLocaleString(locale)}</strong> {tr('операторов', 'operator')}</span>
      {counts.others > 0 && <span><strong>{counts.others.toLocaleString(locale)}</strong> {tr('прочих', 'boshqa')}</span>}
      {counts.hired > 0 && <span>{tr('Наём:', 'Yollash:')} <strong>{counts.hired.toLocaleString(locale)}</strong></span>}
    </div>
  )
}

// Кто из сотрудников не стоит в плане ни разу (с21). Счётчики говорят, сколько
// человек набрано, эта строка — кем добирать: иначе ответ на «кто ещё свободен»
// собирается открытием пикера в каждой клетке.
//
// Свободные считаются от ВСЕХ сотрудников, а не от тех, кого видно в матрице:
// список кандидатов ровно тот же, что отдаёт пикер, и разойтись они не могут.
function FreeEmployees({ editor }: { editor: HallPlanEditor }) {
  const { tr, locale } = useLanguage()

  const free = useMemo(
    () => editor.candidates.filter((candidate) => !editor.planCountByEmployee.has(candidate.id)),
    [editor.candidates, editor.planCountByEmployee],
  )

  // Кандидаты ещё в пути — строки нет вовсе: «Свободных нет» на недогруженном
  // списке было бы враньём, а скелет ради одной серой строки избыточен.
  if (editor.candidatesState !== 'ready') return null

  const names = free.map(employeeDisplayName).join(', ')
  const count = free.length.toLocaleString(locale)

  return (
    <p className="hall-free">
      {free.length > 0
        ? tr(`Свободны: ${count} — ${names}`, `Bo‘sh: ${count} — ${names}`)
        : tr('Свободных нет', 'Bo‘sh xodim yo‘q')}
    </p>
  )
}
