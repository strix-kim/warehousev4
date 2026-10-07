// Плавность движка: кривая --ease-out и значение, идущее к цели. Без three.

// cubic-bezier(.2,.8,.2,1) = --ease-out: x(s) решаем делением пополам
const bz = (s: number, a: number, b: number) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3
export function easeOut(t: number) {
  let lo = 0, hi = 1, s = t
  for (let i = 0; i < 18; i++) { s = (lo + hi) / 2; if (bz(s, 0.2, 0.2) < t) lo = s; else hi = s }
  return bz(s, 0.8, 1)
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

// Значение, плавно идущее к цели по --ease-out
export type Glide = { val: number; from: number; to: number; t0: number; dur: number }
export const still = (val = 0): Glide => ({ val, from: val, to: val, t0: 0, dur: 0 })
export const glide = (v: Glide, to: number, dur: number, now: number) => { if (v.to !== to) Object.assign(v, { from: v.val, to, t0: now, dur }) }
// Шаг к цели; instant (неподвижный мир) — сразу конец
export const glideStep = (v: Glide, now: number, instant = false) =>
  (v.val = v.from + (v.to - v.from) * easeOut(instant || !v.dur ? 1 : clamp01((now - v.t0) / v.dur)))
