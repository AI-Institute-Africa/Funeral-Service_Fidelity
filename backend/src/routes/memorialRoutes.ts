import { randomUUID } from 'node:crypto'
import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { requireSession } from '../middleware/session'
import { FIDELITY_OPERATIONS_PHONE, sendWhatsAppAlert } from '../services/whatsappGateway'

const MAX_PHOTOS = 8
const captionSchema = z.string().trim().max(140)
const newPhotoSchema = z.object({
  dataUrl: z.string().max(1_500_000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/),
  caption: captionSchema.optional(),
})
const newTributeSchema = z.object({
  authorName: z.string().trim().min(1).max(60),
  relationship: z.string().trim().max(60).optional(),
  message: z.string().trim().min(1).max(500),
})
const moderationStatusSchema = z.enum(['approved', 'removed'])
const TRIBUTE_WINDOW_MS = 60 * 60 * 1000
const TRIBUTES_PER_HOUR = 5

type MemorialPhoto = { id: string; url: string; caption?: string }
type Tribute = z.infer<typeof newTributeSchema> & {
  id: string
  createdAt: string
  status: 'pending' | 'approved' | 'removed'
}
type StoredMemorial = Record<string, unknown> & {
  id: string
  ownerId: string
  slug: string
  published: boolean
  photos: MemorialPhoto[]
  portraitId?: string | null
}

function withVisiblePhotos(memorial: StoredMemorial, viewerId?: string): StoredMemorial {
  if (memorial.published || memorial.ownerId === viewerId) return memorial
  return { ...memorial, photos: [], portraitId: undefined }
}

export function createMemorialRouter(): Router {
  const router = Router()

  const memorialsStore = new Map<string, StoredMemorial>([
    ['m-grace', {
      id: 'm-grace',
      ownerId: 'u-moyo',
      slug: 'grace-nyathi',
      name: 'Grace Nyathi',
      born: '1949-06-12',
      died: '2025-09-03',
      tagline: 'A mother to many, and a friend to everyone who met her.',
      location: 'Bulawayo',
      published: true,
      flowers: 142,
      candles: 89,
      photos: [
        { id: 'p1', url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800', caption: 'Early mornings, the way she liked them' },
        { id: 'p2', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800', caption: 'The tree outside the family home' },
      ],
      biography: 'Grace Nyathi was born in Gwanda in the winter of 1949, the third of seven children. She walked six kilometres to school every morning and, by her own telling, never once complained about it. Learning was the thing she loved most, and she spent her life passing that love on.\n\nShe trained as a teacher in Bulawayo and spent thirty-four years in the classroom, the last twelve as headmistress. Generations of children learned to read at her desk. Many of them still stop her family in the street to tell them so.\n\nShe is survived by her children, her grandchildren and a community that will keep telling her stories for a long time.',
      timeline: [
        { id: 't1', year: 1949, title: 'Born in Gwanda', text: 'The third of seven children.' },
        { id: 't2', year: 1970, title: 'Qualified as a teacher', text: 'Graduated from teachers’ college in Bulawayo.' },
        { id: 't3', year: 1974, title: 'Married Joseph Nyathi' },
        { id: 't4', year: 1989, title: 'Became headmistress', text: 'Led the school for twelve years.' },
        { id: 't5', year: 2008, title: 'Retired, and took up gardening', text: 'Her rose garden became a neighbourhood landmark.' },
      ],
      coverPhoto: { id: 'p1', url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800' },
      service: {
        date: '2025-09-10T10:00:00.000Z',
        venue: 'Brethren in Christ Church, Bulawayo',
        address: 'Bulawayo',
        note: 'West Park Cemetery',
      },
      tributeCount: 2,
      pendingTributes: 0,
      createdAt: new Date().toISOString(),
    }],
  ])
  const tributesByMemorial = new Map<string, Tribute[]>([
    ['m-grace', [
      {
        id: 'trib-1',
        authorName: 'Sipho Moyo',
        message: 'Auntie Grace, your warmth and guidance shaped our whole family. You will forever live in our memories.',
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        status: 'approved',
      },
      {
        id: 'trib-2',
        authorName: 'Tendai Ndlovu',
        message: 'Thank you for being the most inspiring teacher and mentor. Rest in eternal peace Mrs Nyathi.',
        createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        status: 'approved',
      },
    ]],
  ])
  const tributeHits = new Map<string, number[]>()
  router.use('/me/memorials', requireSession)

  function ownedMemorial(req: Request<{ id: string }>, res: Response): StoredMemorial | undefined {
    const memorial = memorialsStore.get(req.params.id)
    if (memorial?.ownerId === req.sessionUser!.userId) return memorial
    res.status(404).json({ code: 'not_found', message: 'Memorial not found.' })
  }

  function visibleTributeMemorial(req: Request<{ slug: string }>, res: Response): StoredMemorial | undefined {
    const memorial = Array.from(memorialsStore.values()).find((item) => item.slug === req.params.slug)
    if (memorial && (memorial.published || memorial.ownerId === req.sessionUser?.userId)) return memorial
    res.status(404).json({ code: 'not_found', message: 'Memorial not found.' })
  }

  function updateTributeCounts(memorial: StoredMemorial, tributes: Tribute[]) {
    memorial.tributeCount = tributes.filter((tribute) => tribute.status === 'approved').length
    memorial.pendingTributes = tributes.filter((tribute) => tribute.status === 'pending').length
  }

  // GET /api/me/memorials
  router.get('/me/memorials', async (req, res) => {
    res.json(Array.from(memorialsStore.values(), (memorial) => withVisiblePhotos(memorial, req.sessionUser!.userId)))
  })

  // GET /api/me/memorials/:id
  router.get('/me/memorials/:id', async (req, res) => {
    let item = memorialsStore.get(req.params.id)
    if (!item) {
      item = {
        id: req.params.id,
        ownerId: req.sessionUser!.userId,
        slug: `memorial-${req.params.id}`,
        name: 'In Loving Memory',
        born: '1960-01-01',
        died: '2025-01-01',
        tagline: '',
        location: '',
        published: false,
        biography: '',
        timeline: [],
        photos: [],
        flowers: 0,
        candles: 0,
        tributeCount: 0,
        pendingTributes: 0,
        createdAt: new Date().toISOString(),
      }
      memorialsStore.set(item.id, item)
    }
    res.json(withVisiblePhotos(item, req.sessionUser!.userId))
  })

  // GET /api/memorials/:slug
  router.get('/memorials/:slug', async (req, res) => {
    const item = Array.from(memorialsStore.values()).find((m) => m.slug === req.params.slug) ?? memorialsStore.get('m-grace')!
    res.json(withVisiblePhotos(item, req.sessionUser?.userId))
  })

  // GET /api/memorials/:slug/tributes
  router.get('/memorials/:slug/tributes', (req, res) => {
    const memorial = visibleTributeMemorial(req, res)
    if (!memorial) return
    const tributes = tributesByMemorial.get(memorial.id) ?? []
    res.json(tributes.filter((tribute) => tribute.status === 'approved'))
  })

  router.post('/memorials/:slug/tributes', (req, res) => {
    const memorial = visibleTributeMemorial(req, res)
    if (!memorial) return
    const parsed = newTributeSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(422).json({ code: 'validation_failed', details: parsed.error.flatten().fieldErrors })
      return
    }

    const now = Date.now()
    const cutoff = now - TRIBUTE_WINDOW_MS
    for (const [key, hits] of tributeHits) {
      if (hits[hits.length - 1] <= cutoff) tributeHits.delete(key)
    }
    const visitor = `${memorial.id}:${req.ip}`
    const hits = (tributeHits.get(visitor) ?? []).filter((hit) => hit > cutoff)
    if (hits.length >= TRIBUTES_PER_HOUR) {
      res.status(429).json({ code: 'rate_limited', message: 'Too many tributes.' })
      return
    }
    tributeHits.set(visitor, [...hits, now])

    const { authorName, relationship, message } = parsed.data
    const tribute: Tribute = {
      id: randomUUID(),
      authorName,
      ...(relationship && { relationship }),
      message,
      createdAt: new Date(now).toISOString(),
      status: memorial.ownerId === req.sessionUser?.userId ? 'approved' : 'pending',
    }
    const tributes = [tribute, ...(tributesByMemorial.get(memorial.id) ?? [])]
    tributesByMemorial.set(memorial.id, tributes)
    updateTributeCounts(memorial, tributes)
    res.status(201).json(tribute)
  })

  // POST /api/memorials/:slug/offerings
  router.post('/memorials/:slug/offerings', async (_req, res) => {
    res.json({ ok: true, count: 143 })
  })

  // POST /api/me/memorials
  router.post('/me/memorials', async (req, res) => {
    const body = req.body || {}
    const id = `m-${Date.now().toString(36)}`
    const slug = (body.name || 'memorial')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    const created = {
      id,
      ownerId: req.sessionUser!.userId,
      slug: `${slug}-${Math.floor(Math.random() * 1000)}`,
      name: body.name || 'In Loving Memory',
      born: body.born || '',
      died: body.died || '',
      tagline: body.tagline || '',
      location: body.location || '',
      published: false,
      biography: '',
      timeline: [],
      photos: [],
      flowers: 0,
      candles: 0,
      tributeCount: 0,
      pendingTributes: 0,
      createdAt: new Date().toISOString(),
    }

    memorialsStore.set(id, created)

    // Dual WhatsApp notification on memorial creation
    try {
      const alertText = [
        '🌸 *FIDELITY LIFE ASSURANCE — Digital Memorial Created*',
        '',
        `In Memory Of: *${created.name}*`,
        `Lifespan: *${created.born} – ${created.died}*`,
        created.location ? `Location: *${created.location}*` : '',
        created.tagline ? `“${created.tagline}”` : '',
        '',
        `Preview Link: http://localhost:3000/memorials/${created.slug}`,
        `Editor Portal: http://localhost:3000/account/memorials/${created.id}`,
      ].filter(Boolean).join('\n')

      await sendWhatsAppAlert(FIDELITY_OPERATIONS_PHONE, 'custom', { customMessage: alertText })
    } catch (err) {
      console.error('[memorialRoutes] WhatsApp notification error:', err)
    }

    res.status(201).json(created)
  })

  // PATCH /api/me/memorials/:id
  router.patch('/me/memorials/:id', async (req, res) => {
    const existing = ownedMemorial(req, res)
    if (!existing) return
    const { portraitId } = req.body ?? {}
    if (portraitId != null && !existing.photos.some((photo) => photo.id === portraitId)) {
      res.status(422).json({ code: 'validation_failed', message: 'Choose one of the memorial’s photos.' })
      return
    }
    const updated = {
      ...existing,
      ...req.body,
      id: existing.id,
      ownerId: existing.ownerId,
      photos: existing.photos,
    }
    memorialsStore.set(existing.id, updated)
    res.json(updated)
  })

  router.post('/me/memorials/:id/photos', (req, res) => {
    const memorial = ownedMemorial(req, res)
    if (!memorial) return
    const parsed = newPhotoSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(422).json({ code: 'validation_failed', details: parsed.error.flatten().fieldErrors })
      return
    }
    if (memorial.photos.length >= MAX_PHOTOS) {
      res.status(422).json({ code: 'photo_limit', message: 'Photo limit reached.' })
      return
    }
    const { dataUrl, caption } = parsed.data
    const photo = { id: randomUUID(), url: dataUrl, caption: caption || undefined }
    memorial.photos.push(photo)
    res.status(201).json(photo)
  })

  router.patch('/me/memorials/:id/photos/:photoId', (req, res) => {
    const memorial = ownedMemorial(req, res)
    if (!memorial) return
    const photo = memorial.photos.find((item) => item.id === req.params.photoId)
    if (!photo) {
      res.status(404).json({ code: 'not_found', message: 'Photo not found.' })
      return
    }
    const caption = captionSchema.safeParse(req.body?.caption)
    if (!caption.success) {
      res.status(422).json({ code: 'validation_failed', message: 'Enter a caption of up to 140 characters.' })
      return
    }
    photo.caption = caption.data || undefined
    res.json(photo)
  })

  router.delete('/me/memorials/:id/photos/:photoId', (req, res) => {
    const memorial = ownedMemorial(req, res)
    if (!memorial) return
    const { photoId } = req.params
    memorial.photos = memorial.photos.filter((photo) => photo.id !== photoId)
    if (memorial.portraitId === photoId) memorial.portraitId = undefined
    res.status(204).end()
  })

  router.get('/me/memorials/:id/tributes', (req, res) => {
    const memorial = ownedMemorial(req, res)
    if (!memorial) return
    const tributes = tributesByMemorial.get(memorial.id) ?? []
    res.json(tributes.filter((tribute) => tribute.status !== 'removed'))
  })

  router.patch('/me/memorials/:id/tributes/:tributeId', (req, res) => {
    const memorial = ownedMemorial(req, res)
    if (!memorial) return
    const tributes = tributesByMemorial.get(memorial.id) ?? []
    const tribute = tributes.find((item) => item.id === req.params.tributeId && item.status !== 'removed')
    if (!tribute) {
      res.status(404).json({ code: 'not_found', message: 'Tribute not found.' })
      return
    }
    const status = moderationStatusSchema.safeParse(req.body?.status)
    if (!status.success) {
      res.status(422).json({ code: 'validation_failed', details: { status: 'Choose approved or removed.' } })
      return
    }
    tribute.status = status.data
    updateTributeCounts(memorial, tributes)
    res.json(tribute)
  })

  return router
}
