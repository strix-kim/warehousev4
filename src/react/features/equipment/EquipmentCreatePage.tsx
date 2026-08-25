import { ArrowLeft, Boxes, CheckCircle2, CircleAlert, Layers, PackagePlus, Save, ShieldCheck } from 'lucide-react'
import { FormEvent, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AppSelect } from '../../components/AppSelect'
import { EquipmentVisual } from '../../components/EquipmentVisual'
import {
  createEquipment,
  createEquipmentBatch,
  emptyEquipmentTaxonomy,
  fetchEquipmentTaxonomy,
  serialNumberExists,
} from './api'
import {
  equipmentAvailabilityLabel,
  equipmentAvailabilityOptions,
  type EquipmentAvailability,
} from './availability'
import { translateEquipmentTaxonomy } from '../../lib/equipmentTaxonomy'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'

// 'batch' — та же серийная запись, но много сразу: U34-L. Отдельный режим, а не
// флажок при 'serialized', потому что выбор «как заводим» уже живёт карточками
// раздела 01 — третий сценарий встаёт туда же, а не в новый орган управления.
type RecordKind = 'serialized' | 'batch' | 'quantity'

// Результат проверки серийника на дубли. 'failed' — проверка НЕ прошла: это не
// «дубля нет», а «мы не знаем», и сохранять по нему нельзя (gotchas §11).
type SerialCheck = 'idle' | 'unique' | 'duplicate' | 'failed'

// Локация — ДАННЫЕ, а не текст интерфейса: в базе лежит один словарь значений
// на всех. Через tr() при языке uz в базу уезжало 'Ofis' и заводило вторую
// локацию рядом с 'Офис', под которым сейчас весь каталог.
const DEFAULT_LOCATION = 'Офис'

// Статус «выдано» проставляет только выдача списка, руками новую запись
// в него не заводят — в форме создания этот код не предлагается.
const newEquipmentAvailabilityCodes: EquipmentAvailability[] = ['available', 'unavailable', 'diagnostics']

// Потолок партии — тот же, что в RPC create_equipment_batch: сервер откажет
// числом, клиент говорит словами раньше.
const BATCH_LIMIT = 200

// Только перенос строки, без запятых: серийники бывают с дефисами, пробелами
// и чем угодно ещё, а «один номер — одна строка» непонимания не оставляет.
function parseSerialLines(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
}

export function EquipmentCreatePage() {
  const navigate = useNavigate()
  // Выборка каталога, из которой сюда пришли. Пусто, если открыли по прямой
  // ссылке — тогда «Назад» ведёт на каталог без фильтров, и это честно.
  // routeLocation, а не location: имя location в этом файле занято полем формы
  // «локация оборудования».
  const routeLocation = useLocation()
  const catalogSearch = (routeLocation.state as { catalogSearch?: string } | null)?.catalogSearch ?? ''
  const { tr, language } = useLanguage()
  const [kind, setKind] = useState<RecordKind>('serialized')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [inventoryCode, setInventoryCode] = useState('')
  const [type, setType] = useState('')
  const [subtype, setSubtype] = useState('')
  const [count, setCount] = useState(1)
  const [availability, setAvailability] = useState<EquipmentAvailability>('available')
  const [location, setLocation] = useState(DEFAULT_LOCATION)
  const [length, setLength] = useState('')
  const [specification, setSpecification] = useState('')
  const [description, setDescription] = useState('')
  const [taxonomy, setTaxonomy] = useState(emptyEquipmentTaxonomy)
  const newEquipmentAvailabilityOptions = equipmentAvailabilityOptions(tr, newEquipmentAvailabilityCodes)
  const [serialCheck, setSerialCheck] = useState<SerialCheck>('idle')
  const [isCheckingSerial, setIsCheckingSerial] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [createdId, setCreatedId] = useState('')
  // Сколько единиц завела партия. null — успеха партии не было; вместе с
  // createdId решает, какой экран успеха показывать.
  const [createdCount, setCreatedCount] = useState<number | null>(null)
  const [serialBatch, setSerialBatch] = useState('')
  const brandInputRef = useRef<HTMLInputElement>(null)
  // Первое уникальное поле единицы: серийный номер, а у количественного учёта —
  // внутренний код. Обе ветки отдают ссылку сюда, потому что рендерится всегда
  // ровно одна из них.
  const serialInputRef = useRef<HTMLInputElement>(null)
  const batchInputRef = useRef<HTMLTextAreaElement>(null)

  // Пересчёт на каждый рендер, без мемоизации: партия — до 200 коротких строк.
  const parsedSerials = kind === 'batch' ? parseSerialLines(serialBatch) : []
  const lowerSerialCounts = new Map<string, number>()
  for (const serial of parsedSerials) {
    const key = serial.toLowerCase()
    lowerSerialCounts.set(key, (lowerSerialCounts.get(key) ?? 0) + 1)
  }
  // Повторы внутри textarea ловятся на месте — это UX, а не защита: авторитетную
  // проверку (в том числе против каталога) делает RPC.
  const batchDuplicates = [...new Set(parsedSerials.filter((serial) => (lowerSerialCounts.get(serial.toLowerCase()) ?? 0) > 1))]

  const canSave = Boolean(
    brand.trim()
    && model.trim()
    && (kind === 'quantity' || (kind === 'batch'
      ? parsedSerials.length >= 1 && parsedSerials.length <= BATCH_LIMIT && batchDuplicates.length === 0
      : serialNumber.trim()))
    && type.trim()
    && subtype.trim()
    && location.trim()
    && count >= 1
    // 'failed' кнопку не блокирует: отправка сама перепроверит номер и остановится,
    // если проверка снова не прошла. Иначе один сетевой сбой запирал бы форму.
    && serialCheck !== 'duplicate',
  )

  useEffect(() => {
    fetchEquipmentTaxonomy().then(setTaxonomy).catch((error: unknown) => reportAppError(error, { scope: 'prefetch', route: '/equipment/new', detail: { source: 'taxonomy' } }))
  }, [])

  function changeKind(nextKind: RecordKind) {
    setKind(nextKind)
    setSerialCheck('idle')
    if (nextKind !== 'quantity') setCount(1)
  }

  // Сброс формы к пустому бланку — вместо перезагрузки страницы: партию заводят
  // позициями подряд, а полный перезапуск SPA на каждой из них при плохой сети
  // рискует не подняться обратно.
  function resetForm() {
    setKind('serialized')
    setBrand('')
    setModel('')
    setSerialNumber('')
    setInventoryCode('')
    setSerialBatch('')
    setType('')
    setSubtype('')
    setCount(1)
    setAvailability('available')
    setLocation(DEFAULT_LOCATION)
    setLength('')
    setSpecification('')
    setDescription('')
    setSerialCheck('idle')
    setError('')
    setCreatedId('')
    setCreatedCount(null)
    // Форма монтируется тем же кадром, что и сброс, — фокус ставим после него.
    window.requestAnimationFrame(() => brandInputRef.current?.focus())
  }

  // Партия одинаковых устройств заводится подряд, и бренд, модель, категория и
  // характеристики у них общие: чистится только то, что принадлежит конкретной
  // единице. Полный resetForm на этом сценарии заставлял вводить модель заново.
  function resetForSameModel() {
    setSerialNumber('')
    setInventoryCode('')
    setSerialBatch('')
    if (kind !== 'quantity') setCount(1)
    setSerialCheck('idle')
    setError('')
    setCreatedId('')
    setCreatedCount(null)
    window.requestAnimationFrame(() => (kind === 'batch' ? batchInputRef.current : serialInputRef.current)?.focus())
  }

  async function checkSerial(): Promise<SerialCheck> {
    if (kind !== 'serialized' || !serialNumber.trim()) {
      setSerialCheck('idle')
      return 'idle'
    }
    setIsCheckingSerial(true)
    try {
      const exists = await serialNumberExists(serialNumber)
      const result: SerialCheck = exists ? 'duplicate' : 'unique'
      setSerialCheck(result)
      return result
    } catch {
      // Отказ проверки НЕ означает «дубля нет»: разрешает только база, а
      // уникального индекса на serialnumber в проде нет (gotchas §11).
      setSerialCheck('failed')
      return 'failed'
    } finally {
      setIsCheckingSerial(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (kind === 'batch') {
      // Предварительной проверки дублей на клиенте перед отправкой нет
      // намеренно: авторитет — RPC, она под локом проверяет и партию, и каталог
      // разом, а перечень занятых номеров возвращает ответом, не ошибкой.
      setIsSaving(true)
      try {
        const result = await createEquipmentBatch({
          brand,
          model,
          type,
          subtype,
          availability,
          location,
          lengthinmeters: length,
          technicalspecification: specification,
          description,
          serialNumbers: parsedSerials,
        })
        if (result.status === 'duplicates') {
          // До десяти номеров текстом: сотня в одну строку — уже не сообщение.
          const shown = result.serials.slice(0, 10).join(', ')
          const rest = result.serials.length - Math.min(result.serials.length, 10)
          setError(tr(
            `Эти номера повторяются или уже есть в каталоге: ${shown}${rest > 0 ? ` и ещё ${rest}` : ''}. Ничего не сохранено.`,
            `Bu raqamlar takrorlanadi yoki katalogda allaqachon bor: ${shown}${rest > 0 ? ` va yana ${rest} ta` : ''}. Hech narsa saqlanmadi.`,
          ))
          return
        }
        setCreatedCount(result.count)
      } catch {
        setError(tr('Не удалось добавить партию. Ничего не сохранено — повторите попытку.', 'Partiyani qo‘shib bo‘lmadi. Hech narsa saqlanmadi — qayta urinib ko‘ring.'))
      } finally {
        setIsSaving(false)
      }
      return
    }

    const result = await checkSerial()
    if (result === 'duplicate') {
      setError(tr('Такой серийный номер уже есть в каталоге.', 'Bu seriya raqami katalogda allaqachon mavjud.'))
      return
    }
    if (result === 'failed') {
      setError(tr(
        'Не удалось проверить серийный номер на дубли. Запись не сохранена — повторите попытку.',
        'Seriya raqamini takrorlanishga tekshirib bo‘lmadi. Yozuv saqlanmadi — qayta urinib ko‘ring.',
      ))
      return
    }

    setIsSaving(true)
    try {
      const id = await createEquipment({
        brand,
        model,
        trackingMode: kind === 'quantity' ? 'quantity' : 'serialized',
        serialnumber: kind === 'serialized' ? serialNumber : undefined,
        inventoryCode: kind === 'quantity' ? inventoryCode : undefined,
        type,
        subtype,
        count: kind === 'serialized' ? 1 : Math.max(1, count),
        availability,
        location,
        lengthinmeters: length,
        technicalspecification: specification,
        description,
      })
      setCreatedId(id)
    } catch {
      setError(tr('Не удалось добавить оборудование. Проверьте поля и повторите попытку.', 'Uskunani qo‘shib bo‘lmadi. Maydonlarni tekshirib, qayta urinib ko‘ring.'))
    } finally {
      setIsSaving(false)
    }
  }

  if (createdId || createdCount !== null) {
    return (
      <section className="success-state data-panel">
        <span className="success-state__icon"><CheckCircle2 size={32} /></span>
        <p className="eyebrow">{tr('Готово', 'Tayyor')}</p>
        <h1>{createdCount !== null
          ? tr(`Добавлено единиц: ${createdCount}`, `Qo‘shilgan birliklar: ${createdCount}`)
          : tr('Оборудование добавлено', 'Uskuna qo‘shildi')}</h1>
        <p>{createdCount !== null
          ? `${brand} ${model} — ${tr(`${createdCount} шт. сохранены в каталоге, по записи на серийный номер. Другие записи не изменялись.`, `${createdCount} dona katalogga saqlandi, har bir seriya raqamiga alohida yozuv. Boshqa yozuvlar o‘zgartirilmadi.`)}`
          : `${brand} ${model} ${tr('сохранено в каталоге. Другие записи не изменялись.', 'katalogga saqlandi. Boshqa yozuvlar o‘zgartirilmadi.')}`}</p>
        <div>
          <button className="button button--primary" onClick={() => navigate('/equipment')}>{tr('Открыть каталог', 'Katalogni ochish')}</button>
          <button className="button button--secondary" onClick={resetForSameModel}>{tr('Добавить ещё такую же', 'Xuddi shunday yana qo‘shish')}</button>
          <button className="button button--secondary" onClick={resetForm}>{tr('Добавить другую', 'Boshqasini qo‘shish')}</button>
        </div>
      </section>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <header className="editor-header">
        {/* «Назад» = «я передумал»: возвращаем в ту же выборку каталога, включая
            фильтры и страницу. Кнопка «Открыть каталог» на экране успеха ведёт
            на ЧИСТЫЙ каталог намеренно — под старым фильтром только что заведённая
            позиция могла бы не показаться, и человек решил бы, что не сохранилось. */}
        <button type="button" className="icon-button icon-button--bordered" onClick={() => navigate({ pathname: '/equipment', search: catalogSearch })} aria-label={tr('Назад к каталогу', 'Katalogga qaytish')}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="eyebrow">{tr('Новая запись', 'Yangi yozuv')}</p>
          <h1>{tr('Добавить оборудование', 'Uskuna qo‘shish')}</h1>
        </div>
        <button className="button button--primary editor-header__save" disabled={isSaving || !canSave}>
          <Save size={17} /> {isSaving ? tr('Сохраняем…', 'Saqlanmoqda…') : tr('Добавить в каталог', 'Katalogga qo‘shish')}
        </button>
      </header>

      <div className="equipment-form-layout">
        <section className="data-panel equipment-form">
          <div className="form-section">
            <div className="form-section__heading">
              <span>01</span><div><h2>{tr('Способ учёта', 'Hisob turi')}</h2><p>{tr('Определяет, как количество будет отображаться в каталоге.', 'Miqdor katalogda qanday ko‘rsatilishini belgilaydi.')}</p></div>
            </div>
            <div className="record-kind-grid">
              <button type="button" className={kind === 'serialized' ? 'active' : ''} onClick={() => changeKind('serialized')}>
                <PackagePlus size={21} />
                <span><strong>{tr('С серийным номером', 'Seriya raqami bilan')}</strong><small>{tr('Конкретное устройство. В списках выбирается поштучно, количество всегда 1.', 'Muayyan qurilma. Ro‘yxatlarda donalab tanlanadi, miqdori doimo 1.')}</small></span>
                <i>{kind === 'serialized' && <CheckCircle2 size={18} />}</i>
              </button>
              <button type="button" className={kind === 'batch' ? 'active' : ''} onClick={() => changeKind('batch')}>
                <Layers size={21} />
                <span><strong>{tr('Партия с серийными номерами', 'Seriya raqamli partiya')}</strong><small>{tr('Одна модель, несколько устройств: номера списком, каждому — своя запись.', 'Bitta model, bir nechta qurilma: raqamlar ro‘yxat bilan, har biriga alohida yozuv.')}</small></span>
                <i>{kind === 'batch' && <CheckCircle2 size={18} />}</i>
              </button>
              <button type="button" className={kind === 'quantity' ? 'active' : ''} onClick={() => changeKind('quantity')}>
                <Boxes size={21} />
                <span><strong>{tr('Без серийного номера', 'Seriya raqamisiz')}</strong><small>{tr('Кабели, аксессуары и расходники. Учитываются общим количеством.', 'Kabellar, aksessuarlar va sarf materiallari. Umumiy miqdorda hisoblanadi.')}</small></span>
                <i>{kind === 'quantity' && <CheckCircle2 size={18} />}</i>
              </button>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section__heading">
              <span>02</span><div><h2>{tr('Основная информация', 'Asosiy ma’lumot')}</h2><p>{tr('Поля со звёздочкой обязательны.', 'Yulduzchali maydonlar majburiy.')}</p></div>
            </div>
            <div className="form-grid">
              <label className="field"><span>{tr('Бренд', 'Brend')} *</span><input ref={brandInputRef} value={brand} onChange={(event) => setBrand(event.target.value)} placeholder={tr('Например, Shure', 'Masalan, Shure')} required /></label>
              <label className="field"><span>{tr('Модель', 'Model')} *</span><input value={model} onChange={(event) => setModel(event.target.value)} placeholder={tr('Например, ULXD4Q', 'Masalan, ULXD4Q')} required /></label>
              {kind === 'serialized' ? (
                <label className="field">
                  <span>{tr('Серийный номер', 'Seriya raqami')} *</span>
                  <input
                    ref={serialInputRef}
                    value={serialNumber}
                    onChange={(event) => { setSerialNumber(event.target.value); setSerialCheck('idle') }}
                    onBlur={() => void checkSerial()}
                    className={serialCheck === 'duplicate' ? 'input-error' : ''}
                    placeholder={tr('С корпуса устройства', 'Qurilma korpusidan')}
                    required
                  />
                  {/* Обещание проверки под ПУСТЫМ полем — обещание о том, чего ещё
                      нет. Подсказка появляется, когда есть что проверять или когда
                      проверка уже что-то сказала. */}
                  {(serialNumber.trim() !== '' || isCheckingSerial || serialCheck === 'duplicate' || serialCheck === 'failed') && (
                    <small className={serialCheck === 'duplicate' || serialCheck === 'failed' ? 'field-hint field-hint--error' : 'field-hint'}>
                      {isCheckingSerial
                        ? tr('Проверяем номер…', 'Raqam tekshirilmoqda…')
                        : serialCheck === 'duplicate'
                          ? tr('Этот номер уже используется.', 'Bu raqam allaqachon ishlatilmoqda.')
                          : serialCheck === 'failed'
                            ? tr('Проверить номер не удалось. Сохранение попробует ещё раз.', 'Raqamni tekshirib bo‘lmadi. Saqlash yana urinib ko‘radi.')
                            : tr('Номер проверяется на дубли перед сохранением.', 'Saqlashdan oldin raqam takrorlanishi tekshiriladi.')}
                    </small>
                  )}
                </label>
              ) : kind === 'batch' ? (
                <label className="field form-grid__wide">
                  <span>{tr('Серийные номера — по одному в строке', 'Seriya raqamlari — har birini alohida qatorga')} *</span>
                  <textarea
                    ref={batchInputRef}
                    className={`input-mono${batchDuplicates.length > 0 || parsedSerials.length > BATCH_LIMIT ? ' input-error' : ''}`}
                    value={serialBatch}
                    onChange={(event) => setSerialBatch(event.target.value)}
                    rows={6}
                    placeholder={'AH00001\nAH00002\nAH00003'}
                    required
                  />
                  <small className={batchDuplicates.length > 0 || parsedSerials.length > BATCH_LIMIT ? 'field-hint field-hint--error' : 'field-hint'}>
                    {batchDuplicates.length > 0
                      ? tr(`Повторяются: ${batchDuplicates.slice(0, 10).join(', ')}.`, `Takrorlanmoqda: ${batchDuplicates.slice(0, 10).join(', ')}.`)
                      : parsedSerials.length > BATCH_LIMIT
                        ? tr(`Не больше ${BATCH_LIMIT} номеров за раз.`, `Bir safarda ${BATCH_LIMIT} tadan ko‘p raqam emas.`)
                        : parsedSerials.length > 0
                          ? tr(`Распознано номеров: ${parsedSerials.length}. Перед сохранением все проверяются на дубли.`, `Aniqlangan raqamlar: ${parsedSerials.length}. Saqlashdan oldin barchasi takrorlanishga tekshiriladi.`)
                          : tr('Каждый номер станет отдельной записью каталога.', 'Har bir raqam katalogda alohida yozuv bo‘ladi.')}
                  </small>
                </label>
              ) : (
                <label className="field">
                  <span>{tr('Внутренний код / номер партии', 'Ichki kod / partiya raqami')}</span>
                  <input ref={serialInputRef} value={inventoryCode} onChange={(event) => setInventoryCode(event.target.value)} placeholder={tr('Необязательно', 'Ixtiyoriy')} />
                  <small className="field-hint">{tr('Можно оставить пустым — в списке позиция будет учитываться количеством.', 'Bo‘sh qoldirish mumkin — ro‘yxatda pozitsiya miqdor bo‘yicha hisoblanadi.')}</small>
                </label>
              )}
              {/* disabled-поле выключено и из native-валидации: ноль распознанных
                  номеров в партии держит кнопку, а не браузерный min=1. */}
              <label className="field"><span>{tr('Количество', 'Miqdor')} *</span><input type="number" min="1" max="9999" value={kind === 'quantity' ? count : kind === 'batch' ? parsedSerials.length : 1} onChange={(event) => setCount(Number(event.target.value))} disabled={kind !== 'quantity'} required /></label>
              <label className="field"><span>{tr('Категория', 'Toifa')} *</span><input list="equipment-types" value={type} onChange={(event) => setType(event.target.value)} placeholder={tr('Выберите или введите', 'Tanlang yoki kiriting')} required /></label>
              <label className="field"><span>{tr('Подкатегория', 'Quyi toifa')} *</span><input list="equipment-subtypes" value={subtype} onChange={(event) => setSubtype(event.target.value)} placeholder={tr('Выберите или введите', 'Tanlang yoki kiriting')} required /></label>
              <datalist id="equipment-types">{taxonomy.types.map((value) => <option value={value} label={translateEquipmentTaxonomy(value, language)} key={value} />)}</datalist>
              <datalist id="equipment-subtypes">{taxonomy.subtypes.map((value) => <option value={value} label={translateEquipmentTaxonomy(value, language)} key={value} />)}</datalist>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section__heading">
              <span>03</span><div><h2>{tr('Состояние и детали', 'Holat va tafsilotlar')}</h2><p>{tr('Помогают быстрее находить и проверять оборудование.', 'Uskunani tezroq topish va tekshirishga yordam beradi.')}</p></div>
            </div>
            <div className="form-grid">
              <div className="field"><span>{tr('Статус', 'Holat')}</span><AppSelect value={availability} onChange={setAvailability} ariaLabel={tr('Статус оборудования', 'Uskuna holati')} options={newEquipmentAvailabilityOptions} /></div>
              <label className="field"><span>{tr('Локация', 'Joylashuv')} *</span><input value={location} onChange={(event) => setLocation(event.target.value)} required /></label>
              <label className="field"><span>{tr('Длина, м', 'Uzunlik, m')}</span><input value={length} onChange={(event) => setLength(event.target.value)} placeholder={tr('Только для кабелей', 'Faqat kabellar uchun')} inputMode="decimal" /></label>
              <label className="field form-grid__wide"><span>{tr('Технические характеристики', 'Texnik xususiyatlar')}</span><textarea value={specification} onChange={(event) => setSpecification(event.target.value)} rows={3} placeholder={tr('Мощность, разъёмы, диапазон частот…', 'Quvvat, ulagichlar, chastota diapazoni…')} /></label>
              <label className="field form-grid__wide"><span>{tr('Примечание', 'Izoh')}</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder={tr('Комплектация, состояние корпуса, особенности…', 'Jamlanma, korpus holati, xususiyatlar…')} /></label>
            </div>
          </div>

          {error && <p className="form-error form-error--inline"><CircleAlert size={16} /> {error}</p>}

          {/* На телефоне предпросмотр с кнопкой скрыт, а шапка формы уезжает вверх
              вместе с прокруткой: единственное сохранение оказывалось за экраном.
              На десктопе этот дубль скрыт CSS. */}
          <div className="form-submit-mobile">
            <button className="button button--primary button--wide" disabled={isSaving || !canSave}>
              <Save size={17} /> {isSaving ? tr('Сохраняем…', 'Saqlanmoqda…') : tr('Добавить в каталог', 'Katalogga qo‘shish')}
            </button>
          </div>
        </section>

        <aside className="data-panel equipment-preview">
          <p className="eyebrow">{tr('Предпросмотр', 'Oldindan ko‘rish')}</p>
          <EquipmentVisual item={{ brand, model, type, subtype }} size="large" alt={brand && model ? `${brand} ${model}` : ''} />
          <h2>{brand || tr('Бренд', 'Brend')} {model || tr('Модель', 'Model')}</h2>
          <p>{subtype ? translateEquipmentTaxonomy(subtype, language) : tr('Подкатегория', 'Quyi toifa')}</p>
          <dl>
            <div><dt>{tr('Тип учёта', 'Hisob turi')}</dt><dd>{kind === 'quantity' ? tr('По количеству', 'Miqdor bo‘yicha') : kind === 'batch' ? tr('По серийному номеру, партия', 'Seriya raqami bo‘yicha, partiya') : tr('По серийному номеру', 'Seriya raqami bo‘yicha')}</dd></div>
            <div>
              <dt>{kind === 'quantity' ? tr('Внутренний код', 'Ichki kod') : kind === 'batch' ? tr('Серийные номера', 'Seriya raqamlari') : tr('Серийный номер', 'Seriya raqami')}</dt>
              <dd className="mono">{kind === 'quantity'
                ? inventoryCode || tr('Без кода', 'Kodsiz')
                : kind === 'batch'
                  ? parsedSerials.length > 0 ? `${parsedSerials.slice(0, 3).join(', ')}${parsedSerials.length > 3 ? '…' : ''}` : '—'
                  : serialNumber || '—'}</dd>
            </div>
            <div><dt>{tr('Количество', 'Miqdor')}</dt><dd>{kind === 'quantity' ? count : kind === 'batch' ? parsedSerials.length : 1} {tr('шт.', 'dona')}</dd></div>
            <div><dt>{tr('Статус', 'Holat')}</dt><dd>{equipmentAvailabilityLabel(availability, tr)}</dd></div>
            <div><dt>{tr('Локация', 'Joylashuv')}</dt><dd>{location || '—'}</dd></div>
          </dl>
          <div className="drawer__notice equipment-preview__notice"><ShieldCheck size={18} /><p>{kind === 'serialized'
            ? tr('Перед сохранением серийный номер автоматически проверяется на дубли.', 'Saqlashdan oldin seriya raqami takrorlanishga avtomatik tekshiriladi.')
            : kind === 'batch'
              ? tr('Все номера проверяются на дубли разом: партия сохраняется целиком либо не сохраняется вовсе.', 'Barcha raqamlar birdan takrorlanishga tekshiriladi: partiya to‘liq saqlanadi yoki umuman saqlanmaydi.')
              : tr('Эта позиция будет добавляться в фактические списки с выбором количества.', 'Bu pozitsiya haqiqiy ro‘yxatlarga miqdor tanlash bilan qo‘shiladi.')}</p></div>
          <button className="button button--primary button--wide" disabled={isSaving || !canSave}><Save size={17} /> {tr('Добавить в каталог', 'Katalogga qo‘shish')}</button>
        </aside>
      </div>
    </form>
  )
}
