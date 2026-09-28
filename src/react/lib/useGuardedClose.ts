import { useCallback, useEffect, useRef, useState } from 'react'
import { useUnsavedGuard } from './useUnsavedGuard'

// Защита несохранённого в дровере. У дровера два рода ухода: переход по адресу
// (его ловит useUnsavedGuard, как у форм) и собственное закрытие — Esc, клик по
// подложке, крестик. Второе роутер не видит: дровер закрывается сменой
// состояния страницы, а не адреса. Поэтому закрытие идёт через requestClose,
// и оба вопроса показывает одна плашка.
//
// active — как у useUnsavedGuard: «есть несохранённое И сейчас не сохраняем».
// Вызывающий обязан монтировать дровер только открытым: блокер роутера
// регистрируется самим маунтом (инвариант одного блокера — в useUnsavedGuard).
export function useGuardedClose(active: boolean, onClose: () => void) {
  const { isBlocked, leave, stay, bypass } = useUnsavedGuard(active)
  // Закрытие запрошено и ждёт ответа на плашке.
  const [pending, setPending] = useState(false)
  // Уход, ради которого задан вопрос, если это не само закрытие (requestLeave):
  // из дровера модели оборудования открывают карточку единицы, и набранное
  // теряется так же. null — закрытие: onClose берётся свежий, на момент ответа.
  const pendingActionRef = useRef<(() => void) | null>(null)

  // Пока плашка висела, несохранённое исчезло или началось сохранение — вопрос
  // больше не актуален. Показ гасится сразу (pending && active), а состояние
  // сбрасывается эффектом: иначе провал сохранения вернул бы плашку, о которой
  // уже никто не спрашивал.
  useEffect(() => {
    if (active) return
    pendingActionRef.current = null
    setPending(false)
  }, [active])

  const isPrompting = (pending && active) || isBlocked

  // Уход изнутри дровера, который роутер сам не отличил бы от потери ввода.
  // Повторный запрос при открытой плашке ничего не делает: вопрос уже задан,
  // ответ — кнопкой.
  const requestLeave = useCallback((action: () => void) => {
    if (!active) {
      action()
    } else if (!isBlocked) {
      pendingActionRef.current = action
      setPending(true)
    }
  }, [active, isBlocked])

  // Повторный Esc или клик по подложке при открытой плашке ничего не делает:
  // вопрос уже задан, ответ — кнопкой.
  const requestClose = useCallback(() => {
    if (!active) {
      onClose()
    } else if (!isBlocked) {
      pendingActionRef.current = null
      setPending(true)
    }
  }, [active, isBlocked, onClose])

  // Уход — через bypass: у дровера, живущего в адресе, закрытие — это переход,
  // и форма в этот момент ещё грязная; блокер спросил бы второй раз.
  const confirmClose = useCallback(() => {
    if (isBlocked) {
      leave()
      return
    }
    const action = pendingActionRef.current ?? onClose
    pendingActionRef.current = null
    setPending(false)
    bypass(action)
  }, [bypass, isBlocked, leave, onClose])

  // Снимаем оба вопроса сразу: закрытие могли запросить и поверх
  // заблокированного перехода.
  const keepEditing = useCallback(() => {
    if (isBlocked) stay()
    pendingActionRef.current = null
    setPending(false)
  }, [isBlocked, stay])

  return { requestClose, requestLeave, isPrompting, confirmClose, keepEditing }
}
