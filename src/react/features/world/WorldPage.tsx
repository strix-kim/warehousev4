import { useState } from 'react'
import { useDocumentTitle, useLanguage } from '../../lib/i18n'
import { prefersReducedMotion } from './support'
import { WorldStage } from './WorldStage'

// Dev-стенд мира: маршрут /world существует только под import.meta.env.DEV
// (App.tsx), в прод-сборку страница не попадает.
export function WorldPage() {
  const { tr, locale } = useLanguage()
  useDocumentTitle(tr('Мир', 'Dunyo'))
  const [firstFrameMs, setFirstFrameMs] = useState<number | null>(null)
  const [reduced] = useState(prefersReducedMotion)

  return (
    <section className="w-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">{tr('Стенд разработки', 'Ishlab chiqish stendi')}</p>
          <h1>{tr('Мир', 'Dunyo')}</h1>
          <p className="w-page__facts">
            {firstFrameMs !== null && <span>{tr('Первый кадр', 'Birinchi kadr')}: {firstFrameMs.toLocaleString(locale)} {tr('мс', 'ms')}</span>}
            {reduced && <span>{tr('Движение уменьшено в системе — мир неподвижен', 'Tizimda harakat kamaytirilgan — dunyo harakatsiz')}</span>}
          </p>
        </div>
      </header>
      <WorldStage onFirstFrame={setFirstFrameMs} />
    </section>
  )
}
