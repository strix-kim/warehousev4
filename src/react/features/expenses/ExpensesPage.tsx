import { ChevronLeft, ChevronRight, CircleAlert, FileSpreadsheet, Plus, Search, UserRound } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchExpensesPeriod, fetchExpensesPeriodFresh, readCachedExpensesPeriod, readCachedExpensesPeriodMeta } from './api'
import { ExpenseDrawer } from './ExpenseDrawer'
import { formatDay, formatMonthLabel, formatSum, monthName } from './format'
import type { Expense, ExpenseInput, ExpensesPeriod, ExpensesQuery } from './types'
import { exportExpensesXlsx } from './xlsxExport'
import { AppSelect } from '../../components/AppSelect'
import { DataAge } from '../../components/DataAge'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState, RetryButton } from '../../components/ErrorState'
import { fetchEmployeeBriefs } from '../employees/api'
import { employeeShortName, type EmployeeBrief } from '../employees/types'
import { monthBounds, shiftMonthValue, todayDateValue } from '../../lib/date'
import { useDocumentTitle, useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'
import './expenses.css'

const ROUTE = '/expenses'

// Один ключ на «что сейчас на экране»: по нему отличаем перечитывание того же
// периода (строки остаются, пока летит ответ) от смены месяца или фильтра.
function queryKey({ from, to, spentBy }: ExpensesQuery) {
  return `${from}:${to}:${spentBy}`
}

// Кто встречается в периоде: из этих людей собирается фильтр «Кто потратил».
function spendersOf(period: ExpensesPeriod) {
  return [...new Set(period.rows.flatMap((row) => (row.spent_by ? [row.spent_by] : [])))]
}

// Открытый дровер — состояние страницы, не адреса: черновик расхода незачем
// класть в историю, а несохранённое на уходе ловит сам дровер (useGuardedClose).
type DrawerState = { mode: 'create' } | { mode: 'edit'; expense: Expense }

type ExportState = 'idle' | 'preparing' | 'mismatch' | 'failed'

export function ExpensesPage() {
  const { tr, language } = useLanguage()
  useDocumentTitle(tr('Расходы', 'Xarajatlar'))
  const currency = tr('сум', 'so‘m')

  // Месяц живёт в АДРЕСЕ (?m=2026-10): ссылку на сентябрь можно переслать, а F5
  // не сбрасывает на текущий. Параметра нет или в нём мусор — текущий месяц по
  // ЛОКАЛЬНОЙ дате, как и spent_on новой записи.
  const [params, setParams] = useSearchParams()
  const requestedMonth = params.get('m') ?? ''
  const month = monthBounds(requestedMonth) ? requestedMonth : todayDateValue().slice(0, 7)
  // Фильтр в адрес не едет (как марка у машин): он сужает уже открытый месяц и
  // переживать перезагрузку ему незачем.
  const [spentBy, setSpentBy] = useState('')
  const query = useMemo<ExpensesQuery>(() => {
    // month уже проверен выше, границы есть всегда; фолбэк — для типов.
    const bounds = monthBounds(month) ?? { from: `${month}-01`, to: `${month}-01` }
    return { ...bounds, spentBy }
  }, [month, spentBy])

  // Первый кадр берём из кэша: журнал лежит и на диске (кэш привязан к
  // пользователю), поэтому раздел открывается с суммами и после F5.
  const [period, setPeriod] = useState<ExpensesPeriod | null>(() => readCachedExpensesPeriod(query))
  // Ключ периода, который сейчас нарисован; null — на экране скелет.
  const shownKeyRef = useRef<string | null>(period ? queryKey(query) : null)
  const [isLoading, setIsLoading] = useState(() => !period)
  // Флаг, а не текст: строка в стейте потянула бы tr в зависимости эффекта.
  const [hasError, setHasError] = useState(false)
  // Момент записи показанного периода — значение persistentCache, здесь только
  // перечитывается.
  const [dataAt, setDataAt] = useState<number | null>(null)
  const [isFetching, setIsFetching] = useState(false)
  const [lastFetchFailed, setLastFetchFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  // Кто встречается в месяце БЕЗ фильтра — из них собирается сам фильтр. Под
  // фильтром база отдаёт только его строки, и по ним остальных не узнать.
  const [spenderIds, setSpenderIds] = useState<string[]>(() => (period ? spendersOf(period) : []))

  const [drawer, setDrawer] = useState<DrawerState | null>(null)
  const [exportState, setExportState] = useState<ExportState>('idle')

  // Сотрудники — справочник имён для строк, фильтра и поля «Кто потратил».
  // Отказ не роняет журнал: строки остаются без подписи, у пикера своя кнопка
  // повтора.
  const [candidates, setCandidates] = useState<EmployeeBrief[]>([])
  const [candidatesState, setCandidatesState] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle')

  function loadCandidates() {
    setCandidatesState('loading')
    fetchEmployeeBriefs()
      .then((rows) => {
        setCandidates(rows)
        setCandidatesState('ready')
      })
      .catch((error: unknown) => {
        reportAppError(error, { scope: 'loader', route: ROUTE, detail: { source: 'employees' } })
        setCandidatesState('failed')
      })
  }

  useEffect(loadCandidates, [])

  useEffect(() => {
    let isCurrent = true
    const key = queryKey(query)
    // Тот же период уже на экране (перечитывание после записи или «Обновить») —
    // строки не трогаем. Другой — рисуем кэш этого периода, а без него скелет:
    // под сменившимся месяцем честнее скелет, чем секунда чужих сумм (§7).
    const keepShown = shownKeyRef.current === key
    const cached = keepShown ? null : readCachedExpensesPeriod(query)
    if (!keepShown) {
      setPeriod(cached)
      shownKeyRef.current = cached ? key : null
      if (cached && !query.spentBy) setSpenderIds(spendersOf(cached))
    }
    const hasFrame = keepShown || Boolean(cached)
    // Метка ДО запроса: при живой записи cachedQuery подменяет провал последним
    // значением и промис РЕЗОЛВИТСЯ — честный признак «ответа не было» только
    // несдвинувшаяся метка (gotchas §11).
    const ageBefore = readCachedExpensesPeriodMeta(query)?.touchedAt ?? null
    setIsLoading(!hasFrame)
    setIsFetching(true)
    setHasError(false)
    setDataAt(null)
    setExportState('idle')

    // Показали кэш — обязаны перепроверить у сервера.
    fetchExpensesPeriod(query, { bypassCache: hasFrame || reloadKey > 0 })
      .then((value) => {
        if (!isCurrent) return
        setPeriod(value)
        shownKeyRef.current = key
        if (!query.spentBy) setSpenderIds(spendersOf(value))
        const ageAfter = readCachedExpensesPeriodMeta(query)?.touchedAt ?? null
        setLastFetchFailed(ageAfter !== null && ageAfter === ageBefore)
        setDataAt(ageAfter)
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        setLastFetchFailed(true)
        setDataAt(readCachedExpensesPeriodMeta(query)?.touchedAt ?? null)
        // Строки уже на экране — сбой обновления не повод их рушить.
        if (!hasFrame) setHasError(true)
        reportAppError(error, { scope: 'loader', route: ROUTE })
      })
      .finally(() => {
        if (!isCurrent) return
        setIsLoading(false)
        setIsFetching(false)
      })

    // Под фильтром список «кто встречается в месяце» берём из периода без
    // фильтра — обычно это чтение кэша: человек только что на него смотрел.
    // Отказ не шумит: в фильтре останется один выбранный.
    if (query.spentBy) {
      fetchExpensesPeriod({ ...query, spentBy: '' })
        .then((value) => {
          if (isCurrent) setSpenderIds(spendersOf(value))
        })
        .catch((error: unknown) => reportAppError(error, { scope: 'loader', route: ROUTE, detail: { source: 'spenders' } }))
    }

    return () => { isCurrent = false }
  }, [query, reloadKey])

  const namesById = useMemo(() => new Map(candidates.map((candidate) => [candidate.id, employeeShortName(candidate)])), [candidates])
  const spenderName = (id: string) => namesById.get(id) ?? tr('Сотрудник', 'Xodim')

  // Выбранный стоит в списке всегда — даже если в этом месяце у него трат нет:
  // иначе после смены месяца фильтр показывал бы «Все» при живом отборе.
  const filterOptions = useMemo(() => {
    const ids = spentBy && !spenderIds.includes(spentBy) ? [...spenderIds, spentBy] : spenderIds
    return ids
      .map((id) => ({ value: id, label: namesById.get(id) ?? tr('Сотрудник', 'Xodim') }))
      .sort((left, right) => left.label.localeCompare(right.label))
  }, [spenderIds, spentBy, namesById, tr])

  // Смена месяца ЗАМЕНЯЕТ запись истории: переключатель — фильтр, и «назад»
  // после десяти щелчков должно уводить из раздела, а не листать месяцы обратно.
  function showMonth(next: string) {
    const nextParams = new URLSearchParams(params)
    nextParams.set('m', next)
    setParams(nextParams, { replace: true })
  }

  function reload() {
    setReloadKey((value) => value + 1)
  }

  // Журнал после записи показывает ту строку, которую только что сохранили:
  // расход с датой из другого месяца переводит экран на его месяц, а «Кто
  // потратил» мимо активного фильтра этот фильтр снимает.
  function handleSaved(saved: ExpenseInput) {
    setDrawer(null)
    if (spentBy && saved.spentBy !== spentBy) setSpentBy('')
    const savedMonth = saved.spentOn.slice(0, 7)
    if (savedMonth !== month) showMonth(savedMonth)
    reload()
  }

  function handleDeleted() {
    setDrawer(null)
    reload()
  }

  // Выгрузка читает период заново и МИМО кэша, со всем активным фильтром: итог
  // под фильтром считает база. Не сошлось со строками — файл не выдаётся: лучше
  // отказ, чем документ, в котором «Итого» не равно сумме строк над ним.
  async function exportMonth() {
    if (exportState === 'preparing') return
    setExportState('preparing')
    try {
      const fresh = await fetchExpensesPeriodFresh(query)
      const sum = fresh.rows.reduce((accumulator, row) => accumulator + row.amount, 0)
      if (sum !== fresh.total || fresh.rows.length !== fresh.count) {
        reportAppError(new Error('expenses export: итог базы не сошёлся со строками'), {
          scope: 'loader',
          route: ROUTE,
          detail: { source: 'export', rows: fresh.rows.length, count: fresh.count },
        })
        setExportState('mismatch')
        return
      }
      await exportExpensesXlsx({
        monthLabel: formatMonthLabel(month, language),
        rows: fresh.rows.map((row) => ({ name: row.name, spentOn: row.spent_on, amount: row.amount })),
        total: fresh.total,
      })
      setExportState('idle')
    } catch (error) {
      reportAppError(error, { scope: 'loader', route: ROUTE, detail: { source: 'export' } })
      setExportState('failed')
    }
  }

  const rows = period?.rows ?? []
  const totalText = period ? `${formatSum(period.total)} ${currency}` : '—'
  // В русской фразе месяц идёт строчной («Итого за октябрь»), узбекская с него
  // начинается — там он остаётся с заглавной.
  const monthTitle = monthName(month, language)
  const monthLower = monthTitle.toLowerCase()
  const totalLabel = spentBy
    ? tr(`Итого за ${monthLower} · ${spenderName(spentBy)}`, `${monthTitle} uchun jami · ${spenderName(spentBy)}`)
    : tr(`Итого за ${monthLower}`, `${monthTitle} uchun jami`)
  const openId = drawer?.mode === 'edit' ? drawer.expense.id : ''

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">{tr('Инструменты', 'Asboblar')}</p>
          <h1>{tr('Производственные расходы', 'Ishlab chiqarish xarajatlari')}</h1>
          {period && <p className="catalog-summary">{tr('Записей', 'Yozuvlar')}: {formatSum(period.count)}</p>}
        </div>
        {/* Пустой месяц выгружать нечем — кнопка заперта, а не выдаёт лист из одной шапки. */}
        <button className="button button--secondary" disabled={!period || period.count === 0 || exportState === 'preparing'} onClick={() => void exportMonth()}>
          <FileSpreadsheet size={17} /> {exportState === 'preparing' ? tr('Готовим файл…', 'Fayl tayyorlanmoqda…') : tr('Скачать xlsx', 'Xlsx yuklab olish')}
        </button>
      </header>

      <div className="registry-layout">
        <div className="registry-tools">
          <div className="expenses-month" role="group" aria-label={tr('Месяц', 'Oy')}>
            <button type="button" className="icon-button icon-button--bordered" onClick={() => showMonth(shiftMonthValue(month, -1))} aria-label={tr('Предыдущий месяц', 'Oldingi oy')}>
              <ChevronLeft size={18} />
            </button>
            <strong aria-live="polite">{formatMonthLabel(month, language)}</strong>
            <button type="button" className="icon-button icon-button--bordered" onClick={() => showMonth(shiftMonthValue(month, 1))} aria-label={tr('Следующий месяц', 'Keyingi oy')}>
              <ChevronRight size={18} />
            </button>
          </div>
          {/* Фильтра нет, пока «Кто потратил» ни у кого не заполнено: селект из
              одного «Все» — шум. */}
          {filterOptions.length > 0 && (
            <AppSelect
              value={spentBy}
              options={[{ value: '', label: tr('Все сотрудники', 'Barcha xodimlar') }, ...filterOptions]}
              icon={<UserRound size={17} />}
              onChange={setSpentBy}
              ariaLabel={tr('Кто потратил', 'Kim sarfladi')}
            />
          )}
          {!hasError && <DataAge touchedAt={dataAt} isRefreshing={isFetching} failed={lastFetchFailed} onRefresh={reload} />}
        </div>

        {exportState === 'mismatch' && (
          <p className="form-error expenses-export-error" role="alert">
            <CircleAlert size={15} /> {tr('Файл не выдан: итог в базе не сошёлся с суммой строк. Обновите журнал и попробуйте ещё раз.', 'Fayl berilmadi: bazadagi jami qatorlar yig‘indisiga to‘g‘ri kelmadi. Jurnalni yangilab, qayta urinib ko‘ring.')}
          </p>
        )}
        {exportState === 'failed' && (
          <p className="form-error expenses-export-error" role="alert">
            <CircleAlert size={15} /> {tr('Не удалось собрать файл. Проверьте интернет и повторите.', 'Faylni yig‘ib bo‘lmadi. Internetni tekshirib, qayta urinib ko‘ring.')}
          </p>
        )}

        <section className="data-panel data-panel--registry">
          {hasError ? (
            <ErrorState
              title={tr('Не удалось загрузить расходы', 'Xarajatlarni yuklab bo‘lmadi')}
              text={tr('Проверьте интернет и повторите. Записи на месте — их просто не удалось показать.', 'Internetni tekshiring va qayta urinib ko‘ring. Yozuvlar joyida — ularni shunchaki ko‘rsatib bo‘lmadi.')}
              action={<RetryButton onClick={reload} />}
            />
          ) : (
            <div className="table-scroll" aria-busy={isLoading}>
              <table className="data-table data-table--registry expenses-table">
                <colgroup>
                  <col />
                  <col style={{ width: 150 }} />
                  <col style={{ width: 190 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>{tr('Наименование расхода', 'Xarajat nomi')}</th>
                    <th>{tr('Дата', 'Sana')}</th>
                    <th className="expenses-table__amount">{tr('Сумма', 'Summa')}</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? Array.from({ length: 5 }, (_, index) => (
                        <tr key={index} className="skeleton-row">
                          <td colSpan={3}><span /></td>
                        </tr>
                      ))
                    : rows.map((row) => (
                        <tr
                          key={row.id}
                          className={row.id === openId ? 'is-open' : undefined}
                          onClick={() => setDrawer({ mode: 'edit', expense: row })}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              setDrawer({ mode: 'edit', expense: row })
                            }
                          }}
                          tabIndex={0}
                        >
                          <td>
                            <div className="equipment-cell">
                              <span>
                                <strong title={row.name}>{row.name}</strong>
                                {row.spent_by && namesById.has(row.spent_by) && <small>{namesById.get(row.spent_by)}</small>}
                              </span>
                            </div>
                          </td>
                          <td className="expenses-table__date">{formatDay(row.spent_on)}</td>
                          <td className="expenses-table__amount">{formatSum(row.amount)}</td>
                        </tr>
                      ))}
                </tbody>
                {period && rows.length > 0 && (
                  <tfoot>
                    <tr>
                      <td colSpan={2}>{tr('Итого', 'Jami')}</td>
                      <td className="expenses-table__amount">{totalText}</td>
                    </tr>
                  </tfoot>
                )}
              </table>

              {!isLoading && period && rows.length === 0 && !spentBy && (
                <EmptyState
                  art
                  roomy
                  title={tr(`За ${monthLower} расходов нет`, `${monthTitle} uchun xarajatlar yo‘q`)}
                  text={tr('Запишите первый — наименование, сумма и дата. Месяц потом выгружается одним файлом.', 'Birinchisini yozing — nomi, summasi va sanasi. Keyin oy bitta fayl bilan yuklab olinadi.')}
                  action={(
                    <button className="button button--secondary" onClick={() => setDrawer({ mode: 'create' })}>
                      <Plus size={18} /> {tr('Добавить расход', 'Xarajat qo‘shish')}
                    </button>
                  )}
                />
              )}

              {!isLoading && period && rows.length === 0 && spentBy && (
                <EmptyState
                  icon={<Search size={27} />}
                  title={tr(`У сотрудника нет расходов за ${monthLower}`, `Xodimda ${monthLower} uchun xarajatlar yo‘q`)}
                  text={tr('Снимите фильтр, чтобы увидеть весь месяц.', 'Butun oyni ko‘rish uchun filtrni oling.')}
                  action={<button className="button button--secondary" onClick={() => setSpentBy('')}>{tr('Показать всех', 'Hammasini ko‘rsatish')}</button>}
                />
              )}
            </div>
          )}
        </section>
      </div>

      {/* Итог и ввод — вне .data-panel: её анимация появления держит transform,
          а под предком с transform position: fixed считается от него, а не от окна. */}
      <div className="expenses-bar">
        <span className="expenses-bar__total">
          <small>{totalLabel}</small>
          <strong>{totalText}</strong>
        </span>
        <button className="button button--primary" onClick={() => setDrawer({ mode: 'create' })}>
          <Plus size={18} /> {tr('Расход', 'Xarajat')}
        </button>
      </div>

      <AnimatePresence>
        {drawer && (
          <ExpenseDrawer
            key={drawer.mode === 'edit' ? drawer.expense.id : 'create'}
            expense={drawer.mode === 'edit' ? drawer.expense : undefined}
            defaultSpentBy={spentBy}
            candidates={candidates}
            candidatesState={candidatesState}
            onLoadCandidates={loadCandidates}
            onClose={() => setDrawer(null)}
            onSaved={handleSaved}
            onDeleted={handleDeleted}
            onStale={reload}
          />
        )}
      </AnimatePresence>
    </>
  )
}
