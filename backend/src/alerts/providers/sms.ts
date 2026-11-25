import { env } from '../../config/env'
import type { SendResult, SmsProvider } from '../types'

export type Fetch = typeof fetch

const isRetryableStatus = (status: number) => status === 429 || status >= 500

/** Development fallback: prints instead of sending. */
export class LogSmsProvider implements SmsProvider {
  readonly name = 'log'
  async send(to: string, body: string): Promise<SendResult> {
    console.log(`[alerts:sms] to=${to} body=${JSON.stringify(body)}`)
    return { ok: true, provider: this.name, messageId: `log-${Date.now().toString(36)}` }
  }
}

export interface SmsPopConfig {
  baseUrl: string
  apiKey: string
  senderId: string
  campaignName?: string
}

export class SmsPopSmsProvider implements SmsProvider {
  readonly name = 'smspop'
  constructor(private readonly cfg: SmsPopConfig, private readonly fetchFn: Fetch = fetch) {}

  async send(to: string, body: string): Promise<SendResult> {
    const endpoint = `${this.cfg.baseUrl.replace(/\/+$/, '')}/campaigns`
    try {
      const res = await this.fetchFn(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.cfg.apiKey}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender_id: this.cfg.senderId,
          ...(this.cfg.campaignName ? { name: this.cfg.campaignName } : {}),
          message: body,
          contact_import_method: 'manual',
          manual_contacts: to, // SMSPoP expects a string (comma-separated), not an array
        }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        id?: string | number
        message_id?: string
        message?: string
        error?: string
        data?: { id?: string | number; message_id?: string }
      }
      if (res.ok) {
        const messageId = String(json.message_id ?? json.data?.message_id ?? json.id ?? json.data?.id ?? `smspop-${Date.now().toString(36)}`)
        console.log(`[alerts:smspop] Sent SMS to ${to} (messageId=${messageId})`)
        return { ok: true, provider: this.name, messageId }
      }
      const errMsg = json.error ?? json.message ?? `HTTP ${res.status}`
      console.error(`[alerts:smspop] Failed to send SMS to ${to}: ${errMsg}`)
      return {
        ok: false,
        provider: this.name,
        error: errMsg,
        retryable: isRetryableStatus(res.status),
      }
    } catch (err) {
      return { ok: false, provider: this.name, error: (err as Error).message, retryable: true }
    }
  }
}

export interface AfricasTalkingConfig { apiKey: string; username: string; from?: string }

export class AfricasTalkingSmsProvider implements SmsProvider {
  readonly name = 'africastalking'
  constructor(private readonly cfg: AfricasTalkingConfig, private readonly fetchFn: Fetch = fetch) {}

  async send(to: string, body: string): Promise<SendResult> {
    const host = this.cfg.username === 'sandbox' ? 'api.sandbox.africastalking.com' : 'api.africastalking.com'
    const form = new URLSearchParams({ username: this.cfg.username, to, message: body })
    if (this.cfg.from) form.set('from', this.cfg.from)
    try {
      const res = await this.fetchFn(`https://${host}/version1/messaging`, {
        method: 'POST',
        headers: { apiKey: this.cfg.apiKey, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form,
      })
      if (!res.ok) return { ok: false, provider: this.name, error: `HTTP ${res.status}`, retryable: isRetryableStatus(res.status) }
      const json = (await res.json()) as { SMSMessageData?: { Recipients?: { statusCode: number; status: string; messageId?: string }[] } }
      const recipient = json.SMSMessageData?.Recipients?.[0]
      // 100 Processed, 101 Sent, 102 Queued are accepted; anything else is a rejection (e.g. 403 InvalidPhoneNumber).
      if (recipient && [100, 101, 102].includes(recipient.statusCode)) return { ok: true, provider: this.name, messageId: recipient.messageId }
      return { ok: false, provider: this.name, error: recipient?.status ?? 'no recipient in response', retryable: false }
    } catch (err) {
      return { ok: false, provider: this.name, error: (err as Error).message, retryable: true }
    }
  }
}

export interface TwilioConfig { accountSid: string; authToken: string; from: string; statusCallback?: string }

export class TwilioSmsProvider implements SmsProvider {
  readonly name = 'twilio'
  constructor(private readonly cfg: TwilioConfig, private readonly fetchFn: Fetch = fetch) {}

  async send(to: string, body: string): Promise<SendResult> {
    const form = new URLSearchParams({ To: to, From: this.cfg.from, Body: body })
    if (this.cfg.statusCallback) form.set('StatusCallback', this.cfg.statusCallback)
    const auth = Buffer.from(`${this.cfg.accountSid}:${this.cfg.authToken}`).toString('base64')
    try {
      const res = await this.fetchFn(`https://api.twilio.com/2010-04-01/Accounts/${this.cfg.accountSid}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form,
      })
      const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string }
      if (res.ok && json.sid) return { ok: true, provider: this.name, messageId: json.sid }
      return { ok: false, provider: this.name, error: json.message ?? `HTTP ${res.status}`, retryable: isRetryableStatus(res.status) }
    } catch (err) {
      return { ok: false, provider: this.name, error: (err as Error).message, retryable: true }
    }
  }
}

export type SmsProviderName = 'smspop' | 'africastalking' | 'twilio' | 'log'

export interface SmsSelection {
  /** From the admin setting. When unset the provider is chosen from SMS_PROVIDER or whichever credentials exist. */
  provider?: SmsProviderName
  /** From the admin setting; overrides the env sender for the chosen provider. */
  senderId?: string
}

/**
 * Chooses the SMS provider: the admin's setting if there is one, otherwise SMS_PROVIDER, otherwise
 * SMSPoP, Africa's Talking, Twilio, or the log fallback. API keys always come from the environment.
 * `ALERTS_MODE=log` forces the log provider.
 */
export function createSmsProvider(fetchFn: Fetch = fetch, selection: SmsSelection = {}): SmsProvider {
  const { smspop, africasTalking: at, twilio, publicBaseUrl, smsProvider } = env.alerts
  if (env.alerts.mode === 'log' || selection.provider === 'log') return new LogSmsProvider()

  const hasSmsPop = Boolean(smspop.apiKey && (selection.senderId || smspop.senderId))
  const hasAt = Boolean(at.apiKey && at.username)
  const hasTwilio = Boolean(twilio.accountSid && twilio.authToken && (twilio.from || selection.senderId))
  const envChoice = (smsProvider || undefined) as SmsProviderName | undefined
  const choice = selection.provider ?? envChoice ?? (hasSmsPop ? 'smspop' : hasAt ? 'africastalking' : hasTwilio ? 'twilio' : undefined)

  if (choice === 'smspop' && hasSmsPop) {
    return new SmsPopSmsProvider({ ...smspop, senderId: selection.senderId || smspop.senderId }, fetchFn)
  }
  if (choice === 'africastalking' && hasAt) return new AfricasTalkingSmsProvider({ ...at, from: selection.senderId || at.from }, fetchFn)
  if (choice === 'twilio' && hasTwilio) {
    const statusCallback = publicBaseUrl ? `${publicBaseUrl}/api/alerts/webhooks/twilio` : undefined
    return new TwilioSmsProvider({ ...twilio, from: selection.senderId || twilio.from, statusCallback }, fetchFn)
  }
  throw new Error(`ALERTS_MODE=live but ${choice ?? 'no SMS provider'} is not configured (set SMSPOP_*, AFRICASTALKING_*, or TWILIO_*).`)
}
