import { useLanguage } from '../../lib/i18n'

// Узбекский номер начинается двузначным кодом региона («01 T 769 MC», «01 439 SNA»).
// Не совпало (номер введён иначе) — знак из одной секции, без региона и флага:
// выдумывать регион из чужого формата хуже, чем показать строку как есть.
const PLATE_PATTERN = /^(\d{2})\s?(.+)$/

/** Госномер знаком (макет с31, .plate): регион | серия и номер | флаг «UZ». */
export function Plate({ value, size = 'md' }: { value: string, size?: 'md' | 'lg' }) {
  const { tr } = useLanguage()
  const match = PLATE_PATTERN.exec(value.trim())

  return (
    // role="img": знак читается целиком меткой, а не тремя обрывками секций.
    <span className={`plate${size === 'lg' ? ' plate--lg' : ''}`} role="img" aria-label={tr(`Госномер ${value}`, `Davlat raqami ${value}`)}>
      {match
        ? <><b>{match[1]}</b><span>{match[2]}</span><i>UZ</i></>
        : <span>{value}</span>}
    </span>
  )
}
