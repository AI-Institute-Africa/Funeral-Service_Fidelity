/** BRD 6.1: smart cemetery, plot and grave-record data with Google Maps coordinates and floral tributes. */

export type PlotAvailability = 'available' | 'limited' | 'full'

export type Cemetery = {
  id: string
  name: string
  town: string
  region: string
  about: string
  directions: string
  phone: string
  email: string
  hours: string
  availability: PlotAvailability
  /** Published plot guidance, in USD. 0 means the operator has not published prices. */
  plotFrom: number
  plotTo: number
  sections: string[]
  lat: number
  lng: number
}

export type FlowerTribute = {
  id: string
  graveId: string
  giverName: string
  message: string
  flowerType: 'white-lilies' | 'red-roses' | 'sunflower-wreath' | 'zimbabwe-protea' | 'candle'
  kind?: 'flower' | 'candle'
  mapX?: number
  mapY?: number
  createdAt: string
}

export type GraveRecord = {
  id: string
  fullName: string
  birthYear: number
  deathYear: number
  cemeteryId: string
  section: string
  plot: string
  lat: number
  lng: number
  walkingDirections: string
  /** Unverified records are listed with a warning rather than as a confirmed match. */
  verified: boolean
}

export type PlotEnquiry = {
  id: string
  cemeteryId: string
  name: string
  contact: string
  kind: 'purchase' | 'reserve' | 'information'
  message: string
  createdAt: string
}

export const availabilityLabels: Record<PlotAvailability, string> = {
  available: 'Plots available',
  limited: 'Limited plots',
  full: 'No plots published',
}

export const FLOWER_VARIETIES = [
  { id: 'white-lilies', name: 'Pure White Lilies', symbol: 'Purity, Peace & Dignity', icon: '🌸' },
  { id: 'red-roses', name: 'Velvet Red Roses', symbol: 'Deep Love & Everlasting Respect', icon: '🌹' },
  { id: 'sunflower-wreath', name: 'Golden Sunflower Wreath', symbol: 'Warmth & Joyful Spirit', icon: '🌻' },
  { id: 'zimbabwe-protea', name: 'Everlasting Protea', symbol: 'Resilience, Strength & Heritage', icon: '🌺' },
  { id: 'candle', name: 'Eternal Vigil Candle', symbol: 'Light, Prayer & Remembrance', icon: '🕯️' },
] as const

export const cemeteries: Cemetery[] = [
  {
    id: 'cem-1',
    name: 'Warren Hills Memorial Park',
    town: 'Harare',
    region: 'Harare West',
    about: 'One of Harare’s premier established memorial parks featuring tranquil lawns, private chapels, and dedicated memorial gardens.',
    directions: 'Off Kirkman Road (Solomon Mujuru Drive), 1.2km past the roundabout. Security gate on the left.',
    phone: '+263 242 750 811',
    email: 'warrenhills@fidelitylife.co.zw',
    hours: 'Daily 06:30 to 18:00',
    availability: 'available',
    plotFrom: 450,
    plotTo: 1200,
    sections: ['Lawn A', 'Section B', 'Section C', 'Garden of Remembrance'],
    lat: -17.8284,
    lng: 31.0021,
  },
  {
    id: 'cem-2',
    name: 'Glen Forest Memorial Park',
    town: 'Harare',
    region: 'Harare North',
    about: 'Modern landscaped private memorial sanctuary offering perpetual maintenance, modern security, and scenic rolling hills.',
    directions: 'Borrowdale Road past Pomona, turn onto Glen Forest Road, follow signs for 3km.',
    phone: '+263 771 417 719',
    email: 'glenforest@fidelitylife.co.zw',
    hours: 'Daily 07:00 to 17:30',
    availability: 'available',
    plotFrom: 800,
    plotTo: 2500,
    sections: ['Cedar Heights', 'Acacia Terraces', 'The Sanctuary', 'Rose Garden'],
    lat: -17.674,
    lng: 31.147,
  },
  {
    id: 'cem-3',
    name: 'Granville Cemetery (Mbudzi)',
    town: 'Harare',
    region: 'Harare South',
    about: 'Major Harare municipal cemetery with extensive historical and newly developed community burial sections.',
    directions: 'Along Simon Mazorodze Road just past the Mbudzi interchange; access via the eastern gate.',
    phone: '+263 242 621 110',
    email: 'granville@fidelitylife.co.zw',
    hours: 'Daily 06:30 to 17:00',
    availability: 'limited',
    plotFrom: 200,
    plotTo: 450,
    sections: ['Old Section', 'Section East', 'West Lawn'],
    lat: -17.925,
    lng: 30.981,
  },
  {
    id: 'cem-4',
    name: 'West Park Memorial Cemetery',
    town: 'Bulawayo',
    region: 'Bulawayo Central',
    about: 'Bulawayo’s primary civic cemetery with well-curated tree-lined avenues and designated civic memorials.',
    directions: 'Off Luveve Road, adjacent to Mpilo Central Hospital grounds.',
    phone: '+263 292 881 220',
    email: 'westpark@fidelitylife.co.zw',
    hours: 'Daily 07:00 to 17:00',
    availability: 'limited',
    plotFrom: 300,
    plotTo: 850,
    sections: ['Section 1', 'Section 2', 'Memorial Lawn'],
    lat: -20.158,
    lng: 28.561,
  },
  {
    id: 'cem-5',
    name: 'Zororo Memorial Park',
    town: 'Chitungwiza / Harare South',
    region: 'Chitungwiza',
    about: 'Private parkland memorial cemetery with manicured lawn burial plots, chapel facilities, and water features.',
    directions: 'Seke Road toward Chitungwiza, turn left onto Tilcor Road, 2km on the right.',
    phone: '+263 774 888 999',
    email: 'zororo@fidelitylife.co.zw',
    hours: 'Daily 07:00 to 17:00',
    availability: 'available',
    plotFrom: 500,
    plotTo: 1400,
    sections: ['Peace Garden', 'Heritage Lawn', 'Dignity Section'],
    lat: -17.989,
    lng: 31.052,
  },
]

export const graveRecords: GraveRecord[] = [
  {
    id: 'gr-1',
    fullName: 'Tendai Moyo',
    birthYear: 1948,
    deathYear: 2021,
    cemeteryId: 'cem-1',
    section: 'Section B',
    plot: 'B-114',
    lat: -17.8291,
    lng: 31.0028,
    walkingDirections: 'From the main chapel entrance, walk 120m East along the Jacaranda path to Section B, 4th row, plot 114.',
    verified: true,
  },
  {
    id: 'gr-2',
    fullName: 'Rudo Chikwanha',
    birthYear: 1955,
    deathYear: 2019,
    cemeteryId: 'cem-3',
    section: 'Section East',
    plot: 'E-32',
    lat: -17.9255,
    lng: 30.9818,
    walkingDirections: 'Enter via Eastern gate, proceed 80m South toward the water tower, plot E-32 is marked with polished granite.',
    verified: true,
  },
  {
    id: 'gr-3',
    fullName: 'Sipho Ndlovu',
    birthYear: 1962,
    deathYear: 2023,
    cemeteryId: 'cem-4',
    section: 'Section 1',
    plot: 'T-09',
    lat: -20.1585,
    lng: 28.5615,
    walkingDirections: 'From Luveve road gate, follow central avenue for 150m, Section 1 on the left, row 2, plot T-09.',
    verified: true,
  },
  {
    id: 'gr-4',
    fullName: 'Grace Nyathi',
    birthYear: 1942,
    deathYear: 2024,
    cemeteryId: 'cem-2',
    section: 'Rose Garden',
    plot: 'RG-18',
    lat: -17.6745,
    lng: 31.1475,
    walkingDirections: 'Enter Glen Forest gates, follow Rose Walk for 200m North, plot RG-18 overlooks the lily pond.',
    verified: true,
  },
]

export const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

export function googleMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query.trim())}`
}

export function googleMapsEmbedUrl(lat: number, lng: number): string {
  return `https://maps.google.com/maps?q=${lat},${lng}&hl=en&z=17&output=embed`
}

export function searchCemeteries(query: string, publishedOnly: boolean): Cemetery[] {
  const q = norm(query)
  return cemeteries.filter((c) => {
    if (publishedOnly && c.availability === 'full') return false
    return !q || [c.name, c.town, c.region].some((v) => norm(v).includes(q))
  })
}

export function searchGraves(name: string, deathYear?: number): GraveRecord[] {
  const q = norm(name)
  if (!q) return []
  return graveRecords.filter((g) => norm(g.fullName).includes(q) && (!deathYear || g.deathYear === deathYear))
}

export const priceRange = (c: Cemetery) => (c.plotTo ? `$${c.plotFrom} to $${c.plotTo}` : 'Not published')
