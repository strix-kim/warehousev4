// Гараж изнутри: адрес ↔ движок (контракт — worldStore.ts, «Гараж»). Хозяин — адрес
// (?in=garage, только на кампусе): вход и выход пишут его через replace — «назад»
// уводит со страницы мира, а не из гаража (gotchas §7), — а движок догоняет через
// goInside и по прибытии сам пишет inside в стор.
import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { World } from '../engine/createWorld'
import { useWorldState, type WorldInside, type WorldStore } from '../worldStore'

type Input = {
  store: WorldStore
  worldRef: RefObject<Pick<World, 'goInside'> | null>
  // Адрес просит кампус (ни ?zone=, ни ?lot=): в другой зоне гаража нет
  campus: boolean
}

export function useGarage({ store, worldRef, campus }: Input) {
  const [params, setParams] = useSearchParams()
  const inParam = params.get('in')
  // Чего просит адрес. Незнакомое значение и параметр вне кампуса — не гараж
  const wanted: WorldInside | null = campus && inParam === 'garage' ? 'garage' : null
  const zone = useWorldState(store, (state) => state.zone)
  const inside = useWorldState(store, (state) => state.inside)
  const wantedRef = useRef(wanted)
  // Что движок уже слышал. goInside(null) — отъезд к рабочему ракурсу: звать его на
  // каждую смену зоны нельзя, только когда просьба действительно сменилась.
  const sentRef = useRef<WorldInside | null>(null)
  // Объект, который встанет в pick по прибытии (строка доски «Дела»): вход может
  // начаться с другой зоны, а смена зоны выбор снимает
  const pendingRef = useRef<string | null>(null)

  // Движку — только с кампуса: из другой зоны камера сначала возвращается на него
  // (адрес уже без ?zone=), и просьба уходит, когда стор отдал zone === 'campus'
  const sync = useCallback(() => {
    const world = worldRef.current
    if (!world) return
    const next = wantedRef.current !== null && store.getState().zone === 'campus' ? wantedRef.current : null
    if (next === sentRef.current) return
    sentRef.current = next
    world.goInside(next)
  }, [store, worldRef])
  useEffect(() => {
    // Вход отменён (переезд в зону, участок, шаг по истории) — выбирать по прибытии нечего
    if (wanted === null && wantedRef.current !== null) pendingRef.current = null
    wantedRef.current = wanted
    sync()
  }, [wanted, zone, sync])
  // Мир собран (или пересобран заменой модуля) позже эффекта адреса: новый движок про
  // гараж ещё не слышал. Зовёт сцена сразу после createWorld.
  const attach = useCallback(() => {
    sentRef.current = null
    sync()
  }, [sync])

  // Параметр, которому не место в адресе: переезд в зону или выбор участка другой
  // записью (?lot= посадки, строка доски), чужая ссылка с ?zone= или незнакомым значением
  useEffect(() => {
    if (inParam === null || wanted !== null) return
    setParams((prev) => {
      const query = new URLSearchParams(prev)
      query.delete('in')
      return query
    }, { replace: true })
  }, [inParam, wanted, setParams])

  useEffect(() => {
    if (inside !== 'garage') return
    const pick = pendingRef.current
    pendingRef.current = null
    if (pick !== null) store.setState({ pick })
  }, [inside, store])

  // Вход: с любой зоны — зона и участок из адреса уходят тем же ходом (setParams очереди
  // не ведёт, запись одна). pick — что выбрать внутри.
  const enter = useCallback((pick?: string) => {
    if (pick !== undefined) {
      if (store.getState().inside === 'garage') store.setState({ pick })
      else pendingRef.current = pick
    }
    setParams((prev) => {
      const query = new URLSearchParams(prev)
      query.delete('zone')
      query.delete('lot')
      query.set('in', 'garage')
      return query
    }, { replace: true })
  }, [store, setParams])

  // Выход к кампусу: выбор (машина или само здание гаража) снимается вместе с параметром
  const leave = useCallback(() => {
    pendingRef.current = null
    store.setState({ pick: null })
    setParams((prev) => {
      const query = new URLSearchParams(prev)
      query.delete('in')
      return query
    }, { replace: true })
  }, [store, setParams])

  return { wanted, inside, enter, leave, attach }
}
