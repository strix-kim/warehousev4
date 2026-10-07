// Единственный вход в чанк three. Не lazyWithReload: тот при провале чанка
// перезагружает страницу, а мир встанет и на главной, где отказ 3D обязан
// закончиться плитками, а не перезагрузкой. Отказ оставляет след здесь, запасной
// вид рисует вызывающий.
import { reportAppError } from '../../lib/reportAppError'

export function loadWorld() {
  return import('./engine/createWorld').catch((error: unknown) => {
    reportAppError(error, { scope: 'chunk', route: window.location.pathname, detail: { chunk: 'world' } })
    throw error
  })
}
