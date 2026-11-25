import type { IconName } from '@/components/ui/Icon'
import { anchor, paths } from './routes'

export type NavLink = {
  label: string
  to: string
}

export const site = {
  name: 'Fidelity Life Assurance of Zimbabwe',
  footerName: 'Fidelity Life Assurance of Zimbabwe',
  logo: '/brand/logo.png',
  logoLight: '/brand/logo-light.png',
  mark: '/brand/mark.png',
  markLight: '/brand/mark-light.png',
}

/** Fidelity Life Assurance of Zimbabwe's published contact details (fidelitylife.co.zw). */
export const contact = {
  address: ['Fidelity House', '66 Julius Nyerere Way', 'Harare, Zimbabwe'],
  phone: '+263 (242) 750927 - 34',
  phoneHref: 'tel:+263242750927',
  tollFree: '+263 8080835',
  tollFreeHref: 'tel:+2638080835',
  email: 'customercare@fidelitylife.co.zw',
}

export const primaryNav: NavLink[] = [
  { label: 'Services', to: anchor('services') },
  { label: 'Funeral Plans', to: anchor('plans') },
  { label: 'Digital Services', to: paths.digitalServices },
  { label: 'Marketplace', to: paths.marketplace },
  { label: 'Memorials', to: anchor('memorials') },
]

export type AccountNavItem = NavLink & { icon: IconName; end?: boolean }

export const accountNav: AccountNavItem[] = [
  { label: 'Overview', to: paths.account, icon: 'home', end: true },
  { label: 'My policy', to: paths.accountPolicy, icon: 'shield' },
  { label: 'Requests', to: paths.accountRequests, icon: 'chat' },
  { label: 'Funeral cases', to: paths.accountFuneralCases, icon: 'archive' },
  { label: 'Family History', to: paths.accountFamilyHistory, icon: 'users' },
  { label: 'Records', to: paths.accountFuneralRecords, icon: 'archive' },
  { label: 'Chema Wallet', to: 'http://localhost:3005', icon: 'wallet' },
  { label: 'Coverage', to: paths.accountFuneralStreaming, icon: 'video' },
  { label: 'Funeral day', to: paths.accountProcession, icon: 'map' },
  { label: 'Estate', to: paths.accountEstate, icon: 'file' },
  { label: 'Aftercare', to: paths.accountAftercare, icon: 'heart' },
  { label: 'Alerts', to: paths.accountAlerts, icon: 'chat' },
  { label: 'Orders', to: paths.accountOrders, icon: 'bag' },
  { label: 'Profile', to: paths.accountProfile, icon: 'user' },
]

/** The portal's navigation: what each kind of staff member gets. */
export function portalNav(role: 'admin' | 'provider'): AccountNavItem[] {
  const common: AccountNavItem[] = [
    { label: 'Overview', to: paths.provider, icon: 'home', end: true },
    { label: role === 'admin' ? 'Requests' : 'Assignments', to: paths.portalRequests, icon: 'chat' },
    { label: 'Orders', to: paths.portalOrders, icon: 'bag' },
  ]
  if (role === 'provider') return common
  return [
    ...common,
    { label: 'Operations dashboard', to: paths.portalOperations, icon: 'home' },
    { label: 'Funeral cases', to: `${paths.portalOperations}?section=cases`, icon: 'archive' },
    { label: 'Cash walk-ins', to: `${paths.portalOperations}?section=cases&type=cash-walk-in`, icon: 'plus' },
    { label: 'Customers & policies', to: `${paths.portalOperations}?section=policies`, icon: 'users' },
    { label: 'Services & products', to: `${paths.portalOperations}?section=catalogue`, icon: 'bag' },
    { label: 'Funeral coordinator', to: paths.portalFuneralCases, icon: 'shield' },
    { label: 'Quotations & payments', to: `${paths.portalOperations}?section=finance`, icon: 'file' },
    { label: 'Chema Wallet (Operations)', to: 'http://localhost:3001', icon: 'wallet' },
    { label: 'Chema Admin (Portal)', to: 'http://localhost:3001', icon: 'shield' },
    { label: 'Reports', to: `${paths.portalOperations}?section=reports`, icon: 'clock' },
    { label: 'Audit log', to: `${paths.portalOperations}?section=audit`, icon: 'clock' },
    { label: 'Policy import', to: paths.portalPolicyImport, icon: 'download' },
    { label: 'Activity', to: paths.portalActivity, icon: 'clock' },
    { label: 'Messaging', to: paths.portalMessaging, icon: 'chat' },
  ]
}

export const footerColumns: { title: string; links: NavLink[] }[] = [
  {
    title: 'Explore',
    links: [
      { label: 'Services', to: anchor('services') },
      { label: 'Funeral Plans', to: anchor('plans') },
      { label: 'Digital Services', to: paths.digitalServices },
      { label: 'Remembrance', to: anchor('memorials') },
      { label: 'Cemeteries & grave search', to: paths.cemeteries },
      { label: 'Grief support assistant', to: paths.assistant },
      { label: 'Family History & Family Tree', to: paths.accountFamilyHistory },
      { label: 'Chema Wallet (Contributions & Payouts)', to: 'http://localhost:3005' },
      { label: 'Marketplace', to: paths.marketplace },
      { label: 'Vision, mission and values', to: paths.about },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Repatriation', to: anchor('diaspora') },
      { label: 'AI support', to: anchor('support') },
      { label: 'Funeral records & coverage', to: paths.accountFuneralRecords },
      { label: 'FAQs', to: anchor('faq') },
    ],
  },
  {
    title: 'Sample notice',
    links: [
      { label: 'Request a sample quote', to: anchor('quote-form') },
      { label: 'Sign in', to: paths.login },
      { label: 'My account', to: paths.account },
      { label: 'Staff portal', to: paths.provider },
      { label: 'Demo prototype', to: anchor('top') },
    ],
  },
]
