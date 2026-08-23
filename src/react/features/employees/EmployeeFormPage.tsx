import { ArrowLeft, CheckCircle2, CircleAlert, Save, TriangleAlert, UserRound } from 'lucide-react'
import { FormEvent, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createEmployee, employeeSaveErrorText, fetchEmployeeById, fetchEmployeeFiles, findNamesakes, getSignedUrls, updateEmployee, uploadEmployeeFile, type EmployeeInput, type EmployeeNamesake } from './api'
import { EmployeeFileFields, emptyFileSelection, selectedFiles, type EmployeeFileSelection } from './EmployeeFileFields'
import { EmployeeFilesList } from './EmployeeFilesList'
import { employeeFileKindLabel, employeeFullName, type Employee, type EmployeeFile, type EmployeeFileKind } from './types'
import { UploadQueue, type UploadItem } from '../../components/UploadQueue'
import { compressPhoto } from '../../lib/compressPhoto'
import { parseDateValue } from '../../lib/date'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'

const emptyDraft: EmployeeInput = {
  last_name: '',
  first_name: '',
  middle_name: '',
  position: '',
  phone: '',
  passport_series: '',
  passport_number: '',
  pinfl: '',
  birth_date: '',
  birth_place: '',
  passport_issued_by: '',
  passport_issued_at: '',
  passport_expires_at: '',
  residence_address: '',
  clearance_expires_at: '',
  t_shirt_size: '',
}

// Строка базы в поля формы. NULL в инпуте — это React-предупреждение о переходе
// неуправляемого поля в управляемое, поэтому пусто здесь всегда строка.
// Даты приходят из date-колонок уже в формате YYYY-MM-DD, ровно как их ждёт
// нативный input[type=date].
function draftFromEmployee(employee: Employee): EmployeeInput {
  return {
    last_name: employee.last_name ?? '',
    first_name: employee.first_name ?? '',
    middle_name: employee.middle_name ?? '',
    position: employee.position ?? '',
    phone: employee.phone ?? '',
    passport_series: employee.passport_series ?? '',
    passport_number: employee.passport_number ?? '',
    pinfl: employee.pinfl ?? '',
    birth_date: employee.birth_date ?? '',
    birth_place: employee.birth_place ?? '',
    passport_issued_by: employee.passport_issued_by ?? '',
    passport_issued_at: employee.passport_issued_at ?? '',
    passport_expires_at: employee.passport_expires_at ?? '',
    residence_address: employee.residence_address ?? '',
    clearance_expires_at: employee.clearance_expires_at ?? '',
    t_shirt_size: employee.t_shirt_size ?? '',
  }
}

// Очередь загрузки — общий компонент; у сотрудника в ней свой набор видов файлов.
type EmployeeUpload = UploadItem<EmployeeFileKind>

const shirtSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']

// Одна форма на два режима: без employeeId в адресе — создание, с ним — правка
// существующей карточки. Копия формы во втором файле разъехалась бы с первой на
// первой же новой колонке.
export function EmployeeFormPage() {
  const navigate = useNavigate()
  const { tr, locale } = useLanguage()
  const { employeeId } = useParams<{ employeeId: string }>()
  const isEditing = Boolean(employeeId)
  const route = employeeId ? '/employees/:employeeId/edit' : '/employees/new'

  const [draft, setDraft] = useState<EmployeeInput>(emptyDraft)
  const [files, setFiles] = useState<EmployeeFileSelection>(emptyFileSelection)
  // Найденные тёзки. null — проверки ещё не было; пустой массив — проверка прошла
  // и совпадений нет, повторно её не гоняем.
  const [namesakes, setNamesakes] = useState<EmployeeNamesake[] | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [createdId, setCreatedId] = useState('')
  const [uploads, setUploads] = useState<EmployeeUpload[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const lastNameRef = useRef<HTMLInputElement>(null)

  // Загрузка карточки в режиме правки. 'missing' — строки нет (или её не видно
  // политикой): это честное состояние, а не пустая форма, иначе «Сохранить»
  // молча создало бы вторую карточку. Отдельный запрос по id, а не поиск в
  // списке: прямая ссылка на правку должна работать без открытого раздела.
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'missing' | 'failed'>(employeeId ? 'loading' : 'ready')
  const [reloadKey, setReloadKey] = useState(0)
  const [existingFiles, setExistingFiles] = useState<EmployeeFile[]>([])
  const [fileUrls, setFileUrls] = useState<Map<string, string>>(new Map())
  const [filesState, setFilesState] = useState<'loading' | 'ready' | 'failed'>('loading')

  useEffect(() => {
    if (!employeeId) return
    let isCurrent = true
    setLoadState('loading')
    fetchEmployeeById(employeeId)
      .then((employee) => {
        if (!isCurrent) return
        if (!employee) {
          setLoadState('missing')
          return
        }
        setDraft(draftFromEmployee(employee))
        setLoadState('ready')
      })
      .catch((loadError: unknown) => {
        if (!isCurrent) return
        reportAppError(loadError, { scope: 'loader', route, detail: { employee: employeeId } })
        setLoadState('failed')
      })
    // route выводится из employeeId, отдельной зависимостью ему быть незачем.
    return () => { isCurrent = false }
  }, [employeeId, reloadKey])

  // Уже загруженные файлы — своей веткой: их отказ не должен запирать форму,
  // карточка правится и без списка вложений.
  useEffect(() => {
    if (!employeeId) return
    let isCurrent = true
    setFilesState('loading')
    fetchEmployeeFiles(employeeId)
      .then(async (rows) => {
        if (!isCurrent) return
        setExistingFiles(rows)
        const signed = await getSignedUrls(rows.map((row) => row.storage_path))
        if (isCurrent) {
          setFileUrls(signed)
          setFilesState('ready')
        }
      })
      .catch((filesError: unknown) => {
        if (!isCurrent) return
        reportAppError(filesError, { scope: 'loader', route, detail: { employee: employeeId, source: 'files' } })
        setFilesState('failed')
      })
    return () => { isCurrent = false }
  }, [employeeId, reloadKey])

  const canSave = Boolean(draft.last_name.trim() && draft.first_name.trim())
  const backTarget = employeeId ? `/employees?employee=${employeeId}` : '/employees'
  const saveLabel = isSaving
    ? tr('Сохраняем…', 'Saqlanmoqda…')
    : isEditing ? tr('Сохранить изменения', 'O‘zgarishlarni saqlash') : tr('Сохранить', 'Saqlash')

  function changeField<K extends keyof EmployeeInput>(field: K, value: EmployeeInput[K]) {
    setDraft((current) => ({ ...current, [field]: value }))
    // Подтверждение тёзок относилось к ПРЕЖНЕМУ имени: правка ФИО или даты
    // рождения обязана вернуть проверку в исходное состояние.
    if (field === 'last_name' || field === 'first_name' || field === 'birth_date') setNamesakes(null)
  }

  function resetForm() {
    setDraft(emptyDraft)
    setFiles(emptyFileSelection)
    setNamesakes(null)
    setError('')
    setCreatedId('')
    setUploads([])
    window.requestAnimationFrame(() => lastNameRef.current?.focus())
  }

  // Файлы грузятся по одному и ПОСЛЕ карточки: карточка уже в базе, и провал
  // загрузки её не отменяет — иначе человек терял бы заполненную форму из-за
  // одного тяжёлого скана. Итог возвращаем массивом: setUploads применится не
  // сразу, а решение «уходить ли в карточку» нужно принять здесь же.
  async function runUploads(targetId: string, queue: EmployeeUpload[]): Promise<EmployeeUpload[]> {
    setIsUploading(true)
    const results: EmployeeUpload[] = []
    for (const item of queue) {
      setUploads((current) => current.map((row) => row.id === item.id ? { ...row, status: 'running' } : row))
      try {
        let file = item.file
        if (item.kind === 'photo') {
          const compressed = await compressPhoto(item.file)
          if (compressed.status !== 'ok') {
            setUploads((current) => current.map((row) => row.id === item.id ? { ...row, status: 'unsupported' } : row))
            results.push({ ...item, status: 'unsupported' })
            continue
          }
          file = compressed.file
        }
        await uploadEmployeeFile(targetId, item.kind, file)
        setUploads((current) => current.map((row) => row.id === item.id ? { ...row, status: 'done' } : row))
        results.push({ ...item, status: 'done' })
      } catch (uploadError: unknown) {
        reportAppError(uploadError, { scope: 'loader', route, detail: { kind: item.kind } })
        setUploads((current) => current.map((row) => row.id === item.id ? { ...row, status: 'failed' } : row))
        results.push({ ...item, status: 'failed' })
      }
    }
    setIsUploading(false)
    return results
  }

  function buildQueue(): EmployeeUpload[] {
    return selectedFiles(files).map((entry, index) => ({
      id: `${index}:${entry.kind}:${entry.file.name}`,
      kind: entry.kind,
      file: entry.file,
      status: 'pending',
    }))
  }

  async function save() {
    setIsSaving(true)
    setError('')
    try {
      const fresh = buildQueue()
      // Файлы, упавшие в прошлую попытку, едут вместе с новыми: без этого второе
      // «Сохранить изменения» увело бы в карточку, потеряв их молча.
      const carried = uploads.filter((item) => item.status === 'failed' && !fresh.some((row) => row.id === item.id))
      const queue = [...carried, ...fresh]
      if (employeeId) {
        await updateEmployee(employeeId, draft)
        setUploads(queue)
        // Догружаем ДО ухода в карточку: навигация размонтирует страницу и
        // оборвала бы очередь на середине.
        const results = queue.length > 0 ? await runUploads(employeeId, queue) : []
        if (results.every((item) => item.status === 'done')) {
          navigate(backTarget)
          return
        }
        // Часть файлов не легла — со страницы не уходим: карточка уже сохранена,
        // и человеку нужен «Повторить», а не молчаливый переход.
        setFiles(emptyFileSelection)
        setError(tr('Карточка сохранена, но не все файлы загрузились.', 'Karta saqlandi, lekin barcha fayllar yuklanmadi.'))
        return
      }
      const employee = await createEmployee(draft)
      setCreatedId(employee.id)
      setUploads(queue)
      if (queue.length > 0) void runUploads(employee.id, queue)
    } catch (saveError: unknown) {
      reportAppError(saveError, { scope: 'loader', route })
      setError(employeeSaveErrorText(saveError, tr))
    } finally {
      setIsSaving(false)
    }
  }

  // Повтор упавших загрузок в режиме правки: карточка в базе, чинить нужно
  // только файлы.
  async function retryUploads() {
    if (!employeeId) return
    const failed = uploads.filter((item) => item.status === 'failed')
    if (failed.length === 0) return
    const results = await runUploads(employeeId, failed)
    if (results.every((item) => item.status === 'done')) navigate(backTarget)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSaving) return
    if (namesakes === null) {
      setIsSaving(true)
      try {
        // В режиме правки собственная карточка из проверки исключена: иначе
        // человек получал бы предупреждение о самом себе на каждом сохранении.
        const found = await findNamesakes(draft.last_name, draft.first_name, draft.birth_date, employeeId)
        setNamesakes(found)
        if (found.length > 0) return
      } catch (checkError: unknown) {
        // Отказ проверки НЕ запирает форму: тёзки в базе легальны, и эта проверка
        // ничего не охраняет — уникальность держат индексы по ПИНФЛ и паспорту
        // (gotchas §11 про запрет разрешающего catch тут не действует именно
        // потому, что разрешать здесь нечего).
        reportAppError(checkError, { scope: 'loader', route, detail: { source: 'namesakes' } })
        setNamesakes([])
      } finally {
        setIsSaving(false)
      }
    }
    await save()
  }

  if (isEditing && loadState !== 'ready') {
    return (
      <section className="data-panel">
        {loadState === 'loading' && (
          <div className="state-block"><span>{tr('Загружаем карточку…', 'Karta yuklanmoqda…')}</span></div>
        )}
        {loadState === 'missing' && (
          <div className="state-block">
            <UserRound size={27} />
            <strong>{tr('Карточка не найдена', 'Karta topilmadi')}</strong>
            <span>{tr('Возможно, сотрудника удалили или ссылка устарела.', 'Ehtimol, xodim o‘chirilgan yoki havola eskirgan.')}</span>
            <button className="button button--primary" onClick={() => navigate('/employees')}>{tr('К списку сотрудников', 'Xodimlar ro‘yxatiga')}</button>
          </div>
        )}
        {loadState === 'failed' && (
          <div className="state-block state-block--error">
            <CircleAlert size={24} />
            <strong>{tr('Ошибка загрузки', 'Yuklash xatosi')}</strong>
            <span>{tr('Не удалось загрузить карточку сотрудника.', 'Xodim kartasini yuklab bo‘lmadi.')}</span>
            <button className="button button--secondary" onClick={() => setReloadKey((value) => value + 1)}>{tr('Повторить', 'Qayta urinish')}</button>
          </div>
        )}
      </section>
    )
  }

  if (createdId) {
    const failed = uploads.filter((item) => item.status === 'failed')
    return (
      <section className="success-state data-panel">
        <span className="success-state__icon"><CheckCircle2 size={32} /></span>
        <p className="eyebrow">{tr('Готово', 'Tayyor')}</p>
        <h1>{tr('Сотрудник добавлен', 'Xodim qo‘shildi')}</h1>
        <p>{employeeFullName(draft)} — {tr('карточка сохранена. Данные можно добивать позже.', 'karta saqlandi. Ma’lumotlarni keyinroq to‘ldirish mumkin.')}</p>

        {uploads.length > 0 && <UploadQueue uploads={uploads} label={(kind) => employeeFileKindLabel(kind, tr)} />}

        <div>
          {failed.length > 0 && (
            <button className="button button--secondary" disabled={isUploading} onClick={() => void runUploads(createdId, failed)}>
              {tr('Повторить загрузку', 'Yuklashni takrorlash')}
            </button>
          )}
          <button className="button button--primary" disabled={isUploading} onClick={() => navigate(`/employees?employee=${createdId}`)}>{tr('Открыть карточку', 'Kartani ochish')}</button>
          <button className="button button--secondary" disabled={isUploading} onClick={resetForm}>{tr('Добавить ещё', 'Yana qo‘shish')}</button>
        </div>
      </section>
    )
  }

  const failedUploads = uploads.filter((item) => item.status === 'failed')

  return (
    <form onSubmit={handleSubmit}>
      <header className="editor-header">
        <button type="button" className="icon-button icon-button--bordered" onClick={() => navigate(backTarget)} aria-label={isEditing ? tr('Назад к карточке', 'Kartaga qaytish') : tr('Назад к сотрудникам', 'Xodimlarga qaytish')}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="eyebrow">{isEditing ? tr('Карточка сотрудника', 'Xodim kartasi') : tr('Новая карточка', 'Yangi karta')}</p>
          <h1>{isEditing ? tr('Редактировать сотрудника', 'Xodimni tahrirlash') : tr('Добавить сотрудника', 'Xodim qo‘shish')}</h1>
        </div>
        <button className="button button--primary editor-header__save" disabled={isSaving || isUploading || !canSave}>
          <Save size={17} /> {saveLabel}
        </button>
      </header>

      <section className="data-panel employee-form">
        <div className="form-section">
          <div className="form-section__heading">
            <span>01</span><div><h2>{tr('Основное', 'Asosiy')}</h2><p>{tr('Обязательны только фамилия и имя — остальное добивается позже.', 'Faqat familiya va ism majburiy — qolgani keyinroq to‘ldiriladi.')}</p></div>
          </div>
          <div className="form-grid">
            <label className="field"><span>{tr('Фамилия', 'Familiya')} *</span><input ref={lastNameRef} value={draft.last_name} onChange={(event) => changeField('last_name', event.target.value)} required /></label>
            <label className="field"><span>{tr('Имя', 'Ism')} *</span><input value={draft.first_name} onChange={(event) => changeField('first_name', event.target.value)} required /></label>
            <label className="field"><span>{tr('Отчество', 'Otasining ismi')}</span><input value={draft.middle_name} onChange={(event) => changeField('middle_name', event.target.value)} /></label>
            <label className="field"><span>{tr('Должность', 'Lavozim')}</span><input value={draft.position} onChange={(event) => changeField('position', event.target.value)} placeholder={tr('Например, видеоинженер', 'Masalan, video muhandis')} /></label>
            <label className="field"><span>{tr('Телефон', 'Telefon')}</span><input type="tel" value={draft.phone} onChange={(event) => changeField('phone', event.target.value)} placeholder="+998 90 000 00 00" /></label>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section__heading">
            <span>02</span><div><h2>{tr('Паспорт', 'Pasport')}</h2><p>{tr('Все поля необязательны. Серия, номер и ПИНФЛ нормализуются при сохранении.', 'Barcha maydonlar ixtiyoriy. Seriya, raqam va JSHSHIR saqlashda normallashtiriladi.')}</p></div>
          </div>
          <div className="form-grid">
            <label className="field"><span>{tr('Серия', 'Seriya')}</span><input className="mono" value={draft.passport_series} onChange={(event) => changeField('passport_series', event.target.value)} placeholder="AA" maxLength={10} /></label>
            <label className="field"><span>{tr('Номер', 'Raqam')}</span><input className="mono" value={draft.passport_number} onChange={(event) => changeField('passport_number', event.target.value)} inputMode="numeric" placeholder="1234567" /></label>
            <label className="field"><span>{tr('ПИНФЛ', 'JSHSHIR')}</span><input className="mono" value={draft.pinfl} onChange={(event) => changeField('pinfl', event.target.value)} inputMode="numeric" placeholder={tr('14 цифр', '14 ta raqam')} /></label>
            {/* Нативный date, а не AppDatePicker: тот листает месяцы по одному, и
                дата рождения 1987 года стоила бы человеку четырёхсот нажатий. */}
            <label className="field"><span>{tr('Дата рождения', 'Tug‘ilgan sana')}</span><input type="date" value={draft.birth_date} onChange={(event) => changeField('birth_date', event.target.value)} /></label>
            <label className="field"><span>{tr('Место рождения', 'Tug‘ilgan joyi')}</span><input value={draft.birth_place} onChange={(event) => changeField('birth_place', event.target.value)} /></label>
            <label className="field"><span>{tr('Кем и где выдан', 'Kim tomonidan berilgan')}</span><input value={draft.passport_issued_by} onChange={(event) => changeField('passport_issued_by', event.target.value)} /></label>
            <label className="field"><span>{tr('Дата выдачи', 'Berilgan sana')}</span><input type="date" value={draft.passport_issued_at} onChange={(event) => changeField('passport_issued_at', event.target.value)} /></label>
            <label className="field"><span>{tr('Действителен до', 'Amal qilish muddati')}</span><input type="date" value={draft.passport_expires_at} onChange={(event) => changeField('passport_expires_at', event.target.value)} /></label>
            <label className="field form-grid__wide"><span>{tr('Адрес прописки', 'Ro‘yxatdan o‘tgan manzil')}</span><input value={draft.residence_address} onChange={(event) => changeField('residence_address', event.target.value)} /></label>
            <label className="field"><span>{tr('Допуск до', 'Ruxsat muddati')}</span><input type="date" value={draft.clearance_expires_at} onChange={(event) => changeField('clearance_expires_at', event.target.value)} /></label>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section__heading">
            <span>03</span><div><h2>{tr('Файлы', 'Fayllar')}</h2><p>{isEditing
              ? tr('Загруженные файлы удалить нельзя — можно добавить новые. До 10 МБ на файл: JPG, PNG, WEBP или PDF.', 'Yuklangan fayllarni o‘chirib bo‘lmaydi — yangilarini qo‘shish mumkin. Har bir fayl 10 MB gacha: JPG, PNG, WEBP yoki PDF.')
              : tr('До 10 МБ на файл: JPG, PNG, WEBP или PDF. Загрузятся после сохранения карточки.', 'Har bir fayl 10 MB gacha: JPG, PNG, WEBP yoki PDF. Karta saqlangach yuklanadi.')}</p></div>
          </div>

          {/* В режиме правки сначала то, что уже лежит в карточке, — только на
              чтение: DELETE в бакете запрещён политиками, кнопок удаления нет. */}
          {isEditing && (
            <div className="unit-lists">
              {filesState === 'failed'
                ? <p className="form-error"><CircleAlert size={15} /> {tr('Не удалось загрузить файлы сотрудника.', 'Xodim fayllarini yuklab bo‘lmadi.')}</p>
                : filesState === 'loading'
                  ? <p className="muted">{tr('Загружаем файлы…', 'Fayllar yuklanmoqda…')}</p>
                  : existingFiles.length === 0
                    ? <p className="muted">{tr('Файлов пока нет.', 'Hozircha fayllar yo‘q.')}</p>
                    : <EmployeeFilesList files={existingFiles} urls={fileUrls} photoAlt={employeeFullName(draft)} />}
            </div>
          )}

          <EmployeeFileFields selection={files} onChange={setFiles} disabled={isSaving || isUploading} />

          {/* Очередь дозагрузки в правке: на создании такой список живёт на экране
              успеха, здесь уходить со страницы некуда — сохранение возвращает в
              карточку само. */}
          {isEditing && uploads.length > 0 && (
            <>
              <UploadQueue uploads={uploads} label={(kind) => employeeFileKindLabel(kind, tr)} />
              {failedUploads.length > 0 && !isUploading && (
                <div className="employee-form-actions">
                  <button type="button" className="button button--secondary" onClick={() => void retryUploads()}>{tr('Повторить загрузку', 'Yuklashni takrorlash')}</button>
                  <button type="button" className="button button--primary" onClick={() => navigate(backTarget)}>{tr('Открыть карточку', 'Kartani ochish')}</button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="form-section">
          <div className="form-section__heading">
            <span>04</span><div><h2>{tr('Прочее', 'Boshqa')}</h2><p>{tr('Пригодится при заказе формы на выезд.', 'Chiqishga forma buyurtma qilishda asqotadi.')}</p></div>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>{tr('Размер футболки / худи', 'Futbolka / xudi o‘lchami')}</span>
              <input list="employee-shirt-sizes" value={draft.t_shirt_size} onChange={(event) => changeField('t_shirt_size', event.target.value)} placeholder={tr('Выберите или введите', 'Tanlang yoki kiriting')} />
              <datalist id="employee-shirt-sizes">{shirtSizes.map((size) => <option value={size} key={size} />)}</datalist>
            </label>
          </div>
        </div>

        {/* Тёзки — предупреждение, а не запрет: однофамильцы с одной датой рождения
            в базе легальны, и решение принимает человек. */}
        {namesakes !== null && namesakes.length > 0 && (
          <div className="form-section employee-namesakes">
            <p className="availability-warning">
              <TriangleAlert size={16} />
              <span>
                {tr('Такой человек, похоже, уже заведён:', 'Bunday xodim allaqachon kiritilganga o‘xshaydi:')}
                {' '}
                {namesakes.map((person) => `${employeeFullName(person)}${person.birth_date ? ` (${parseDateValue(person.birth_date)?.toLocaleDateString(locale) ?? person.birth_date})` : ''}${person.position ? `, ${person.position}` : ''}`).join('; ')}
              </span>
            </p>
            <div className="employee-form-actions">
              <button type="button" className="button button--secondary" onClick={() => setNamesakes(null)} disabled={isSaving}>{tr('Отмена', 'Bekor qilish')}</button>
              <button type="button" className="button button--primary" onClick={() => void save()} disabled={isSaving}>{tr('Всё равно сохранить', 'Baribir saqlash')}</button>
            </div>
          </div>
        )}

        {error && <p className="form-error form-error--inline"><CircleAlert size={16} /> {error}</p>}

        {/* На телефоне кнопка в шапке уезжает вверх вместе с прокруткой — тот же
            дубль, что и в форме оборудования; на десктопе он скрыт CSS. */}
        <div className="form-submit-mobile">
          <button className="button button--primary button--wide" disabled={isSaving || isUploading || !canSave}>
            <Save size={17} /> {saveLabel}
          </button>
        </div>
      </section>
    </form>
  )
}
