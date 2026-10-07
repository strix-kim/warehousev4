// Выбранное не лежит под собственной панелью. Панель места или квартала — обвязка в
// правой части сцены ([data-w-chrome="panel"], контракт — worldStore.ts): вывеска под
// ней гаснет, а здание не видно. Пока панель открыта, кадр сдвинут влево ровно настолько,
// чтобы якорь выбранного вышел из-под неё. Сдвиг живёт в проекции (setViewOffset):
// поза камеры, указатель и подписи считаются с ним сами.
import * as THREE from 'three'
import { lotPartId, parseLotId, type WorldStore } from '../worldStore'
import type { WorldCtx } from './createWorld'

// От якоря выбранного до края панели, px: половина участка на экране и зазор
const ROOM = 170

// Возвращает кадр сдвига: зовётся перед рендером сцены
export function createPanelShift(ctx: WorldCtx, store: WorldStore, reduced: boolean) {
  const stage = ctx.container.parentElement, at = new THREE.Vector3()
  let shown = 0, last = 0, w0 = 0, h0 = 0
  return (now: number) => {
    const { pick, hudCompact } = store.getState(), w = ctx.container.clientWidth, h = ctx.container.clientHeight
    // Якорь участка — один на все его части; в компактной сцене панель — лист снизу
    const lot = parseLotId(pick)
    const anchor = pick && !hudCompact && !ctx.flight ? ctx.labels.get(lot ? lotPartId('lot', lot.venueId) : pick) : undefined
    const panel = anchor && stage?.querySelector<HTMLElement>('[data-w-chrome="panel"]')
    let want = 0
    if (anchor && panel) {
      // Место якоря в несдвинутом кадре: матрица — с прошлого кадра, сдвиг — в проекции
      const x = (at.setFromMatrixPosition(anchor.matrixWorld).project(ctx.camera).x + 1) / 2 * w + shown
      want = Math.min(Math.max(x + ROOM - panel.offsetLeft, 0), panel.offsetWidth)
    }
    // Кадр догоняет сдвиг, а не прыгает; в неподвижном мире — встаёт сразу
    const k = reduced ? 1 : 1 - Math.exp(-Math.min(now - last, 100) / 1000 * 12)
    last = now
    const next = Math.abs(want - shown) < 0.5 ? want : shown + (want - shown) * k
    if (next === shown && w === w0 && h === h0) return
    shown = next; w0 = w; h0 = h
    if (!w || !h) return
    if (shown) ctx.camera.setViewOffset(w, h, shown, 0, w, h)
    else ctx.camera.clearViewOffset()
  }
}
