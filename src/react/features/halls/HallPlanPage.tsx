import { ArrowLeft, CircleAlert, LayoutGrid, Pencil, Presentation } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { HallMatrix } from './HallMatrix'
import { HallPlanMetaDrawer } from './HallPlanMetaDrawer'
import { useHallPlanEditor, type HallPlanEditor } from './useHallPlanEditor'
import { formatPlanPeriod } from './types'
import { employeeDisplayName } from '../employees/types'
import { formatTime } from '../../lib/date'
import { useLanguage } from '../../lib/i18n'
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

  // Сотрудников грузим сразу, а не по первому клику в клетку (с21): строка
  // «Свободны» стоит над матрицей и нужна ДО того, как открыли пикер. Повторов
  // не боимся — loadCandidates держит свой ref (StrictMode монтирует эффект
  // дважды, и состояние в обоих проходах ещё 'idle').
  // В зависимостях только loadState: сама loadCandidates пересоздаётся каждым
  // рендером редактора, и держать её в списке значило бы перезапускать эффект
  // на каждый ввод буквы в имя зала. Замыкание при этом не устаревает — функция
  // ходит в базу и пишет через setState, внешнего состояния не читает.
  useEffect(() => {
    if (editor.loadState === 'ready') editor.loadCandidates()
  }, [editor.loadState])

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
      <header className="editor-header">
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
          <button className="button button--secondary" onClick={() => setMetaOpen(true)}>
            <Pencil size={16} /> {tr('Изменить', 'O‘zgartirish')}
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
function PlanCounts({ counts }: { counts: { technicians: number; operators: number; others: number; totalPeople: number } }) {
  const { tr, locale } = useLanguage()

  return (
    <div className="hall-counts">
      <span><strong>{counts.totalPeople.toLocaleString(locale)}</strong> {tr('человек', 'kishi')}</span>
      <span><strong>{counts.technicians.toLocaleString(locale)}</strong> {tr('видеоинженеров', 'videoinjener')}</span>
      <span><strong>{counts.operators.toLocaleString(locale)}</strong> {tr('операторов', 'operator')}</span>
      {counts.others > 0 && <span><strong>{counts.others.toLocaleString(locale)}</strong> {tr('прочих', 'boshqa')}</span>}
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
