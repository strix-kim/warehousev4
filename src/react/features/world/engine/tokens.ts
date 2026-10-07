// Цвета мира — токены :root продукта (styles/01-tokens.css). Читаются на каждое
// создание мира, копии значений в коде нет.
const NAMES = {
  bg: '--bg', card: '--card', sunk: '--sunk', select: '--select', line: '--line', ctl: '--ctl',
  ink: '--ink', muted: '--muted', soft: '--soft', night3: '--night-3', red: '--red',
  ok: '--ok-dot', warnBg: '--warn-bg',
  night: '--night', night2: '--night-2', nightLine: '--night-line',
  onNight: '--on-night', onNight2: '--on-night-2', redNight: '--red-night',
} as const

export type Tokens = Record<keyof typeof NAMES, string>

export function readTokens(): Tokens {
  const css = getComputedStyle(document.documentElement)
  const tokens = {} as Tokens
  for (const key of Object.keys(NAMES) as Array<keyof typeof NAMES>) {
    const value = css.getPropertyValue(NAMES[key]).trim()
    // Пустой токен three молча превратил бы в чёрный — пусть мир не построится вовсе
    if (!value) throw new Error(`Токен ${NAMES[key]} не задан в :root`)
    tokens[key] = value
  }
  return tokens
}
