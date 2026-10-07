// Единственный вход в чанк three. Не lazyWithReload: тот при провале чанка
// перезагружает страницу, а мир встанет и на главной, где отказ 3D обязан
// закончиться плитками, а не перезагрузкой. Отказ оставляет след здесь, запасной
// вид рисует вызывающий.
import { reportAppError } from '../../lib/reportAppError'
import type { World, WorldDeps } from './engine/createWorld'

// Данные мира до живого адаптера (useWorldData) — макетные и только в dev: фикстуры
// едут своим чанком рядом с движком и подставляются, если вызывающий данных не дал.
// В прод-сборке ветка вырезается вместе с файлом фикстур.
export function loadWorld() {
  return Promise.all([
    import('./engine/createWorld'),
    import.meta.env.DEV ? import('./data/fixtures.dev') : null,
  ]).then(([engine, fixtures]) => ({
    createWorld: (container: HTMLElement, deps: WorldDeps): World => engine.createWorld(container, { data: fixtures?.FIXTURES, ...deps }),
  }), (error: unknown) => {
    reportAppError(error, { scope: 'chunk', route: window.location.pathname, detail: { chunk: 'world' } })
    throw error
  })
}
