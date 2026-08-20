import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { purgeCacheScope, setCacheScope } from '../../lib/persistentCache'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'

type AuthContextValue = {
  session: Session | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  // Кому сейчас принадлежит кэш. Нужен именно предыдущий id: на выходе стирать
  // приходится ключи того, кто ушёл, а в новой сессии его id уже недоступен.
  const scopedUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    // Кэш переезжает на нового владельца ДО setSession: AppShell со своими
    // прогревочными таймерами монтируется уже после этого, то есть прогрев
    // всегда пишет в scope вошедшего пользователя.
    function applyCacheScope(nextSession: Session | null) {
      const nextUserId = nextSession?.user.id ?? null
      const previousUserId = scopedUserIdRef.current
      if (previousUserId && previousUserId !== nextUserId) purgeCacheScope(previousUserId)
      scopedUserIdRef.current = nextUserId
      setCacheScope(nextUserId)
    }

    if (!supabase) {
      setIsLoading(false)
      return
    }

    let isCurrent = true
    supabase.auth.getSession()
      .then(({ data }) => {
        if (!isCurrent) return
        applyCacheScope(data.session)
        setSession(data.session)
      })
      .catch(() => {
        if (!isCurrent) return
        applyCacheScope(null)
        setSession(null)
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })

    // Сюда же приходит SIGNED_OUT — и из нашей кнопки выхода, и из другой вкладки.
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applyCacheScope(nextSession)
      setSession(nextSession)
      setIsLoading(false)
    })

    return () => {
      isCurrent = false
      data.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      async signIn(email, password) {
        if (!isSupabaseConfigured || !supabase) {
          throw new Error('Supabase не настроен. Добавьте переменные окружения.')
        }

        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      },
      async signOut() {
        if (!supabase) return
        const { error } = await supabase.auth.signOut()
        if (error) throw error
      },
    }),
    [isLoading, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth должен использоваться внутри AuthProvider')
  return value
}
