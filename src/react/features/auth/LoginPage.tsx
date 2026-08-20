import { ArrowRight, Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { LanguageSwitcher, useLanguage } from '../../lib/i18n'
import { isSupabaseConfigured } from '../../lib/supabase'

export function LoginPage() {
  const { session, signIn } = useAuth()
  const { tr } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (session) return <Navigate to="/" replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    // Провал конфигурации — не «неверный пароль»: без переменных окружения
    // клиента Supabase просто нет, и signIn упал бы в общий catch, обвинив
    // пользователя. Гейт сборки ловит пустые переменные, но не протухший ключ.
    if (!isSupabaseConfigured) {
      setError(tr(
        'Приложение не настроено: нет связи с сервером данных. Сообщите администратору.',
        'Ilova sozlanmagan: ma’lumotlar serveri bilan aloqa yo‘q. Administratorga xabar bering.',
      ))
      return
    }

    setIsSubmitting(true)

    try {
      await signIn(email.trim(), password)
    } catch {
      setError(tr('Не удалось войти. Проверьте логин и пароль.', 'Kirish amalga oshmadi. Login va parolni tekshiring.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand-panel" aria-label="ARGO Warehouse">
        <div className="brand-lockup brand-lockup--light">
          <span className="brand-mark">A</span>
          <span className="brand-name">ARGO</span>
        </div>
        <div className="login-brand-copy">
          <p className="eyebrow eyebrow--light">{tr('Внутренняя система', 'Ichki tizim')}</p>
          <h1>{tr('Оборудование всегда под контролем.', 'Uskunalar doimo nazorat ostida.')}</h1>
          <p>{tr('Каталог, комплектация и документы для каждого проекта — в одном рабочем пространстве.', 'Har bir loyiha uchun katalog, jamlanma va hujjatlar — bitta ish maydonida.')}</p>
        </div>
        <img className="login-brand-illustration" src="/illustrations/av-warehouse.webp" alt="" aria-hidden="true" loading="eager" decoding="async" fetchPriority="high" />
        <p className="login-version">WAREHOUSE · 2026</p>
      </section>

      <section className="login-form-panel">
        <form className="login-card" onSubmit={handleSubmit}>
          <LanguageSwitcher />
          <div className="login-icon" aria-hidden="true"><LockKeyhole size={22} /></div>
          <p className="eyebrow">{tr('Доступ сотрудника', 'Xodim kirishi')}</p>
          <h2>{tr('Вход в систему', 'Tizimga kirish')}</h2>
          <p className="muted">{tr('Используйте учётную запись ARGO Media.', 'ARGO Media hisobidan foydalaning.')}</p>

          <label className="field">
            <span>{tr('Электронная почта', 'Elektron pochta')}</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@argomedia.uz"
              autoComplete="username"
              required
            />
          </label>

          <label className="field">
            <span>{tr('Пароль', 'Parol')}</span>
            <span className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="icon-button icon-button--inside"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? tr('Скрыть пароль', 'Parolni yashirish') : tr('Показать пароль', 'Parolni ko‘rsatish')}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>

          {error && <p className="form-error" role="alert">{error}</p>}

          <button className="button button--primary button--wide" disabled={isSubmitting}>
            {isSubmitting ? tr('Входим…', 'Kirilmoqda…') : tr('Войти', 'Kirish')}
            {!isSubmitting && <ArrowRight size={18} />}
          </button>
        </form>
      </section>
    </main>
  )
}
