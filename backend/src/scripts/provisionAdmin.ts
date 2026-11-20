import { prisma } from '../lib/prisma'
import { isValidPhone } from '../whatsapp/phone'

async function main() {
  const phoneNumber = process.env.ADMIN_PHONE?.trim() ?? ''
  const firstName = process.env.ADMIN_FIRST_NAME?.trim() ?? ''
  const lastName = process.env.ADMIN_LAST_NAME?.trim() ?? ''
  if (process.env.ALLOW_ADMIN_PROVISIONING !== 'I_UNDERSTAND') {
    throw new Error('Set ALLOW_ADMIN_PROVISIONING=I_UNDERSTAND for this one-time operator action.')
  }
  if (!isValidPhone(phoneNumber) || !firstName || !lastName) {
    throw new Error('Provide ADMIN_PHONE as E.164 plus ADMIN_FIRST_NAME and ADMIN_LAST_NAME.')
  }
  const existing = await prisma.user.findUnique({ where: { phoneNumber }, select: { id: true, role: true } })
  if (existing) {
    throw new Error(`An account already uses this phone (role: ${existing.role}); no account was changed.`)
  }
  const user = await prisma.user.create({
    data: {
      phoneNumber,
      role: 'ADMIN',
      isActive: true,
      adminProfile: {
        create: {
          firstName,
          lastName,
          jobTitle: 'System administrator',
          isSuperAdmin: true,
        },
      },
    },
    select: { id: true },
  })
  console.log(`Created initial administrator account ${user.id}. Sign in using the configured live OTP provider.`)
}

main()
  .catch((error: unknown) => {
    console.error('[admin:provision] Failed:', error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
