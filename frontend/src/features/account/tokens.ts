import { useState, useEffect } from 'react'

export const KUWANA_STORAGE_KEY = 'fidelity.kuwana.tokens.v1'
export const DEFAULT_INITIAL_TOKENS = 250

export type TokenTransaction = {
  id: string
  feature: string
  amount: number
  description: string
  timestamp: string
}

export type KuwanaTokenState = {
  balance: number
  transactions: TokenTransaction[]
}

export const TOKEN_COSTS = {
  FLOWER_TRIBUTE: 10,
  AI_BIOGRAPHY: 15,
  STREAM_REPLAY: 20,
  SUNO_MUSIC: 25,
  AI_VIDEO: 30,
  EXHUMATION_ADVISORY: 50,
} as const

export function loadTokenState(): KuwanaTokenState {
  if (typeof window === 'undefined') {
    return { balance: DEFAULT_INITIAL_TOKENS, transactions: [] }
  }
  const raw = window.localStorage.getItem(KUWANA_STORAGE_KEY)
  if (!raw) {
    const initial: KuwanaTokenState = {
      balance: DEFAULT_INITIAL_TOKENS,
      transactions: [
        {
          id: 'tx-welcome',
          feature: 'welcome-grant',
          amount: DEFAULT_INITIAL_TOKENS,
          description: 'Initial Kuwana token grant for Fidelity Life portal',
          timestamp: new Date().toISOString(),
        },
      ],
    }
    window.localStorage.setItem(KUWANA_STORAGE_KEY, JSON.stringify(initial))
    return initial
  }
  try {
    return JSON.parse(raw) as KuwanaTokenState
  } catch {
    return { balance: DEFAULT_INITIAL_TOKENS, transactions: [] }
  }
}

export function saveTokenState(state: KuwanaTokenState): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(KUWANA_STORAGE_KEY, JSON.stringify(state))
}

export function deductTokens(amount: number, feature: string, description: string): boolean {
  const current = loadTokenState()
  if (current.balance < amount) return false
  const updated: KuwanaTokenState = {
    balance: current.balance - amount,
    transactions: [
      {
        id: `tx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        feature,
        amount: -amount,
        description,
        timestamp: new Date().toISOString(),
      },
      ...current.transactions,
    ],
  }
  saveTokenState(updated)
  window.dispatchEvent(new CustomEvent('kuwana-tokens-changed', { detail: updated }))
  return true
}

export function addTokens(amount: number, description = 'Kuwana token top-up'): void {
  const current = loadTokenState()
  const updated: KuwanaTokenState = {
    balance: current.balance + amount,
    transactions: [
      {
        id: `tx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        feature: 'top-up',
        amount,
        description,
        timestamp: new Date().toISOString(),
      },
      ...current.transactions,
    ],
  }
  saveTokenState(updated)
  window.dispatchEvent(new CustomEvent('kuwana-tokens-changed', { detail: updated }))
}

export function useKuwanaTokens() {
  const [tokens, setTokens] = useState<KuwanaTokenState>(() => loadTokenState())

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const custom = e as CustomEvent<KuwanaTokenState>
      if (custom.detail) setTokens(custom.detail)
      else setTokens(loadTokenState())
    }
    window.addEventListener('kuwana-tokens-changed', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener('kuwana-tokens-changed', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  return {
    balance: tokens.balance,
    transactions: tokens.transactions,
    spend: (amount: number, feature: string, description: string) => deductTokens(amount, feature, description),
    topUp: (amount: number, desc?: string) => addTokens(amount, desc),
  }
}
