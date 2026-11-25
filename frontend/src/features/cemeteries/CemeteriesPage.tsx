import { useId, useState, useEffect, useRef, type DragEvent, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/features/auth'
import { Callout } from '@/components/ui/Callout'
import { Section } from '@/components/ui/Section'
import { SectionHead } from '@/components/ui/SectionHead'
import { StatusChip } from '@/components/ui/StatusChip'
import { TextField } from '@/components/ui/TextField'
import { Modal } from '@/components/ui/Modal'
import {
  availabilityLabels,
  cemeteries,
  googleMapsSearchUrl,
  googleMapsEmbedUrl,
  priceRange,
  searchCemeteries,
  searchGraves,
  FLOWER_VARIETIES,
  type Cemetery,
  type GraveRecord,
  type PlotEnquiry,
  type FlowerTribute,
} from './data'
import { plotEnquiryStore, flowerTributeStore } from './store'

import './cemeteries.css'

const tone = { available: 'success', limited: 'warning', full: 'neutral' } as const

function EnquiryForm({ cemetery, onDone }: { cemetery: Cemetery; onDone: () => void }) {
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [kind, setKind] = useState<PlotEnquiry['kind']>('information')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const kindId = useId()

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !contact.trim()) {
      setError('Please add your name and a phone number or email.')
      return
    }
    plotEnquiryStore.add({ cemeteryId: cemetery.id, name: name.trim(), contact: contact.trim(), kind, message: message.trim() })
    setSent(true)
  }

  if (sent) {
    return (
      <Callout tone="success" role="status">
        Sample enquiry saved in this browser only. In a real service it would go to the cemetery operator, who must confirm availability, prices and any purchase or reservation.{' '}
        <button type="button" className="btn btn--outline btn--sm" onClick={onDone}>
          Close
        </button>
      </Callout>
    )
  }
  return (
    <form className="cem-form" onSubmit={submit} noValidate aria-label={`Plot enquiry for ${cemetery.name}`}>
      <TextField label="Your name" value={name} onChange={setName} autoComplete="name" />
      <TextField label="Phone or email" value={contact} onChange={setContact} error={error} />
      <div className="field">
        <label htmlFor={kindId} className="field__label">
          I would like to
        </label>
        <select id={kindId} className="select" value={kind} onChange={(e) => setKind(e.target.value as PlotEnquiry['kind'])}>
          <option value="information">Ask about plots</option>
          <option value="reserve">Enquire about reserving a plot</option>
          <option value="purchase">Enquire about buying a plot</option>
        </select>
      </div>
      <TextField label="Message" tag="Optional" value={message} onChange={setMessage} />
      <div className="cem-actions">
        <button className="btn btn--primary btn--sm" type="submit">
          Send sample enquiry
        </button>
        <button className="btn btn--outline btn--sm" type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  )
}

function CemeteryCard({ c, onOpenMap }: { c: Cemetery; onOpenMap: (c: Cemetery) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <article className="card stack">
      <div className="cem-top">
        <div>
          <p className="eyebrow">
            {c.town} · {c.region}
          </p>
          <h3 style={{ margin: 0 }}>{c.name}</h3>
        </div>
        <StatusChip tone={tone[c.availability]}>{availabilityLabels[c.availability]}</StatusChip>
      </div>
      <p>{c.about}</p>
      <div className="cem-kv">
        <div>
          <span>Published plot guidance</span>
          <strong>{priceRange(c)}</strong>
        </div>
        <div>
          <span>Sections</span>
          <strong>{c.sections.join(', ')}</strong>
        </div>
        <div>
          <span>Opening hours</span>
          <strong>{c.hours}</strong>
        </div>
        <div>
          <span>Phone</span>
          <strong>{c.phone}</strong>
        </div>
        <div>
          <span>Email</span>
          <strong>{c.email}</strong>
        </div>
      </div>
      <p className="muted">
        <strong>Directions.</strong> {c.directions}
      </p>
      <div className="cem-actions" style={{ flexWrap: 'wrap', gap: '8px' }}>
        <button type="button" className="btn btn--primary btn--sm" onClick={() => onOpenMap(c)}>
          🗺️ View Google Maps & Directions
        </button>
        <a
          className="btn btn--outline btn--sm"
          href={googleMapsSearchUrl(`${c.name}, ${c.town}, ${c.region}`)}
          target="_blank"
          rel="noreferrer"
        >
          Open in Maps App
        </a>
      </div>
      {open ? (
        <EnquiryForm cemetery={c} onDone={() => setOpen(false)} />
      ) : (
        <div className="cem-actions">
          <button className="btn btn--outline btn--sm" type="button" onClick={() => setOpen(true)}>
            Plot enquiry
          </button>
        </div>
      )}
    </article>
  )
}

function GraveResult({
  g,
  onViewGrave,
  onAddFlowers,
}: {
  g: GraveRecord
  onViewGrave: (g: GraveRecord) => void
  onAddFlowers: (g: GraveRecord) => void
}) {
  const c = cemeteries.find((x) => x.id === g.cemeteryId)
  const [tributes, setTributes] = useState<FlowerTribute[]>(() => flowerTributeStore.listByGrave(g.id))

  useEffect(() => {
    const handleUpdate = () => {
      setTributes(flowerTributeStore.listByGrave(g.id))
    }
    window.addEventListener('flowers-updated', handleUpdate)
    return () => window.removeEventListener('flowers-updated', handleUpdate)
  }, [g.id])

  return (
    <li className="card stack" style={{ borderLeft: '4px solid #4f46e5' }}>
      <div className="cem-top">
        <div>
          <strong style={{ fontSize: '18px' }}>
            {g.fullName} ({g.birthYear} to {g.deathYear})
          </strong>
          <p className="muted" style={{ margin: '4px 0 0 0' }}>
            {c?.name}, {c?.town} · <strong>{g.section}</strong>, Plot <strong>{g.plot}</strong>
          </p>
        </div>
        <StatusChip tone={g.verified ? 'success' : 'warning'}>
          {g.verified ? 'Verified record' : 'Awaiting verification'}
        </StatusChip>
      </div>

      <p className="muted" style={{ fontSize: '13px', margin: '4px 0' }}>
        <strong>Walking Route:</strong> {g.walkingDirections}
      </p>

      {/* Virtual Flowers Tribute Wall */}
      {tributes.length > 0 && (
        <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', marginTop: '6px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
            💐 In Loving Memory Floral Offerings ({tributes.length}):
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {tributes.map((t) => {
              const flower = FLOWER_VARIETIES.find((v) => v.id === t.flowerType)
              return (
                <div
                  key={t.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    fontSize: '12px',
                  }}
                >
                  <span style={{ fontSize: '16px', marginRight: '6px' }}>{flower?.icon || '🌸'}</span>
                  <strong>{t.giverName}</strong>: &ldquo;{t.message}&rdquo;
                  <span style={{ fontSize: '10px', color: '#94a3b8', marginLeft: '6px' }}>
                    ({new Date(t.createdAt).toLocaleDateString('en-GB')})
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="cem-actions" style={{ flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
        <button type="button" className="btn btn--primary btn--sm" onClick={() => onViewGrave(g)}>
          View Grave Site (GPS & Map)
        </button>
        <button type="button" className="btn btn--outline btn--sm" onClick={() => {
          const lat = window.prompt("Enter exact Latitude:", String(g.lat || -17.8252));
          const lng = window.prompt("Enter exact Longitude:", String(g.lng || 31.0335));
          if (lat && lng) window.alert("Grave location pinpointed: " + lat + ", " + lng);
        }}>
          Pinpoint Location
        </button>
        <button
          type="button"
          className="btn btn--sm"
          style={{
            background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
            color: '#ffffff',
            border: 'none',
          }}
          onClick={() => onAddFlowers(g)}
        >
          💐 Leave Flowers or Candle on Grave
        </button>
        {c && (
          <a
            className="btn btn--outline btn--sm"
            href={googleMapsSearchUrl(`${c.name}, ${c.town}`)}
            target="_blank"
            rel="noreferrer"
          >
            Directions in Maps
          </a>
        )}
      </div>
    </li>
  )
}

function GraveSiteMapModal({
  grave,
  defaultName,
  onClose,
  onOpenForm,
}: {
  grave: GraveRecord
  defaultName: string
  onClose: () => void
  onOpenForm: (grave: GraveRecord) => void
}) {
  const mapBoxRef = useRef<HTMLDivElement>(null)
  const [visitorName, setVisitorName] = useState(defaultName)
  const [visitorMsg, setVisitorMsg] = useState('')
  const [draggingKind, setDraggingKind] = useState<'flower' | 'candle' | null>(null)
  const [mapNotice, setMapNotice] = useState('')
  const [mapError, setMapError] = useState('')
  const [tributes, setTributes] = useState<FlowerTribute[]>(() => flowerTributeStore.listByGrave(grave.id))

  useEffect(() => {
    const refresh = () => setTributes(flowerTributeStore.listByGrave(grave.id))
    window.addEventListener('flowers-updated', refresh)
    return () => window.removeEventListener('flowers-updated', refresh)
  }, [grave.id])

  function placeOnMap(kind: 'flower' | 'candle', xPct: number, yPct: number) {
    setMapError('')
    const name = visitorName.trim()
    if (!name) {
      setMapError('Please enter your name first so it can be recorded on the grave.')
      return
    }
    flowerTributeStore.add({
      graveId: grave.id,
      giverName: name,
      message: visitorMsg.trim() || (kind === 'candle' ? 'Lit a vigil candle in loving memory.' : 'Placed flowers in loving memory.'),
      flowerType: kind === 'candle' ? 'candle' : 'white-lilies',
      kind,
      mapX: Math.max(8, Math.min(92, Math.round(xPct))),
      mapY: Math.max(10, Math.min(88, Math.round(yPct))),
    })
    setMapNotice(`${kind === 'candle' ? '🕯️ Candle' : '🌸 Flower'} placed on the grave by ${name}!`)
    setVisitorMsg('')
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const kind = (e.dataTransfer.getData('text/plain') as 'flower' | 'candle') || draggingKind
    setDraggingKind(null)
    if (!kind || !mapBoxRef.current) return
    const rect = mapBoxRef.current.getBoundingClientRect()
    const xPct = ((e.clientX - rect.left) / rect.width) * 100
    const yPct = ((e.clientY - rect.top) / rect.height) * 100
    placeOnMap(kind, xPct, yPct)
  }

  return (
    <Modal title={`Grave Site: ${grave.fullName} (${grave.plot})`} onClose={onClose}>
      <div className="stack" style={{ gap: '12px' }}>
        <div
          style={{
            background: '#f1f5f9',
            padding: '10px 12px',
            borderRadius: '8px',
            fontSize: '13px',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '6px',
          }}
        >
          <div><strong>Section:</strong> {grave.section}</div>
          <div><strong>Plot Number:</strong> {grave.plot}</div>
          <div><strong>Years:</strong> {grave.birthYear} — {grave.deathYear}</div>
          <div><strong>Status:</strong> {grave.verified ? 'Verified Marker' : 'Pending verification'}</div>
        </div>

        <p style={{ margin: 0, fontSize: '13px' }}>
          <strong>Walking route:</strong> {grave.walkingDirections}
        </p>

        {/* Drag-and-drop Flower & Candle Bar */}
        <div style={{ background: '#fdf2f8', border: '1px solid #fbcfe8', borderRadius: '8px', padding: '10px 12px', display: 'grid', gap: '8px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#9d174d' }}>
            Drag a 🌸 Flower or 🕯️ Candle onto the grave on Google Maps below (your name is recorded)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
            <input
              className="input"
              placeholder="Your name (required)"
              value={visitorName}
              onChange={(e) => setVisitorName(e.target.value)}
            />
            <input
              className="input"
              placeholder="Short tribute message (optional)"
              value={visitorMsg}
              onChange={(e) => setVisitorMsg(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div
              draggable
              onDragStart={(e) => {
                setDraggingKind('flower')
                e.dataTransfer.setData('text/plain', 'flower')
              }}
              onDragEnd={() => setDraggingKind(null)}
              style={{
                cursor: 'grab',
                padding: '6px 12px',
                borderRadius: '999px',
                background: '#ffffff',
                border: '1px solid #f472b6',
                fontSize: '13px',
                fontWeight: 600,
                userSelect: 'none',
              }}
              title="Drag onto the grave on the map"
            >
              🌸 Drag Flower
            </div>
            <div
              draggable
              onDragStart={(e) => {
                setDraggingKind('candle')
                e.dataTransfer.setData('text/plain', 'candle')
              }}
              onDragEnd={() => setDraggingKind(null)}
              style={{
                cursor: 'grab',
                padding: '6px 12px',
                borderRadius: '999px',
                background: '#ffffff',
                border: '1px solid #f59e0b',
                fontSize: '13px',
                fontWeight: 600,
                userSelect: 'none',
              }}
              title="Drag onto the grave on the map"
            >
              🕯️ Drag Candle
            </div>
            <button type="button" className="btn btn--outline btn--sm" onClick={() => placeOnMap('flower', 46 + Math.random() * 8, 46 + Math.random() * 8)}>
              + Place Flower
            </button>
            <button type="button" className="btn btn--outline btn--sm" onClick={() => placeOnMap('candle', 46 + Math.random() * 8, 46 + Math.random() * 8)}>
              + Light Candle
            </button>
          </div>
          {mapError && <p style={{ margin: 0, fontSize: '12px', color: '#b91c1c', fontWeight: 600 }}>{mapError}</p>}
          {mapNotice && <p style={{ margin: 0, fontSize: '12px', color: '#047857', fontWeight: 600 }}>{mapNotice}</p>}
        </div>

        {/* Google Maps Grave View with Drop Overlay & Placed Markers */}
        <div
          ref={mapBoxRef}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          style={{
            position: 'relative',
            borderRadius: '8px',
            overflow: 'hidden',
            height: '340px',
            border: draggingKind ? '2px dashed #db2777' : '1px solid #cbd5e1',
          }}
        >
          <iframe
            title={`Grave ${grave.fullName}`}
            width="100%"
            height="100%"
            frameBorder="0"
            style={{ border: 0, pointerEvents: draggingKind ? 'none' : 'auto' }}
            src={googleMapsEmbedUrl(grave.lat, grave.lng)}
            allowFullScreen
          />

          {/* Drop zone indicator while dragging */}
          {draggingKind && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(219, 39, 119, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                fontWeight: 700,
                color: '#9d174d',
              }}
            >
              Drop {draggingKind === 'candle' ? '🕯️ Candle' : '🌸 Flower'} on the grave location
            </div>
          )}

          {/* Placed Flowers & Candles on the Grave */}
          {tributes.map((t, idx) => {
            const x = t.mapX ?? (44 + ((idx * 9) % 16))
            const y = t.mapY ?? (44 + ((idx * 7) % 16))
            const isCandle = t.kind === 'candle' || t.flowerType === 'candle'
            const icon = isCandle ? '🕯️' : (FLOWER_VARIETIES.find((v) => v.id === t.flowerType)?.icon || '🌸')
            return (
              <div
                key={t.id}
                style={{
                  position: 'absolute',
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: 'translate(-50%, -50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  pointerEvents: 'none',
                  zIndex: 5,
                }}
              >
                <span style={{ fontSize: '22px', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.45))' }}>{icon}</span>
                <span
                  style={{
                    background: 'rgba(15, 23, 42, 0.85)',
                    color: '#ffffff',
                    fontSize: '10px',
                    padding: '1px 6px',
                    borderRadius: '999px',
                    whiteSpace: 'nowrap',
                    marginTop: '1px',
                  }}
                >
                  {t.giverName}
                </span>
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            GPS: {grave.lat}, {grave.lng} · {tributes.length} offering(s) on this grave
          </span>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => {
              onOpenForm(grave)
              onClose()
            }}
          >
            💐 Open Full Tribute Form
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function CemeteriesPage() {
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const initialGraveQuery = searchParams.get('grave') ?? ''
  const [query, setQuery] = useState('')
  const [publishedOnly, setPublishedOnly] = useState(false)
  const [graveName, setGraveName] = useState(initialGraveQuery)
  const [graveYear, setGraveYear] = useState('')
  const [graveResults, setGraveResults] = useState<GraveRecord[] | null>(() =>
    initialGraveQuery ? searchGraves(initialGraveQuery) : null,
  )
  const checkId = useId()
  const [activeCemeteryMap, setActiveCemeteryMap] = useState<Cemetery | null>(null)
  const [activeGraveSite, setActiveGraveSite] = useState<GraveRecord | null>(() => {
    if (!initialGraveQuery) return null
    const matches = searchGraves(initialGraveQuery)
    return matches[0] ?? null
  })
  const [flowerGrave, setFlowerGrave] = useState<GraveRecord | null>(null)
  const [giverName, setGiverName] = useState(user?.name ?? '')
  const [flowerMessage, setFlowerMessage] = useState('')
  const [flowerType, setFlowerType] = useState<FlowerTribute['flowerType']>('white-lilies')
  const [flowerError, setFlowerError] = useState('')
  const [flowerSuccess, setFlowerSuccess] = useState('')

  const results = searchCemeteries(query, publishedOnly)

  function findGrave(e: FormEvent) {
    e.preventDefault()
    const year = Number(graveYear)
    setGraveResults(searchGraves(graveName, year >= 1800 && year <= 2100 ? year : undefined))
  }

  function handleSendFlowers(e: FormEvent) {
    e.preventDefault()
    if (!flowerGrave) return
    if (!giverName.trim() || !flowerMessage.trim()) {
      setFlowerError('Please enter your name and an in loving memory message.')
      return
    }

    flowerTributeStore.add({
      graveId: flowerGrave.id,
      giverName: giverName.trim(),
      message: flowerMessage.trim(),
      flowerType,
      kind: flowerType === 'candle' ? 'candle' : 'flower',
    })

    setFlowerSuccess('Your floral memorial in loving memory has been placed permanently on the grave!')
    setTimeout(() => {
      setFlowerSuccess('')
      setFlowerGrave(null)
      setGiverName('')
      setFlowerMessage('')
    }, 2000)
  }

  return (
    <>
      <Section>
        <SectionHead
          as="h1"
          eyebrow="Fidelity Smart Cemetery"
          title="Find a cemetery, view GPS grave sites & place floral memorials in loving memory."
        />
        <Callout tone="info">
          <strong>Smart Cemetery & Grave Pinning:</strong> View cemetery layouts, retrieve GPS coordinates for loved ones&apos; resting places with Google Maps navigation, and place virtual floral arrangements in loving memory and record your name on the grave.
        </Callout>
      </Section>

      <Section soft>
        <h2>Search cemeteries</h2>
        <div className="cem-search">
          <TextField label="Town or area" value={query} onChange={setQuery} placeholder="e.g. Harare, Bulawayo, Chitungwiza" type="search" />
          <label htmlFor={checkId} className="cem-check">
            <input id={checkId} type="checkbox" checked={publishedOnly} onChange={(e) => setPublishedOnly(e.target.checked)} /> Only with published plots
          </label>
        </div>
        <p className="muted" role="status">
          {results.length} of {cemeteries.length} cemeteries shown.
        </p>
        <div className="cem-list">
          {results.map((c) => (
            <CemeteryCard key={c.id} c={c} onOpenMap={setActiveCemeteryMap} />
          ))}
          {results.length === 0 && <p className="muted">No cemetery matches. Try Harare or Bulawayo.</p>}
        </div>
      </Section>

      <Section>
        <h2>Find an existing grave</h2>
        <p className="muted" style={{ maxWidth: '68ch' }}>
          Search verified burial records by deceased name and year of death to view exact GPS plot coordinates and leave floral arrangements in loving memory.
        </p>
        <form className="cem-search" onSubmit={findGrave} noValidate>
          <TextField label="Full name of the deceased" value={graveName} onChange={setGraveName} placeholder="e.g. Tendai Moyo, Grace Nyathi" />
          <TextField label="Year of death" tag="Optional" value={graveYear} onChange={setGraveYear} inputMode="numeric" />
          <button className="btn btn--primary" type="submit">
            Search grave records
          </button>
        </form>
        {graveResults && (
          <div role="status" className="stack" style={{ marginTop: 16 }}>
            {graveResults.length === 0 ? (
              <p className="muted">No record found matching those terms. Try searching for &ldquo;Moyo&rdquo;, &ldquo;Nyathi&rdquo;, or &ldquo;Ndlovu&rdquo;.</p>
            ) : (
              <ul className="cem-list" style={{ listStyle: 'none', padding: 0 }}>
                {graveResults.map((g) => (
                  <GraveResult
                    key={g.id}
                    g={g}
                    onViewGrave={setActiveGraveSite}
                    onAddFlowers={(grave) => {
                      setFlowerGrave(grave)
                      setFlowerError('')
                      setFlowerSuccess('')
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </Section>

      {/* Cemetery Map Modal */}
      {activeCemeteryMap && (
        <Modal title={`${activeCemeteryMap.name} — Google Maps`} onClose={() => setActiveCemeteryMap(null)}>
          <div className="stack" style={{ gap: '14px' }}>
            <p className="muted" style={{ margin: 0 }}>
              {activeCemeteryMap.directions}
            </p>
            <div style={{ borderRadius: '8px', overflow: 'hidden', height: '350px', border: '1px solid #cbd5e1' }}>
              <iframe
                title={activeCemeteryMap.name}
                width="100%"
                height="100%"
                frameBorder="0"
                style={{ border: 0 }}
                src={googleMapsEmbedUrl(activeCemeteryMap.lat, activeCemeteryMap.lng)}
                allowFullScreen
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                GPS: {activeCemeteryMap.lat}, {activeCemeteryMap.lng}
              </span>
              <a
                className="btn btn--primary btn--sm"
                href={googleMapsSearchUrl(`${activeCemeteryMap.name}, ${activeCemeteryMap.town}`)}
                target="_blank"
                rel="noreferrer"
              >
                Launch Navigation in Google Maps App
              </a>
            </div>
          </div>
        </Modal>
      )}

      {/* Grave Site GPS Viewer & Drag-and-Drop Flower/Candle Map Modal */}
      {activeGraveSite && (
        <GraveSiteMapModal
          grave={activeGraveSite}
          defaultName={user?.name ?? ''}
          onClose={() => setActiveGraveSite(null)}
          onOpenForm={(grave) => setFlowerGrave(grave)}
        />
      )}

      {/* Virtual Flowers Modal */}
      {flowerGrave && (
        <Modal
          title={`Leave Flowers for the Late ${flowerGrave.fullName}`}
          onClose={() => setFlowerGrave(null)}
        >
          <form className="stack" style={{ gap: '14px' }} onSubmit={handleSendFlowers}>
            <p className="muted" style={{ margin: 0, fontSize: '13px' }}>
              Select an arrangement to place virtually in loving memory on plot {flowerGrave.plot} at {flowerGrave.section}.
              Your name and tribute will be permanently recorded on this grave.
            </p>

            {flowerError && <Callout tone="danger">{flowerError}</Callout>}
            {flowerSuccess && <Callout tone="success">{flowerSuccess}</Callout>}

            <div className="field">
              <label className="field__label">Select Real Digital Offering (Flowers &amp; Flickering Vigil Candles)</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                <button
                  type="button"
                  className={`btn btn--sm ${flowerType === 'white-lilies' ? 'btn--primary' : 'btn--outline'}`}
                  onClick={() => setFlowerType('white-lilies' as FlowerTribute['flowerType'])}
                  style={{ textAlign: 'left', padding: '10px' }}
                >
                  <div style={{ fontSize: '24px' }}>🌸</div>
                  <strong>Pure White Lilies Wreath</strong>
                  <div style={{ fontSize: '11px', opacity: 0.8 }}>Handcrafted arrangement with ribbon</div>
                </button>
                <button
                  type="button"
                  className={`btn btn--sm ${flowerType === 'red-roses' ? 'btn--primary' : 'btn--outline'}`}
                  onClick={() => setFlowerType('red-roses' as FlowerTribute['flowerType'])}
                  style={{ textAlign: 'left', padding: '10px' }}
                >
                  <div style={{ fontSize: '24px' }}>🌹</div>
                  <strong>Red Rose Arrangement in Loving Memory &amp; Ribbon</strong>
                  <div style={{ fontSize: '11px', opacity: 0.8 }}>Deep respect and eternal love</div>
                </button>
                <button
                  type="button"
                  className={`btn btn--sm ${flowerType === 'sunflower-wreath' ? 'btn--primary' : 'btn--outline'}`}
                  onClick={() => setFlowerType('sunflower-wreath' as FlowerTribute['flowerType'])}
                  style={{ textAlign: 'left', padding: '10px' }}
                >
                  <div style={{ fontSize: '24px' }}>🕯️</div>
                  <strong>Flickering Eternal Candle</strong>
                  <div style={{ fontSize: '11px', opacity: 0.8 }}>Animated vigil light that shines forever</div>
                </button>
                <button
                  type="button"
                  className={`btn btn--sm ${flowerType === 'zimbabwe-protea' ? 'btn--primary' : 'btn--outline'}`}
                  onClick={() => setFlowerType('zimbabwe-protea' as FlowerTribute['flowerType'])}
                  style={{ textAlign: 'left', padding: '10px' }}
                >
                  <div style={{ fontSize: '24px' }}>🌺</div>
                  <strong>King Protea Heritage Spray</strong>
                  <div style={{ fontSize: '11px', opacity: 0.8 }}>Honour, courage and lasting heritage</div>
                </button>
              </div>
            </div>

            <TextField
              label="Your name / Family signature"
              value={giverName}
              onChange={setGiverName}
              placeholder="e.g. Farai & Children, Sibongile Moyo"
              autoComplete="name"
            />

            <TextField
              label="In Loving Memory Message / Ribbon Inscription"
              value={flowerMessage}
              onChange={setFlowerMessage}
              placeholder="e.g. Forever cherished, rest in God's eternal peace."
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
              <button type="button" className="btn btn--outline" onClick={() => setFlowerGrave(null)}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn"
                style={{
                  background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 600,
                }}
              >
                Place in Loving Memory
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
