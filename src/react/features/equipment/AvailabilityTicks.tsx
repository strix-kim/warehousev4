// Шкала единиц модели (макет с31, V-14): штрих на единицу. Норма — тёмно-серая
// заливка, цвет получает только отклонение: диагностика — янтарная, «нет на
// складе» — малиновый пустой контур. Строка каталога знает только «свободно из
// всего», поэтому остальное рисует нейтральным контуром (rest): выдумывать,
// что из несвободного — диагностика, а что — выдача, не из чего.
export type AvailabilityCounts = {
  free: number
  warn?: number
  bad?: number
  rest?: number
}

// Больше 14 штрихов не читаются поштучно (и не влезают в колонку) — шкала
// становится полосой с долями, как в макете.
const MAX_TICKS = 14

export function AvailabilityTicks({ free, warn = 0, bad = 0, rest = 0 }: AvailabilityCounts) {
  const total = free + warn + bad + rest
  if (total <= 0) return null
  if (total > MAX_TICKS) {
    return (
      <span className="ticks ticks--bar" aria-hidden="true">
        {free > 0 && <i style={{ flex: free }} />}
        {warn > 0 && <i className="w" style={{ flex: warn }} />}
        {bad > 0 && <i className="b" style={{ flex: bad }} />}
        {rest > 0 && <i className="r" style={{ flex: rest }} />}
      </span>
    )
  }
  const kinds = [
    ...Array<string>(free).fill(''),
    ...Array<string>(warn).fill('w'),
    ...Array<string>(bad).fill('b'),
    ...Array<string>(rest).fill('r'),
  ]
  return (
    <span className="ticks" aria-hidden="true">
      {kinds.map((kind, index) => <i key={index} className={kind || undefined} />)}
    </span>
  )
}

// «3 из 4» — главное число строки: свободно крупно, всего мелко. Ноль
// свободных — отклонение, число малиновое (решение прораба с32).
// totalLabel — «из 4» или «/4»: подпись разная у таблицы и у карточки телефона.
export function FreeCount({ free, totalLabel }: { free: number; totalLabel: string }) {
  return (
    <span className={`free-count${free > 0 ? '' : ' free-count--none'}`}>
      <b>{free}</b> <small>{totalLabel}</small>
    </span>
  )
}
