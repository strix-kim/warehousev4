import type { WorldSiteId, WorldZone } from '../worldStore'

// Значки-объекты клавиш: объём в изометрии собран из <i> (фасад, крыша, боковая
// грань) и плоских деталей <b> — геометрия целиком в world-hud.css (.w-ico--*).
// Не lucide: значок обязан повторять силуэт здания в сцене.
type Shape = { kind: string; parts: React.ReactNode }
const SHAPES: Record<WorldSiteId, Shape> = {
  office: { kind: 'office', parts: <><i /><b /></> },
  warehouse: { kind: 'store', parts: <><i /><i /></> },
  garage: { kind: 'garage', parts: <><i /><b /></> },
}
// Зоны карты: кампус — офис с флагом, «Площадки» — зал места, «Где работали» — три
// здания разной высоты (те же силуэты, что на кнопках зон на земле). Формы — из
// макета voxel-world-s51.html (ICO.office, ICO.hall, ICO.arch).
const ZONE_SHAPES: Record<WorldZone, Shape> = {
  campus: SHAPES.office,
  venues: { kind: 'hall', parts: <><i /><b /></> },
  archive: { kind: 'arch', parts: <><i /><i /><i /></> },
}

// sm — компактный значок (вывески, переключатель зон): тот же рисунок, уменьшенный
function Ico({ shape: { kind, parts }, sm }: { shape: Shape; sm?: boolean }) {
  return <span className={`w-ico w-ico--${kind}${sm ? ' w-ico--sm' : ''}`} aria-hidden="true">{parts}</span>
}

export function SiteIcon({ id, sm }: { id: WorldSiteId; sm?: boolean }) {
  return <Ico shape={SHAPES[id]} sm={sm} />
}

export function ZoneIcon({ zone }: { zone: WorldZone }) {
  return <Ico shape={ZONE_SHAPES[zone]} sm />
}
