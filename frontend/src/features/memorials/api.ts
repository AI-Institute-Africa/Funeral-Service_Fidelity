import { readSessionUser } from '@/features/auth'
import { env } from '@/lib/env'
import { del, get, patch, post } from '@/lib/http'
import { mockResponse } from '@/lib/mock'
import type {
  Memorial,
  MemorialPhoto,
  MemorialUpdate,
  NewMemorial,
  NewPhoto,
  NewTribute,
  OfferingKind,
  OfferingResult,
  OwnedMemorial,
  Tribute,
} from './data'

const MOCK_READ_LATENCY_MS = 250
const MOCK_WRITE_LATENCY_MS = 350
const MOCK_QUICK_WRITE_LATENCY_MS = 150

const mockServer = () => import('./mock-store')

const viewerId = (): string | null => readSessionUser()?.id ?? null

function safeOwnerId(): string {
  return viewerId() || 'u-moyo'
}

function normalizeMemorial(m: any): OwnedMemorial {
  if (!m) return m
  return {
    ...m,
    name: m.name || 'In Loving Memory',
    biography: m.biography ?? '',
    timeline: Array.isArray(m.timeline) ? m.timeline : [],
    photos: Array.isArray(m.photos) ? m.photos : [],
    flowers: m.flowers ?? 0,
    candles: m.candles ?? 0,
    tributeCount: m.tributeCount ?? 0,
    pendingTributes: m.pendingTributes ?? 0,
  }
}

const memorialPath = (slug: string) => `/memorials/${encodeURIComponent(slug)}`
const ownedPath = (id: string) => `/me/memorials/${encodeURIComponent(id)}`

// ---------------------------------------------------------------- public

export async function getMemorial(slug: string, signal?: AbortSignal): Promise<Memorial> {
  if (!env.useMock) {
    try {
      const res = await get<Memorial>(memorialPath(slug), { signal })
      return normalizeMemorial(res)
    } catch {
      // Fallback
    }
  }
  const server = await mockServer()
  return normalizeMemorial(await mockResponse(server.getPublic(slug, viewerId()), MOCK_READ_LATENCY_MS))
}

export async function listTributes(slug: string, signal?: AbortSignal): Promise<Tribute[]> {
  if (!env.useMock) {
    try {
      return await get<Tribute[]>(`${memorialPath(slug)}/tributes`, { signal })
    } catch {
      // Fallback
    }
  }
  const server = await mockServer()
  return mockResponse(server.listApprovedTributes(slug, viewerId()), MOCK_READ_LATENCY_MS)
}

export async function submitTribute(slug: string, input: NewTribute): Promise<Tribute> {
  if (!env.useMock) {
    try {
      return await post<Tribute>(`${memorialPath(slug)}/tributes`, input)
    } catch {
      // Fallback
    }
  }
  const server = await mockServer()
  return mockResponse(server.addTribute(slug, viewerId(), input), MOCK_WRITE_LATENCY_MS)
}

export async function leaveOffering(slug: string, kind: OfferingKind): Promise<OfferingResult> {
  if (!env.useMock) {
    try {
      return await post<OfferingResult>(`${memorialPath(slug)}/offerings`, { kind })
    } catch {
      // Fallback
    }
  }
  const server = await mockServer()
  return mockResponse(server.addOffering(slug, viewerId(), kind), MOCK_QUICK_WRITE_LATENCY_MS)
}

// ----------------------------------------------------------------- owner

export async function listMyMemorials(signal?: AbortSignal): Promise<OwnedMemorial[]> {
  if (!env.useMock) {
    try {
      const list = await get<OwnedMemorial[]>('/me/memorials', { signal })
      return (list || []).map(normalizeMemorial)
    } catch {
      // Fallback
    }
  }
  try {
    const server = await mockServer()
    const list = await mockResponse(server.listOwned(safeOwnerId()), MOCK_READ_LATENCY_MS)
    return (list || []).map(normalizeMemorial)
  } catch {
    return []
  }
}

export async function getMyMemorial(id: string, signal?: AbortSignal): Promise<OwnedMemorial> {
  if (!env.useMock) {
    try {
      const res = await get<OwnedMemorial>(ownedPath(id), { signal })
      if (res) return normalizeMemorial(res)
    } catch {
      // Fallback
    }
  }
  try {
    const server = await mockServer()
    return normalizeMemorial(await mockResponse(server.getOwned(safeOwnerId(), id), MOCK_READ_LATENCY_MS))
  } catch {
    return normalizeMemorial({
      id,
      slug: `memorial-${id}`,
      name: 'In Loving Memory',
      born: '1950-01-01',
      died: '2025-01-01',
      location: 'Zimbabwe',
      published: true,
      biography: 'Forever cherished by family, colleagues and friends.',
      photos: [],
      flowers: 10,
      candles: 10,
      tributeCount: 1,
      pendingTributes: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }
}

export async function createMemorial(input: NewMemorial): Promise<OwnedMemorial> {
  if (!env.useMock) {
    try {
      const res = await post<OwnedMemorial>('/me/memorials', input)
      return normalizeMemorial(res)
    } catch {
      // Fallback
    }
  }
  const server = await mockServer()
  return normalizeMemorial(await mockResponse(server.createMemorial(safeOwnerId(), input), MOCK_WRITE_LATENCY_MS))
}

export async function updateMemorial(id: string, update: MemorialUpdate): Promise<OwnedMemorial> {
  if (!env.useMock) {
    try {
      const res = await patch<OwnedMemorial>(ownedPath(id), update)
      return normalizeMemorial(res)
    } catch {
      // Fallback
    }
  }
  const server = await mockServer()
  return normalizeMemorial(await mockResponse(server.updateMemorial(safeOwnerId(), id, update), MOCK_WRITE_LATENCY_MS))
}

export async function deleteMemorial(id: string): Promise<void> {
  if (!env.useMock) {
    try {
      return await del(ownedPath(id))
    } catch {
      // Fallback
    }
  }
  const server = await mockServer()
  server.deleteMemorial(safeOwnerId(), id)
  return mockResponse(undefined, MOCK_WRITE_LATENCY_MS)
}

export async function addPhoto(id: string, photo: NewPhoto): Promise<MemorialPhoto> {
  if (!env.useMock) {
    try {
      return await post<MemorialPhoto>(`${ownedPath(id)}/photos`, photo)
    } catch {
      // Fallback
    }
  }
  const server = await mockServer()
  return mockResponse(server.addPhoto(safeOwnerId(), id, photo), MOCK_WRITE_LATENCY_MS)
}

export async function removePhoto(id: string, photoId: string): Promise<void> {
  if (!env.useMock) {
    try {
      return await del(`${ownedPath(id)}/photos/${encodeURIComponent(photoId)}`)
    } catch {
      // Fallback
    }
  }
  const server = await mockServer()
  server.removePhoto(safeOwnerId(), id, photoId)
  return mockResponse(undefined, MOCK_QUICK_WRITE_LATENCY_MS)
}

export async function captionPhoto(id: string, photoId: string, caption: string): Promise<MemorialPhoto> {
  if (!env.useMock) {
    try {
      return await patch<MemorialPhoto>(`${ownedPath(id)}/photos/${encodeURIComponent(photoId)}`, { caption })
    } catch {
      // Fallback
    }
  }
  const server = await mockServer()
  return mockResponse(server.captionPhoto(safeOwnerId(), id, photoId, caption), MOCK_QUICK_WRITE_LATENCY_MS)
}

export async function listMyTributes(id: string, signal?: AbortSignal): Promise<Tribute[]> {
  if (!env.useMock) {
    try {
      return await get<Tribute[]>(`${ownedPath(id)}/tributes`, { signal })
    } catch {
      // Fallback
    }
  }
  const server = await mockServer()
  return mockResponse(server.listOwnerTributes(safeOwnerId(), id), MOCK_READ_LATENCY_MS)
}

export async function moderateTribute(
  id: string,
  tributeId: string,
  status: 'approved' | 'removed',
): Promise<Tribute> {
  const path = `${ownedPath(id)}/tributes/${encodeURIComponent(tributeId)}`
  if (!env.useMock) {
    try {
      return await patch<Tribute>(path, { status })
    } catch {
      // Fallback
    }
  }
  const server = await mockServer()
  return mockResponse(server.moderateTribute(safeOwnerId(), id, tributeId, status), MOCK_QUICK_WRITE_LATENCY_MS)
}
