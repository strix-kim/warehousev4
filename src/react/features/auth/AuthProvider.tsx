import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { purgeCacheScope, setCacheScope } from '../../lib/persistentCache'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'

// Почему человек оказался на экране входа: сам нажал «Выйти» или сеанс
// кончился без него (протух refresh-токен, выход в другой вкладке). Живёт только
// в памяти: после перезагрузки /login ничего не объясняет — объяснять уже нечего.
export type SignOutReason = 'manual' | 'ended'

type AuthContextValue = {
  session: Session | null
  isLoading: boolean
  signOutReason: SignOutReason | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [signOutReason, setSignOutReason] = useState<SignOutReason | null>(null)
  // Метка «этот SIGNED_OUT заказали мы». Ставится до вызова supabase.auth.signOut:
  // событие приходит изнутри него, раньше, чем промис разрешится.
  const signOutIntentRef = useRef<SignOutReason | null>(null)
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
    // На первом заходе без сессии SIGNED_OUT НЕ приходит (auth-js 2.70:
    // _recoverAndRefresh снимает сессию только если в хранилище что-то лежало),
    // поэтому 'ended' видит лишь тот, у кого сеанс действительно был и кончился.
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'SIGNED_OUT') {
        setSignOutReason(signOutIntentRef.current ?? 'ended')
        signOutIntentRef.current = null
      } else if (event === 'SIGNED_IN') {
        setSignOutReason(null)
      }
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
      signOutReason,
      async signIn(email, password) {
        if (!isSupabaseConfigured || !supabase) {
          throw new Error('Supabase не настроен. Добавьте переменные окружения.')
        }

        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      },
      async signOut() {
        if (!supabase) return
        signOutIntentRef.current = 'manual'
        try {
          const { error } = await supabase.auth.signOut()
          if (error) throw error
        } catch (error) {
          // Выход не состоялся — метка не должна дожить до чужого SIGNED_OUT и
          // выдать истёкший сеанс за нажатую кнопку.
          signOutIntentRef.current = null
          throw error
        }
      },
    }),
    [isLoading, session, signOutReason],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth должен использоваться внутри AuthProvider')
  return value
}
