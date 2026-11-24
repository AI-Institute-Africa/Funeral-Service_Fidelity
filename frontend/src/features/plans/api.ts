import { env } from '@/lib/env'
import { get, post } from '@/lib/http'
import { mockResponse } from '@/lib/mock'
import { plans, type Plan } from './data'
import { estimateTotal, type ServiceType, type Town } from './pricing'

export type QuoteRequest = {
  planId: string
  serviceType: ServiceType
  town: Town
}

export type QuoteReceipt = {
  id: string
  /** Human-readable reference a family can quote when they phone the provider. */
  reference: string
  /** Authoritative total computed by the server; the client-side figure is only a preview. */
  estimatedTotal: number
}

const MOCK_SUBMIT_LATENCY_MS = 600

export async function listPlans(signal?: AbortSignal): Promise<Plan[]> {
  if (!env.useMock) {
    try {
      const data = await get<Plan[]>('/plans', { signal })
      if (data && data.length) return data
    } catch {
      // Fallback
    }
  }
  return mockResponse(plans)
}

export async function submitQuoteRequest(request: QuoteRequest): Promise<QuoteReceipt> {
  if (!env.useMock) {
    try {
      return await post<QuoteReceipt>('/quote-requests', request)
    } catch {
      // Fallback
    }
  }

  const plan = plans.find((candidate) => candidate.id === request.planId)
  const reference = `SAMPLE-${Math.floor(1000 + Math.random() * 9000)}`
  return mockResponse(
    { id: reference.toLowerCase(), reference, estimatedTotal: plan ? estimateTotal(plan, request.town, request.serviceType) : 150 },
    MOCK_SUBMIT_LATENCY_MS,
  )
}
