import { ArrowDown, FileCheck2, FileSpreadsheet, ListChecks, Save } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorState } from '../../components/ErrorState'
import { formatDateTime, todayDateValue } from '../../lib/date'
import { useLanguage } from '../../lib/i18n'
import {
  clearListDraft,
  createEquipmentList,
  readListDraft,
  updateEquipmentList,
} from './api'
import { buildCatalogGroups, type CatalogGroup } from './catalogGroups'
import { CatalogPanel, CatalogPreviewDrawer } from './ListEditorCatalog'
import { ListEditorDraftNotice } from './ListEditorDraftNotice'
import { ListEditorHeader } from './ListEditorHeader'
import { KitPanel } from './ListEditorKit'
import { ListEditorMeta, type ListMetaField, type RequisiteField } from './ListEditorMeta'
import { useEditorChrome } from './useEditorChrome'
import { useEditorCatalog } from './useEditorCatalog'
import { useMobilePanels } from './useMobilePanels'
import { useOpenedList } from './useOpenedList'
import {
  addGroupTo,
  changeCountIn,
  setCountIn,
  toggleSerialIn,
  toggleSerialPickerIn,
  type SelectedGroup,
} from './listSelection'
import { buildExportRows, buildListItems, resolveListName, resolveSelection, selectionFromList, serializeDocument } from './listDocument'
import { useListDraftAutosave } from './useListDraftAutosave'
import { useListDraftRestore } from './useListDraftRestore'
import type { ListDraft } from './api'
import { downloadEquipmentListXlsx } from './xlsxExport'

export function ListEditorPage() {
  const navigate = useNavigate()
  const { listId } = useParams<{ listId: string }>()
  const { tr, language, locale } = useLanguage()
  // Реквизиты стартуют пустыми: подставленный текст пользователь принимал за свой
  // и увозил в документ и в базу.
  //
  // Черновик читается ЗДЕСЬ и второй раз внутри useListDraftRestore, и это не
  // недосмотр: инициализаторы полей ниже выполняются до того, как появится
  // groupsByKey, без которого хук вызвать нечем. Оба чтения бьют в один ключ кэша
  // и возвращают одно значение — «починка» через проброс сверху вниз потребовала
  // бы поднять хук выше каталога, куда он не встанет.
  const restoredDraft = useState(() => listId ? null : readListDraft())[0]
  const [name, setName] = useState<string>(() => restoredDraft?.name ?? '')
  const [clientName, setClientName] = useState<string>(() => restoredDraft?.clientName ?? '')
  const [venue, setVenue] = useState<string>(() => restoredDraft?.venue ?? '')
  const [description, setDescription] = useState(() => restoredDraft?.description ?? '')
  const [eventDate, setEventDate] = useState(() => restoredDraft?.eventDate ?? todayDateValue())
  const [selected, setSelected] = useState<SelectedGroup[]>([])
  const [isSaving, setIsSaving] = useState(false)
  // Режим экспорта, а не флаг: «Готовим…» должна гореть на нажатой кнопке, а не на обеих.
  const [isExporting, setIsExporting] = useState<'' | 'working' | 'approval'>('')
  const [saveError, setSaveError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  // Незаполненные реквизиты, на которые указала попытка собрать документ на
  // согласование. Подсветка снимается с поля, как только его начали править.
  const [requisiteErrors, setRequisiteErrors] = useState<Set<RequisiteField>>(() => new Set())
  // Момент последней записи в базу. Нужен только строке состояния в шапке.
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [previewGroup, setPreviewGroup] = useState<CatalogGroup | null>(null)
  const { mobilePanel, moveToMobilePanel, catalogRef, selectionRef } = useMobilePanels()
  // Панель реквизитов свёрнута по умолчанию: список собирают без неё, а документу
  // на согласование страница раскроет её сама (см. exportList).
  const [metaOpen, setMetaOpen] = useState(false)
  const metaRef = useRef<HTMLElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  useEditorChrome(gridRef)
  // Снимок документа на момент последней записи в базу. Пустая строка — снимка
  // ещё нет (список не открыт или не догрузился), и предупреждать не о чем.
  const savedSnapshotRef = useRef('')
  // Что именно восстановилось: сколько единиц вернулось и сколько позиций не
  // нашлось в живом каталоге. null — плашки нет.
  // Гидратация разведена на две: шапка документа заполняется сразу из строки
  // списка, состав — только когда приехал каталог.
  const hydratedMetaRef = useRef('')
  const hydratedSelectionRef = useRef('')
  // Ref гасит повторный вход в эффект, но не вызывает рендер — а хук
  // восстановления должен УЗНАТЬ, что гидратация из базы закончилась. Отсюда
  // пара: ref для гварда, состояние для уведомления.
  const [hydratedListId, setHydratedListId] = useState<string | null>(null)
  // Автосейв заблокирован, пока восстановление не закончилось: стартовый пустой
  // стейт затёр бы сохранённый черновик раньше, чем тот успеет подняться.
  // Восстанавливать нечего — снят сразу.

  // Порядок важен: эффекты исполняются в порядке объявления — каталог, строка
  // списка, затем гидратация шапки ниже.
  const { equipment, isLoading, hasLoadError } = useEditorCatalog()
  const { listToEdit, isOpening, openError } = useOpenedList(listId)

  // Шапка документа заполняется, как только приехала САМА строка списка, и не
  // ждёт каталог. Раньше и шапка, и состав гидратировались одним эффектом по
  // приходу каталога — на холодном старте с медленной сетью приехавшие данные
  // затирали название, которое пользователь успел набрать за эти секунды.
  useEffect(() => {
    if (!listToEdit || hydratedMetaRef.current === listToEdit.id) return
    setName(listToEdit.name)
    setClientName(listToEdit.client_name ?? '')
    setVenue(listToEdit.venue ?? '')
    setDescription(listToEdit.description ?? '')
    setEventDate(listToEdit.reservation_start ?? todayDateValue())
    const savedAt = Date.parse(listToEdit.created_at ?? '')
    setLastSavedAt(Number.isNaN(savedAt) ? null : savedAt)
    hydratedMetaRef.current = listToEdit.id
  }, [listToEdit])

  const groups = useMemo(() => buildCatalogGroups(equipment), [equipment])

  // Единственный источник группы по ключу: и восстановление, и рендер выборки,
  // и payload читают каталог отсюда, а не из снимков в стейте.
  const groupsByKey = useMemo(() => new Map(groups.map((group) => [group.key, group])), [groups])

  useEffect(() => {
    if (!listToEdit || groups.length === 0 || hydratedSelectionRef.current === listToEdit.id) return
    const restoredItems = selectionFromList(listToEdit, equipment, groupsByKey)
    setSelected(restoredItems)
    // Точка отсчёта для «есть несохранённые правки»: считаем её по строке из
    // базы, а не по стейту — стейт шапки мог уже разъехаться с ней, если
    // пользователь начал печатать, пока ехал каталог.
    savedSnapshotRef.current = serializeDocument({
      name: listToEdit.name,
      clientName: listToEdit.client_name ?? '',
      venue: listToEdit.venue ?? '',
      description: listToEdit.description ?? '',
      eventDate: listToEdit.reservation_start ?? todayDateValue(),
      items: restoredItems,
    })
    hydratedSelectionRef.current = listToEdit.id
    setHydratedListId(listToEdit.id)
  }, [equipment, groups, groupsByKey, listToEdit])

  // Шапка документа из черновика открытого списка. Отдельным колбэком, чтобы не
  // тащить в хук шесть сеттеров формы.
  const applyDocument = useCallback((draft: ListDraft) => {
    setName(draft.name)
    setClientName(draft.clientName)
    setVenue(draft.venue)
    setDescription(draft.description)
    setEventDate(draft.eventDate)
  }, [])

  const { draftNotice, setDraftNotice, draftRestoredRef } = useListDraftRestore({
    listId, isLoading, hasLoadError, hydratedListId, groupsByKey, setSelected, applyDocument,
  })

  const draftItems = useMemo(() => selected.map((item) => ({
    key: item.key,
    count: item.count,
    serialIds: item.serialIds,
  })), [selected])

  // Расхождение с последним сохранённым состоянием. Считается ДО автосейва: он
  // же по нему и решает, писать черновик открытого списка или стирать.
  const isDirty = savedSnapshotRef.current !== ''
    && savedSnapshotRef.current !== serializeDocument({ name, clientName, venue, description, eventDate, items: draftItems })

  useListDraftAutosave({ listId, restoredRef: draftRestoredRef, isDirty, name, clientName, venue, description, eventDate, items: draftItems })

  // Закрытие вкладки всё равно спрашивает подтверждение: черновик переживает
  // уход, но человек об этом не знает, а «правки пропали» дороже лишнего диалога.
  // Текст диалога свой у каждого браузера, задать его нельзя.

  useEffect(() => {
    if (!listId || !isDirty) return
    const warnOnUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Хвост для Chrome/Edge младше 119: они не смотрят на preventDefault, а
      // диалог показывают, только если returnValue стал НЕ пустой строкой
      // (пустая — его же значение по умолчанию, то есть присвоение впустую).
      event.returnValue = true
    }
    window.addEventListener('beforeunload', warnOnUnload)
    return () => window.removeEventListener('beforeunload', warnOnUnload)
  }, [isDirty, listId])

  // Сброс несохранённой работы. У /lists/new это «Начать заново» — форма пустеет.
  // У открытого списка пустеть нечему: откатываем к строке из базы, для чего
  // снимаем гвард гидратации и даём эффекту отработать заново.
  function discardDraft() {
    clearListDraft(listId)
    setDraftNotice(null)
    setSuccessMessage('')
    setRequisiteErrors(new Set())

    if (listId && listToEdit) {
      setName(listToEdit.name)
      setClientName(listToEdit.client_name ?? '')
      setVenue(listToEdit.venue ?? '')
      setDescription(listToEdit.description ?? '')
      setEventDate(listToEdit.reservation_start ?? todayDateValue())
      hydratedSelectionRef.current = ''
      setHydratedListId(null)
      return
    }

    setSelected([])
    setName('')
    setClientName('')
    setVenue('')
    setDescription('')
    setEventDate(todayDateValue())
  }

  function clearRequisiteError(field: RequisiteField) {
    setRequisiteErrors((current) => {
      if (!current.has(field)) return current
      const next = new Set(current)
      next.delete(field)
      return next
    })
  }

  // Правка реквизита снимает с поля подсветку «обязательно для согласования»:
  // пользователь уже отвечает на подсказку, держать её дальше незачем.
  function changeMeta(field: ListMetaField, value: string) {
    switch (field) {
      case 'name': setName(value); clearRequisiteError(field); break
      case 'clientName': setClientName(value); clearRequisiteError(field); break
      case 'venue': setVenue(value); clearRequisiteError(field); break
      case 'description': setDescription(value); break
      case 'eventDate': setEventDate(value); break
    }
  }

  const selectedCount = selected.reduce((sum, item) => sum + item.count, 0)
  const selectedKeys = useMemo(() => new Set(selected.map((item) => item.key)), [selected])
  const selectedByKey = useMemo(() => new Map(selected.map((item) => [item.key, item])), [selected])
  const resolvedSelection = useMemo(() => resolveSelection(selected, groupsByKey), [groupsByKey, selected])
  const canSubmit = selectedCount > 0 && !isOpening && !openError

  function addGroup(group: CatalogGroup) {
    setSuccessMessage('')
    setSelected((current) => addGroupTo(current, group))
  }

  function changeCount(key: string, delta: number) {
    setSelected((current) => changeCountIn(current, key, delta))
  }

  function setCount(key: string, count: number) {
    setSelected((current) => setCountIn(current, key, count))
  }

  function toggleSerialPicker(key: string) {
    setSelected((current) => toggleSerialPickerIn(current, key))
  }

  function toggleSerial(key: string, equipmentId: string) {
    setSelected((current) => toggleSerialIn(current, key, equipmentId))
  }

  function clearSelection() {
    setSuccessMessage('')
    setSelected([])
  }

  async function persistList() {
    const items = buildListItems(resolvedSelection)
    const listMode: 'specific' | 'abstract' = items.every((item) => item.tracking_mode !== 'planned') ? 'specific' : 'abstract'
    const input = {
      name: resolveListName({ name, eventDate, locale, tr }),
      description,
      clientName: clientName.trim(),
      venue: venue.trim(),
      listMode,
      reservationStart: eventDate || null,
      reservationEnd: eventDate || null,
      equipmentItems: items,
    }
    const id = listId ? await updateEquipmentList(listId, input) : await createEquipmentList(input)
    // Имя возвращаем разрешённым: снимок «сохранено» должен совпасть с тем, что
    // приедет из базы гидратацией, иначе список сразу окажется «изменённым».
    return { id, name: input.name }
  }

  async function saveList() {
    if (!canSubmit) return
    const isCreating = !listId
    setIsSaving(true)
    setSaveError('')
    setSuccessMessage('')
    try {
      const saved = await persistList()
      savedSnapshotRef.current = serializeDocument({ name: saved.name, clientName, venue, description, eventDate, items: draftItems })
      // Пустое поле после записи показывает то имя, что уехало в базу: иначе у
      // открытого списка (гидратация для него уже отработала) поле и h1 остались
      // бы пустыми, а «есть несохранённые правки» — взведённым до перезагрузки.
      if (!name.trim()) setName(saved.name)
      setSuccessMessage(isCreating ? tr('Список сохранён в системе.', 'Ro‘yxat tizimda saqlandi.') : tr('Изменения сохранены.', 'O‘zgarishlar saqlandi.'))
      setLastSavedAt(Date.now())
      // Черновик своё отработал в любом режиме: состояние уехало в базу, и
      // расхождения больше нет. Автосейв стёр бы его сам следующим тиком, но
      // тогда плашка успела бы мигнуть на перезагрузке в этот интервал.
      clearListDraft(listId)
      setDraftNotice(null)
      // После создания источник правды — listId из URL: следующее «Сохранить» обновит эту же запись, а не заведёт вторую.
      if (isCreating) {
        navigate(`/lists/${saved.id}/edit`, { replace: true })
      }
    } catch {
      setSaveError(tr('Не удалось сохранить список. Файл всё ещё можно скачать.', 'Ro‘yxatni saqlab bo‘lmadi. Faylni baribir yuklab olish mumkin.'))
    } finally {
      setIsSaving(false)
    }
  }

  function exportList(documentMode: 'working' | 'approval') {
    if (!canSubmit) return
    // Реквизиты обязательны только для документа на согласование: он идёт
    // заказчику под грифом «УТВЕРЖДАЮ», и пустых строк в нём быть не должно.
    // «Рабочий Excel» и «Сохранить» не требуют ни одного заполненного поля.
    if (documentMode === 'approval') {
      const fields: [RequisiteField, string][] = [['name', name], ['clientName', clientName], ['venue', venue]]
      const missing = fields.filter(([, value]) => !value.trim()).map(([field]) => field)
      if (missing.length > 0) {
        setRequisiteErrors(new Set(missing))
        setSaveError(tr(
          'Для документа на согласование заполните название, заказчика и площадку.',
          'Kelishuv hujjati uchun nom, buyurtmachi va maydonni to‘ldiring.',
        ))
        setSuccessMessage('')
        setMetaOpen(true)
        // Поля свёрнутой панели появляются в DOM только после раскрытия, поэтому
        // прокрутка и фокус — следующим кадром. preventScroll обязателен: обычный
        // фокус прыгает к полю мгновенно и обрывает плавную прокрутку к панели.
        window.requestAnimationFrame(() => {
          metaRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
          document.getElementById(`quick-list-${missing[0]}`)?.focus({ preventScroll: true })
        })
        return
      }
    }
    setRequisiteErrors(new Set())
    setIsExporting(documentMode)
    setSaveError('')
    setSuccessMessage('')
    try {
      downloadEquipmentListXlsx({
        name: resolveListName({ name, eventDate, locale, tr }),
        clientName: clientName.trim(),
        venue: venue.trim(),
        description: description.trim(),
        eventDate: eventDate || null,
        locale,
        language,
        documentMode,
        rows: buildExportRows(resolvedSelection),
      })
      setSuccessMessage(tr('Excel скачан. Сохранять список в системе необязательно.', 'Excel yuklandi. Ro‘yxatni tizimda saqlash shart emas.'))
    } catch {
      setSaveError(tr('Не удалось подготовить Excel. Попробуйте ещё раз.', 'Excelni tayyorlab bo‘lmadi. Qayta urinib ko‘ring.'))
    } finally {
      setIsExporting('')
    }
  }

  const isBusy = isSaving || isExporting !== ''
  // Один набор действий на две точки монтажа: шапка (десктоп) и футер выборки
  // (телефон). Разные подписи в двух местах разошлись бы при первой же правке.
  const actionButtons = (
    <>
      <button className="button button--secondary" onClick={() => void saveList()} disabled={!canSubmit || isBusy}>
        <Save size={17} /> {isSaving ? tr('Сохраняем…', 'Saqlanmoqda…') : tr('Сохранить', 'Saqlash')}
      </button>
      <button className="button button--secondary" onClick={() => exportList('working')} disabled={!canSubmit || isBusy} title={tr('Только список оборудования — для команды и работы', 'Faqat uskunalar ro‘yxati — jamoa va ish uchun')}>
        <FileSpreadsheet size={17} />{isExporting === 'working' ? tr('Готовим…', 'Tayyorlanmoqda…') : tr('Рабочий Excel', 'Ishchi Excel')}
      </button>
      <button className="button button--primary" onClick={() => exportList('approval')} disabled={!canSubmit || isBusy} title={tr('Документ для заказчика: с реквизитами и подписями', 'Buyurtmachi uchun hujjat: rekvizitlar va imzolar bilan')}>
        <FileCheck2 size={17} />{isExporting === 'approval' ? tr('Готовим…', 'Tayyorlanmoqda…') : tr('С реквизитами', 'Rekvizitlar bilan')}
      </button>
    </>
  )

  // Строка состояния занимает место eyebrow и имеет фиксированную высоту: результат
  // действия сменяет нейтральный статус, не двигая раскладку и не заводя тостов.
  const statusTone = saveError ? 'error' : successMessage ? 'success' : ''
  const statusText = saveError || successMessage || (listId
    ? (lastSavedAt
      ? tr(`Черновик · сохранён ${formatDateTime(lastSavedAt, locale)}`, `Qoralama · saqlangan ${formatDateTime(lastSavedAt, locale)}`)
      : tr('Черновик', 'Qoralama'))
    : tr('Новый список — Excel скачивается без сохранения', 'Yangi ro‘yxat — Excel saqlamasdan yuklanadi'))
  const statusBody = (
    <>
      {statusText}
      {Boolean(successMessage) && listId && <> · <Link to="/lists">{tr('Открыть в реестре', 'Reestrda ochish')}</Link></>}
    </>
  )

  return (
    <>
      <ListEditorHeader
        title={name.trim() || tr('Новый список', 'Yangi ro‘yxat')}
        statusTone={statusTone}
        statusBody={statusBody}
        actions={actionButtons}
        onBack={() => navigate('/lists')}
      />

      {openError && <ErrorState inline className="editor-open-error" title={tr('Список не открыт', 'Ro‘yxat ochilmadi')} text={tr('Не удалось открыть сохранённый список. Проверьте интернет и откройте его из реестра ещё раз — сам список не изменился.', 'Saqlangan ro‘yxatni ochib bo‘lmadi. Internetni tekshiring va uni reestrdan qayta oching — ro‘yxatning o‘zi o‘zgarmadi.')} action={<button className="button button--secondary" onClick={() => navigate('/lists')}>{tr('Вернуться к спискам', 'Ro‘yxatlarga qaytish')}</button>} />}

      {draftNotice && <ListEditorDraftNotice notice={draftNotice} onDiscard={discardDraft} />}

      <ListEditorMeta
        panelRef={metaRef}
        values={{ name, clientName, venue, description, eventDate }}
        requisiteErrors={requisiteErrors}
        open={metaOpen}
        onToggle={() => setMetaOpen((current) => !current)}
        onChange={changeMeta}
      />

      <div className="mobile-editor-tabs" role="tablist" aria-label={tr('Раздел редактора', 'Tahrirchi bo‘limi')}>
        <button className={mobilePanel === 'catalog' ? 'active' : ''} onClick={() => moveToMobilePanel('catalog')} role="tab" aria-selected={mobilePanel === 'catalog'}>{tr('Каталог', 'Katalog')}</button>
        <button className={mobilePanel === 'selection' ? 'active' : ''} onClick={() => moveToMobilePanel('selection')} role="tab" aria-selected={mobilePanel === 'selection'}>{tr('В списке', 'Ro‘yxatda')} <strong>{selectedCount}</strong></button>
      </div>

      <div ref={gridRef} className="editor-grid editor-grid--quick">
        <CatalogPanel
          panelRef={catalogRef}
          isMobileActive={mobilePanel === 'catalog'}
          groups={groups}
          equipmentCount={equipment.length}
          isLoading={isLoading}
          hasLoadError={hasLoadError}
          selectedKeys={selectedKeys}
          selectedByKey={selectedByKey}
          onPreview={setPreviewGroup}
          onAdd={addGroup}
        />

        <KitPanel
          panelRef={selectionRef}
          isMobileActive={mobilePanel === 'selection'}
          resolvedSelection={resolvedSelection}
          selectedCount={selectedCount}
          onChangeCount={changeCount}
          onSetCount={setCount}
          onToggleSerialPicker={toggleSerialPicker}
          onToggleSerial={toggleSerial}
          onClear={clearSelection}
          actions={actionButtons}
          status={statusTone !== '' ? <p className={`editor-status editor-status--${statusTone} editor-status--inline`}>{statusBody}</p> : null}
        />
      </div>

      {selectedCount > 0 && mobilePanel === 'catalog' && (
        <button className="mobile-selection-bar" type="button" onClick={() => moveToMobilePanel('selection')}>
          <span><ListChecks size={18} /> {tr('Добавлено в список', 'Ro‘yxatga qo‘shildi')} <strong>{selectedCount}</strong></span>
          <span>{tr('Открыть', 'Ochish')} <ArrowDown size={16} /></span>
        </button>
      )}

      {previewGroup && <CatalogPreviewDrawer group={previewGroup} onClose={() => setPreviewGroup(null)} onAdd={() => { addGroup(previewGroup); setPreviewGroup(null) }} />}
    </>
  )
}
