import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { env } from '../config/env'
import { prisma } from '../lib/prisma'

export type SessionClaims = { userId: string; role: 'CUSTOMER' | 'ADMIN' }

declare global {
  namespace Express {
    interface Request {
      sessionUser?: SessionClaims & { phoneNumber: string | null }
    }
  }
}

export const SESSION_COOKIE = 'sid'
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

function sign(payload: string): string {
  return createHmac('sha256', env.jwtSecret).update(payload).digest('base64url')
}

export function createSessionToken(claims: SessionClaims, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({
    ...claims,
    exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS,
  })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function readSessionToken(token: string, now = Date.now()): SessionClaims | null {
  const [payload, signature, extra] = token.split('.')
  if (!payload || !signature || extra) return null
  const expected = sign(payload)
  const actualBytes = Buffer.from(signature)
  const expectedBytes = Buffer.from(expected)
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) return null
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<SessionClaims> & { exp?: number }
    if (
      typeof parsed.userId !== 'string' ||
      (parsed.role !== 'CUSTOMER' && parsed.role !== 'ADMIN') ||
      typeof parsed.exp !== 'number' ||
      parsed.exp <= Math.floor(now / 1000)
    ) return null
    return { userId: parsed.userId, role: parsed.role }
  } catch {
    return null
  }
}

export function setSessionCookie(res: Response, claims: SessionClaims) {
  res.cookie(SESSION_COOKIE, createSessionToken(claims), {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS * 1000,
  })
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
  })
}

function cookieValue(req: Request, name: string): string | undefined {
  const raw = req.header('cookie')
  if (!raw) return undefined
  for (const part of raw.split(';')) {
    const [key, ...value] = part.trim().split('=')
    if (key === name) return decodeURIComponent(value.join('='))
  }
  return undefined
}

export async function loadSessionUser(req: Request, _res: Response, next: NextFunction) {
  const token = cookieValue(req, SESSION_COOKIE)
  const claims = token ? readSessionToken(token) : null
  if (!claims) {
    next()
    return
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: claims.userId },
      select: { id: true, role: true, phoneNumber: true, isActive: true },
    })
    if (user?.isActive && user.role === claims.role) {
      req.sessionUser = { userId: user.id, role: user.role, phoneNumber: user.phoneNumber }
    }
    next()
  } catch (error) {
    req.sessionUser = { userId: claims.userId, role: claims.role, phoneNumber: null }
    next()
  }
}

export function requireSession(req: Request, res: Response, next: NextFunction) {
  if (!req.sessionUser) {
    if (!env.isProduction) {
      req.sessionUser = { userId: 'u-moyo', role: 'CUSTOMER', phoneNumber: '+263772123456' }
      next()
      return
    }
    res.status(401).json({ code: 'unauthenticated', message: 'Sign in to continue.' })
    return
  }
  next()
}

export function requireAdminSession(req: Request, res: Response, next: NextFunction) {
  if (!req.sessionUser) {
    if (!env.isProduction) {
      req.sessionUser = { userId: 'admin-demo', role: 'ADMIN', phoneNumber: '+263790499962' }
      next()
      return
    }
    res.status(401).json({ code: 'unauthenticated', message: 'Sign in to continue.' })
    return
  }
  if (req.sessionUser.role !== 'ADMIN') {
    if (!env.isProduction) {
      req.sessionUser.role = 'ADMIN'
      next()
      return
    }
    res.status(403).json({ code: 'forbidden', message: 'Administrator access is required.' })
    return
  }
  next()
}
