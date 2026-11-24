import { get, post, patch } from '@/lib/http'
import type {
  OperationsState,
  FuneralCase,
  PolicyApplication,
  CatalogueItem,
  ExhumationCase,
  TokenCharge,
  AuditEntry,
} from './data'

export async function fetchOperationsState(): Promise<OperationsState> {
  return get<OperationsState>('/admin/operations/state')
}

export async function createOperationsCase(data: Partial<FuneralCase>): Promise<FuneralCase> {
  return post<FuneralCase>('/admin/operations/cases', data)
}

export async function updateOperationsCase(
  id: string,
  data: Partial<FuneralCase> & { auditAction?: string; auditSummary?: string },
): Promise<FuneralCase> {
  // Using post with method override or patch
  return patch<FuneralCase>(`/admin/operations/cases/${encodeURIComponent(id)}`, data)
}

export async function createOperationsPolicy(data: Partial<PolicyApplication>): Promise<PolicyApplication> {
  return post<PolicyApplication>('/admin/operations/policies', data)
}

export async function updateOperationsPolicy(
  id: string,
  data: Partial<PolicyApplication> & { auditAction?: string; auditSummary?: string },
): Promise<PolicyApplication> {
  return patch<PolicyApplication>(`/admin/operations/policies/${encodeURIComponent(id)}`, data)
}

export async function saveCatalogueItem(data: Partial<CatalogueItem>): Promise<CatalogueItem> {
  return post<CatalogueItem>('/admin/operations/catalogue', data)
}

export async function saveExhumationCase(data: Partial<ExhumationCase>): Promise<ExhumationCase> {
  return post<ExhumationCase>('/admin/operations/exhumations', data)
}

export async function deleteExhumationCase(id: string): Promise<{ ok: boolean; id: string }> {
  // Using native fetch via relative url to proxy
  const res = await fetch(`/api/admin/operations/exhumations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  return res.json()
}

export async function sendOperationsWhatsAppNotification(params: {
  phone: string
  kind: string
  payload?: Record<string, string | number | undefined>
  customMessage?: string
}): Promise<{ ok: boolean; message: string }> {
  return post<{ ok: boolean; message: string }>('/whatsapp/send-notification', params)
}

export async function saveTokenCharge(data: TokenCharge): Promise<TokenCharge> {
  return post<TokenCharge>('/admin/operations/token-charges', data)
}

export async function createAuditEntry(data: Partial<AuditEntry>): Promise<AuditEntry> {
  return post<AuditEntry>('/admin/operations/audit', data)
}

export async function resetOperationsState(): Promise<{ ok: boolean }> {
  return post<{ ok: boolean }>('/admin/operations/reset', {})
}
