import type { ContributionStatus, FamilyContribution, FamilyHistoryArchive, FamilyMember, FamilyVisibility } from './data'
import { nextMemberId } from './data'
import { seedFamilyHistory } from './seed'

const KEY = 'fidelity.mock.familyHistory'

function read(): FamilyHistoryArchive {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as FamilyHistoryArchive
  } catch {
    /* seed fallback */
  }
  const seed = seedFamilyHistory()
  localStorage.setItem(KEY, JSON.stringify(seed))
  return seed
}

function write(archive: FamilyHistoryArchive) {
  const next = { ...archive, updatedAt: new Date().toISOString() }
  localStorage.setItem(KEY, JSON.stringify(next))
  return next
}

export const familyHistoryStore = {
  get: (): FamilyHistoryArchive => read(),
  setVisibility: (visibility: FamilyVisibility) => write({ ...read(), visibility }),
  addMember: (
    input: Pick<FamilyMember, 'name' | 'relationship' | 'birthDate' | 'deathDate' | 'location' | 'bio' | 'memorialSlug' | 'photoUrl'>,
  ): { archive: FamilyHistoryArchive; updatedExisting: boolean } => {
    const archive = read()
    const normalized = input.name.trim().toLowerCase()
    const existing = archive.members.find((m) => m.name.trim().toLowerCase() === normalized)
    if (existing) {
      // Person is already on the family tree: update existing record only (no duplicate)
      const updatedMembers = archive.members.map((m) =>
        m.id === existing.id
          ? {
              ...m,
              relationship: input.relationship || m.relationship,
              birthDate: input.birthDate || m.birthDate,
              deathDate: input.deathDate || m.deathDate,
              location: input.location || m.location,
              bio: input.bio || m.bio,
              memorialSlug: input.memorialSlug || m.memorialSlug,
              photoUrl: input.photoUrl || m.photoUrl,
            }
          : m,
      )
      return { archive: write({ ...archive, members: updatedMembers }), updatedExisting: true }
    }
    const member: FamilyMember = { id: nextMemberId(), ...input }
    return { archive: write({ ...archive, members: [...archive.members, member] }), updatedExisting: false }
  },
  updateMember: (id: string, patch: Partial<FamilyMember>) => {
    const archive = read()
    return write({
      ...archive,
      members: archive.members.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })
  },
  addPhoto: (input: { url: string; caption?: string; year?: number }) => {
    const archive = read()
    const photo = { id: nextMemberId('fp'), ...input }
    return write({ ...archive, photos: [photo, ...archive.photos] })
  },
  reviewContribution: (id: string, status: ContributionStatus, reviewer: string) => {
    const archive = read()
    return write({
      ...archive,
      contributions: archive.contributions.map((c) => (c.id === id ? { ...c, status, reviewedAt: new Date().toISOString(), reviewer } : c)),
      records:
        status === 'approved'
          ? [
              {
                id: nextMemberId('fr'),
                title: archive.contributions.find((c) => c.id === id)?.summary ?? 'Approved contribution',
                kind: 'story',
                content: archive.contributions.find((c) => c.id === id)?.details ?? '',
                contributedBy: archive.contributions.find((c) => c.id === id)?.submittedBy ?? reviewer,
                status: 'approved',
                visibility: archive.visibility,
                addedAt: new Date().toISOString(),
              },
              ...archive.records,
            ]
          : archive.records,
    })
  },
  addContribution: (input: Pick<FamilyContribution, 'invitedName' | 'invitedEmail' | 'submittedBy' | 'summary' | 'details'>) => {
    const archive = read()
    const item: FamilyContribution = { id: nextMemberId('fc'), ...input, status: 'pending', submittedAt: new Date().toISOString() }
    return write({ ...archive, contributions: [item, ...archive.contributions] })
  },
}
