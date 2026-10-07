import { CircleAlert, FileSpreadsheet, X } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { type VehicleWithDrivers } from './types'
import { DrawerLayer } from '../../components/DrawerLayer'
import { ProjectChoiceField, useProjectChoice } from '../../components/ProjectChoiceField'
import { UnsavedPrompt } from '../../components/UnsavedPrompt'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'
import { useGuardedClose } from '../../lib/useGuardedClose'
import { useModalLayer } from '../../lib/useModalLayer'
import type { EventDocumentMeta } from '../../lib/xlsx/eventDocument'
import { projectErrorText } from '../projects/api'
import type { ProjectBrief } from '../projects/types'

// Фаза одной сборки. Союзом, а не флагами: «готовим» и «готово» — состояния, а
// не два независимых булевых значения. Счётчика здесь нет: карточки водителей
// приезжают одним запросом, показывать «3 из 12» нечего. Текст отказа — строкой:
// «мероприятие не создалось» и «файл не собрался» чинятся по-разному.
type ExportPhase = { kind: 'idle' } | { kind: 'preparing' } | { kind: 'done' } | { kind: 'error'; text: string }

export type VehicleEventExportRun = (meta: EventDocumentMeta, options: { signal: AbortSignal }) => Promise<void>

// «Список автотранспорта на мероприятие»: шапка документа берётся из выбранного
// либо тут же заведённого мероприятия — ручного набора шапки нет, два пути к
// одному документу разъехались бы (то же решение, что у состава сотрудников).
// Машины за мероприятием НЕ сохраняются (решение прораба с55): от него только
// реквизиты. Выбор машин остаётся на странице — дровер его не копирует и при
// закрытии не сбрасывает.
export function VehicleEventExportDrawer({ vehicles, onClose, onExport }: {
  vehicles: VehicleWithDrivers[]
  onClose: () => void
  onExport?: VehicleEventExportRun
}) {
  const { tr, locale } = useLanguage()
  // Выбор «существующее / новое» — общий с составом сотрудников и планом залов.
  const choice = useProjectChoice({ report: { route: '/vehicles', source: 'export-projects' } })
  // Язык документа по умолчанию UZ: бумагу на объект подают по-узбекски, а
  // интерфейс у большинства русский — совпадать этим двум незачем.
  const [language, setLanguage] = useState<EventDocumentMeta['language']>('uz')
  const [phase, setPhase] = useState<ExportPhase>({ kind: 'idle' })
  // Закрытие дровера гасит незаконченную выборку: ответ уже некому показывать.
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => () => abortRef.current?.abort(), [])

  const isBusy = phase.kind === 'preparing'
  // Клиентская проверка здесь — подсказка, а не защита: реквизиты нового
  // мероприятия держит база (projects_dates_check, projects_identity_key).
  // Кнопку запирает заведомо мёртвый запрос: мероприятие не выбрано, у нового
  // нет названия либо нет даты начала — без неё не сложить фразу периода в
  // шапке (EventDocumentMeta.dateFrom обязателен).
  const canExport = choice.isReady && choice.hasDate

  // Терять есть что, пока набранные реквизиты нового мероприятия не записаны:
  // после создания черновик очищается. Выбор из списка и язык — выбор, а не
  // набранная работа. Во время сборки не спрашиваем: закрытие здесь — отмена
  // скачивания, и она гасит очередь загрузок штатно.
  const { requestClose, isPrompting, confirmClose, keepEditing } = useGuardedClose(choice.isDirty && !isBusy, onClose)
  useModalLayer(requestClose)

  // Машина без водителя даёт строку из одних прочерков — это законно, но человек
  // должен увидеть это ДО того, как отдаст бумагу принимающей стороне.
  const withoutDriver = vehicles.filter((vehicle) => vehicle.drivers.length === 0)

  async function runExport() {
    if (!onExport || !canExport || isBusy) return
    const controller = new AbortController()
    abortRef.current = controller
    setPhase({ kind: 'preparing' })

    // Новое мероприятие создаётся здесь и один раз (useProjectChoice.ensure):
    // не соберись после этого файл — повтор возьмёт уже созданное.
    let project: ProjectBrief | null
    try {
      project = await choice.ensure()
    } catch (error) {
      if (controller.signal.aborted) return
      reportAppError(error, { scope: 'loader', route: '/vehicles', detail: { source: 'export-project' } })
      setPhase({ kind: 'error', text: projectErrorText(error, tr) })
      return
    }
    if (controller.signal.aborted) return
    // canExport такого не пускает; ветка — для типа, а не для человека.
    if (!project?.date_from) {
      setPhase({ kind: 'idle' })
      return
    }

    try {
      await onExport({ name: project.name, dateFrom: project.date_from, dateTo: project.date_to, language }, { signal: controller.signal })
      if (!controller.signal.aborted) setPhase({ kind: 'done' })
    } catch (error) {
      // Отмена — не отказ: дровер уже закрыт, показывать некому и незачем.
      if (controller.signal.aborted) return
      reportAppError(error, { scope: 'loader', route: '/vehicles', detail: { source: 'event-export' } })
      setPhase({ kind: 'error', text: tr('Не удалось собрать файл. Повторите попытку.', 'Faylni yig‘ib bo‘lmadi. Qayta urinib ko‘ring.') })
    }
  }

  return (
    <DrawerLayer ariaLabel={tr('Список на мероприятие', 'Tadbir uchun ro‘yxat')} onRequestClose={requestClose} className="drawer">
      <div className="drawer__header">
        <div>
          <p className="eyebrow">{tr('Документ', 'Hujjat')}</p>
          <h2>{tr('Список на мероприятие', 'Tadbir uchun ro‘yxat')}</h2>
          <p className="drawer__lead">{tr('Машин', 'Mashinalar')}: {vehicles.length.toLocaleString(locale)}</p>
        </div>
        <div className="drawer__header-actions">
          <button autoFocus className="icon-button icon-button--bordered" onClick={requestClose} aria-label={tr('Закрыть', 'Yopish')}><X size={19} /></button>
        </div>
      </div>

      <AnimatePresence>
        {isPrompting && (
          <UnsavedPrompt
            key="unsaved"
            message={tr('Есть несохранённые изменения.', 'Saqlanmagan o‘zgarishlar bor.')}
            stayLabel={tr('Продолжить правку', 'Tahrirni davom ettirish')}
            leaveLabel={tr('Закрыть без сохранения', 'Saqlamasdan yopish')}
            onStay={keepEditing}
            onLeave={confirmClose}
          />
        )}
      </AnimatePresence>

      <ProjectChoiceField choice={choice} groupLabel={tr('Мероприятие для документа', 'Hujjat uchun tadbir')} disabled={isBusy}>
        {/* Язык бумаги, а не интерфейса: в UZ-документ уходят узбекские заголовки,
            даже если человек работает в русском интерфейсе. */}
        <div className="field">
          <span>{tr('Язык документа', 'Hujjat tili')}</span>
          <div className="language-switch" role="group" aria-label={tr('Язык документа', 'Hujjat tili')}>
            <button type="button" className={language === 'ru' ? 'active' : ''} aria-pressed={language === 'ru'} onClick={() => setLanguage('ru')}>RU</button>
            <button type="button" className={language === 'uz' ? 'active' : ''} aria-pressed={language === 'uz'} onClick={() => setLanguage('uz')}>UZ</button>
          </div>
        </div>
      </ProjectChoiceField>

      <div className="event-export-summary">
        {withoutDriver.length === 0
          ? <strong>{tr('Водители есть у всех машин', 'Hamma mashinada haydovchi bor')}</strong>
          : <>
            <strong>{tr('Без водителя', 'Haydovchisiz')}: {withoutDriver.length.toLocaleString(locale)}</strong>
            <small>{withoutDriver.map((vehicle) => vehicle.plate_number).join(', ')}</small>
          </>}
        {/* Чтобы человек не искал машины на странице мероприятия: туда они не
            пишутся, от мероприятия документу нужны только название и даты. */}
        <small>
          {choice.mode === 'new'
            ? tr('Новое мероприятие появится в реестре при скачивании. Машины за мероприятием не сохраняются — от него в документ идут только название и даты.', 'Yangi tadbir yuklab olishda reyestrda paydo bo‘ladi. Mashinalar tadbirga saqlanmaydi — undan hujjatga faqat nom va sanalar olinadi.')
            : tr('Машины за мероприятием не сохраняются — от него в документ идут только название и даты.', 'Mashinalar tadbirga saqlanmaydi — undan hujjatga faqat nom va sanalar olinadi.')}
        </small>
      </div>

      <div className="event-export-actions">
        {phase.kind === 'error' && <p className="form-error"><CircleAlert size={15} /> {phase.text}</p>}
        <button className="button button--primary button--wide" disabled={!onExport || !canExport || isBusy} onClick={() => void runExport()}>
          <FileSpreadsheet size={17} /> {tr('Скачать Excel', 'Excel yuklab olish')}
        </button>
        {choice.isReady && !choice.hasDate && (
          <small className="field-hint">
            {choice.mode === 'existing'
              ? tr('У мероприятия нет даты начала — без неё Excel не собрать. Укажите дату мероприятия на его странице.', 'Tadbirning boshlanish sanasi yo‘q — usiz Excel yig‘ilmaydi. Tadbir sanasini uning sahifasida ko‘rsating.')
              : tr('Чтобы скачать Excel, укажите дату начала мероприятия.', 'Excel yuklab olish uchun tadbirning boshlanish sanasini ko‘rsating.')}
          </small>
        )}
        {phase.kind === 'preparing' && (
          <small className="field-hint">{tr('Готовим карточки водителей…', 'Haydovchilar kartalari tayyorlanmoqda…')}</small>
        )}
        {phase.kind === 'done' && (
          <small className="field-hint">{tr('Файл скачан', 'Fayl yuklab olindi')}</small>
        )}
      </div>
    </DrawerLayer>
  )
}
