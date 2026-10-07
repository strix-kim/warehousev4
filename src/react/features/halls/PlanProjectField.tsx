import { CalendarRange } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AppSelect, type AppSelectOption } from '../../components/AppSelect'
import { fetchProjectBriefs } from '../projects/api'
import { formatProjectPeriod, type ProjectBrief } from '../projects/types'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'

// Служебное значение селекта. Настоящие — uuid мероприятия, с ним не пересекутся.
const NONE = ''

/**
 * Поле «Мероприятие» в шапке плана залов: выбрать из реестра либо оставить
 * «Без мероприятия». Контролируемое — выбор хранит дровер. Только ссылка:
 * название и даты плана от выбора не меняются (план event-s53, развилка 9).
 * Реестр поле грузит само, тем же приёмом, что VenueField: источник один
 * (projects/api, кэш `projects:list`), и отказ загрузки — его забота.
 */
export function PlanProjectField({ value, onChange, disabled = false }: {
  value: string | null
  onChange: (projectId: string | null) => void
  disabled?: boolean
}) {
  const { tr, locale } = useLanguage()
  const [projects, setProjects] = useState<ProjectBrief[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let isCurrent = true
    setLoadState('loading')
    fetchProjectBriefs()
      .then((rows) => {
        if (!isCurrent) return
        setProjects(rows)
        setLoadState('ready')
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        setLoadState('failed')
        reportAppError(error, { scope: 'loader', route: '/halls', detail: { source: 'plan-projects' } })
      })
    return () => { isCurrent = false }
  }, [reloadKey])

  const options = useMemo<AppSelectOption<string>[]>(() => {
    // Пока реестр в пути, единственный пункт — текущее значение: AppSelect
    // показывает options[0], когда значения нет в списке, и «Без мероприятия»
    // при выбранном мероприятии было бы враньём.
    if (loadState !== 'ready') {
      return [{ value: value ?? NONE, label: loadState === 'loading' ? tr('Загружаем мероприятия…', 'Tadbirlar yuklanmoqda…') : tr('Мероприятия не загрузились', 'Tadbirlar yuklanmadi') }]
    }
    const list: AppSelectOption<string>[] = [
      { value: NONE, label: tr('Без мероприятия', 'Tadbirsiz') },
      // Период в подписи: ежегодный форум с тем же названием в реестре не один.
      ...projects.map((project) => ({ value: project.id, label: `${project.name} · ${formatProjectPeriod(project.date_from, project.date_to, locale, tr)}` })),
    ]
    // Привязанного мероприятия нет в реестре (не отдала политика) — честный
    // пункт вместо молчаливой подмены первым.
    if (value && !projects.some((project) => project.id === value)) {
      list.push({ value, label: tr('Мероприятие недоступно', 'Tadbir mavjud emas') })
    }
    return list
  }, [loadState, locale, projects, tr, value])

  const fieldLabel = tr('Мероприятие', 'Tadbir')

  return (
    <div className="field">
      <span><CalendarRange size={13} /> {fieldLabel}</span>
      {disabled || loadState !== 'ready'
        // Выключенное и недогруженное поле — та же кнопка селекта без попапа.
        ? <div className="app-select"><button className="app-select__trigger" type="button" disabled aria-label={fieldLabel}><span>{options.find((option) => option.value === (value ?? NONE))?.label ?? options[0]?.label}</span></button></div>
        : <AppSelect value={value ?? NONE} options={options} onChange={(next) => onChange(next === NONE ? null : next)} ariaLabel={fieldLabel} />}
      {loadState === 'failed'
        ? (
          <small className="field-hint field-hint--error">
            {tr('Не удалось загрузить мероприятия.', 'Tadbirlarni yuklab bo‘lmadi.')}{' '}
            <button type="button" className="plan-project-field__retry" onClick={() => setReloadKey((current) => current + 1)}>{tr('Повторить', 'Qayta urinish')}</button>
          </small>
        )
        : <small className="field-hint">{tr('План появится на странице мероприятия. Название и даты плана остаются своими.', 'Reja tadbir sahifasida ko‘rinadi. Rejaning nomi va sanalari o‘zicha qoladi.')}</small>}
    </div>
  )
}
