import { CircleAlert, Plus, UserRound, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchEmployeePhotoPaths, fetchEmployees, getSignedUrls } from './api'
import { EmployeeDrawer } from './EmployeeDrawer'
import { employeeFullName, type Employee } from './types'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'

export function EmployeesPage() {
  const navigate = useNavigate()
  const { tr, locale } = useLanguage()
  // Открытая карточка живёт в АДРЕСЕ: заход в «Добавить сотрудника» и обратно
  // размонтирует страницу, а на телефоне жест «назад» обязан закрывать карточку,
  // а не выкидывать из раздела.
  const [params, setParams] = useSearchParams()
  const employeeId = params.get('employee') ?? ''
  const [employees, setEmployees] = useState<Employee[]>([])
  // Подписанные ссылки на первое фото каждого — только память страницы: URL
  // живёт час, и в persistentCache ему не место.
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map())
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
        // поэтому у них своя ветка и свой отчёт.
        void fetchEmployeePhotoPaths()
          .then((paths) => getSignedUrls([...paths.values()]).then((urls) => ({ paths, urls })))
          .then(({ paths, urls }) => {
            if (!isCurrent) return
            const byEmployee = new Map<string, string>()
            for (const [id, path] of paths) {
              const url = urls.get(path)
              if (url) byEmployee.set(id, url)
            }
            setPhotoUrls(byEmployee)
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

  // Выдача полная (сотрудников ~200), поэтому карточку из адреса ищем в ней же —
  // отдельного запроса по id не нужно. Неизвестный id просто не откроет дровер.
  const selected = employeeId ? employees.find((employee) => employee.id === employeeId) ?? null : null

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
          <span className="toolbar__count">{tr('Сотрудников', 'Xodimlar')}: {employees.length.toLocaleString(locale)}</span>
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
            <table className="data-table">
              <thead>
                <tr>
                  <th>{tr('Сотрудник', 'Xodim')}</th>
                  <th>{tr('Должность', 'Lavozim')}</th>
                  <th>{tr('Телефон', 'Telefon')}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && employees.length === 0
                  ? Array.from({ length: 8 }, (_, index) => (
                      <tr key={index} className="skeleton-row">
                        <td colSpan={3}><span /></td>
                      </tr>
                    ))
                  : employees.map((employee) => {
                      const photo = photoUrls.get(employee.id)
                      return (
                        <tr
                          key={employee.id}
                          onClick={() => openEmployee(employee)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              openEmployee(employee)
                            }
                          }}
                          tabIndex={0}
                        >
                          <td>
                            <div className="equipment-cell">
                              <span className="employee-avatar">
                                {photo
                                  ? <img src={photo} alt="" loading="lazy" decoding="async" />
                                  : <UserRound size={18} />}
                              </span>
                              <span>
                                <strong>{employeeFullName(employee)}</strong>
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
          </div>
        )}
      </section>

      {selected && <EmployeeDrawer employee={selected} onClose={closeEmployee} />}
    </>
  )
}
