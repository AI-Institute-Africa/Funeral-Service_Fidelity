import type { FlowerTribute, PlotEnquiry } from './data'

const ENQUIRIES_KEY = 'fidelity.mock.plotEnquiries'
const FLOWERS_KEY = 'fidelity.cemeteries.flowers.v1'

const INITIAL_FLOWERS: FlowerTribute[] = [
  {
    id: 'fl-1',
    graveId: 'gr-1',
    giverName: 'Farai & Chipo Moyo',
    message: 'Always in our thoughts and forever in our hearts, Baba.',
    flowerType: 'white-lilies',
    createdAt: '2026-11-15T10:30:00.000Z',
  },
  {
    id: 'fl-2',
    graveId: 'gr-4',
    giverName: 'Tariro Nyathi (UK)',
    message: 'Rest peacefully, Ambuya. We miss your laughter and love.',
    flowerType: 'red-roses',
    createdAt: '2026-11-18T14:15:00.000Z',
  },
]

function readStorage<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as T[]
  } catch {
    /* storage unavailable */
  }
  return fallback
}

export const plotEnquiryStore = {
  list: () => readStorage<PlotEnquiry>(ENQUIRIES_KEY, []),
  add: (e: Omit<PlotEnquiry, 'id' | 'createdAt'>): PlotEnquiry => {
    const item = { ...e, id: `pe-${Date.now().toString(36)}`, createdAt: new Date().toISOString() }
    try {
      localStorage.setItem(ENQUIRIES_KEY, JSON.stringify([item, ...readStorage<PlotEnquiry>(ENQUIRIES_KEY, [])]))
    } catch {
      /* storage unavailable */
    }
    return item
  },
}

export const flowerTributeStore = {
  listByGrave: (graveId: string): FlowerTribute[] => {
    const all = readStorage<FlowerTribute>(FLOWERS_KEY, INITIAL_FLOWERS)
    return all.filter((f) => f.graveId === graveId)
  },
  add: (tribute: Omit<FlowerTribute, 'id' | 'createdAt'>): FlowerTribute => {
    const item: FlowerTribute = {
      ...tribute,
      id: `fl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
    }
    const current = readStorage<FlowerTribute>(FLOWERS_KEY, INITIAL_FLOWERS)
    const updated = [item, ...current]
    try {
      localStorage.setItem(FLOWERS_KEY, JSON.stringify(updated))
    } catch {
      /* storage unavailable */
    }
    window.dispatchEvent(new CustomEvent('flowers-updated', { detail: { graveId: tribute.graveId } }))
    return item
  },
}
