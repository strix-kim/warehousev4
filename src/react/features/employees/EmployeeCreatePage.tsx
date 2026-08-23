import { ArrowLeft, CheckCircle2, CircleAlert, Save, TriangleAlert } from 'lucide-react'
import { FormEvent, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createEmployee, employeeSaveErrorText, findNamesakes, uploadEmployeeFile, type CreateEmployeeInput, type EmployeeNamesake } from './api'
import { compressPhoto } from './compressPhoto'
import { EmployeeFileFields, emptyFileSelection, selectedFiles, type EmployeeFileSelection } from './EmployeeFileFields'
import { employeeFileKindLabel, employeeFullName, type EmployeeFileKind } from './types'
import { parseDateValue } from '../../lib/date'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'

const emptyDraft: CreateEmployeeInput = {
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

// Строка очереди загрузки. 'unsupported' — файл не декодировался (HEIC на
// десктопе): повторять нечего, нужен другой файл, поэтому это отдельный исход,
// а не разновидность 'failed'.
type UploadItem = {
  id: string
  kind: EmployeeFileKind
  file: File
  status: 'pending' | 'running' | 'done' | 'failed' | 'unsupported'
}

const shirtSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']

export function EmployeeCreatePage() {
  const navigate = useNavigate()
  const { tr, locale } = useLanguage()
  const [draft, setDraft] = useState<CreateEmployeeInput>(emptyDraft)
  const [files, setFiles] = useState<EmployeeFileSelection>(emptyFileSelection)
  // Найденные тёзки. null — проверки ещё не было; пустой массив — проверка прошла
  // и совпадений нет, повторно её не гоняем.
  const [namesakes, setNamesakes] = useState<EmployeeNamesake[] | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [createdId, setCreatedId] = useState('')
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const lastNameRef = useRef<HTMLInputElement>(null)

  const canSave = Boolean(draft.last_name.trim() && draft.first_name.trim())

  function changeField<K extends keyof CreateEmployeeInput>(field: K, value: CreateEmployeeInput[K]) {
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
  // одного тяжёлого скана.
  async function runUploads(employeeId: string, queue: UploadItem[]) {
    setIsUploading(true)
    for (const item of queue) {
      setUploads((current) => current.map((row) => row.id === item.id ? { ...row, status: 'running' } : row))
      try {
        let file = item.file
        if (item.kind === 'photo') {
          const compressed = await compressPhoto(item.file)
          if (compressed.status !== 'ok') {
            setUploads((current) => current.map((row) => row.id === item.id ? { ...row, status: 'unsupported' } : row))
            continue
          }
          file = compressed.file
        }
        await uploadEmployeeFile(employeeId, item.kind, file)
        setUploads((current) => current.map((row) => row.id === item.id ? { ...row, status: 'done' } : row))
      } catch (uploadError: unknown) {
        reportAppError(uploadError, { scope: 'loader', route: '/employees/new', detail: { kind: item.kind } })
        setUploads((current) => current.map((row) => row.id === item.id ? { ...row, status: 'failed' } : row))
      }
    }
    setIsUploading(false)
  }

  async function save() {
    setIsSaving(true)
    setError('')
    try {
      const employee = await createEmployee(draft)
      setCreatedId(employee.id)
      const queue: UploadItem[] = selectedFiles(files).map((entry, index) => ({
        id: `${index}:${entry.kind}:${entry.file.name}`,
        kind: entry.kind,
        file: entry.file,
        status: 'pending',
      }))
      setUploads(queue)
      if (queue.length > 0) void runUploads(employee.id, queue)
    } catch (saveError: unknown) {
      reportAppError(saveError, { scope: 'loader', route: '/employees/new' })
      setError(employeeSaveErrorText(saveError, tr))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSaving) return
    if (namesakes === null) {
      setIsSaving(true)
      try {
        const found = await findNamesakes(draft.last_name, draft.first_name, draft.birth_date)
        setNamesakes(found)
        if (found.length > 0) return
      } catch (checkError: unknown) {
        // Отказ проверки НЕ запирает форму: тёзки в базе легальны, и эта проверка
        // ничего не охраняет — уникальность держат индексы по ПИНФЛ и паспорту
        // (gotchas §11 про запрет разрешающего catch тут не действует именно
        // потому, что разрешать здесь нечего).
        reportAppError(checkError, { scope: 'loader', route: '/employees/new', detail: { source: 'namesakes' } })
        setNamesakes([])
      } finally {
        setIsSaving(false)
      }
    }
    await save()
  }

  if (createdId) {
    const failed = uploads.filter((item) => item.status === 'failed')
    return (
      <section className="success-state data-panel">
        <span className="success-state__icon"><CheckCircle2 size={32} /></span>
        <p className="eyebrow">{tr('Готово', 'Tayyor')}</p>
        <h1>{tr('Сотрудник добавлен', 'Xodim qo‘shildi')}</h1>
        <p>{employeeFullName(draft)} — {tr('карточка сохранена. Данные можно добивать позже.', 'karta saqlandi. Ma’lumotlarni keyinroq to‘ldirish mumkin.')}</p>

        {uploads.length > 0 && (
          <ul className="employee-upload-list">
            {uploads.map((item) => (
              <li key={item.id}>
                <span>{employeeFileKindLabel(item.kind, tr)} · {item.file.name}</span>
                <span className={`badge badge--${item.status === 'done' ? 'success' : item.status === 'pending' || item.status === 'running' ? 'neutral' : 'danger'}`}>
                  <i />{item.status === 'done'
                    ? tr('Загружен', 'Yuklandi')
                    : item.status === 'running'
                      ? tr('Загружаем…', 'Yuklanmoqda…')
                      : item.status === 'pending'
                        ? tr('В очереди', 'Navbatda')
                        : item.status === 'unsupported'
                          ? tr('Формат не поддерживается — нужен JPG или PNG', 'Format qo‘llab-quvvatlanmaydi — JPG yoki PNG kerak')
                          : tr('Не загрузился', 'Yuklanmadi')}
                </span>
              </li>
            ))}
          </ul>
        )}

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

  return (
    <form onSubmit={handleSubmit}>
      <header className="editor-header">
        <button type="button" className="icon-button icon-button--bordered" onClick={() => navigate('/employees')} aria-label={tr('Назад к сотрудникам', 'Xodimlarga qaytish')}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="eyebrow">{tr('Новая карточка', 'Yangi karta')}</p>
          <h1>{tr('Добавить сотрудника', 'Xodim qo‘shish')}</h1>
        </div>
        <button className="button button--primary editor-header__save" disabled={isSaving || !canSave}>
          <Save size={17} /> {isSaving ? tr('Сохраняем…', 'Saqlanmoqda…') : tr('Сохранить', 'Saqlash')}
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
            <span>03</span><div><h2>{tr('Файлы', 'Fayllar')}</h2><p>{tr('До 10 МБ на файл: JPG, PNG, WEBP или PDF. Загрузятся после сохранения карточки.', 'Har bir fayl 10 MB gacha: JPG, PNG, WEBP yoki PDF. Karta saqlangach yuklanadi.')}</p></div>
          </div>
          <EmployeeFileFields selection={files} onChange={setFiles} disabled={isSaving} />
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
            <div className="employee-namesakes__actions">
              <button type="button" className="button button--secondary" onClick={() => setNamesakes(null)} disabled={isSaving}>{tr('Отмена', 'Bekor qilish')}</button>
              <button type="button" className="button button--primary" onClick={() => void save()} disabled={isSaving}>{tr('Всё равно сохранить', 'Baribir saqlash')}</button>
            </div>
          </div>
        )}

        {error && <p className="form-error form-error--inline"><CircleAlert size={16} /> {error}</p>}

        {/* На телефоне кнопка в шапке уезжает вверх вместе с прокруткой — тот же
            дубль, что и в форме оборудования; на десктопе он скрыт CSS. */}
        <div className="form-submit-mobile">
          <button className="button button--primary button--wide" disabled={isSaving || !canSave}>
            <Save size={17} /> {isSaving ? tr('Сохраняем…', 'Saqlanmoqda…') : tr('Сохранить', 'Saqlash')}
          </button>
        </div>
      </section>
    </form>
  )
}
