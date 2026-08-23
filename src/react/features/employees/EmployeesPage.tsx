import { CircleAlert, FileSpreadsheet, Plus, Search, UserRound, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchEmployeePhotos, fetchEmployees, getSignedUrls, pickDocumentPhoto, type EmployeePhotoRef } from './api'
import { EmployeeDrawer } from './EmployeeDrawer'
import { EmployeeEventExportDrawer } from './EmployeeEventExportDrawer'
import { employeeFullName, type Employee } from './types'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'

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

function matchesSearch(employee: Employee, query: string, digits: string) {
  const haystack = normalized([employee.last_name, employee.first_name, employee.middle_name, employee.position, employee.phone].filter(Boolean).join(' '))
  if (haystack.includes(query)) return true
  return Boolean(digits) && digitsOnly(employee.phone ?? '').includes(digits)
}

export function EmployeesPage() {
  const navigate = useNavigate()
  const { tr, locale } = useLanguage()
  // Открытая карточка живёт в АДРЕСЕ: заход в «Добавить сотрудника» и обратно
  // размонтирует страницу, а на телефоне жест «назад» обязан закрывать карточку,
  // а не выкидывать из раздела.
  const [params, setParams] = useSearchParams()
  const employeeId = params.get('employee') ?? ''
  const [employees, setEmployees] = useState<Employee[]>([])
  // Поиск здесь клиентский и в адрес не едет — как у машин: выдача полная,
  // фильтр мгновенный, запоминать его в истории незачем.
  const [search, setSearch] = useState('')
  // Состав будущего документа — черновик действия, а не состояние экрана:
  // ни в адресе, ни в хранилище его нет, уход со страницы сбрасывает выбор.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isExportOpen, setIsExportOpen] = useState(false)
  // Фото сотрудников: карта нужна не только миниатюрам — сводка «без фото»
  // в экспорте считается по ней же, тем же pickDocumentPhoto.
  const [photos, setPhotos] = useState<Map<string, EmployeePhotoRef[]>>(new Map())
  // Подписанные ссылки по пути в бакете — только память страницы: URL живёт час,
  // и в persistentCache ему не место.
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map())
  // Пустая карта фото и НЕотвеченный запрос — разные состояния (gotchas §11):
  // без этого флага сводка экспорта после отказа уверенно говорила бы «без фото
  // все», хотя мы просто не знаем.
  const [photosKnown, setPhotosKnown] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  // Флаг, а не текст: строка в стейте потянула бы tr в зависимости эффекта, и
  // смена языка перезагружала бы список.
  const [hasError, setHasError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let isCurrent = true
    setIsLoading(true)
    setHasError(false)
    fetchEmployees()
      .then((rows) => {
        if (!isCurrent) return
        setEmployees(rows)
        // Миниатюры — украшение строки: их отказ не должен ронять список,
        // поэтому у них своя ветка и свой отчёт. Подписываем только фото для
        // документов: остальные снимки на этом экране не видны.
        void fetchEmployeePhotos()
          .then(async (byEmployee) => {
            if (!isCurrent) return
            // Карту кладём ДО подписи ссылок: сводка «без фото» считается по ней,
            // и провал подписи не должен превращаться в «фото нет ни у кого».
            setPhotos(byEmployee)
            setPhotosKnown(true)
            const paths = rows.map((row) => pickDocumentPhoto(row, byEmployee.get(row.id))?.storage_path).filter((path): path is string => Boolean(path))
            const urls = await getSignedUrls(paths)
            if (isCurrent) setPhotoUrls(urls)
          })
          .catch((error: unknown) => reportAppError(error, { scope: 'loader', route: '/employees', detail: { source: 'photos' } }))
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        setHasError(true)
        reportAppError(error, { scope: 'loader', route: '/employees' })
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })
    return () => { isCurrent = false }
  }, [reloadKey])

  const query = normalized(search)
  const visible = useMemo(() => {
    if (!query) return employees
    const digits = digitsOnly(query)
    return employees.filter((employee) => matchesSearch(employee, query, digits))
  }, [employees, query])

  // Карточка — тоже адрес. Открытие пушит запись, поэтому «назад» её закрывает;
  // закрытие ЗАМЕНЯЕТ текущую запись, иначе «назад» открыло бы её снова (§7).
  function openEmployee(employee: Employee) {
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

  // Выдача полная (сотрудников ~200), поэтому карточку из адреса ищем в ней же —
  // отдельного запроса по id не нужно. Ищем по ПОЛНОМУ списку, а не по
  // отфильтрованному: набранный поиск не должен закрывать открытую карточку.
  const openCard = employeeId ? employees.find((employee) => employee.id === employeeId) ?? null : null
  const chosen = employees.filter((employee) => selected.has(employee.id))

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
          </label>
          <label className="select-all">
            <input type="checkbox" checked={allShownSelected} disabled={visible.length === 0} onChange={toggleAllShown} />
            <span>{tr('Выбрать всех показанных', 'Ko‘rsatilganlarning barchasini tanlash')} ({visible.length.toLocaleString(locale)})</span>
          </label>
          <span className="toolbar__count">
            {query
              ? tr(`Показано ${visible.length.toLocaleString(locale)} из ${employees.length.toLocaleString(locale)}`, `${employees.length.toLocaleString(locale)} tadan ${visible.length.toLocaleString(locale)} tasi ko‘rsatilgan`)
              : `${tr('Сотрудников', 'Xodimlar')}: ${employees.length.toLocaleString(locale)}`}
          </span>
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
                              <span className="employee-avatar">
                                {url
                                  ? <img src={url} alt="" loading="lazy" decoding="async" />
                                  : <UserRound size={18} />}
                              </span>
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
                <strong>{tr(`Ничего не найдено по «${search.trim()}»`, `«${search.trim()}» bo‘yicha hech narsa topilmadi`)}</strong>
                <span>{tr('Проверьте написание фамилии — телефон можно набрать и одними цифрами.', 'Familiya yozilishini tekshiring — telefonni faqat raqamlar bilan ham kiritish mumkin.')}</span>
                <button className="button button--secondary" onClick={() => setSearch('')}>{tr('Сбросить поиск', 'Qidiruvni tozalash')}</button>
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
      {isExportOpen && <EmployeeEventExportDrawer employees={chosen} photos={photos} photosKnown={photosKnown} onClose={() => setIsExportOpen(false)} />}
    </>
  )
}
