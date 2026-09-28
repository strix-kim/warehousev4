import { useCallback, useEffect, useState } from 'react'
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
  const { isBlocked, leave, stay } = useUnsavedGuard(active)
  // Закрытие запрошено и ждёт ответа на плашке.
  const [pending, setPending] = useState(false)

  // Пока плашка висела, несохранённое исчезло или началось сохранение — вопрос
  // больше не актуален. Показ гасится сразу (pending && active), а состояние
  // сбрасывается эффектом: иначе провал сохранения вернул бы плашку, о которой
  // уже никто не спрашивал.
  useEffect(() => {
    if (!active) setPending(false)
  }, [active])

  const isPrompting = (pending && active) || isBlocked

  // Повторный Esc или клик по подложке при открытой плашке ничего не делает:
  // вопрос уже задан, ответ — кнопкой.
  const requestClose = useCallback(() => {
    if (!active) onClose()
    else if (!isBlocked) setPending(true)
  }, [active, isBlocked, onClose])

  const confirmClose = useCallback(() => {
    if (isBlocked) {
      leave()
      return
    }
    setPending(false)
    onClose()
  }, [isBlocked, leave, onClose])

  // Снимаем оба вопроса сразу: закрытие могли запросить и поверх
  // заблокированного перехода.
  const keepEditing = useCallback(() => {
    if (isBlocked) stay()
    setPending(false)
  }, [isBlocked, stay])

  return { requestClose, isPrompting, confirmClose, keepEditing }
}
