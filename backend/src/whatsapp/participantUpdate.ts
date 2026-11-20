import { phoneToWhatsAppJid } from './phone'

export function requireSuccessfulParticipantUpdate(
  results: { status: string; jid?: string }[],
  phone: string,
  action: 'add' | 'remove',
): void {
  const jid = phoneToWhatsAppJid(phone)
  const result = results.find((entry) => entry.jid === jid) ?? results[0]
  if (!result || result.status !== '200') {
    throw new Error(`WhatsApp could not ${action} this case-group participant${result ? ` (status ${result.status})` : ''}.`)
  }
}
