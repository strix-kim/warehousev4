import { BriefcaseBusiness, CircleAlert, FileSpreadsheet, Plus, Search, UserRound, Users, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchEmployeeList, fetchEmployeePhotos, fetchEmployeesByIds, getSignedUrls, pickDocumentPhoto, readCachedEmployeeList, readCachedEmployeeListMeta, readCachedEmployeePhotos, type EmployeePhotoRef } from './api'
import { EmployeeDrawer } from './EmployeeDrawer'
import { EmployeeEventExportDrawer } from './EmployeeEventExportDrawer'
import { downloadEmployeeEventXlsx, loadEventPhotos } from './eventExport'
import { employeeFullName, type EmployeeListItem } from './types'
import { AppSelect } from '../../components/AppSelect'
import { DataAge } from '../../components/DataAge'
import { PhotoThumb } from '../../components/PhotoThumb'
import { useDocumentTitle, useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'
import type { EventDocumentMeta } from '../../lib/xlsx/eventDocument'

// Строка поиска и поле карточки приводятся к одному виду: регистр не важен,
// подряд идущие пробелы схлопнуты — «иванов  азиз» находит «Иванов Азиз».
function normalized(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

// Телефон сверяем ещё и одними цифрами: в базе он с пробелами и плюсом, а в
// голове у человека — слитно («901234567»).
function digitsOnly(value: string) {
  return value.replace(/\D+/g, '')
}

function matchesSearch(employee: EmployeeListItem, query: string, digits: string) {
  const haystack = normalized([employee.last_name, employee.first_name, employee.middle_name, employee.position, employee.phone].filter(Boolean).join(' '))
  if (haystack.includes(query)) return true
  return Boolean(digits) && digitsOnly(employee.phone ?? '').includes(digits)
}

export function EmployeesPage() {
  const navigate = useNavigate()
  const { tr, locale } = useLanguage()
  useDocumentTitle(tr('Сотрудники', 'Xodimlar'))
  // Открытая карточка живёт в АДРЕСЕ: заход в «Добавить сотрудника» и обратно
  // размонтирует страницу, а на телефоне жест «назад» обязан закрывать карточку,
  // а не выкидывать из раздела.
  const [params, setParams] = useSearchParams()
  const employeeId = params.get('employee') ?? ''
  // Первый кадр берём из кэша. В реестре нет паспортных данных (api.ts), поэтому
  // запись лежит на диске и раздел открывается с людьми даже после перезагрузки.
  const [cachedEmployees] = useState(() => readCachedEmployeeList())
  const [employees, setEmployees] = useState<EmployeeListItem[]>(() => cachedEmployees ?? [])
  // Поиск здесь клиентский и в адрес не едет — как у машин: выдача полная,
  // фильтр мгновенный, запоминать его в истории незачем.
  const [search, setSearch] = useState('')
  // Должность — такой же клиентский фильтр, как поиск, и складывается с ним:
  // выбранная должность сужает найденное, а не заменяет его.
  const [position, setPosition] = useState('')
  // Состав будущего документа — черновик действия, а не состояние экрана:
  // ни в адресе, ни в хранилище его нет, уход со страницы сбрасывает выбор.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isExportOpen, setIsExportOpen] = useState(false)
  // Фото сотрудников: карта нужна не только миниатюрам — сводка «без фото»
  // в экспорте считается по ней же, тем же pickDocumentPhoto.
  const [photos, setPhotos] = useState<Map<string, EmployeePhotoRef[]>>(() => readCachedEmployeePhotos() ?? new Map())
  // Подписанные ссылки по пути в бакете — только память страницы: URL живёт час,
  // и в persistentCache ему не место.
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map())
  // Пустая карта фото и НЕотвеченный запрос — разные состояния (gotchas §11):
  // без этого флага сводка экспорта после отказа уверенно говорила бы «без фото
  // все», хотя мы просто не знаем.
  const [photosKnown, setPhotosKnown] = useState(() => readCachedEmployeePhotos() !== null)
  const [isLoading, setIsLoading] = useState(() => !cachedEmployees)
  // Флаг, а не текст: строка в стейте потянула бы tr в зависимости эффекта, и
  // смена языка перезагружала бы список.
  const [hasError, setHasError] = useState(false)
  // Момент записи показанной выдачи. Значение принадлежит persistentCache —
  // здесь только перечитывается, ничего производного не храним.
  const [dataAt, setDataAt] = useState<number | null>(null)
  // Отдельный флаг от isLoading: isLoading означает «показывать нечего, рисуем
  // скелет» и при живом кэше всегда false, а кнопке «Обновить» нужен признак
  // «запрос в полёте».
  const [isFetching, setIsFetching] = useState(false)
  // Исход ПОСЛЕДНЕГО запроса: бейдж обязан отличать «данные старые» от
  // «обновиться не удалось».
  const [lastFetchFailed, setLastFetchFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let isCurrent = true
    // Показали кэш — обязаны перепроверить у сервера; «Обновить» обходит кэш
    // всегда, потому что её жмут именно от недоверия к показанному.
    const bypassCache = reloadKey > 0 || Boolean(cachedEmployees)
    // Метка ДО запроса. Отказ сети не всегда доходит до .catch: при живой записи
    // cachedQuery подменяет провал последним значением и промис РЕЗОЛВИТСЯ.
    // Единственный честный признак «ответа не было» — несдвинувшаяся метка
    // (gotchas §11): кэш двигает её только на успешном ответе.
    const ageBefore = readCachedEmployeeListMeta()?.touchedAt ?? null
    setIsLoading(!cachedEmployees)
    setIsFetching(true)
    setHasError(false)
    setDataAt(null)

    // Два круга вместо трёх: фото спрашивают ДРУГУЮ таблицу и выдачи сотрудников
    // не ждут — раньше запрос за ними стартовал только после её ответа.
    // Миниатюры — украшение строки: их отказ не должен ронять список, поэтому у
    // них своя ветка и свой отчёт.
    const photosPromise = fetchEmployeePhotos({ bypassCache })
      .then((byEmployee) => {
        if (isCurrent) {
          // Карту кладём ДО подписи ссылок: сводка «без фото» считается по ней,
          // и провал подписи не должен превращаться в «фото нет ни у кого».
          setPhotos(byEmployee)
          setPhotosKnown(true)
        }
        return byEmployee
      })
      .catch((error: unknown) => {
        reportAppError(error, { scope: 'loader', route: '/employees', detail: { source: 'photos' } })
        return null
      })

    fetchEmployeeList({ bypassCache })
      .then(async (rows) => {
        if (!isCurrent) return
        setEmployees(rows)
        const ageAfter = readCachedEmployeeListMeta()?.touchedAt ?? null
        setLastFetchFailed(ageAfter !== null && ageAfter === ageBefore)
        setDataAt(ageAfter)

        // Подписываем только фото для документов: остальные снимки на этом
        // экране не видны.
        const byEmployee = await photosPromise
        if (!isCurrent || !byEmployee) return
        const paths = rows.map((row) => pickDocumentPhoto(row, byEmployee.get(row.id))?.storage_path).filter((path): path is string => Boolean(path))
        const urls = await getSignedUrls(paths)
        if (isCurrent) setPhotoUrls(urls)
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        setLastFetchFailed(true)
        setDataAt(readCachedEmployeeListMeta()?.touchedAt ?? null)
        // Кэш уже на экране — сбой обновления не повод рушить показанный список.
        if (!cachedEmployees) setHasError(true)
        reportAppError(error, { scope: 'loader', route: '/employees' })
      })
      .finally(() => {
        if (!isCurrent) return
        setIsLoading(false)
        setIsFetching(false)
      })
    return () => { isCurrent = false }
  }, [reloadKey])

  const query = normalized(search)
  const isFiltered = Boolean(query) || Boolean(position)
  const visible = useMemo(() => {
    if (!isFiltered) return employees
    const digits = digitsOnly(query)
    return employees.filter((employee) => {
      if (position && employee.position !== position) return false
      return !query || matchesSearch(employee, query, digits)
    })
  }, [employees, query, position, isFiltered])

  // Должности берём из самой выдачи — отдельного справочника у сотрудников нет,
  // а список здесь полный, так что счёт по нему честный. Считаем по ПОЛНОЙ
  // выдаче, а не по видимому: иначе выбранная должность выкинула бы из списка
  // все остальные и сменить её было бы нечем.
  const positionOptions = useMemo(() => {
    const values = [...new Set(employees.map((employee) => employee.position).filter((value): value is string => Boolean(value)))]
    values.sort((a, b) => a.localeCompare(b, 'ru'))
    return values
  }, [employees])

  function resetFilters() {
    setSearch('')
    setPosition('')
  }

  // Карточка — тоже адрес. Открытие пушит запись, поэтому «назад» её закрывает;
  // закрытие ЗАМЕНЯЕТ текущую запись, иначе «назад» открыло бы её снова (§7).
  function openEmployee(employee: EmployeeListItem) {
    const next = new URLSearchParams(params)
    next.set('employee', employee.id)
    setParams(next)
  }

  function closeEmployee() {
    const next = new URLSearchParams(params)
    next.delete('employee')
    setParams(next, { replace: true })
  }

  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // «Показанные» — это результат поиска, а не вся база: галка в тулбаре обещает
  // ровно то, что человек видит перед собой.
  const allShownSelected = visible.length > 0 && visible.every((employee) => selected.has(employee.id))

  function toggleAllShown() {
    setSelected((current) => {
      const next = new Set(current)
      for (const employee of visible) {
        if (allShownSelected) next.delete(employee.id)
        else next.add(employee.id)
      }
      return next
    })
  }

  // Новое фото для документов пришло из карточки: правим строку в списке (от неё
  // же кормится открытый дровер) и подписываем путь. Ссылка уже в памяти кэша —
  // карточка подписала её, когда показывала список файлов.
  function applyDocumentPhoto(id: string, fileId: string) {
    setEmployees((current) => current.map((employee) => employee.id === id ? { ...employee, document_photo_id: fileId } : employee))
    const path = photos.get(id)?.find((photo) => photo.id === fileId)?.storage_path
    if (!path || photoUrls.has(path)) return
    void getSignedUrls([path])
      .then((urls) => setPhotoUrls((current) => new Map([...current, ...urls])))
      .catch((error: unknown) => reportAppError(error, { scope: 'loader', route: '/employees', detail: { source: 'photos' } }))
  }

  // Строку из адреса ищем в реестре — по ПОЛНОМУ списку, а не по отфильтрованному:
  // набранный поиск не должен закрывать открытую карточку. Паспортных полей в ней
  // нет, поэтому дровер догружает карточку по id сам: шапка рисуется мгновенно,
  // документы дорисовываются, когда приедут.
  const openCard = employeeId ? employees.find((employee) => employee.id === employeeId) ?? null : null
  const chosen = employees.filter((employee) => selected.has(employee.id))

  // Сборка документа: качаем фото (те же, что показывает список — pickDocumentPhoto
  // тут единственный судья), потом собираем файл. Отменённый прогон файл НЕ отдаёт:
  // человек уже закрыл дровер, и загрузка «сама собой» его бы озадачила.
  // Паспорт, ПИНФЛ и дата рождения в реестре не лежат — за ними идём отдельным
  // запросом по выбранным id, ровно в момент сборки файла и без кэша.
  async function exportEventList(meta: EventDocumentMeta, options: { onProgress: (done: number, total: number) => void; signal: AbortSignal }) {
    const refs = chosen
      .map((employee) => ({ employeeId: employee.id, photo: pickDocumentPhoto(employee, photos.get(employee.id)) }))
      .filter((item): item is { employeeId: string; photo: EmployeePhotoRef } => Boolean(item.photo))
      .map((item) => ({ employeeId: item.employeeId, storage_path: item.photo.storage_path }))
    // Полные строки и фото едут ВМЕСТЕ: ждать их по очереди незачем — запросы
    // независимы, а человек стоит перед полосой прогресса.
    const [full, { photos: loaded, failed }] = await Promise.all([
      fetchEmployeesByIds(chosen.map((employee) => employee.id)),
      loadEventPhotos(refs, options),
    ])
    if (!options.signal.aborted) downloadEmployeeEventXlsx({ employees: full, meta, photos: loaded })
    return { failed }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">{tr('Люди', 'Odamlar')}</p>
          <h1>{tr('Сотрудники', 'Xodimlar')}</h1>
          <p className="page-description">{tr('Карточки сотрудников: контакты, документы и сканы.', 'Xodimlar kartalari: kontaktlar, hujjatlar va nusxalar.')}</p>
        </div>
        <button className="button button--primary" onClick={() => navigate('/employees/new')}>
          <Plus size={18} /> {tr('Добавить сотрудника', 'Xodim qo‘shish')}
        </button>
      </header>

      <section className="data-panel">
        <div className="toolbar">
          <label className="search-field">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tr('Фамилия, должность или телефон…', 'Familiya, lavozim yoki telefon…')}
              aria-label={tr('Поиск сотрудников', 'Xodimlarni qidirish')}
            />
            {search && (
              <button className="icon-button" onClick={() => setSearch('')} aria-label={tr('Очистить поиск', 'Qidiruvni tozalash')}>
                <X size={16} />
              </button>
            )}
          </label>
          <AppSelect
            value={position}
            options={[{ value: '', label: tr('Все должности', 'Barcha lavozimlar') }, ...positionOptions.map((value) => ({ value, label: value }))]}
            icon={<BriefcaseBusiness size={17} />}
            onChange={setPosition}
            ariaLabel={tr('Фильтр по должности', 'Lavozim bo‘yicha filtr')}
          />
          <label className="select-all">
            <input type="checkbox" checked={allShownSelected} disabled={visible.length === 0} onChange={toggleAllShown} />
            {/* Числа в подписи нет намеренно: сколько сейчас показано, печатает
                один toolbar__count — два счётчика рядом расходились бы в глазах. */}
            <span>{tr('Выбрать всех показанных', 'Ko‘rsatilganlarning barchasini tanlash')}</span>
          </label>
          <span className="toolbar__count">
            {isFiltered
              ? tr(`Найдено: ${visible.length.toLocaleString(locale)} из ${employees.length.toLocaleString(locale)}`, `Topildi: ${employees.length.toLocaleString(locale)} tadan ${visible.length.toLocaleString(locale)} tasi`)
              : `${tr('Сотрудников', 'Xodimlar')}: ${employees.length.toLocaleString(locale)}`}
          </span>
          {/* Рядом с блоком «Ошибка загрузки» бейдж не рисуем: на экране оказались
              бы два разных предложения обновиться. */}
          {!hasError && <DataAge touchedAt={dataAt} isRefreshing={isFetching} failed={lastFetchFailed} onRefresh={() => setReloadKey((value) => value + 1)} />}
        </div>

        {hasError ? (
          <div className="state-block state-block--error">
            <CircleAlert size={24} />
            <strong>{tr('Ошибка загрузки', 'Yuklash xatosi')}</strong>
            <span>{tr('Не удалось загрузить сотрудников. Повторите попытку.', 'Xodimlarni yuklab bo‘lmadi. Qayta urinib ko‘ring.')}</span>
            <button className="button button--secondary" onClick={() => setReloadKey((value) => value + 1)}>{tr('Повторить', 'Qayta urinish')}</button>
          </div>
        ) : (
          <div className="table-scroll" aria-busy={isLoading}>
            <table className="data-table data-table--selectable">
              <thead>
                <tr>
                  <th className="select-cell" aria-label={tr('Выбор', 'Tanlash')} />
                  <th>{tr('Сотрудник', 'Xodim')}</th>
                  <th>{tr('Должность', 'Lavozim')}</th>
                  <th>{tr('Телефон', 'Telefon')}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && employees.length === 0
                  ? Array.from({ length: 8 }, (_, index) => (
                      <tr key={index} className="skeleton-row">
                        <td colSpan={4}><span /></td>
                      </tr>
                    ))
                  : visible.map((employee) => {
                      const photo = pickDocumentPhoto(employee, photos.get(employee.id))
                      const url = photo ? photoUrls.get(photo.storage_path) : undefined
                      const fullName = employeeFullName(employee)
                      return (
                        <tr
                          key={employee.id}
                          className={selected.has(employee.id) ? 'is-selected' : undefined}
                          onClick={() => openEmployee(employee)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              openEmployee(employee)
                            }
                          }}
                          tabIndex={0}
                        >
                          {/* Ячейка выбора гасит всплытие: иначе галка заодно
                              открывала бы карточку. Остальная строка — открывает. */}
                          <td className="select-cell" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selected.has(employee.id)}
                              onChange={() => toggleSelected(employee.id)}
                              aria-label={fullName}
                            />
                          </td>
                          <td>
                            <div className="equipment-cell">
                              <PhotoThumb className="employee-avatar" url={url} placeholder={<UserRound size={18} />} />
                              <span>
                                <strong>{fullName}</strong>
                                <small>{employee.position || tr('Должность не указана', 'Lavozim ko‘rsatilmagan')}</small>
                              </span>
                            </div>
                          </td>
                          <td data-label={tr('Должность', 'Lavozim')}>{employee.position || '—'}</td>
                          <td data-label={tr('Телефон', 'Telefon')}>{employee.phone || '—'}</td>
                        </tr>
                      )
                    })}
              </tbody>
            </table>

            {!isLoading && employees.length === 0 && (
              <div className="state-block">
                {/* Иллюстрации у раздела пока нет. Когда арт придёт — на место
                    иконки одной строкой встаёт <img src="…" alt="" aria-hidden="true" />,
                    а блоку добавляются state-block--illustrated и --roomy. */}
                <Users size={27} />
                <strong>{tr('Сотрудников пока нет', 'Hozircha xodimlar yo‘q')}</strong>
                <span>{tr('Заведите первую карточку — паспортные данные и сканы можно добить позже.', 'Birinchi kartani yarating — pasport ma’lumotlari va nusxalarni keyinroq to‘ldirish mumkin.')}</span>
                <button className="button button--primary" onClick={() => navigate('/employees/new')}>
                  <Plus size={18} /> {tr('Добавить сотрудника', 'Xodim qo‘shish')}
                </button>
              </div>
            )}

            {!isLoading && employees.length > 0 && visible.length === 0 && (
              <div className="state-block">
                <Search size={27} />
                {/* Пусто может быть и от одной должности, без единой буквы в поиске —
                    тогда заголовок с пустыми кавычками врал бы про запрос. */}
                <strong>{search.trim()
                  ? tr(`Ничего не найдено по «${search.trim()}»`, `«${search.trim()}» bo‘yicha hech narsa topilmadi`)
                  : tr('Ничего не найдено', 'Hech narsa topilmadi')}</strong>
                <span>{tr('Проверьте написание фамилии или снимите фильтр по должности — телефон можно набрать и одними цифрами.', 'Familiya yozilishini tekshiring yoki lavozim filtrini oling — telefonni faqat raqamlar bilan ham kiritish mumkin.')}</span>
                <button className="button button--secondary" onClick={resetFilters}>{tr('Сбросить фильтры', 'Filtrlarni tozalash')}</button>
              </div>
            )}
          </div>
        )}
      </section>

      {selected.size > 0 && (
        <div className="bulk-bar">
          <span>{tr('Выбрано', 'Tanlangan')}: <strong>{selected.size.toLocaleString(locale)}</strong></span>
          <button className="button button--secondary" onClick={() => setSelected(new Set())}>{tr('Снять выбор', 'Tanlovni bekor qilish')}</button>
          <button className="button button--primary" onClick={() => setIsExportOpen(true)}>
            <FileSpreadsheet size={17} /> {tr('Список на мероприятие', 'Tadbir uchun ro‘yxat')}
          </button>
        </div>
      )}

      {openCard && <EmployeeDrawer employee={openCard} onClose={closeEmployee} onDocumentPhotoChange={(fileId) => applyDocumentPhoto(openCard.id, fileId)} />}
      {isExportOpen && <EmployeeEventExportDrawer employees={chosen} photos={photos} photosKnown={photosKnown} onClose={() => setIsExportOpen(false)} onExport={exportEventList} />}
    </>
  )
}
