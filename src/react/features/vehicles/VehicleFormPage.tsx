import { ArrowLeft, CarFront, CheckCircle2, CircleAlert, Save, X } from 'lucide-react'
import { FormEvent, useMemo, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createVehicle, fetchVehicleById, fetchVehicleFiles, getSignedUrls, saveVehicleDrivers, updateVehicle, uploadVehiclePhoto, vehicleSaveErrorText, type VehicleInput } from './api'
import { VehicleFilesList } from './VehicleFilesList'
import { driverFullName, vehicleTitle, type VehicleDriver, type VehicleFile } from './types'
import { fetchEmployeeBriefs } from '../employees/api'
import { EmployeePicker } from '../../components/EmployeePicker'
import { PhotoPickField } from '../../components/PhotoPickField'
import { UploadQueue, type UploadItem } from '../../components/UploadQueue'
import { compressPhoto } from '../../lib/compressPhoto'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'

const emptyDraft: VehicleInput = {
  brand: '',
  model: '',
  color: '',
  plate_number: '',
}

// Строка базы в поля формы. NULL в инпуте — это React-предупреждение о переходе
// неуправляемого поля в управляемое, поэтому пусто здесь всегда строка.
function draftFromVehicle(vehicle: { brand: string; model: string | null; color: string | null; plate_number: string }): VehicleInput {
  return {
    brand: vehicle.brand,
    model: vehicle.model ?? '',
    color: vehicle.color ?? '',
    plate_number: vehicle.plate_number,
  }
}

// Вид файла у машины один — фото (CHECK на vehicle_files.kind), но очередь общая
// и параметризована видом.
type VehicleUpload = UploadItem<'photo'>

// Одна форма на два режима: без vehicleId в адресе — создание, с ним — правка
// существующей карточки. Копия формы во втором файле разъехалась бы с первой на
// первой же новой колонке.
export function VehicleFormPage() {
  const navigate = useNavigate()
  const { tr } = useLanguage()
  const { vehicleId } = useParams<{ vehicleId: string }>()
  const isEditing = Boolean(vehicleId)
  const route = vehicleId ? '/vehicles/:vehicleId/edit' : '/vehicles/new'

  const [draft, setDraft] = useState<VehicleInput>(emptyDraft)
  const [photos, setPhotos] = useState<File[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [createdId, setCreatedId] = useState('')
  const [uploads, setUploads] = useState<VehicleUpload[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const brandRef = useRef<HTMLInputElement>(null)
  // Машина, созданная предыдущей попыткой: если карточка легла, а водители нет,
  // второе «Сохранить» не должно вставлять её заново — 23505 по собственному
  // номеру был бы враньём про дубль.
  const createdRef = useRef('')

  // Водители: выбранные чипами и то, что было в базе на момент загрузки —
  // сохранение считает разницу между этими двумя списками.
  const [drivers, setDrivers] = useState<VehicleDriver[]>([])
  const [savedDriverIds, setSavedDriverIds] = useState<string[]>([])
  const [candidates, setCandidates] = useState<VehicleDriver[]>([])
  // 'idle' — за списком сотрудников ещё не ходили: он грузится по фокусу поля,
  // а не при открытии формы, где водителей могут и не трогать.
  const [candidatesState, setCandidatesState] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle')

  // Загрузка карточки в режиме правки. 'missing' — строки нет (или её не видно
  // политикой): это честное состояние, а не пустая форма, иначе «Сохранить»
  // молча создало бы вторую машину.
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'missing' | 'failed'>(vehicleId ? 'loading' : 'ready')
  const [reloadKey, setReloadKey] = useState(0)
  const [existingFiles, setExistingFiles] = useState<VehicleFile[]>([])
  const [fileUrls, setFileUrls] = useState<Map<string, string>>(new Map())
  const [filesState, setFilesState] = useState<'loading' | 'ready' | 'failed'>('loading')

  useEffect(() => {
    if (!vehicleId) return
    let isCurrent = true
    setLoadState('loading')
    fetchVehicleById(vehicleId)
      .then((vehicle) => {
        if (!isCurrent) return
        if (!vehicle) {
          setLoadState('missing')
          return
        }
        setDraft(draftFromVehicle(vehicle))
        setDrivers(vehicle.drivers)
        setSavedDriverIds(vehicle.drivers.map((driver) => driver.id))
        setLoadState('ready')
      })
      .catch((loadError: unknown) => {
        if (!isCurrent) return
        reportAppError(loadError, { scope: 'loader', route, detail: { vehicle: vehicleId } })
        setLoadState('failed')
      })
    // route выводится из vehicleId, отдельной зависимостью ему быть незачем.
    return () => { isCurrent = false }
  }, [vehicleId, reloadKey])

  // Уже загруженные фото — своей веткой: их отказ не должен запирать форму,
  // карточка правится и без списка вложений.
  useEffect(() => {
    if (!vehicleId) return
    let isCurrent = true
    setFilesState('loading')
    fetchVehicleFiles(vehicleId)
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
        reportAppError(filesError, { scope: 'loader', route, detail: { vehicle: vehicleId, source: 'files' } })
        setFilesState('failed')
      })
    return () => { isCurrent = false }
  }, [vehicleId, reloadKey])

  const canSave = Boolean(draft.brand.trim() && draft.plate_number.trim())
  const backTarget = vehicleId ? `/vehicles?vehicle=${vehicleId}` : '/vehicles'
  const saveLabel = isSaving
    ? tr('Сохраняем…', 'Saqlanmoqda…')
    : isEditing ? tr('Сохранить изменения', 'O‘zgarishlarni saqlash') : tr('Сохранить', 'Saqlash')

  function changeField<K extends keyof VehicleInput>(field: K, value: VehicleInput[K]) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  // Сотрудники грузятся ЦЕЛИКОМ и один раз на открытие формы: их ~200, а фильтр
  // по подстроке ФИО мгновенный. Отказ не гасим — у панели своя кнопка повтора,
  // иначе пустая выдача читалась бы как «сотрудников нет».
  function loadCandidates() {
    setCandidatesState('loading')
    fetchEmployeeBriefs()
      .then((rows) => {
        setCandidates(rows)
        setCandidatesState('ready')
      })
      .catch((candidatesError: unknown) => {
        reportAppError(candidatesError, { scope: 'loader', route, detail: { source: 'drivers' } })
        setCandidatesState('failed')
      })
  }

  // Набор id для пикера считается здесь, а не в нём: новый Set на каждый рендер
  // сбрасывал бы его memo фильтра выдачи.
  const chosenDriverIds = useMemo(() => new Set(drivers.map((driver) => driver.id)), [drivers])

  function addDriver(driver: VehicleDriver) {
    setDrivers((current) => current.some((row) => row.id === driver.id) ? current : [...current, driver])
  }

  function removeDriver(driverId: string) {
    setDrivers((current) => current.filter((driver) => driver.id !== driverId))
  }

  function resetForm() {
    setDraft(emptyDraft)
    setPhotos([])
    setDrivers([])
    setSavedDriverIds([])
    setError('')
    setCreatedId('')
    setUploads([])
    createdRef.current = ''
    window.requestAnimationFrame(() => brandRef.current?.focus())
  }

  // Фото грузятся по одному и ПОСЛЕ карточки: карточка уже в базе, и провал
  // загрузки её не отменяет — иначе человек терял бы заполненную форму из-за
  // одного тяжёлого снимка. Итог возвращаем массивом: setUploads применится не
  // сразу, а решение «уходить ли в карточку» нужно принять здесь же.
  async function runUploads(targetId: string, queue: VehicleUpload[]): Promise<VehicleUpload[]> {
    setIsUploading(true)
    const results: VehicleUpload[] = []
    for (const item of queue) {
      setUploads((current) => current.map((row) => row.id === item.id ? { ...row, status: 'running' } : row))
      try {
        // У машины все вложения — фотографии, поэтому ужимаем без разбора вида.
        const compressed = await compressPhoto(item.file)
        if (compressed.status !== 'ok') {
          setUploads((current) => current.map((row) => row.id === item.id ? { ...row, status: 'unsupported' } : row))
          results.push({ ...item, status: 'unsupported' })
          continue
        }
        await uploadVehiclePhoto(targetId, compressed.file)
        setUploads((current) => current.map((row) => row.id === item.id ? { ...row, status: 'done' } : row))
        results.push({ ...item, status: 'done' })
      } catch (uploadError: unknown) {
        reportAppError(uploadError, { scope: 'loader', route })
        setUploads((current) => current.map((row) => row.id === item.id ? { ...row, status: 'failed' } : row))
        results.push({ ...item, status: 'failed' })
      }
    }
    setIsUploading(false)
    return results
  }

  function buildQueue(): VehicleUpload[] {
    return photos.map((file, index) => ({
      id: `${index}:${file.name}:${file.size}`,
      kind: 'photo',
      file,
      status: 'pending',
    }))
  }

  async function save() {
    setIsSaving(true)
    setError('')
    try {
      const fresh = buildQueue()
      // Фото, упавшие в прошлую попытку, едут вместе с новыми: без этого второе
      // «Сохранить изменения» увело бы в карточку, потеряв их молча.
      const carried = uploads.filter((item) => item.status === 'failed' && !fresh.some((row) => row.id === item.id))
      const queue = [...carried, ...fresh]
      const driverIds = drivers.map((driver) => driver.id)

      if (vehicleId) {
        await updateVehicle(vehicleId, draft)
        await saveVehicleDrivers(vehicleId, savedDriverIds, driverIds)
        // Связка уже в базе: повторное сохранение должно считать разницу от
        // ТЕКУЩЕГО состава, а не пытаться снять снятых второй раз.
        setSavedDriverIds(driverIds)
        setUploads(queue)
        // Догружаем ДО ухода в карточку: навигация размонтирует страницу и
        // оборвала бы очередь на середине.
        const results = queue.length > 0 ? await runUploads(vehicleId, queue) : []
        if (results.every((item) => item.status === 'done')) {
          navigate(backTarget)
          return
        }
        // Часть фото не легла — со страницы не уходим: карточка уже сохранена,
        // и человеку нужен «Повторить», а не молчаливый переход.
        setPhotos([])
        setError(tr('Карточка сохранена, но не все фото загрузились.', 'Karta saqlandi, lekin barcha fotolar yuklanmadi.'))
        return
      }

      const saved = createdRef.current
        ? await updateVehicle(createdRef.current, draft)
        : await createVehicle(draft)
      createdRef.current = saved.id
      await saveVehicleDrivers(saved.id, savedDriverIds, driverIds)
      setSavedDriverIds(driverIds)
      setCreatedId(saved.id)
      setUploads(queue)
      if (queue.length > 0) void runUploads(saved.id, queue)
    } catch (saveError: unknown) {
      reportAppError(saveError, { scope: 'loader', route })
      setError(vehicleSaveErrorText(saveError, tr))
    } finally {
      setIsSaving(false)
    }
  }

  // Повтор упавших загрузок в режиме правки: карточка в базе, чинить нужно
  // только фото.
  async function retryUploads() {
    if (!vehicleId) return
    const failed = uploads.filter((item) => item.status === 'failed')
    if (failed.length === 0) return
    const results = await runUploads(vehicleId, failed)
    if (results.every((item) => item.status === 'done')) navigate(backTarget)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSaving) return
    void save()
  }

  if (isEditing && loadState !== 'ready') {
    return (
      <section className="data-panel">
        {loadState === 'loading' && (
          <div className="state-block"><span>{tr('Загружаем карточку…', 'Karta yuklanmoqda…')}</span></div>
        )}
        {loadState === 'missing' && (
          <div className="state-block">
            <CarFront size={27} />
            <strong>{tr('Карточка не найдена', 'Karta topilmadi')}</strong>
            <span>{tr('Возможно, машину удалили или ссылка устарела.', 'Ehtimol, mashina o‘chirilgan yoki havola eskirgan.')}</span>
            <button className="button button--primary" onClick={() => navigate('/vehicles')}>{tr('К списку машин', 'Mashinalar ro‘yxatiga')}</button>
          </div>
        )}
        {loadState === 'failed' && (
          <div className="state-block state-block--error">
            <CircleAlert size={24} />
            <strong>{tr('Ошибка загрузки', 'Yuklash xatosi')}</strong>
            <span>{tr('Не удалось загрузить карточку машины.', 'Mashina kartasini yuklab bo‘lmadi.')}</span>
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
        <h1>{tr('Машина добавлена', 'Mashina qo‘shildi')}</h1>
        <p>{vehicleTitle(draft.brand, draft.model)} — {tr('карточка сохранена. Данные можно добивать позже.', 'karta saqlandi. Ma’lumotlarni keyinroq to‘ldirish mumkin.')}</p>

        {uploads.length > 0 && <UploadQueue uploads={uploads} label={() => tr('Фото', 'Foto')} />}

        <div>
          {failed.length > 0 && (
            <button className="button button--secondary" disabled={isUploading} onClick={() => void runUploads(createdId, failed)}>
              {tr('Повторить загрузку', 'Yuklashni takrorlash')}
            </button>
          )}
          <button className="button button--primary" disabled={isUploading} onClick={() => navigate(`/vehicles?vehicle=${createdId}`)}>{tr('Открыть карточку', 'Kartani ochish')}</button>
          <button className="button button--secondary" disabled={isUploading} onClick={resetForm}>{tr('Добавить ещё', 'Yana qo‘shish')}</button>
        </div>
      </section>
    )
  }

  const failedUploads = uploads.filter((item) => item.status === 'failed')

  return (
    <form onSubmit={handleSubmit}>
      <header className="editor-header">
        <button type="button" className="icon-button icon-button--bordered" onClick={() => navigate(backTarget)} aria-label={isEditing ? tr('Назад к карточке', 'Kartaga qaytish') : tr('Назад к машинам', 'Mashinalarga qaytish')}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="eyebrow">{isEditing ? tr('Карточка машины', 'Mashina kartasi') : tr('Новая карточка', 'Yangi karta')}</p>
          <h1>{isEditing ? tr('Редактировать машину', 'Mashinani tahrirlash') : tr('Добавить машину', 'Mashina qo‘shish')}</h1>
        </div>
        <button className="button button--primary editor-header__save" disabled={isSaving || isUploading || !canSave}>
          <Save size={17} /> {saveLabel}
        </button>
      </header>

      <section className="data-panel vehicle-form">
        <div className="form-section">
          <div className="form-section__heading">
            <span>01</span><div><h2>{tr('Машина', 'Mashina')}</h2><p>{tr('Обязательны марка и госномер — остальное добивается позже.', 'Marka va davlat raqami majburiy — qolgani keyinroq to‘ldiriladi.')}</p></div>
          </div>
          <div className="form-grid">
            <label className="field"><span>{tr('Марка', 'Marka')} *</span><input ref={brandRef} value={draft.brand} onChange={(event) => changeField('brand', event.target.value)} placeholder={tr('Например, Chevrolet', 'Masalan, Chevrolet')} required /></label>
            <label className="field"><span>{tr('Модель', 'Model')}</span><input value={draft.model} onChange={(event) => changeField('model', event.target.value)} placeholder={tr('Например, Cobalt', 'Masalan, Cobalt')} /></label>
            <label className="field"><span>{tr('Цвет', 'Rang')}</span><input value={draft.color} onChange={(event) => changeField('color', event.target.value)} placeholder={tr('Например, белый', 'Masalan, oq')} /></label>
            {/* Номер вводится как есть — свободной строкой: регистр, пробелы и
                кириллические двойники букв приводит триггер в базе, а второй
                канон на клиенте разошёлся бы с ним на первой же правке. */}
            <label className="field">
              <span>{tr('Госномер', 'Davlat raqami')} *</span>
              <input className="input-mono" value={draft.plate_number} onChange={(event) => changeField('plate_number', event.target.value)} placeholder="01 A 123 BC" required />
              <small className="field-hint">{tr('Регистр и пробелы не важны — система приведёт номер сама.', 'Registr va bo‘shliqlar muhim emas — tizim raqamni o‘zi keltiradi.')}</small>
            </label>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section__heading">
            <span>02</span><div><h2>{tr('Водители', 'Haydovchilar')}</h2><p>{tr('Водителей может быть несколько. Карточка сотрудника живёт в разделе «Сотрудники».', 'Haydovchilar bir nechta bo‘lishi mumkin. Xodim kartasi «Xodimlar» bo‘limida.')}</p></div>
          </div>

          {drivers.length > 0 && (
            <ul className="driver-chips">
              {drivers.map((driver) => (
                <li key={driver.id}>
                  <span>{driverFullName(driver)}</span>
                  <button type="button" className="icon-button" disabled={isSaving || isUploading} onClick={() => removeDriver(driver.id)} aria-label={tr('Снять водителя', 'Haydovchini olib tashlash')}>
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <EmployeePicker
            candidates={candidates}
            candidatesState={candidatesState}
            onLoad={loadCandidates}
            exclude={chosenDriverIds}
            onPick={addDriver}
            label={tr('Добавить водителя', 'Haydovchi qo‘shish')}
            disabled={isSaving || isUploading}
          />
        </div>

        <div className="form-section">
          <div className="form-section__heading">
            <span>03</span><div><h2>{tr('Фото', 'Fotolar')}</h2><p>{isEditing
              ? tr('Загруженные фото удалить нельзя — можно добавить новые. До 10 МБ на файл.', 'Yuklangan fotolarni o‘chirib bo‘lmaydi — yangilarini qo‘shish mumkin. Har bir fayl 10 MB gacha.')
              : tr('До 10 МБ на файл. Загрузятся после сохранения карточки.', 'Har bir fayl 10 MB gacha. Karta saqlangach yuklanadi.')}</p></div>
          </div>

          {/* В режиме правки сначала то, что уже лежит в карточке, — только на
              чтение: DELETE в бакете запрещён политиками, кнопок удаления нет. */}
          {isEditing && (
            <div className="unit-lists">
              {filesState === 'failed'
                ? <p className="form-error"><CircleAlert size={15} /> {tr('Не удалось загрузить фото машины.', 'Mashina fotolarini yuklab bo‘lmadi.')}</p>
                : filesState === 'loading'
                  ? <p className="muted">{tr('Загружаем фото…', 'Fotolar yuklanmoqda…')}</p>
                  : existingFiles.length === 0
                    ? <p className="muted">{tr('Фото пока нет.', 'Hozircha fotolar yo‘q.')}</p>
                    : <VehicleFilesList files={existingFiles} urls={fileUrls} photoAlt={vehicleTitle(draft.brand, draft.model)} />}
            </div>
          )}

          <PhotoPickField files={photos} onChange={setPhotos} disabled={isSaving || isUploading} />

          {/* Очередь дозагрузки в правке: на создании такой список живёт на экране
              успеха, здесь уходить со страницы некуда — сохранение возвращает в
              карточку само. */}
          {isEditing && uploads.length > 0 && (
            <>
              <UploadQueue uploads={uploads} label={() => tr('Фото', 'Foto')} />
              {failedUploads.length > 0 && !isUploading && (
                <div className="employee-form-actions">
                  <button type="button" className="button button--secondary" onClick={() => void retryUploads()}>{tr('Повторить загрузку', 'Yuklashni takrorlash')}</button>
                  <button type="button" className="button button--primary" onClick={() => navigate(backTarget)}>{tr('Открыть карточку', 'Kartani ochish')}</button>
                </div>
              )}
            </>
          )}
        </div>

        {error && <p className="form-error form-error--inline"><CircleAlert size={16} /> {error}</p>}

        {/* На телефоне кнопка в шапке уезжает вверх вместе с прокруткой — тот же
            дубль, что и в форме сотрудника; на десктопе он скрыт CSS. */}
        <div className="form-submit-mobile">
          <button className="button button--primary button--wide" disabled={isSaving || isUploading || !canSave}>
            <Save size={17} /> {saveLabel}
          </button>
        </div>
      </section>
    </form>
  )
}
