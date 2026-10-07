// Проверки среды до загрузки чанка three: файл живёт во входном чанке и three
// не импортирует.

let webgl2: boolean | null = null

// r186 требует WebGL2. Ответ запоминаем: каждая проба — живой контекст, а браузер
// держит их около шестнадцати на вкладку. Пробный контекст отпускаем сразу.
export function hasWebGL2(): boolean {
  if (webgl2 !== null) return webgl2
  try {
    const gl = window.WebGL2RenderingContext ? document.createElement('canvas').getContext('webgl2') : null
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    webgl2 = gl !== null
  } catch {
    webgl2 = false
  }
  return webgl2
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
