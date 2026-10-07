import type { WorldSiteId } from '../worldStore'

// Значки-объекты клавиш: объём в изометрии собран из <i> (фасад, крыша, боковая
// грань) и плоских деталей <b> — геометрия целиком в world-hud.css (.w-ico--*).
// Не lucide: значок обязан повторять силуэт здания в сцене.
const SHAPES: Record<WorldSiteId, { kind: string; parts: React.ReactNode }> = {
  office: { kind: 'office', parts: <><i /><b /></> },
  warehouse: { kind: 'store', parts: <><i /><i /></> },
  garage: { kind: 'garage', parts: <><i /><b /></> },
}

export function SiteIcon({ id }: { id: WorldSiteId }) {
  const { kind, parts } = SHAPES[id]
  return <span className={`w-ico w-ico--${kind}`} aria-hidden="true">{parts}</span>
}
