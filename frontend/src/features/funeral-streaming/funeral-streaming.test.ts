import { describe, expect, it } from 'vitest'
import { streamViewerForUser } from './data'
import { seedStreams } from './seed'

describe('recording access', () => {
  const stream = seedStreams()[0]

  it('matches invited accounts by email or normalized phone number', () => {
    expect(streamViewerForUser(stream, { phone: '+263771234567', email: 'SAMUEL@example.com' })?.id).toBe('sv1')
    expect(streamViewerForUser(stream, { phone: '0771112222' })?.id).toBe('sv2')
  })

  it('does not grant access to an uninvited or revoked account', () => {
    expect(streamViewerForUser(stream, { phone: '+263771234568' })).toBeUndefined()
    const revoked = { ...stream, viewers: stream.viewers.map((viewer) => ({ ...viewer, status: 'revoked' as const })) }
    expect(streamViewerForUser(revoked, { phone: '+263771234567', email: 'samuel@example.com' })).toBeUndefined()
  })
})
