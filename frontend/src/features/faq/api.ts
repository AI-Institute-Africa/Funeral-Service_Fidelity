import { env } from '@/lib/env'
import { get } from '@/lib/http'
import { mockResponse } from '@/lib/mock'
import { faqs, type FaqItem } from './data'

export async function listFaqs(signal?: AbortSignal): Promise<FaqItem[]> {
  if (!env.useMock) {
    try {
      const data = await get<FaqItem[]>('/faqs', { signal })
      if (data && data.length) return data
    } catch {
      // Fallback
    }
  }
  return mockResponse(faqs)
}
