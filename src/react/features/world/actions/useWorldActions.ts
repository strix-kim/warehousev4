// Диспетчер действий мира: что делать с активированным объектом (клик в сцене,
// вывеска, клавиша, «плюс») и чем открыть действие — дровером поверх сцены или
// интерьером (план world-game-s59.md, решение 2).
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ADD_LOT_ID, isAddId, parseLotId, WORLD_SITES, type WorldSiteId, type WorldStore } from '../worldStore'

// Дровер действия поверх сцены. null — дровера нет. Живёт локальным состоянием, не в
// адресе (решение 7). Хоста дроверов ещё нет (Э1): run пока никто не зовёт.
export type WorldAction = {
  kind: 'project-new' | 'project-edit' | 'plan-new' | 'staff' | 'expense' | 'car'
  lotId?: string
  carId?: string
} | null

// Раздел продукта за каждым зданием
const SITE_ROUTES: Record<WorldSiteId, string> = { office: '/lists', warehouse: '/equipment', garage: '/vehicles' }

// mock — мир наполнен макетом (?mock=on): его мероприятий в базе нет
export function useWorldActions({ store, mock }: { store: WorldStore; mock: boolean }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [action, setAction] = useState<WorldAction>(null)
  // Откуда ушли в интерьер: путь с query внутри приложения. Интерьер читает
  // state.from (lib/returnTo.ts) и по нему возвращает «Назад в мир» на эту же запись.
  const from = location.pathname + location.search

  const run = (next: WorldAction) => setAction(next)
  const close = () => setAction(null)
  // Интерьер — обычный маршрут на весь экран, push-переходом
  const leaveTo = (path: string) => navigate(path, { state: { from } })

  // Выбор и переход — один путь для вывески, клавиши и клика по зданию в сцене.
  // Движок к этому моменту pick уже поставил: повторная запись того же id стор не будит.
  // Участки и места — выбор без перехода: их показывают панели зон по pick из стора.
  // «Плюс» ведёт туда, где недостающее создаётся: записи в базу из мира нет.
  const activate = (id: string) => {
    if (isAddId(id)) {
      const lot = parseLotId(id)
      // Макетного мероприятия (?mock=on) в базе нет — вести некуда, кроме реестра
      if (id === ADD_LOT_ID || !lot || mock) navigate('/projects')
      // Параметр project читает ListEditorPage: новый список сразу на мероприятии
      else if (lot.part === 'addtruck') leaveTo(`/lists/new?project=${lot.venueId}`)
      // HallPlansPage по new=1 открывает дровер нового плана с этим мероприятием
      else navigate(`/halls?new=1&project=${lot.venueId}`)
      return
    }
    if (!WORLD_SITES.includes(id as WorldSiteId)) return
    store.setState({ pick: id })
    navigate(SITE_ROUTES[id as WorldSiteId])
  }

  return { action, run, close, leaveTo, activate }
}
