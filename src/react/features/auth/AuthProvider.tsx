import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
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

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false)
      return
    }

    let isCurrent = true
    supabase.auth.getSession()
      .then(({ data }) => {
        if (isCurrent) setSession(data.session)
      })
      .catch(() => {
        if (isCurrent) setSession(null)
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
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
