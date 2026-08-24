import { ArrowLeft, CircleAlert, Presentation } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchHallPlan, type HallPlanWithHalls } from './api'
import { formatPlanPeriod, sortHalls } from './types'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'
import './halls.css'

// Редактор плана. Пока ЗАГЛУШКА: шапка и состояния загрузки есть, сама доска
// залов приходит следующим шагом (Ш4) — маршрут заводится раньше неё, чтобы
// создание плана уже вело в свой адрес, а не в никуда.
export function HallPlanPage() {
  const navigate = useNavigate()
  const { tr, locale } = useLanguage()
  const { planId } = useParams<{ planId: string }>()

  const [plan, setPlan] = useState<HallPlanWithHalls | null>(null)
  // 'missing' — строки нет (или её не видно политикой): честное состояние, а не
  // пустая шапка, иначе прямая ссылка на удалённый план выглядела бы рабочей.
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!planId) return
    let isCurrent = true
    setLoadState('loading')
    fetchHallPlan(planId)
      .then((row) => {
        if (!isCurrent) return
        if (!row) {
          setLoadState('missing')
          return
        }
        setPlan(row)
        setLoadState('ready')
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        reportAppError(error, { scope: 'loader', route: '/halls/:planId', detail: { plan: planId } })
        setLoadState('failed')
      })
    return () => { isCurrent = false }
  }, [planId, reloadKey])

  if (loadState !== 'ready' || !plan) {
    return (
      <section className="data-panel">
        {loadState === 'loading' && (
          <div className="state-block"><span>{tr('Загружаем план…', 'Reja yuklanmoqda…')}</span></div>
        )}
        {loadState === 'missing' && (
          <div className="state-block">
            <Presentation size={27} />
            <strong>{tr('План не найден', 'Reja topilmadi')}</strong>
            <span>{tr('Возможно, план удалили или ссылка устарела.', 'Ehtimol, reja o‘chirilgan yoki havola eskirgan.')}</span>
            <button className="button button--primary" onClick={() => navigate('/halls')}>{tr('К списку планов', 'Rejalar ro‘yxatiga')}</button>
          </div>
        )}
        {loadState === 'failed' && (
          <div className="state-block state-block--error">
            <CircleAlert size={24} />
            <strong>{tr('Ошибка загрузки', 'Yuklash xatosi')}</strong>
            <span>{tr('Не удалось загрузить план залов.', 'Zallar rejasini yuklab bo‘lmadi.')}</span>
            <button className="button button--secondary" onClick={() => setReloadKey((value) => value + 1)}>{tr('Повторить', 'Qayta urinish')}</button>
          </div>
        )}
      </section>
    )
  }

  const halls = sortHalls(plan.halls)

  return (
    <>
      {/* Шапка редактора, а не .page-header: у раздела с адресом внутри есть
          возврат кнопкой-стрелкой — тот же приём, что у форм машины и сотрудника.
          Период стоит в надстрочнике: h1 здесь однострочный с многоточием. */}
      <header className="editor-header">
        <button type="button" className="icon-button icon-button--bordered" onClick={() => navigate('/halls')} aria-label={tr('Назад к планам', 'Rejalarga qaytish')}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="eyebrow">{tr('План залов', 'Zallar rejasi')} · {formatPlanPeriod(plan, locale, tr)}</p>
          <h1>{plan.name}</h1>
        </div>
      </header>

      <section className="data-panel">
        <div className="state-block">
          <Presentation size={27} />
          <strong>{tr('Редактор — следующим шагом', 'Muharrir — keyingi qadamda')}</strong>
          <span>{tr(`Залов в плане: ${halls.length}. Расстановка по залам появится здесь.`, `Rejadagi zallar: ${halls.length}. Zallar bo‘yicha taqsimot shu yerda paydo bo‘ladi.`)}</span>
        </div>
      </section>
    </>
  )
}
