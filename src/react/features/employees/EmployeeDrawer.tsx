import { CircleAlert, Pencil } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchEmployeeById, fetchEmployeeFiles, getSignedUrls, setEmployeeDocumentPhoto } from './api'
import { EmployeeFilesList, EmployeeFilesSkeleton } from './EmployeeFilesList'
import { employeeFullName, type Employee, type EmployeeFile, type EmployeeListItem, type Tr } from './types'
import { DrawerFrame } from '../../components/DrawerFrame'
import { ProfileHead, ProfileSections, type ProfileBadge, type ProfileSection } from '../../components/ProfileCard'
import { formatEventDate, parseDateValue } from '../../lib/date'
import { expiryPillClass, expiryState, type ExpiryState } from '../../lib/expiry'
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

// Сроки живут ТОЛЬКО пилюлей в шапке: цвет отвечает на «можно ли ставить в
// работу», а дата стоит тут же, поэтому отдельной строки в реквизитах им не нужно —
// это был бы второй показ тех же данных. Срок не заполнен — пилюли нет вовсе
// (решение прораба, с27): молчание честнее серого «не указан», который выглядел
// бы как проверенный факт.
//
// Слово, а не только цвет: «истёк», «истекает» и «действителен до» — три разных
// текста. Один текст на три цвета читался бы одинаково и дальтоником, и любым,
// кто смотрит на карточку мельком.
function expiryPills(employee: Employee, tr: Tr, locale: string): ProfileBadge[] {
  const badges: ProfileBadge[] = []
  const add = (key: string, value: string | null, labels: Record<ExpiryState, (date: string) => string>) => {
    const state = expiryState(value)
    const date = dateLabel(value, locale)
    if (!state || !date) return
    badges.push({ key, className: expiryPillClass(state), label: labels[state](date) })
  }
  // Узбекский принимает дату ПЕРЕД послелогом и пишет его слитно: formatEventDate
  // отдаёт «12-sentabr 2026-yil», отсюда «…2026-yilgacha» и «…2026-yilda».
  add('passport', employee.passport_expires_at, {
    expired: (date) => tr(`Паспорт истёк ${date}`, `Pasport muddati ${date}da tugagan`),
    soon: (date) => tr(`Паспорт истекает ${date}`, `Pasport muddati ${date}da tugaydi`),
    valid: (date) => tr(`Паспорт действителен до ${date}`, `Pasport ${date}gacha amal qiladi`),
  })
  add('clearance', employee.clearance_expires_at, {
    expired: (date) => tr(`Допуск истёк ${date}`, `Ruxsat muddati ${date}da tugagan`),
    soon: (date) => tr(`Допуск истекает ${date}`, `Ruxsat muddati ${date}da tugaydi`),
    valid: (date) => tr(`Допуск до ${date}`, `Ruxsat ${date}gacha`),
  })
  return badges
}

// Реквизиты секциями: человек ищет не «двенадцатую строку сверху», а паспорт или
// прописку — и группа подсказывает, где смотреть. Телефон и должность стоят в
// шапке, второй раз их здесь нет.
function detailSections(employee: Employee, tr: Tr, locale: string): ProfileSection[] {
  const passport = [employee.passport_series, employee.passport_number].filter(Boolean).join(' ')
  return [
    {
      key: 'personal',
      title: tr('Личное', 'Shaxsiy ma’lumotlar'),
      fields: [
        { key: 'birth_date', label: tr('Дата рождения', 'Tug‘ilgan sana'), value: dateLabel(employee.birth_date, locale) },
        { key: 'birth_place', label: tr('Место рождения', 'Tug‘ilgan joyi'), value: employee.birth_place },
        { key: 't_shirt_size', label: tr('Футболка / худи', 'Futbolka / xudi'), value: employee.t_shirt_size, copy: false },
      ],
    },
    {
      key: 'documents',
      title: tr('Документы', 'Hujjatlar'),
      fields: [
        { key: 'passport', label: tr('Паспорт', 'Pasport'), value: passport || null, mono: true },
        { key: 'pinfl', label: tr('ПИНФЛ', 'JSHSHIR'), value: employee.pinfl, mono: true },
        { key: 'passport_issued_at', label: tr('Дата выдачи', 'Berilgan sana'), value: dateLabel(employee.passport_issued_at, locale) },
        { key: 'passport_issued_by', label: tr('Кем выдан', 'Kim tomonidan berilgan'), value: employee.passport_issued_by },
        { key: 'residence_address', label: tr('Адрес прописки', 'Ro‘yxatdan o‘tgan manzil'), value: employee.residence_address },
      ],
    },
  ]
}

// Заглушка фото — силуэт макета (с31) на тёмном градиенте рамы фото; заливку даёт
// CSS токеном --faint.
function PortraitSilhouette() {
  return (
    <svg className="profile-head__silhouette" viewBox="0 0 108 128" aria-hidden="true">
      <circle cx="54" cy="50" r="21" />
      <path d="M12 128c3-25 20-39 42-39s39 14 42 39z" />
    </svg>
  )
}

export function EmployeeDrawer({ employee, photoUrl, onClose, onDocumentPhotoChange }: {
  // Строка РЕЕСТРА, а не полная карточка: паспорт, ПИНФЛ и адрес прописки в
  // кэше реестра не лежат (решение с26), поэтому дровер догружает их сам —
  // шапка (имя, должность, телефон) рисуется мгновенно, документы дорисовываются.
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
  // Пока карточка едет, реквизитов нет — на их месте болванка: видно, что данные
  // не кончились, а грузятся.
  const sections = card ? detailSections(card, tr, locale) : []
  const badges = card ? expiryPills(card, tr, locale) : []

  return (
    <DrawerFrame
      className="profile"
      ariaLabel={tr('Карточка сотрудника', 'Xodim kartasi')}
      instant={false}
      onRequestClose={onClose}
      head={/* Надзаголовок называет КЛАСС записи, должность стоит под именем, а
                главным фактом идёт телефон: раньше должность была и там, и строкой
                в реквизитах — один и тот же факт дважды. */
        <ProfileHead
          eyebrow={tr('Сотрудник', 'Xodim')}
          photo={{ url: photoUrl, placeholder: <PortraitSilhouette />, shape: 'portrait' }}
          title={fullName}
          titleCopy={fullName}
          subtitle={employee.position}
          mainFact={{ value: employee.phone ?? '', label: tr('телефон', 'telefon') }}
          badges={badges}
          onClose={onClose}
        />}
      foot={<button className="button button--secondary" onClick={() => navigate(`/employees/${employee.id}/edit`)}><Pencil size={16} /> {tr('Редактировать', 'Tahrirlash')}</button>}
    >
      <ProfileSections sections={sections} />

      {isCardLoading && <div className="detail-skeleton employee-card-skeleton" />}
      {hasCardError && <p className="form-error"><CircleAlert size={15} /> {tr('Не удалось загрузить документы карточки.', 'Karta hujjatlarini yuklab bo‘lmadi.')}</p>}
      {!isCardLoading && !hasCardError && !employee.position && !employee.phone && badges.length === 0 && sections.every((section) => section.fields.every((field) => !field.value)) && (
        <p className="muted">{tr('Кроме имени, в карточке пока ничего нет.', 'Kartada ismdan boshqa hozircha hech narsa yo‘q.')}</p>
      )}

      <section className="profile-section">
        <h3 className="drawer-caps">{tr('Файлы', 'Fayllar')}</h3>
        {hasError
          ? <p className="form-error"><CircleAlert size={15} /> {tr('Не удалось загрузить файлы сотрудника.', 'Xodim fayllarini yuklab bo‘lmadi.')}</p>
          : isLoading
            ? <EmployeeFilesSkeleton />
            : files.length === 0
              ? <p className="muted">{tr('Файлов пока нет.', 'Hozircha fayllar yo‘q.')}</p>
              : <>
                <EmployeeFilesList
                  files={files}
                  urls={urls}
                  photoAlt={fullName}
                  documentPhotoId={employee.document_photo_id}
                  onChooseDocumentPhoto={chooseDocumentPhoto}
                />
                <p className="profile-section__hint">{tr('Открываются по временной ссылке — она действует час.', 'Vaqtinchalik havola orqali ochiladi — u bir soat amal qiladi.')}</p>
              </>}
      </section>
    </DrawerFrame>
  )
}
