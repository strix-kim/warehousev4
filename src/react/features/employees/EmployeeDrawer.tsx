import { Cake, CalendarDays, CircleAlert, Hash, House, IdCard, Landmark, MapPin, Pencil, Phone, Shirt, UserRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchEmployeeById, fetchEmployeeFiles, getSignedUrls, setEmployeeDocumentPhoto } from './api'
import { EmployeeFilesList, EmployeeFilesSkeleton } from './EmployeeFilesList'
import { employeeFullName, type Employee, type EmployeeFile, type EmployeeListItem, type Tr } from './types'
import { ProfileBadges, ProfileHead, ProfileSections, type ProfileBadge, type ProfileSection } from '../../components/ProfileCard'
import { formatEventDate, parseDateValue } from '../../lib/date'
import { expiryBadgeClass, expiryState } from '../../lib/expiry'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'
import { useModalLayer } from '../../lib/useModalLayer'

// Календарный день словами. Мусор в колонке parseDateValue отдаёт как null —
// показываем тогда сырое значение, а не пустоту: это данные, а не наш формат.
function dateLabel(value: string | null, locale: string) {
  if (!value) return null
  const date = parseDateValue(value)
  return date ? formatEventDate(date, locale) : value
}

// Сроки живут ТОЛЬКО бейджем: цвет отвечает на «можно ли ставить в работу», а
// дата стоит тут же, поэтому отдельной строки в реквизитах им не нужно — это
// был бы второй показ тех же данных. Срок не заполнен — бейджа нет вовсе
// (решение прораба, с27): молчание честнее серого «не указан», который выглядел
// бы как проверенный факт.
function expiryBadges(employee: Employee, tr: Tr, locale: string): ProfileBadge[] {
  const badges: ProfileBadge[] = []
  const add = (key: string, value: string | null, label: (date: string) => string) => {
    const state = expiryState(value)
    const date = dateLabel(value, locale)
    if (!state || !date) return
    badges.push({ key, className: expiryBadgeClass(state), label: label(date) })
  }
  add('passport', employee.passport_expires_at, (date) => tr(`Паспорт до ${date}`, `Pasport ${date} gacha`))
  add('clearance', employee.clearance_expires_at, (date) => tr(`Допуск до ${date}`, `Ruxsat ${date} gacha`))
  return badges
}

// Реквизиты секциями: человек ищет не «двенадцатую строку сверху», а телефон,
// паспорт или прописку — и группа подсказывает, где смотреть.
function detailSections(employee: Employee, tr: Tr, locale: string): ProfileSection[] {
  const passport = [employee.passport_series, employee.passport_number].filter(Boolean).join(' ')
  return [
    {
      key: 'contacts',
      title: tr('Контакты', 'Aloqa'),
      fields: [
        { key: 'phone', label: tr('Телефон', 'Telefon'), value: employee.phone, icon: <Phone size={13} />, strong: true },
      ],
    },
    {
      key: 'personal',
      title: tr('Личное', 'Shaxsiy'),
      fields: [
        { key: 'birth_date', label: tr('Дата рождения', 'Tug‘ilgan sana'), value: dateLabel(employee.birth_date, locale), icon: <Cake size={13} /> },
        { key: 't_shirt_size', label: tr('Размер футболки / худи', 'Futbolka / xudi o‘lchami'), value: employee.t_shirt_size, icon: <Shirt size={13} /> },
        { key: 'birth_place', label: tr('Место рождения', 'Tug‘ilgan joyi'), value: employee.birth_place, icon: <MapPin size={13} />, wide: true },
      ],
    },
    {
      key: 'documents',
      title: tr('Документы', 'Hujjatlar'),
      fields: [
        { key: 'passport', label: tr('Паспорт', 'Pasport'), value: passport || null, icon: <IdCard size={13} />, strong: true },
        { key: 'pinfl', label: tr('ПИНФЛ', 'JSHSHIR'), value: employee.pinfl, icon: <Hash size={13} /> },
        { key: 'passport_issued_at', label: tr('Дата выдачи', 'Berilgan sana'), value: dateLabel(employee.passport_issued_at, locale), icon: <CalendarDays size={13} /> },
        { key: 'passport_issued_by', label: tr('Кем выдан', 'Kim tomonidan berilgan'), value: employee.passport_issued_by, icon: <Landmark size={13} />, wide: true },
        { key: 'residence_address', label: tr('Адрес прописки', 'Ro‘yxatdan o‘tgan manzil'), value: employee.residence_address, icon: <House size={13} />, wide: true },
      ],
    },
  ]
}

// Реквизиты, известные ДО запроса: они уже лежат в реестре, и прятать их за
// скелетом только ради единообразия значит показать пустоту вместо того, что
// у нас на руках.
function knownSections(employee: EmployeeListItem, tr: Tr): ProfileSection[] {
  return [
    {
      key: 'contacts',
      title: tr('Контакты', 'Aloqa'),
      fields: [
        { key: 'phone', label: tr('Телефон', 'Telefon'), value: employee.phone, icon: <Phone size={13} />, strong: true },
      ],
    },
  ]
}

export function EmployeeDrawer({ employee, photoUrl, onClose, onDocumentPhotoChange }: {
  // Строка РЕЕСТРА, а не полная карточка: паспорт, ПИНФЛ и адрес прописки в
  // кэше реестра не лежат (решение с26), поэтому дровер догружает их сам —
  // шапка и контакты рисуются мгновенно, документы дорисовываются.
  employee: EmployeeListItem
  // Подписанная ссылка на фото для документов — та же, что показывает строка
  // списка. Приходит готовой, чтобы шапка не ждала круга сети (с26).
  photoUrl?: string
  onClose: () => void
  // Выбор фото уезжает наверх, на страницу: там же лежит строка сотрудника, из
  // которой карточка получает employee, и там же — миниатюра списка.
  onDocumentPhotoChange?: (fileId: string) => void
}) {
  const { tr, locale } = useLanguage()
  const navigate = useNavigate()
  useModalLayer(onClose)
  // Полная карточка: приезжает отдельным запросом на открытие дровера.
  const [card, setCard] = useState<Employee | null>(null)
  const [isCardLoading, setIsCardLoading] = useState(true)
  const [hasCardError, setHasCardError] = useState(false)
  const [files, setFiles] = useState<EmployeeFile[]>([])
  // Подписанные ссылки живут час и в персистентный кэш не кладутся — только
  // память страницы, ключ — путь в бакете.
  const [urls, setUrls] = useState<Map<string, string>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  // Флаг вместо текста: строка в стейте потянула бы tr в зависимости эффекта,
  // и смена языка перезапрашивала бы файлы.
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let isCurrent = true
    setIsCardLoading(true)
    setHasCardError(false)
    setCard(null)
    fetchEmployeeById(employee.id)
      .then((row) => { if (isCurrent) setCard(row) })
      .catch((error: unknown) => {
        if (!isCurrent) return
        setHasCardError(true)
        reportAppError(error, { scope: 'loader', route: '/employees', detail: { employee: employee.id, source: 'card' } })
      })
      .finally(() => { if (isCurrent) setIsCardLoading(false) })
    return () => { isCurrent = false }
  }, [employee.id])

  useEffect(() => {
    let isCurrent = true
    setIsLoading(true)
    setHasError(false)
    fetchEmployeeFiles(employee.id)
      .then(async (rows) => {
        if (!isCurrent) return
        setFiles(rows)
        // Ссылки подписываем пачкой: по запросу на файл дало бы десяток
        // обращений на одну карточку.
        const signed = await getSignedUrls(rows.map((row) => row.storage_path))
        if (isCurrent) setUrls(signed)
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        setHasError(true)
        reportAppError(error, { scope: 'loader', route: '/employees', detail: { employee: employee.id } })
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })
    return () => { isCurrent = false }
  }, [employee.id])

  // Запрос идёт отдельно от «Сохранить» карточки: колонки document_photo_id нет
  // в EmployeeInput, и форма её не трогает. Ошибку пробрасываем в список файлов —
  // он показывает её строкой рядом с фото.
  async function chooseDocumentPhoto(fileId: string) {
    try {
      await setEmployeeDocumentPhoto(employee.id, fileId)
      onDocumentPhotoChange?.(fileId)
    } catch (saveError: unknown) {
      reportAppError(saveError, { scope: 'loader', route: '/employees', detail: { employee: employee.id, source: 'document-photo' } })
      throw saveError
    }
  }

  const fullName = employeeFullName(employee)
  // Пока карточка едет, показываем то, что уже есть в реестре, и добираем
  // скелетом — так видно, что данные не кончились, а грузятся.
  const sections = card ? detailSections(card, tr, locale) : knownSections(employee, tr)
  const badges = card ? expiryBadges(card, tr, locale) : []

  return (
    <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={tr('Карточка сотрудника', 'Xodim kartasi')} onMouseDown={onClose}>
      <aside className="drawer" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer__header">
          {/* Надзаголовок называет КЛАСС записи, а должность стоит главным фактом
              под именем: раньше она была и там, и строкой в реквизитах — один и
              тот же факт дважды. */}
          <ProfileHead
            eyebrow={tr('Сотрудник', 'Xodim')}
            title={fullName}
            fact={employee.position}
            photoUrl={photoUrl}
            photoAlt={fullName}
            photoPlaceholder={<UserRound size={26} />}
          />
          <div className="drawer__header-actions">
            <button className="button button--secondary" onClick={() => navigate(`/employees/${employee.id}/edit`)}><Pencil size={16} /> {tr('Редактировать', 'Tahrirlash')}</button>
            <button autoFocus className="icon-button icon-button--bordered" onClick={onClose} aria-label={tr('Закрыть', 'Yopish')}><X size={19} /></button>
          </div>
        </div>

        <ProfileBadges badges={badges} />
        <ProfileSections sections={sections} />

        {isCardLoading && <div className="detail-skeleton employee-card-skeleton" />}
        {hasCardError && <p className="form-error"><CircleAlert size={15} /> {tr('Не удалось загрузить документы карточки.', 'Karta hujjatlarini yuklab bo‘lmadi.')}</p>}
        {!isCardLoading && !hasCardError && sections.every((section) => section.fields.every((field) => !field.value)) && (
          <p className="muted">{tr('Кроме имени, в карточке пока ничего нет.', 'Kartada ismdan boshqa hozircha hech narsa yo‘q.')}</p>
        )}

        <section className="unit-lists">
          <div className="panel-heading"><div><h3>{tr('Файлы', 'Fayllar')}</h3><p>{tr('Открываются по временной ссылке — она действует час.', 'Vaqtinchalik havola orqali ochiladi — u bir soat amal qiladi.')}</p></div></div>
          {hasError
            ? <p className="form-error"><CircleAlert size={15} /> {tr('Не удалось загрузить файлы сотрудника.', 'Xodim fayllarini yuklab bo‘lmadi.')}</p>
            : isLoading
              ? <EmployeeFilesSkeleton />
              : files.length === 0
                ? <p className="muted">{tr('Файлов пока нет.', 'Hozircha fayllar yo‘q.')}</p>
                : <EmployeeFilesList
                  files={files}
                  urls={urls}
                  photoAlt={fullName}
                  documentPhotoId={employee.document_photo_id}
                  onChooseDocumentPhoto={chooseDocumentPhoto}
                />}
        </section>
      </aside>
    </div>
  )
}
