import { MonitorOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'
import { loadWorld } from './loadWorld'
import { hasWebGL2, prefersReducedMotion } from './support'
import { createWorldStore, type CameraPose } from './worldStore'
import './world.css'

// unsupported — WebGL2 нет; failed — чанк не приехал или мир не собрался;
// lost — браузер отобрал контекст у живого мира
type Status = 'loading' | 'ready' | 'unsupported' | 'failed' | 'lost'

// HMR: правка модуля движка доходит сюда (ближайшая граница Fast Refresh), эффект
// ниже сносит мир и собирает новый. Чтобы прораб после каждой правки не возвращался
// в стартовый кадр, поза камеры переезжает через import.meta.hot.data. Флаг swapping
// отличает замену модуля от обычного ухода со страницы: возврат на маршрут обязан
// начинаться с рабочего ракурса, как в проде.
const hot = import.meta.hot
if (hot) hot.dispose((data) => { data.swapping = true })

type Props = {
  // Миллисекунды от запроса чанка до первого кадра — цифра для dev-стенда
  onFirstFrame?: (ms: number) => void
}

export function WorldStage({ onFirstFrame }: Props) {
  const { tr } = useLanguage()
  const slotRef = useRef<HTMLDivElement>(null)
  const [store] = useState(createWorldStore)
  const [status, setStatus] = useState<Status>(() => (hasWebGL2() ? 'loading' : 'unsupported'))
  const onFirstFrameRef = useRef(onFirstFrame)
  useEffect(() => { onFirstFrameRef.current = onFirstFrame }, [onFirstFrame])

  useEffect(() => {
    const slot = slotRef.current
    if (!slot || !hasWebGL2()) return
    // StrictMode монтирует эффект дважды, а чанк приезжает позже cleanup: без флага
    // второй мир встал бы в слот рядом с первым
    let cancelled = false
    let dispose: (() => void) | null = null
    let getPose: (() => CameraPose) | null = null
    const startedAt = performance.now()

    loadWorld().then((engine) => {
      if (cancelled) return
      try {
        const world = engine.createWorld(slot, {
          store,
          reducedMotion: prefersReducedMotion(),
          pose: (hot?.data.pose as CameraPose | undefined) ?? null,
          onFirstFrame: () => {
            setStatus('ready')
            onFirstFrameRef.current?.(Math.round(performance.now() - startedAt))
          },
          onContextLost: () => {
            world.dispose()
            setStatus('lost')
          },
        })
        dispose = world.dispose
        getPose = world.getPose
      } catch (error) {
        reportAppError(error, { scope: 'loader', route: window.location.pathname, detail: { batch: 'world-create' } })
        setStatus('failed')
      } finally {
        if (hot) { hot.data.pose = null; hot.data.swapping = false }
      }
    }, () => {
      // След уже оставил loadWorld
      if (!cancelled) setStatus('failed')
    })

    return () => {
      cancelled = true
      if (hot?.data.swapping && getPose) hot.data.pose = getPose()
      dispose?.()
    }
  }, [store])

  return (
    <div className="w-stage">
      <div className="w-scene" ref={slotRef} aria-hidden="true" />
      {status === 'loading' && <p className="w-stage__state w-stage__loading" role="status">{tr('Загружаем мир…', 'Dunyo yuklanmoqda…')}</p>}
      {status === 'unsupported' && (
        <div className="w-stage__state">
          <EmptyState
            icon={<MonitorOff size={22} />}
            title={tr('3D-вид недоступен', '3D ko‘rinish mavjud emas')}
            text={tr('Браузер или устройство не поддерживает WebGL2. Все разделы открываются из меню.', 'Brauzer yoki qurilma WebGL2 ni qo‘llab-quvvatlamaydi. Barcha bo‘limlar menyudan ochiladi.')}
          />
        </div>
      )}
      {status === 'failed' && (
        <div className="w-stage__state">
          <ErrorState
            inline
            title={tr('Не удалось загрузить 3D-вид', '3D ko‘rinishni yuklab bo‘lmadi')}
            text={tr('Проверьте соединение и обновите страницу. Все разделы открываются из меню.', 'Aloqani tekshirib, sahifani yangilang. Barcha bo‘limlar menyudan ochiladi.')}
          />
        </div>
      )}
      {status === 'lost' && (
        <div className="w-stage__state">
          <ErrorState
            inline
            title={tr('3D-вид остановлен', '3D ko‘rinish to‘xtatildi')}
            text={tr('Браузер отключил графику на этой вкладке. Обновите страницу, чтобы вернуть мир.', 'Brauzer bu varaqda grafikani o‘chirdi. Dunyoni qaytarish uchun sahifani yangilang.')}
          />
        </div>
      )}
    </div>
  )
}
