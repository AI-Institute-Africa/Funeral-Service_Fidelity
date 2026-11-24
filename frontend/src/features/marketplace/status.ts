import type { StatusTone } from '@/components/ui/StatusChip'
import type { Order, OrderStatus } from './data'

export const orderStatusDisplay: Record<OrderStatus, { label: string; tone: StatusTone }> = {
  awaiting_payment: { label: 'Awaiting payment', tone: 'warning' },
  payment_failed: { label: 'Payment failed', tone: 'danger' },
  paid: { label: 'Paid', tone: 'info' },
  confirmed: { label: 'Confirmed', tone: 'info' },
  in_progress: { label: 'In Progress', tone: 'warning' },
  delivered: { label: 'Closed', tone: 'success' },
  closed: { label: 'Closed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
}

/** The stages a successful order passes through, in order. */
export const TRACKING_STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'paid', label: 'Paid' },
  { status: 'confirmed', label: 'Confirmed' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'closed', label: 'Closed' },
]

/** Index of the furthest tracking step reached, or -1 if the order hasn't been paid. */
export function trackingIndex(status: OrderStatus): number {
  return TRACKING_STEPS.findIndex((step) => step.status === status)
}

export const needsPayment = (order: Pick<Order, 'status' | 'payment'>): boolean =>
  order.status === 'awaiting_payment' || order.status === 'payment_failed'

export const paymentMethodLabel: Record<string, string> = {
  ecocash: 'EcoCash',
  paynow: 'Paynow',
  innbucks: 'InnBucks',
  omari: "O'mari",
  onemoney: 'OneMoney',
  zipit: 'ZimSwitch ZIPIT',
  card: 'Card (Visa/Mastercard)',
  chema_wallet: 'Chema Wallet',
  kuwana_tokens: 'Kuwana Tokens',
  cash: 'Cash',
}

/** Prefills a product's personalisation field when the shopper arrives from a memorial. */
export function suggestPersonalisation(itemId: string, name: string | null): string {
  if (!name) return ''
  if (itemId === 'granite-plaque') return name
  if (itemId === 'wreath-package') return `In loving memory of ${name}. Forever in our hearts.`
  return `In loving memory of ${name}`
}
