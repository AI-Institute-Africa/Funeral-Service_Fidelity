import { normaliseInternationalPhone } from '../../lib/phone'

export type StreamStatus = 'scheduled' | 'live' | 'ended' | 'unavailable'
export type ViewerStatus = 'invited' | 'accessed' | 'revoked'

export type StreamViewer = {
  id: string
  name: string
  contact: string
  status: ViewerStatus
  invitedAt: string
  accessedAt?: string
  consentForAlerts?: boolean
}

export type FuneralStream = {
  id: string
  personName: string
  serviceTitle: string
  date: string
  time: string
  venue: string
  details: string
  status: StreamStatus
  viewers: StreamViewer[]
  recordingAvailable: boolean
  savedToArchiveId?: string
  updatedAt: string
}

export const statusLabels: Record<StreamStatus, string> = {
  scheduled: 'Scheduled',
  live: 'Live',
  ended: 'Ended',
  unavailable: 'Unavailable',
}

export const statusTone: Record<StreamStatus, 'neutral' | 'danger' | 'success' | 'warning' | 'info'> = {
  scheduled: 'info',
  live: 'danger',
  ended: 'success',
  unavailable: 'warning',
}

export const nextId = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export function streamViewerForUser(
  stream: FuneralStream,
  user: { phone: string; email?: string },
): StreamViewer | undefined {
  const phone = normaliseInternationalPhone(user.phone)
  const email = user.email?.trim().toLowerCase()
  return stream.viewers.find((viewer) => {
    if (viewer.status === 'revoked') return false
    const viewerPhone = normaliseInternationalPhone(viewer.contact)
    if (phone && viewerPhone === phone) return true
    return Boolean(email && viewer.contact.trim().toLowerCase() === email)
  })
}
