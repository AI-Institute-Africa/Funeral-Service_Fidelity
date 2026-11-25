import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { env } from '../config/env'
import { createSmsProvider } from '../alerts/providers/sms'
import { sendWhatsAppOtp, notifyDual } from '../services/whatsappGateway'
import {
  createFallbackUser,
  findFallbackUserById,
  findFallbackUserByPhone,
  updateFallbackUser,
} from '../lib/fallbackUsers'
import { prisma } from '../lib/prisma'
import { clearSessionCookie, requireSession, setSessionCookie } from '../middleware/session'

const OTP_TTL_MS = 5 * 60_000
const OTP_RESEND_MS = 60_000
const OTP_MAX_ATTEMPTS = 5
const inMemoryOtpChallenges = new Map<string, { codeHash: string; expiresAt: Date; attempts: number; lastSentAt: Date }>()

const phoneSchema = z.string().regex(/^\+[1-9]\d{7,14}$/, 'Enter a valid phone number with country code.')
const otpSchema = z.string().regex(/^\d{6}$/, 'Enter the six-digit code.')

function hashOtp(phone: string, code: string): string {
  return createHmac('sha256', env.jwtSecret).update(`${phone}:${code}`).digest('hex')
}

function normaliseName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') || '-' }
}

async function publicUser(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { customerProfile: true, adminProfile: true },
    })
    if (!user || !user.isActive) return null
    const name = user.customerProfile
      ? `${user.customerProfile.firstName} ${user.customerProfile.lastName}`.trim()
      : `${user.adminProfile?.firstName ?? ''} ${user.adminProfile?.lastName ?? ''}`.trim()
    if (!user.phoneNumber || !name) return null
    return {
      id: user.id,
      name,
      phone: user.phoneNumber,
      ...(user.email ? { email: user.email } : {}),
      role: user.role === 'ADMIN' ? 'admin' as const : 'customer' as const,
      language: (user.customerProfile?.preferredLanguage === 'sn' || user.customerProfile?.preferredLanguage === 'nd'
        ? user.customerProfile.preferredLanguage
        : 'en') as 'en' | 'sn' | 'nd',
    }
  } catch {
    // Database offline fallback: read from local persistent store instead of hardcoding a single demo user.
    const fallback = findFallbackUserById(userId)
    if (!fallback) return null
    return {
      id: fallback.id,
      name: fallback.name,
      phone: fallback.phone,
      ...(fallback.email ? { email: fallback.email } : {}),
      role: fallback.role === 'ADMIN' ? 'admin' as const : 'customer' as const,
      language: fallback.language,
    }
  }
}

async function consumeOtp(phone: string, code: string): Promise<boolean> {
  try {
    const challenge = await prisma.otpChallenge.findUnique({
      where: { phone_purpose: { phone, purpose: 'login' } },
    })
    if (challenge) {
      if (challenge.expiresAt <= new Date() || challenge.attempts >= OTP_MAX_ATTEMPTS) return false
      const expected = Buffer.from(challenge.codeHash, 'hex')
      const actual = Buffer.from(hashOtp(phone, code), 'hex')
      const valid = expected.length === actual.length && expected.length > 0 && timingSafeEqual(expected, actual)
      if (!valid) {
        await prisma.otpChallenge.updateMany({
          where: { id: challenge.id, attempts: { lt: OTP_MAX_ATTEMPTS } },
          data: { attempts: { increment: 1 } },
        })
        return false
      }
      const removed = await prisma.otpChallenge.deleteMany({ where: { id: challenge.id, codeHash: challenge.codeHash } })
      inMemoryOtpChallenges.delete(phone)
      return removed.count === 1
    }
  } catch (_dbErr) {
    // Database offline fallback
  }

  const mem = inMemoryOtpChallenges.get(phone)
  if (!mem || mem.expiresAt <= new Date() || mem.attempts >= OTP_MAX_ATTEMPTS) return false
  const expected = Buffer.from(mem.codeHash, 'hex')
  const actual = Buffer.from(hashOtp(phone, code), 'hex')
  const valid = expected.length === actual.length && expected.length > 0 && timingSafeEqual(expected, actual)
  if (!valid) {
    mem.attempts += 1
    return false
  }
  inMemoryOtpChallenges.delete(phone)
  return true
}

export function createAuthRouter(): Router {
  const router = Router()

  router.post('/otp', async (req, res, next) => {
    try {
      const parsed = z.object({ phone: phoneSchema }).safeParse(req.body)
      if (!parsed.success) {
        res.status(422).json({ code: 'validation_failed', message: 'Enter a valid mobile number with its country code.' })
        return
      }
      const phone = parsed.data.phone
      const code = String(randomInt(100_000, 1_000_000))
      const now = new Date()
      const existingMem = inMemoryOtpChallenges.get(phone)
      if (existingMem && Date.now() - existingMem.lastSentAt.getTime() < OTP_RESEND_MS) {
        res.status(429).json({ code: 'rate_limited', message: 'Wait a moment before requesting another code.' })
        return
      }
      inMemoryOtpChallenges.set(phone, {
        codeHash: hashOtp(phone, code),
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
        attempts: 0,
        lastSentAt: now,
      })
      try {
        const existing = await prisma.otpChallenge.findUnique({
          where: { phone_purpose: { phone, purpose: 'login' } },
        })
        if (existing && Date.now() - existing.lastSentAt.getTime() < OTP_RESEND_MS) {
          res.status(429).json({ code: 'rate_limited', message: 'Wait a moment before requesting another code.' })
          return
        }
        await prisma.otpChallenge.upsert({
          where: { phone_purpose: { phone, purpose: 'login' } },
          create: { phone, purpose: 'login', codeHash: hashOtp(phone, code), expiresAt: new Date(now.getTime() + OTP_TTL_MS), lastSentAt: now },
          update: { codeHash: hashOtp(phone, code), attempts: 0, expiresAt: new Date(now.getTime() + OTP_TTL_MS), lastSentAt: now },
        })
      } catch (dbErr) {
        // Database offline fallback
      }

      // Send OTP via WhatsApp Gateway and SMS provider in parallel to minimize latency
      const [waResult, smsSent] = await Promise.all([
        sendWhatsAppOtp(phone, code),
        createSmsProvider().send(phone, `Your Fidelity Life sign-in code is ${code}. It expires in 5 minutes. Do not share it with anyone.`),
      ])

      if (!waResult.ok && !smsSent.ok) {
        inMemoryOtpChallenges.delete(phone)
        await prisma.otpChallenge.deleteMany({ where: { phone, purpose: 'login', codeHash: hashOtp(phone, code) } }).catch(() => {})
        console.error('[auth] OTP delivery failed via both WhatsApp and SMS:', { wa: waResult.error, sms: smsSent.error })
        res.status(503).json({ code: 'otp_delivery_failed', message: 'We could not deliver a sign-in code. Please try again later.' })
        return
      }

      console.log(`[auth:otp] Generated OTP for ${phone}: ${code} (WhatsApp: ${waResult.ok ? (waResult.queued ? 'queued' : 'sent') : 'failed'}, SMS [${smsSent.provider}]: ${smsSent.ok ? 'sent' : `failed: ${smsSent.error}`})`)

      res.json({
        expiresInSeconds: OTP_TTL_MS / 1000,
        whatsappDelivered: waResult.ok,
        whatsappQueued: Boolean(waResult.queued),

      })
    } catch (error) {
      next(error)
    }
  })

  router.post('/signin', async (req, res, next) => {
    try {
      const parsed = z.object({ phone: phoneSchema, code: otpSchema }).safeParse(req.body)
      if (!parsed.success) {
        res.status(422).json({ code: 'validation_failed', message: 'Enter your mobile number and six-digit code.' })
        return
      }
      if (!(await consumeOtp(parsed.data.phone, parsed.data.code))) {
        res.status(401).json({ code: 'otp_invalid', message: 'That code is incorrect or has expired.' })
        return
      }
      let account: { id: string; role: 'CUSTOMER' | 'ADMIN' } | null = null
      let dbOnline = true
      try {
        const dbUser = await prisma.user.findUnique({ where: { phoneNumber: parsed.data.phone } })
        if (dbUser) {
          account = { id: dbUser.id, role: dbUser.role === 'ADMIN' ? 'ADMIN' : 'CUSTOMER' }
          await prisma.user.update({ where: { id: dbUser.id }, data: { lastLoginAt: new Date() } }).catch(() => {})
        }
      } catch {
        dbOnline = false
      }
      if (!dbOnline) {
        const fallback = findFallbackUserByPhone(parsed.data.phone)
        if (fallback) {
          account = { id: fallback.id, role: fallback.role }
          updateFallbackUser(fallback.id, { lastLoginAt: new Date().toISOString() })
        }
      }
      if (!account) {
        res.status(404).json({
          code: 'account_not_found',
          message: 'We could not find an account for that number. Please register first.',
        })
        return
      }
      setSessionCookie(res, { userId: account.id, role: account.role })
      const user = await publicUser(account.id)
      if (!user) {
        res.status(401).json({ code: 'unauthenticated', message: 'Sign in to continue.' })
        return
      }
      res.json(user)
    } catch (error) {
      next(error)
    }
  })

  router.post('/signup', async (req, res, next) => {
    try {
      const parsed = z.object({
        name: z.string().trim().min(2).max(120),
        phone: phoneSchema,
        code: otpSchema,
        email: z.string().trim().email().max(254).optional().or(z.literal('')),
      }).safeParse(req.body)
      if (!parsed.success) {
        res.status(422).json({ code: 'validation_failed', message: 'Enter your name, mobile number and six-digit code.' })
        return
      }
      if (!(await consumeOtp(parsed.data.phone, parsed.data.code))) {
        res.status(401).json({ code: 'otp_invalid', message: 'That code is incorrect or has expired.' })
        return
      }
      let userId = `u-${Date.now().toString(36)}`
      let userRole: 'CUSTOMER' | 'ADMIN' = 'CUSTOMER'
      let dbOnline = true
      try {
        if (await prisma.user.findUnique({ where: { phoneNumber: parsed.data.phone }, select: { id: true } })) {
          res.status(409).json({ code: 'account_exists', message: 'An account already uses this number. Sign in instead.' })
          return
        }
        const { firstName, lastName } = normaliseName(parsed.data.name)
        const user = await prisma.user.create({
          data: {
            phoneNumber: parsed.data.phone,
            email: parsed.data.email || null,
            role: 'CUSTOMER',
            customerProfile: {
              create: { firstName, lastName, phoneNumber: parsed.data.phone },
            },
          },
        })
        userId = user.id
        userRole = user.role
      } catch {
        dbOnline = false
      }
      if (!dbOnline) {
        if (findFallbackUserByPhone(parsed.data.phone)) {
          res.status(409).json({ code: 'account_exists', message: 'An account already uses this number. Sign in instead.' })
          return
        }
        createFallbackUser({
          id: userId,
          name: parsed.data.name,
          phone: parsed.data.phone,
          email: parsed.data.email || undefined,
          role: userRole,
        })
      }
      setSessionCookie(res, { userId, role: userRole })
      const response = await publicUser(userId)

      // Dual WhatsApp notifications for new registration (Customer + Fidelity Management)
      void notifyDual({
        customerPhone: parsed.data.phone,
        kind: 'registration.welcome',
        payload: {
          customerName: parsed.data.name,
          phone: parsed.data.phone,
          email: parsed.data.email || undefined,
        },
        adminAlertKind: 'admin.new_registration',
      })

      res.status(201).json(response)
    } catch (error) {
      next(error)
    }
  })

  router.post('/signout', (_req, res) => {
    clearSessionCookie(res)
    res.sendStatus(204)
  })

  router.get('/me', requireSession, async (req, res, next) => {
    try {
      const user = await publicUser(req.sessionUser!.userId)
      if (!user) {
        res.status(401).json({ code: 'unauthenticated', message: 'Sign in to continue.' })
        return
      }
      res.json(user)
    } catch (error) {
      next(error)
    }
  })

  router.patch('/me', requireSession, async (req, res, next) => {
    try {
      const parsed = z.object({
        name: z.string().trim().min(2).max(120),
        email: z.string().trim().email().max(254).optional().or(z.literal('')),
        language: z.enum(['en', 'sn', 'nd']),
      }).safeParse(req.body)
      if (!parsed.success) {
        res.status(422).json({ code: 'validation_failed', message: 'Check the profile details and try again.' })
        return
      }
      const { firstName, lastName } = normaliseName(parsed.data.name)
      const current = req.sessionUser!
      try {
        await prisma.$transaction(async (transaction) => {
          await transaction.user.update({ where: { id: current.userId }, data: { email: parsed.data.email || null } })
          if (current.role === 'CUSTOMER') {
            await transaction.customerProfile.update({
              where: { userId: current.userId },
              data: { firstName, lastName, preferredLanguage: parsed.data.language },
            })
          } else {
            await transaction.admin.update({ where: { userId: current.userId }, data: { firstName, lastName } })
          }
        })
      } catch {
        updateFallbackUser(current.userId, {
          name: parsed.data.name,
          email: parsed.data.email ?? '',
          language: parsed.data.language,
        })
      }
      const user = await publicUser(req.sessionUser!.userId)
      if (!user) {
        res.status(401).json({ code: 'unauthenticated', message: 'Sign in to continue.' })
        return
      }
      res.json(user)
    } catch (error) {
      next(error)
    }
  })

  return router
}
