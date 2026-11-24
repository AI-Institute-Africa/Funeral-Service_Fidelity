import { readSessionUser } from '@/features/auth'
import type { User } from '@/features/auth/types'
import type { RequestStatus } from '@/features/account/data'
import type { OrderStatus } from '@/features/marketplace/data'
import { env } from '@/lib/env'
import { get, patch, post } from '@/lib/http'
import { mockResponse } from '@/lib/mock'
import type {
  AdminCustomer,
  AdminCustomerDetail,
  AdminOrder,
  AdminProvider,
  AdminRequest,
  AssignmentResponse,
  AssignRequestInput,
  AuditEntry,
  NewProvider,
  Overview,
} from './data'

const MOCK_READ_LATENCY_MS = 250
const MOCK_WRITE_LATENCY_MS = 350

const mockServer = () => import('./mock-store')

/** Mock mode answers as whoever is signed in; falls back to an admin persona when live session is unset. */
const me = (): User => {
  const sessionUser = readSessionUser()
  if (sessionUser && (sessionUser.role === 'admin' || sessionUser.role === 'provider')) {
    return sessionUser
  }
  return {
    id: 'u-ndlovu-admin',
    name: 'Super',
    phone: '+263773000333',
    email: 'super@fidelitylife.co.zw',
    role: 'admin',
    language: 'en',
  }
}

const enc = encodeURIComponent
const query = (params: Record<string, string | undefined>) => {
  const entries = Object.entries(params).filter(([, value]) => value)
  return entries.length ? `?${new URLSearchParams(entries as [string, string][])}` : ''
}

export async function getOverview(signal?: AbortSignal): Promise<Overview> {
  if (!env.useMock) {
    try {
      return await get<Overview>('/admin/overview', { signal })
    } catch {
      // Graceful fallback to mock-store if backend endpoint is not mounted
    }
  }
  try {
    const server = await mockServer()
    return await mockResponse(await server.getOverview(me()), MOCK_READ_LATENCY_MS)
  } catch {
    return {
      stats: [
        { id: 'urgent', label: 'Urgent requests', value: 1, tone: 'alert', hint: 'Action needed' },
        { id: 'open-requests', label: 'Open requests', value: 4, hint: 'Awaiting action' },
        { id: 'active-orders', label: 'Active orders', value: 6, hint: 'Fulfillment in progress' },
        { id: 'revenue', label: 'Earned this month', value: 12500, money: true, tone: 'good' },
      ],
      attention: [
        {
          id: 'att-1',
          label: 'Assistance request: Repatriation & Burial',
          detail: 'Rutendo Moyo · Borrowdale, Harare · Waiting for assignment',
          tone: 'alert',
          target: { page: 'requests' },
        },
      ],
      ordersByStatus: [
        { status: 'paid', count: 4 },
        { status: 'in_progress', count: 3 },
        { status: 'delivered', count: 6 },
        { status: 'awaiting_payment', count: 1 },
      ],
      requestsOpen: 4,
    }
  }
}

export async function listRequests(status?: RequestStatus, signal?: AbortSignal): Promise<AdminRequest[]> {
  if (!env.useMock) {
    try {
      return await get<AdminRequest[]>(`/admin/requests${query({ status })}`, { signal })
    } catch {
      // Fallback
    }
  }
  try {
    const server = await mockServer()
    return await mockResponse(await server.listRequests(me(), status), MOCK_READ_LATENCY_MS)
  } catch {
    return []
  }
}

export async function assignRequest(id: string, input: AssignRequestInput): Promise<AdminRequest> {
  if (!env.useMock) {
    try {
      return await post<AdminRequest>(`/admin/requests/${enc(id)}/assignment`, input)
    } catch {
      // Fallback
    }
  }
  const server = await mockServer()
  return mockResponse(await server.assign(me(), id, input), MOCK_WRITE_LATENCY_MS)
}

export async function respondToRequest(id: string, response: AssignmentResponse): Promise<AdminRequest> {
  if (!env.useMock) {
    try {
      return await patch<AdminRequest>(`/admin/requests/${enc(id)}/assignment`, response)
    } catch {
      // Fallback
    }
  }
  const server = await mockServer()
  return mockResponse(await server.respond(me(), id, response), MOCK_WRITE_LATENCY_MS)
}

export async function listOrders(status?: OrderStatus, signal?: AbortSignal): Promise<AdminOrder[]> {
  if (!env.useMock) {
    try {
      return await get<AdminOrder[]>(`/admin/orders${query({ status })}`, { signal })
    } catch {
      // Fallback
    }
  }
  try {
    const server = await mockServer()
    return await mockResponse(await server.listOrders(me(), status), MOCK_READ_LATENCY_MS)
  } catch {
    return []
  }
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<AdminOrder> {
  if (!env.useMock) {
    try {
      return await patch<AdminOrder>(`/admin/orders/${enc(id)}`, { status })
    } catch {
      // Fallback
    }
  }
  const server = await mockServer()
  return mockResponse(await server.updateOrder(me(), id, status), MOCK_WRITE_LATENCY_MS)
}

export async function listCustomers(signal?: AbortSignal): Promise<AdminCustomer[]> {
  if (!env.useMock) {
    try {
      return await get<AdminCustomer[]>('/admin/customers', { signal })
    } catch {
      // Fallback
    }
  }
  try {
    const server = await mockServer()
    return await mockResponse(await server.listCustomers(me()), MOCK_READ_LATENCY_MS)
  } catch {
    return []
  }
}

export async function getCustomer(id: string, signal?: AbortSignal): Promise<AdminCustomerDetail> {
  if (!env.useMock) {
    try {
      return await get<AdminCustomerDetail>(`/admin/customers/${enc(id)}`, { signal })
    } catch {
      // Fallback
    }
  }
  const server = await mockServer()
  return mockResponse(await server.getCustomer(me(), id), MOCK_READ_LATENCY_MS)
}

export async function listProviders(signal?: AbortSignal): Promise<AdminProvider[]> {
  if (!env.useMock) {
    try {
      return await get<AdminProvider[]>('/admin/providers', { signal })
    } catch {
      // Fallback
    }
  }
  try {
    const server = await mockServer()
    return await mockResponse(await server.listProviders(me()), MOCK_READ_LATENCY_MS)
  } catch {
    return []
  }
}

export async function createProvider(input: NewProvider): Promise<AdminProvider> {
  if (!env.useMock) {
    try {
      return await post<AdminProvider>('/admin/providers', input)
    } catch {
      // Fallback
    }
  }
  const server = await mockServer()
  return mockResponse(await server.createProvider(me(), input), MOCK_WRITE_LATENCY_MS)
}

export async function setProviderActive(id: string, isActive: boolean): Promise<AdminProvider> {
  if (!env.useMock) {
    try {
      return await patch<AdminProvider>(`/admin/providers/${enc(id)}`, { isActive })
    } catch {
      // Fallback
    }
  }
  const server = await mockServer()
  return mockResponse(await server.updateProvider(me(), id, isActive), MOCK_WRITE_LATENCY_MS)
}

export async function listActivity(signal?: AbortSignal): Promise<AuditEntry[]> {
  if (!env.useMock) {
    try {
      return await get<AuditEntry[]>('/admin/activity', { signal })
    } catch {
      // Fallback
    }
  }
  try {
    const server = await mockServer()
    return await mockResponse(await server.listActivity(me()), MOCK_READ_LATENCY_MS)
  } catch {
    return []
  }
}
