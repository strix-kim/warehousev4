import { useState } from 'react'
import { useDocumentTitle, useLanguage } from '../../lib/i18n'
import { saveWorldStyle, useWorldStyle, WORLD_INKS, WORLD_PALETTES, type WorldInk, type WorldPalette } from './settings'
import { prefersReducedMotion } from './support'
import { WorldStage } from './WorldStage'

// Страница мира: маршрут /world в проде с с58 (App.tsx). Цифра первого кадра —
// замер для разработки, в прод-сборке её нет.
export function WorldPage() {
  const { tr, locale } = useLanguage()
  useDocumentTitle(tr('Мир', 'Dunyo'))
  const [firstFrameMs, setFirstFrameMs] = useState<number | null>(null)
  const [reduced] = useState(prefersReducedMotion)
  // home здесь не читается: вид главной выбирают на самой главной (HomePage)
  const style = useWorldStyle()
  const paletteNames: Record<WorldPalette, string> = { white: tr('Белая схема', 'Oq sxema'), night: tr('Ночь', 'Tun') }
  const inkNames: Record<WorldInk, string> = { ink1: tr('Мягче', 'Yumshoqroq'), ink2: tr('Светлый', 'Och'), ink3: tr('Бледный', 'Xira') }

  return (
    <section className="w-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">{tr('3D-вид', '3D ko‘rinish')}</p>
          <h1>{tr('Мир', 'Dunyo')}</h1>
          <p className="w-page__facts">
            {import.meta.env.DEV && firstFrameMs !== null && <span>{tr('Первый кадр', 'Birinchi kadr')}: {firstFrameMs.toLocaleString(locale)} {tr('мс', 'ms')}</span>}
            {reduced && <span>{tr('Движение уменьшено в системе — мир неподвижен', 'Tizimda harakat kamaytirilgan — dunyo harakatsiz')}</span>}
          </p>
        </div>
        <div className="w-page__panel">
          <div className="w-page__axis">
            <span id="w-axis-palette">{tr('Цвет мира', 'Dunyo rangi')}</span>
            <div className="segmented" role="group" aria-labelledby="w-axis-palette">
              {WORLD_PALETTES.map((id) => (
                <button key={id} type="button" aria-pressed={style.palette === id} onClick={() => saveWorldStyle({ palette: id })}>
                  {style.palette === id && <span className="segmented__thumb" />}
                  {paletteNames[id]}
                </button>
              ))}
            </div>
          </div>
          <div className="w-page__axis">
            <span id="w-axis-ink">{tr('Контур', 'Kontur')}</span>
            <div className="segmented" role="group" aria-labelledby="w-axis-ink">
              {WORLD_INKS.map((id) => (
                <button key={id} type="button" aria-pressed={style.ink === id} onClick={() => saveWorldStyle({ ink: id })}>
                  {style.ink === id && <span className="segmented__thumb" />}
                  {inkNames[id]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>
      <WorldStage look={style} onFirstFrame={setFirstFrameMs} />
    </section>
  )
}
