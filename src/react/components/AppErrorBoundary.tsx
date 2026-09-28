import { RotateCw } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { readStoredLanguage } from '../lib/i18n'
import { reportAppError } from '../lib/reportAppError'
import { ErrorState } from './ErrorState'

type Tr = (ru: string, uz: string) => string

type Props = {
  children: ReactNode
  // 'app' — корневая граница (уносит вообще всё, включая сайдбар), 'page' — граница
  // одного раздела внутри .app-content.
  variant: 'app' | 'page'
  // Смена значения гасит экран ошибки. Ремаунт через key= здесь запрещён: редактор
  // списка после создания делает navigate(`/lists/:id/edit`, { replace: true }),
  // и пересборка поддерева стёрла бы только что набранный список.
  resetKey?: string
  // tr приходит пропсом, а не из useLanguage(): корневая граница стоит ВЫШЕ
  // LanguageProvider, и хук бросил бы прямо внутри того, что ловит ошибки.
  // Пропса нет — берём язык из localStorage тем же чтением, что и провайдер.
  tr?: Tr
}

type State = { error: Error | null }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: unknown): State {
    // Бросить можно что угодно, а показать надо строку: нормализуем на входе, чтобы
    // отрисовка фолбэка не стала вторым источником ошибки.
    if (error instanceof Error) return { error }
    try {
      return { error: new Error(String(error)) }
    } catch {
      // Приведение к строке само бросает (брошен объект с падающим toString). Для
      // корневой границы это конец дерева — падать здесь нельзя ни при каких данных.
      return { error: new Error('Unknown error') }
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportAppError(error, {
      scope: 'boundary',
      route: window.location.pathname,
      componentStack: info.componentStack ?? undefined,
      detail: { variant: this.props.variant },
    })
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const tr: Tr = this.props.tr ?? ((ru, uz) => (readStoredLanguage() === 'uz' ? uz : ru))
    return <ErrorFallback error={error} variant={this.props.variant} tr={tr} />
  }
}

function ErrorFallback({ error, variant, tr }: { error: Error; variant: 'app' | 'page'; tr: Tr }) {
  const block = (
    <ErrorState
      title={tr('Что-то сломалось', 'Nimadir buzildi')}
      text={tr('Раздел не удалось показать. Перезагрузите страницу — если не поможет, сообщите администратору.', 'Bo‘limni ko‘rsatib bo‘lmadi. Sahifani qayta yuklang — agar yordam bermasa, administratorga xabar bering.')}
      action={
        // Именно перезагрузка, а не «попробовать снова»: React.lazy запоминает отказ
        // загрузки чанка, и повторный рендер того же импорта упал бы снова.
        <button className="button button--secondary" type="button" onClick={() => window.location.reload()}>
          <RotateCw size={16} /> {tr('Перезагрузить', 'Qayta yuklash')}
        </button>
      }
    >
      {/* Ветка вырезается из прод-сборки целиком: import.meta.env.DEV — константа сборки. */}
      {import.meta.env.DEV && (
        <pre style={{ maxWidth: '100%', margin: '12px 0 0', overflow: 'auto', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
          {error.stack ?? error.message}
        </pre>
      )}
    </ErrorState>
  )

  // Под корневой границей нет ни сайдбара, ни .app-content: блоку нужна собственная
  // полноэкранная подложка того же цвета, что у загрузчика приложения.
  return variant === 'app' ? <main className="error-screen">{block}</main> : block
}
