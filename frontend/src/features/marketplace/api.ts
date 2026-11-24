import { readSessionUser } from '@/features/auth'
import { env } from '@/lib/env'
import { get, post } from '@/lib/http'
import { mockResponse } from '@/lib/mock'
import { readInactiveProviders } from '@/lib/mock-flags'
import { activeCatalogue } from './catalogue'
import { marketplaceItems, type MarketplaceItem, type NewOrder, type Order, type PaymentInput } from './data'

const MOCK_READ_LATENCY_MS = 250
const MOCK_WRITE_LATENCY_MS = 350

const mockServer = () => import('./mock-store')

function mockUserId(): string {
  const user = readSessionUser()
  return user?.id || 'u-moyo'
}

const orderPath = (id: string) => `/me/orders/${encodeURIComponent(id)}`

/** Mock mode: the catalogue minus products of providers the administrator switched off. */
export const visibleCatalogue = (): MarketplaceItem[] => activeCatalogue(marketplaceItems, readInactiveProviders())

export async function listMarketplaceItems(signal?: AbortSignal): Promise<MarketplaceItem[]> {
  if (!env.useMock) {
    try {
      const items = await get<MarketplaceItem[]>('/marketplace/items', { signal })
      if (items && items.length) return items
    } catch {
      // Fallback
    }
  }
  return mockResponse(visibleCatalogue(), MOCK_READ_LATENCY_MS)
}

export async function listOrders(signal?: AbortSignal): Promise<Order[]> {
  if (!env.useMock) {
    try {
      const orders = await get<Order[]>('/me/orders', { signal })
      if (orders) return orders
    } catch {
      // Fallback
    }
  }
  try {
    const server = await mockServer()
    return await mockResponse(server.listOrders(mockUserId()), MOCK_READ_LATENCY_MS)
  } catch {
    return []
  }
}

export async function getOrder(id: string, signal?: AbortSignal): Promise<Order> {
  if (!env.useMock) {
    try {
      const order = await get<Order>(orderPath(id), { signal })
      if (order) return order
    } catch {
      // Fallback
    }
  }
  const server = await mockServer()
  return mockResponse(server.getOrder(mockUserId(), id), 120)
}

export async function createOrder(input: NewOrder): Promise<Order> {
  if (!env.useMock) {
    try {
      const created = await post<Order>('/me/orders', input)
      if (created) return created
    } catch {
      // Fallback
    }
  }
  const server = await mockServer()
  return mockResponse(server.createOrder(mockUserId(), input), MOCK_WRITE_LATENCY_MS)
}

export async function payOrder(id: string, payment: PaymentInput): Promise<Order> {
  if (!env.useMock) {
    try {
      const paid = await post<Order>(`${orderPath(id)}/payment`, payment)
      if (paid) return paid
    } catch {
      // Fallback
    }
  }
  const server = await mockServer()
  return mockResponse(server.payOrder(mockUserId(), id, payment), MOCK_WRITE_LATENCY_MS)
}

export async function resolveHostedPayment(id: string, outcome: 'paid' | 'failed'): Promise<Order> {
  const server = await mockServer()
  return mockResponse(server.resolveHostedPayment(mockUserId(), id, outcome), MOCK_WRITE_LATENCY_MS)
}
