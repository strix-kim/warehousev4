import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './app/App'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { AuthProvider } from './features/auth/AuthProvider'
import { LanguageProvider } from './lib/i18n'
import { installGlobalErrorReporting, reportAppError } from './lib/reportAppError'
import './styles.css'

// Слушатели вешаются до createRoot: ошибка в самом рендере рута иначе осталась бы
// без канала.
installGlobalErrorReporting()

createRoot(document.getElementById('root')!, {
  // Штатные обработчики React 19 переопределяем всегда, включая разработку: иначе
  // ошибка, которую React отдал границе или пережил сам, в канал не попадёт и в
  // консоли будет выглядеть как чужая. Сам объект Error канал печатает в dev-ветке.
  // onCaughtError не задаём: пойманное границей докладывает сама граница
  // (componentDidCatch), и второй обработчик дал бы по два отчёта на одну ошибку —
  // с разными scope, так что дедуп канала их не сольёт.
  onUncaughtError: (error, errorInfo) => reportAppError(error, { scope: 'react', componentStack: errorInfo.componentStack }),
  onRecoverableError: (error, errorInfo) => reportAppError(error, { scope: 'react', componentStack: errorInfo.componentStack, detail: { recoverable: true } }),
}).render(
  <StrictMode>
    {/* Корневая граница — самая внешняя: она единственная переживает падение самих
        провайдеров (AuthProvider, LanguageProvider) и роутера. Экран у неё
        полноэкранный, потому что сайдбара под ней уже нет. */}
    <AppErrorBoundary variant="app">
      <BrowserRouter>
        <LanguageProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </LanguageProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>,
)
