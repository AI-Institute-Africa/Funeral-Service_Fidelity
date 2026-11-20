import { prisma } from "../lib/prisma";
import { logWhatsAppEvent } from "./events";
import { isWhatsAppSettingEnabled } from "./settingValue";

const SETTING_KEY = "whatsapp_enabled";
const CACHE_TTL_MS = 5000; // 5 seconds in-memory cache

let cachedEnabled: boolean | null = null;
let cacheExpiresAt = 0;

export interface WhatsAppSettingsState {
  enabled: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
}

/** Reset cache for testing */
export function _resetSettingsCacheForTesting(): void {
  cachedEnabled = null;
  cacheExpiresAt = 0;
}

/**
 * Checks if WhatsApp automation is currently enabled.
 * Uses a 5-second in-memory cache to prevent excessive DB lookups on high volume.
 * Defaults to false if the row does not exist or cannot be read.
 */
export async function isWhatsAppEnabled(): Promise<boolean> {
  const now = Date.now();
  if (cachedEnabled !== null && now < cacheExpiresAt) {
    return cachedEnabled;
  }

  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: SETTING_KEY },
    });

    const isEnabled = isWhatsAppSettingEnabled(setting?.value)
    cachedEnabled = isEnabled;
    cacheExpiresAt = now + CACHE_TTL_MS;
    return isEnabled;
  } catch (err) {
    console.error("[whatsapp/settings] Failed to read setting; WhatsApp sending is disabled until settings are available:", err);
    cachedEnabled = false;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return false;
  }
}

/**
 * Retrieves the full settings state including author and timestamp.
 */
export async function getWhatsAppSettings(): Promise<WhatsAppSettingsState> {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: SETTING_KEY },
    });

    const enabled = isWhatsAppSettingEnabled(setting?.value)
    cachedEnabled = enabled;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;

    return {
      enabled,
      updatedBy: setting?.updatedBy ?? null,
      updatedAt: setting?.updatedAt ? setting.updatedAt.toISOString() : null,
    };
  } catch (err) {
    console.error("[whatsapp/settings] Error fetching settings:", err);
    throw err
  }
}

/**
 * Updates the WhatsApp automation enabled state and logs an event.
 */
export async function setWhatsAppEnabled(enabled: boolean, adminEmail: string): Promise<WhatsAppSettingsState> {
  const value = String(enabled);
  const now = new Date();

  const updated = await prisma.appSetting.upsert({
    where: { key: SETTING_KEY },
    create: {
      key: SETTING_KEY,
      value,
      updatedBy: adminEmail,
    },
    update: {
      value,
      updatedBy: adminEmail,
    },
  });

  // Update in-memory cache immediately
  cachedEnabled = enabled;
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;

  // Log toggle event
  await logWhatsAppEvent({
    type: "SETTINGS",
    status: enabled ? "ENABLED" : "DISABLED",
    details: `WhatsApp automation was turned ${enabled ? "ON" : "OFF"} by ${adminEmail}`,
    metadata: {
      adminEmail,
      enabled,
      timestamp: now.toISOString(),
    },
  });

  console.log(`[whatsapp/settings] WhatsApp automation turned ${enabled ? "ON" : "OFF"} by ${adminEmail}`);

  return {
    enabled,
    updatedBy: updated.updatedBy ?? adminEmail,
    updatedAt: updated.updatedAt.toISOString(),
  };
}
