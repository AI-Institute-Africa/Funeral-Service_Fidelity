import fs from 'node:fs'
import path from 'node:path'

const DATA_DIR = path.resolve(process.cwd(), '.data')
const REQUESTS_FILE = path.join(DATA_DIR, 'requests.json')
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json')
const OPS_FILE = path.join(DATA_DIR, 'operations.json')

function readJson<T>(filePath: string, seed: () => T): T {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8')
      return JSON.parse(raw) as T
    }
  } catch {
    // Fall back to seed if unreadable
  }
  const initial = seed()
  writeJson(filePath, initial)
  return initial
}

function writeJson<T>(filePath: string, data: T): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
}

export interface StoredRequest {
  id: string
  reference: string
  kind: 'bereavement' | 'claim' | 'general'
  contactPreference: 'call' | 'whatsapp' | 'sms' | 'email'
  bestTimeToCall?: string
  message: string
  status: 'received' | 'assigned' | 'in_progress' | 'complete' | 'cancelled'
  deceasedName?: string
  dateOfDeath?: string
  serviceLocation?: string
  urgent: boolean
  actions: ('assign' | 'accepted' | 'declined' | 'completed')[]
  customer: {
    id: string
    name: string
    phone: string
    email?: string
    policyNumber?: string
    policyStatus?: string
  }
  assignedTo?: string
  assignment?: {
    providerId: string
    providerName: string
    status: 'assigned' | 'accepted' | 'declined' | 'completed'
    assignedAt: string
    respondedAt?: string
    note?: string
  }
  statusHistory?: {
    status: string
    label: string
    at: string
    note?: string
  }[]
  createdAt: string
  updatedAt: string
}

export interface StoredOrder {
  id: string
  reference: string
  status: string
  customer: { id: string; name: string; phone: string }
  lines: {
    itemId: string
    title: string
    optionLabels: string[]
    quantity: number
    unitPrice: number
    lineTotal: number
    personalisation?: string
    provider: string
  }[]
  subtotal: number
  deliveryFee: number
  total: number
  delivery: {
    recipientName: string
    phone: string
    town: string
    address: string
    neededBy: string
    notes?: string
  }
  payment: {
    method: string
    status: string
    reference: string
    amount: number
    paidAt?: string
  }
  events: { at: string; label: string }[]
  scoped: boolean
  shared: boolean
  actions: string[]
  createdAt: string
}

function seedRequests(): StoredRequest[] {
  const now = new Date()
  const iso = now.toISOString()
  return [
    {
      id: 'AR-1049',
      reference: 'AR-1049',
      kind: 'bereavement',
      contactPreference: 'call',
      bestTimeToCall: 'Morning',
      message: 'Assistance required for burial setup and repatriation in Borrowdale.',
      status: 'assigned',
      deceasedName: 'Tariro Moyo',
      dateOfDeath: iso.slice(0, 10),
      serviceLocation: 'Borrowdale, Harare',
      urgent: true,
      actions: ['assign', 'completed'],
      customer: {
        id: 'u-moyo',
        name: 'Rutendo Moyo',
        phone: '+263772123456',
        policyNumber: 'FLA-POL-8821',
        policyStatus: 'active',
      },
      assignedTo: 'Harare Funeral Care',
      assignment: {
        providerId: 'harare-funeral-care',
        providerName: 'Harare Funeral Care',
        status: 'accepted',
        assignedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        respondedAt: new Date(Date.now() - 3600000).toISOString(),
        note: 'Coordinator assigned to oversee mortuary transit and equipment.',
      },
      statusHistory: [
        { status: 'received', label: 'Received', at: new Date(Date.now() - 3600000 * 2).toISOString(), note: 'Request submitted' },
        { status: 'assigned', label: 'Adviser assigned', at: new Date(Date.now() - 3600000).toISOString(), note: 'Assigned to Harare Funeral Care' },
      ],
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'AR-1050',
      reference: 'AR-1050',
      kind: 'bereavement',
      contactPreference: 'whatsapp',
      bestTimeToCall: 'Anytime',
      message: 'Immediate collection requested from Chitungwiza hospital.',
      status: 'received',
      deceasedName: 'Sekuru Munemo',
      dateOfDeath: iso.slice(0, 10),
      serviceLocation: 'Chitungwiza',
      urgent: true,
      actions: ['assign'],
      customer: { id: 'u-munemo', name: 'Grace Munemo', phone: '+263774888999' },
      statusHistory: [
        { status: 'received', label: 'Received', at: new Date(Date.now() - 3600000).toISOString(), note: 'Request submitted' },
      ],
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
    },
  ]
}

function seedOrders(): StoredOrder[] {
  const now = new Date().toISOString()
  return [
    {
      id: 'ORD-101',
      reference: 'FS-1042',
      status: 'paid',
      customer: { id: 'u-moyo', name: 'Rutendo Moyo', phone: '+263772123456' },
      lines: [
        {
          itemId: 'casket-oak',
          title: 'Standard Oak Casket',
          optionLabels: ['Polished Oak', 'Brass Fittings'],
          quantity: 1,
          unitPrice: 850,
          lineTotal: 850,
          personalisation: 'Rest In Peace',
          provider: 'Harare Funeral Supplies',
        },
      ],
      subtotal: 850,
      deliveryFee: 0,
      total: 850,
      delivery: {
        recipientName: 'Rutendo Moyo',
        phone: '+263772123456',
        town: 'Harare',
        address: '42 Ridgeway North, Borrowdale, Harare',
        neededBy: '2026-11-24',
      },
      payment: {
        method: 'ecocash',
        status: 'paid',
        reference: 'PAY-ECO-8812',
        amount: 850,
        paidAt: now,
      },
      events: [{ at: now, label: 'Order placed & paid via EcoCash' }],
      scoped: false,
      shared: false,
      actions: ['confirmed'],
      createdAt: now,
    },
    {
      id: 'ORD-102',
      reference: 'FS-1043',
      status: 'in_progress',
      customer: { id: 'u-munemo', name: 'Grace Munemo', phone: '+263774888999' },
      lines: [
        {
          itemId: 'casket-dome',
          title: 'Dome Casket (Mahogany Finish)',
          optionLabels: ['Mahogany Gloss', 'Silver Trim'],
          quantity: 1,
          unitPrice: 1650,
          lineTotal: 1650,
          personalisation: 'Forever in our hearts',
          provider: 'Fidelity Heritage Supplies',
        },
      ],
      subtotal: 1650,
      deliveryFee: 0,
      total: 1650,
      delivery: {
        recipientName: 'Grace Munemo',
        phone: '+263774888999',
        town: 'Harare',
        address: '15 Enterprise Rd, Highlands, Harare',
        neededBy: '2026-11-25',
      },
      payment: {
        method: 'paynow',
        status: 'paid',
        reference: 'PAY-PN-4921',
        amount: 1650,
        paidAt: now,
      },
      events: [
        { at: now, label: 'Order placed' },
        { at: now, label: 'Being prepared by workshop' },
      ],
      scoped: false,
      shared: false,
      actions: ['delivered'],
      createdAt: now,
    },
  ]
}

export function listStoredRequests(): StoredRequest[] {
  return readJson<StoredRequest[]>(REQUESTS_FILE, seedRequests)
}

export function saveStoredRequests(requests: StoredRequest[]): void {
  writeJson(REQUESTS_FILE, requests)
}

export function listStoredOrders(): StoredOrder[] {
  return readJson<StoredOrder[]>(ORDERS_FILE, seedOrders)
}

export function saveStoredOrders(orders: StoredOrder[]): void {
  writeJson(ORDERS_FILE, orders)
}

export function loadPersistedOpsState<T>(seed: () => T): T {
  return readJson<T>(OPS_FILE, seed)
}

export function savePersistedOpsState<T>(state: T): void {
  writeJson(OPS_FILE, state)
}
