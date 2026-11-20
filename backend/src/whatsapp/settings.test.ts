import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isWhatsAppSettingEnabled } from './settingValue'

describe('WhatsApp sending setting', () => {
  it('is disabled unless the persisted value explicitly enables it', () => {
    assert.equal(isWhatsAppSettingEnabled(undefined), false)
    assert.equal(isWhatsAppSettingEnabled(null), false)
    assert.equal(isWhatsAppSettingEnabled('false'), false)
    assert.equal(isWhatsAppSettingEnabled('TRUE'), false)
    assert.equal(isWhatsAppSettingEnabled('true'), true)
  })
})
