import { CalendarDays, CalendarPlus, CarFront, CheckCheck, ChevronDown, ChevronRight, ClipboardList, FileClock, FileWarning, LayoutGrid, ListChecks, MapPin, Users, Utensils, X, type LucideIcon } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useEffect, useId, useRef, useState } from 'react'
import { BottomSheet } from '../../../components/BottomSheet'
import { useLanguage } from '../../../lib/i18n'
import { useModalLayer } from '../../../lib/useModalLayer'
import { vehicleTitle } from '../../vehicles/types'
import type { Quest, QuestKind } from '../data/quests'
import { useWorldState, type WorldStore } from '../worldStore'
import { ruPlural } from './plural'
import './world-quests.css'

// Свёрнута ли доска на этом устройстве. Настройка устройства, как облик мира
// (settings.ts): вне persistentCache, переживает выход. Хранится только «свёрнута» —
// по умолчанию доска раскрыта.
const FOLD_KEY = 'argo-world-quests'
function readFolded() {
  try {
    return window.localStorage.getItem(FOLD_KEY) === 'folded'
  } catch {
    return false
  }
}
function saveFolded(folded: boolean) {
  try {
    if (folded) window.localStorage.setItem(FOLD_KEY, 'folded')
    else window.localStorage.removeItem(FOLD_KEY)
  } catch {
    // Хранилище недоступно: выбор живёт до конца сеанса
  }
}

const ICONS: Record<QuestKind, LucideIcon> = {
  'no-lots': CalendarPlus,
  'no-place': MapPin,
  'no-dates': CalendarDays,
  'no-lists': ClipboardList,
  'no-plan': LayoutGrid,
  'no-staff': Users,
  'meal-missing': Utensils,
  'meal-collecting': Utensils,
  'car-no-driver': CarFront,
  'docs-expired': FileWarning,
  'docs-soon': FileClock,
}
// Тон значка: горит сегодня или уже просрочено — bad, в работе или скоро — warn.
// Смысл несёт текст строки, тон его только подчёркивает.
const TONES: Partial<Record<QuestKind, 'bad' | 'warn'>> = { 'meal-missing': 'bad', 'docs-expired': 'bad', 'meal-collecting': 'warn', 'car-no-driver': 'warn', 'docs-soon': 'warn' }

// Строки дел — кнопки: текст дела и подстрочник (мероприятие, машина либо раздел, куда ведёт дело).
// Одни и те же в раскрытой доске и в листе телефона.
function QuestRows({ quests, onPick }: { quests: readonly Quest[]; onPick: (quest: Quest) => void }) {
  const { tr, locale } = useLanguage()
  // Формулировки документов — те же, что у плитки сотрудников на главной (HomeTiles.tsx)
  const docs = (count: number, ru: [string, string, string], uz: string) => {
    const n = count.toLocaleString(locale)
    return tr(`${n} ${ruPlural(count, 'документ', 'документа', 'документов')} ${ruPlural(count, ...ru)}`, `${n} ta hujjat muddati ${uz}`)
  }
  const texts: Record<QuestKind, (quest: Quest) => string> = {
    'no-lots': () => tr('Нет мероприятий впереди', 'Oldinda tadbirlar yo‘q'),
    'no-place': () => tr('Площадка не указана', 'Maydon ko‘rsatilmagan'),
    'no-dates': () => tr('Даты не указаны', 'Sanalar ko‘rsatilmagan'),
    'no-lists': () => tr('Нет списка', 'Ro‘yxat yo‘q'),
    'no-plan': () => tr('Нет плана залов', 'Zallar rejasi yo‘q'),
    'no-staff': () => tr('Состав не указан', 'Tarkib ko‘rsatilmagan'),
    'meal-missing': () => tr('Обед не заказан', 'Tushlik buyurtma qilinmagan'),
    'meal-collecting': () => tr('Собираем заказы на обед', 'Tushlik buyurtmalari yig‘ilmoqda'),
    'car-no-driver': () => tr('Водитель не назначен', 'Haydovchi tayinlanmagan'),
    'docs-expired': (quest) => docs(quest.count ?? 0, ['истёк', 'истекли', 'истекли'], 'o‘tgan'),
    'docs-soon': (quest) => docs(quest.count ?? 0, ['истекает', 'истекают', 'истекают'], 'tugayapti'),
  }
  // У машины — номер и марка с моделью: по ним её узнают в гараже
  const sub = (quest: Quest) => quest.car ? `${quest.car.plate} · ${vehicleTitle(quest.car.brand, quest.car.model)}`
    : quest.lot?.name ?? (quest.kind === 'no-lots' ? tr('Создать мероприятие', 'Tadbir yaratish') : tr('Сотрудники', 'Xodimlar'))

  return (
    <ul className="w-quests__rows">
      {quests.map((quest) => {
        const Icon = ICONS[quest.kind], tone = TONES[quest.kind]
        return (
          <li key={quest.id}>
            <button type="button" className={`w-quest${tone ? ` w-quest--${tone}` : ''}`} onClick={() => onPick(quest)}>
              <span className="w-quest__ico" aria-hidden="true"><Icon size={18} /></span>
              <span className="w-quest__text">
                <b>{texts[quest.kind](quest)}</b>
                <small>{sub(quest)}</small>
              </span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// Лист дел на телефоне. Свой компонент: Esc, блокировку прокрутки и возврат фокуса на
// плашку держит useModalLayer — он обязан жить ровно столько, сколько открыт лист.
function QuestSheet({ title, quests, onPick, onClose }: { title: string; quests: readonly Quest[]; onPick: (quest: Quest) => void; onClose: () => void }) {
  const { tr } = useLanguage()
  const titleId = useId()
  useModalLayer(onClose)

  return (
    <BottomSheet ariaLabelledBy={titleId} onClose={onClose} className="w-qsheet">
      <div className="sheet__header">
        <strong id={titleId}>{title}</strong>
        <button type="button" autoFocus className="icon-button icon-button--bordered" onClick={onClose} aria-label={tr('Закрыть', 'Yopish')}><X size={19} /></button>
      </div>
      <QuestRows quests={quests} onPick={onPick} />
    </BottomSheet>
  )
}

type Props = {
  store: WorldStore
  // Дела по порядку строк (data/quests.ts); пусто — «Всё собрано»
  quests: readonly Quest[]
  // Строка нажата: адрес, камеру и действие ведёт сцена
  onQuest: (quest: Quest) => void
}

// Доска «Дела» (план world-game-s59, раздел 1): чего не хватает мероприятиям впереди и
// что горит сегодня. Каждая строка — кнопка: текстовый и клавиатурный путь к объекту с
// делом. data-w-chrome — неподвижная обвязка, вывески её обходят (контракт HUD в
// worldStore.ts). Монтирует её сцена, только когда реестр ответил.
// Десктоп: плашка «Дела: N» слева снизу (над клавишами кампуса), список раскрывается
// вверх и прокручивается внутри; свёрнутость помнит устройство. Компактная сцена
// (.w-stage.is-sm): только плашка, список — нижним листом продукта.
export function QuestBoard({ store, quests, onQuest }: Props) {
  const { tr, locale } = useLanguage()
  const compact = useWorldState(store, (state) => state.hudCompact)
  const listId = useId()
  const [folded, setFolded] = useState(readFolded)
  const [sheet, setSheet] = useState(false)
  // Дело, выбранное в листе: ждёт, пока лист уйдёт
  const pickedRef = useRef<Quest | null>(null)
  const count = quests.length
  // Сцена стала широкой или дела кончились при открытом листе — лист снят, обратно сам
  // не вернётся
  useEffect(() => { if (!compact || count === 0) setSheet(false) }, [compact, count])

  if (count === 0) {
    return (
      <section className="w-quests" aria-label={tr('Дела', 'Ishlar')} data-w-chrome>
        <p className="w-plaque w-quests__head w-quests__head--done">
          <CheckCheck size={18} aria-hidden="true" />
          {tr('Всё собрано', 'Hammasi tayyor')}
        </p>
      </section>
    )
  }

  const title = tr(`Дела: ${count.toLocaleString(locale)}`, `Ishlar: ${count.toLocaleString(locale)}`)
  const open = compact ? sheet : !folded
  const toggle = () => {
    if (compact) { setSheet(true); return }
    setFolded(!folded)
    saveFolded(!folded)
  }
  // Действие — после ухода листа, а не вместе с ним. Лист и дровер действия оба держат
  // useModalLayer: открой дровер поверх уходящего листа — он запомнил бы «прокрутка
  // заперта» как прежнее состояние страницы и вернул бы его при закрытии, навсегда.
  const pickFromSheet = (quest: Quest) => {
    pickedRef.current = quest
    setSheet(false)
  }
  const sheetGone = () => {
    const quest = pickedRef.current
    pickedRef.current = null
    if (quest) onQuest(quest)
  }

  return (
    <>
      <section className={`w-quests${open && !compact ? ' is-open' : ''}`} aria-label={tr('Дела', 'Ishlar')} data-w-chrome>
        <button
          type="button"
          className="w-plaque w-quests__head"
          aria-expanded={open}
          aria-controls={compact ? undefined : listId}
          aria-haspopup={compact ? 'dialog' : undefined}
          onClick={toggle}
        >
          <ListChecks size={18} aria-hidden="true" />
          {title}
          <ChevronDown className="w-quests__chev" size={16} aria-hidden="true" />
        </button>
        {open && !compact && (
          <div className="w-plaque w-quests__list" id={listId}>
            <QuestRows quests={quests} onPick={onQuest} />
          </div>
        )}
      </section>
      {/* Лист — рядом с доской, а не внутри: доску в компактной сцене прячет открытая
          панель участка, лист при этом обязан доиграть уход */}
      <AnimatePresence onExitComplete={sheetGone}>
        {compact && sheet && <QuestSheet key="quests" title={title} quests={quests} onPick={pickFromSheet} onClose={() => setSheet(false)} />}
      </AnimatePresence>
    </>
  )
}
