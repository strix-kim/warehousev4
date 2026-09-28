import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useLanguage } from '../../lib/i18n'

// Тон точки состояния документа: 'warning' — есть несохранённые правки,
// 'success' — совпадает с базой, 'neutral' — новый список, которому сохранение
// необязательно. null — точки нет: на её месте результат действия.
export type EditorStatusDot = 'warning' | 'success' | 'neutral' | null

// Липкая шапка редактора. Строка состояния считается на странице: тот же узел
// стоит и в подвале выборки на телефоне.
export function ListEditorHeader({ title, statusTone, statusDot, statusBody, actions, onBack }: {
  title: string
  statusTone: string
  statusDot: EditorStatusDot
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
        <p className={`editor-status ${statusTone ? `editor-status--${statusTone}` : ''}`} role="status">
          <span className="editor-status__kind">{tr('Список оборудования', 'Uskunalar ro‘yxati')}</span>
          <span className="editor-status__state">
            {statusDot && <i className={`status-dot ${statusDot === 'neutral' ? '' : `status-dot--${statusDot}`}`} aria-hidden="true" />}
            <span>{statusBody}</span>
          </span>
        </p>
        <h1>{title}</h1>
      </div>
      <div className="editor-header__actions">{actions}</div>
    </header>
  )
}
