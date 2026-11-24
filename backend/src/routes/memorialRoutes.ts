import { Router } from 'express'
import { FIDELITY_OPERATIONS_PHONE, sendWhatsAppAlert } from '../services/whatsappGateway'

export function createMemorialRouter(): Router {
  const router = Router()

  const memorialsStore: Record<string, any> = {
    'm-grace': {
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
    },
  }

  // GET /api/me/memorials
  router.get('/me/memorials', async (_req, res) => {
    res.json(Object.values(memorialsStore))
  })

  // GET /api/me/memorials/:id
  router.get('/me/memorials/:id', async (req, res) => {
    let item = memorialsStore[req.params.id]
    if (!item) {
      if (req.params.id === 'm-grace') {
        item = memorialsStore['m-grace']
      } else {
        item = {
          id: req.params.id,
          ownerId: 'u-moyo',
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
        memorialsStore[req.params.id] = item
      }
    }
    res.json(item)
  })

  // GET /api/memorials/:slug
  router.get('/memorials/:slug', async (req, res) => {
    const item = Object.values(memorialsStore).find((m) => m.slug === req.params.slug) || memorialsStore['m-grace']
    res.json(item)
  })

  // GET /api/memorials/:slug/tributes
  router.get('/memorials/:slug/tributes', async (_req, res) => {
    res.json([
      {
        id: 'trib-1',
        author: 'Sipho Moyo',
        message: 'Auntie Grace, your warmth and guidance shaped our whole family. You will forever live in our memories.',
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        status: 'approved',
      },
      {
        id: 'trib-2',
        author: 'Tendai Ndlovu',
        message: 'Thank you for being the most inspiring teacher and mentor. Rest in eternal peace Mrs Nyathi.',
        createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        status: 'approved',
      },
    ])
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
      ownerId: 'u-moyo',
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

    memorialsStore[id] = created

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
    const id = req.params.id
    const existing = memorialsStore[id] || memorialsStore['m-grace']
    const updated = {
      ...existing,
      ...req.body,
    }
    memorialsStore[id] = updated
    res.json(updated)
  })

  return router
}
