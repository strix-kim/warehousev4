import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useLanguage } from '../../lib/i18n'

// Липкая шапка редактора. Строка состояния считается на странице: тот же узел
// стоит и в подвале выборки на телефоне.
export function ListEditorHeader({ title, statusTone, statusBody, actions, onBack }: {
  title: string
  statusTone: string
  statusBody: ReactNode
  actions: ReactNode
  onBack: () => void
}) {
  const { tr } = useLanguage()

  return (
    <header className="editor-header editor-header--quick">
      <button className="icon-button icon-button--bordered" onClick={onBack} aria-label={tr('Назад к спискам', 'Ro‘yxatlarga qaytish')}>
        <ArrowLeft size={18} />
      </button>
      <div>
        <p className={`editor-status ${statusTone ? `editor-status--${statusTone}` : ''}`} role="status">{statusBody}</p>
        <h1>{title}</h1>
      </div>
      <div className="editor-header__actions">{actions}</div>
    </header>
  )
}
