import { env } from '@/lib/env'
import { get, post } from '@/lib/http'
import { mockResponse } from '@/lib/mock'
import { readSessionUser } from '@/features/auth'
import type { AssistanceRequest, LinkPolicyInput, NewRequest, Policy } from './data'

const MOCK_READ_LATENCY_MS = 300
const MOCK_WRITE_LATENCY_MS = 400

const mockServer = () => import('./mock-store')

function mockUserId(): string {
  const user = readSessionUser()
  return user?.id || 'u-moyo'
}

/** The signed-in user's policy, or null if they haven't linked one. */
export async function getPolicy(signal?: AbortSignal): Promise<Policy | null> {
  if (!env.useMock) {
    try {
      const res = await get<Policy | undefined>('/me/policy', { signal })
      if (res !== undefined) return res
    } catch {
      // Fallback to demo mock store
    }
  }
  try {
    const server = await mockServer()
    return await mockResponse(server.getPolicy(mockUserId()), MOCK_READ_LATENCY_MS)
  } catch {
    return null
  }
}

export async function linkPolicy(input: LinkPolicyInput): Promise<Policy> {
  if (!env.useMock) {
    try {
      return await post<Policy>('/me/policy', input)
    } catch {
      // Fallback
    }
  }
  const server = await mockServer()
  const policy = server.linkPolicy(mockUserId(), input.policyNumber, input.idNumber)
  return mockResponse(policy, MOCK_WRITE_LATENCY_MS)
}

export async function listRequests(signal?: AbortSignal): Promise<AssistanceRequest[]> {
  if (!env.useMock) {
    try {
      return await get<AssistanceRequest[]>('/me/requests', { signal })
    } catch {
      // Fallback
    }
  }
  try {
    const server = await mockServer()
    return await mockResponse(server.listRequests(mockUserId()), MOCK_READ_LATENCY_MS)
  } catch {
    return []
  }
}

export async function createRequest(input: NewRequest): Promise<AssistanceRequest> {
  if (!env.useMock) {
    try {
      return await post<AssistanceRequest>('/me/requests', input)
    } catch {
      // Fallback
    }
  }
  const server = await mockServer()
  return mockResponse(server.createRequest(mockUserId(), input), MOCK_WRITE_LATENCY_MS)
}
