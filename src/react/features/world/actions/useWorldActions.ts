// Диспетчер действий мира: что делать с активированным объектом (клик в сцене,
// вывеска, клавиша, «плюс») и чем открыть действие — дровером поверх сцены или
// интерьером (план world-game-s59.md, решение 2).
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { Quest } from '../data/quests'
import { ADD_CAR_ID, ADD_LOT_ID, carId, isAddId, parseLotId, WORLD_SITES, type WorldSiteId, type WorldStore } from '../worldStore'

// Дровер действия поверх сцены. null — дровера нет. Живёт локальным состоянием, не в
// адресе (решение 7). Рисует его хост — actions/WorldActions.tsx.
// lotId — id мероприятия, carId — id машины (строки vehicles, без префикса объекта сцены).
export type WorldAction = {
  kind: 'project-new' | 'project-edit' | 'plan-new' | 'staff' | 'expense' | 'car'
  lotId?: string
  carId?: string
} | null

// Раздел продукта за зданием. Гаража здесь нет: он открывается изнутри, в мире
const SITE_ROUTES: Record<Exclude<WorldSiteId, 'garage'>, string> = { office: '/lists', warehouse: '/equipment' }

type Input = {
  store: WorldStore
  // Мир наполнен макетом (?mock=on): его мероприятий в базе нет
  mock: boolean
  // «Сегодня» мира (useWorldData): день, на котором открывается интерьер обедов
  today: string
  // Войти в гараж (hud/useGarage.ts): пишет ?in=garage; pick — объект, который будет
  // выбран по прибытии
  onGarage: (pick?: string) => void
}

export function useWorldActions({ store, mock, today, onGarage }: Input) {
  const navigate = useNavigate()
  const location = useLocation()
  const [action, setAction] = useState<WorldAction>(null)
  // Новое мероприятие пишется в базу и перечитывается реестр: «плюс» пустой ячейки
  // стоит в состоянии «строится». Ставит и снимает хост действий.
  const [building, setBuilding] = useState(false)
  // Откуда ушли в интерьер: путь с query внутри приложения. Интерьер читает
  // state.from (lib/returnTo.ts) и по нему возвращает «Назад в мир» на эту же запись.
  const from = location.pathname + location.search

  // Дровер один: поверх открытого второй не встаёт. Пока участок строится, новое
  // мероприятие не заводим — повторный клик по «плюсу» ничего не открывает.
  const run = (next: WorldAction) => {
    if (next && (action || (next.kind === 'project-new' && building))) return
    setAction(next)
  }
  const close = () => setAction(null)
  // Интерьер — обычный маршрут на весь экран, push-переходом. back — адрес мира, если
  // тем же ходом он сменился (строка доски пишет в него участок): location этого рендера
  // новой записи ещё не видит
  const leaveTo = (path: string, back = from) => navigate(path, { state: { from: back } })

  // Выбор и переход — один путь для вывески, клавиши и клика по зданию в сцене.
  // Движок к этому моменту pick уже поставил: повторная запись того же id стор не будит.
  // Участки и места — выбор без перехода: их показывают панели зон по pick из стора.
  // «Плюс» пустой ячейки открывает дровер нового мероприятия прямо в мире. «Плюсы»
  // внутри участка: план залов и состав — дроверы поверх сцены (plan-new, staff),
  // список — интерьер редактора с возвратом в мир. «Плюс» свободного проёма гаража —
  // интерьер новой машины; машины макет не подменяет, поэтому mock здесь не спрашиваем.
  const activate = (id: string) => {
    if (isAddId(id)) {
      const lot = parseLotId(id)
      if (id === ADD_CAR_ID) leaveTo('/vehicles/new')
      else if (id === ADD_LOT_ID && !mock) run({ kind: 'project-new' })
      // Макетного мероприятия (?mock=on) в базе нет — вести некуда, кроме реестра
      else if (id === ADD_LOT_ID || !lot || mock) navigate('/projects')
      // Параметр project читает ListEditorPage: новый список сразу на мероприятии
      else if (lot.part === 'addtruck') leaveTo(`/lists/new?project=${lot.venueId}`)
      else if (lot.part === 'addcrew') run({ kind: 'staff', lotId: lot.venueId })
      else run({ kind: 'plan-new', lotId: lot.venueId })
      return
    }
    if (!WORLD_SITES.includes(id as WorldSiteId)) return
    store.setState({ pick: id })
    // Гараж открывается в мире: камера подъезжает внутрь (контракт — worldStore.ts,
    // «Гараж»). Только с кампуса: вывески и клавиши зданий стоят на нём же.
    if (id === 'garage') {
      if (store.getState().zone === 'campus') onGarage()
      return
    }
    navigate(SITE_ROUTES[id as Exclude<WorldSiteId, 'garage'>])
  }

  // Действие дела — строка доски «Дела» (hud/QuestBoard.tsx). Те же действия, что у
  // «плюсов» и секций карточки участка: короткие формы — дровером, тяжёлые экраны —
  // интерьером. Адрес и камеру ведёт сцена; back — адрес мира для возврата из интерьера.
  const runQuest = (quest: Quest, back?: string) => {
    const { kind, lot } = quest
    if (!lot) {
      // Машина без водителя: вход в гараж, по прибытии она выбрана — действие (назначить
      // водителя) человек берёт в её карточке. Дровера нет.
      if (kind === 'car-no-driver') { if (quest.car) onGarage(carId(quest.car.id)) }
      // Сроки документов — в реестре сотрудников (там же их пилюли)
      else if (kind === 'docs-expired' || kind === 'docs-soon') leaveTo('/employees', back)
      else if (mock) navigate('/projects')
      else run({ kind: 'project-new' })
      return
    }
    // Макетного мероприятия (?mock=on) в базе нет — вести некуда, кроме реестра
    if (mock) { navigate('/projects'); return }
    // Участок вне сетки (седьмой и дальше): объекта в сцене нет — страница мероприятия
    if (quest.part === null) { leaveTo(`/projects/${lot.id}`, back); return }
    if (kind === 'no-place' || kind === 'no-dates') run({ kind: 'project-edit', lotId: lot.id })
    else if (kind === 'no-lists') leaveTo(`/lists/new?project=${lot.id}`, back)
    else if (kind === 'no-plan') run({ kind: 'plan-new', lotId: lot.id })
    else if (kind === 'no-staff') run({ kind: 'staff', lotId: lot.id })
    // Обеды: параметр day читает MealsPage
    else if (kind === 'meal-missing' || kind === 'meal-collecting') leaveTo(`/projects/${lot.id}/meals?day=${today}`, back)
  }

  return { action, run, close, leaveTo, activate, runQuest, building, setBuilding }
}
