import { useId, useState, useEffect, type FormEvent } from 'react'
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
import { useKuwanaTokens, TOKEN_COSTS } from '@/features/account/tokens'
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
          💐 Leave Virtual Flowers (10 Tokens)
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

export default function CemeteriesPage() {
  const [query, setQuery] = useState('')
  const [publishedOnly, setPublishedOnly] = useState(false)
  const [graveName, setGraveName] = useState('')
  const [graveYear, setGraveYear] = useState('')
  const [graveResults, setGraveResults] = useState<GraveRecord[] | null>(null)
  const checkId = useId()

  const { balance, spend } = useKuwanaTokens()

  // Modals state
  const [activeCemeteryMap, setActiveCemeteryMap] = useState<Cemetery | null>(null)
  const [activeGraveSite, setActiveGraveSite] = useState<GraveRecord | null>(null)
  const [flowerGrave, setFlowerGrave] = useState<GraveRecord | null>(null)

  // Flower Form State
  const [giverName, setGiverName] = useState('')
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

    if (balance < TOKEN_COSTS.FLOWER_TRIBUTE) {
      setFlowerError(`Insufficient Kuwana tokens. You need ${TOKEN_COSTS.FLOWER_TRIBUTE} tokens (current balance: ${balance}). Top up in the header.`)
      return
    }

    const deducted = spend(
      TOKEN_COSTS.FLOWER_TRIBUTE,
      'flower-tribute',
      `Virtual flower tribute for late ${flowerGrave.fullName} at plot ${flowerGrave.plot}`,
    )

    if (!deducted) {
      setFlowerError('Could not deduct tokens. Please try again.')
      return
    }

    flowerTributeStore.add({
      graveId: flowerGrave.id,
      giverName: giverName.trim(),
      message: flowerMessage.trim(),
      flowerType,
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
          <strong>Smart Cemetery & Grave Pinning:</strong> View cemetery layouts, retrieve GPS coordinates for loved ones&apos; resting places with Google Maps navigation, and place virtual floral arrangements in loving memory using Kuwana Tokens.
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

      {/* Grave Site GPS Viewer Modal */}
      {activeGraveSite && (
        <Modal
          title={`Grave Site: ${activeGraveSite.fullName} (${activeGraveSite.plot})`}
          onClose={() => setActiveGraveSite(null)}
        >
          <div className="stack" style={{ gap: '14px' }}>
            <div
              style={{
                background: '#f1f5f9',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '13px',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '8px',
              }}
            >
              <div>
                <strong>Section:</strong> {activeGraveSite.section}
              </div>
              <div>
                <strong>Plot Number:</strong> {activeGraveSite.plot}
              </div>
              <div>
                <strong>Years:</strong> {activeGraveSite.birthYear} — {activeGraveSite.deathYear}
              </div>
              <div>
                <strong>Status:</strong> {activeGraveSite.verified ? 'Verified Marker' : 'Pending verification'}
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '13px' }}>
              <strong>Walking route from main gate:</strong> {activeGraveSite.walkingDirections}
            </p>

            <div style={{ borderRadius: '8px', overflow: 'hidden', height: '340px', border: '1px solid #cbd5e1' }}>
              <iframe
                title={`Grave ${activeGraveSite.fullName}`}
                width="100%"
                height="100%"
                frameBorder="0"
                style={{ border: 0 }}
                src={googleMapsEmbedUrl(activeGraveSite.lat, activeGraveSite.lng)}
                allowFullScreen
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                GPS: {activeGraveSite.lat}, {activeGraveSite.lng}
              </span>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => {
                  setFlowerGrave(activeGraveSite)
                  setActiveGraveSite(null)
                }}
              >
                💐 Leave Virtual Flowers
              </button>
            </div>
          </div>
        </Modal>
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
              Cost: <strong>{TOKEN_COSTS.FLOWER_TRIBUTE} Kuwana Tokens</strong> (Your balance: <strong>{balance}</strong>).
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
                  <div style={{ fontSize: '24px' }}>?????</div>
                  <strong>Pure White Lilies Wreath</strong>
                  <div style={{ fontSize: '11px', opacity: 0.8 }}>Handcrafted arrangement with ribbon</div>
                </button>
                <button
                  type="button"
                  className={`btn btn--sm ${flowerType === 'red-roses' ? 'btn--primary' : 'btn--outline'}`}
                  onClick={() => setFlowerType('red-roses' as FlowerTribute['flowerType'])}
                  style={{ textAlign: 'left', padding: '10px' }}
                >
                  <div style={{ fontSize: '24px' }}>???</div>
                  <strong>Red Rose Arrangement in Loving Memory &amp; Ribbon</strong>
                  <div style={{ fontSize: '11px', opacity: 0.8 }}>Deep respect and eternal love</div>
                </button>
                <button
                  type="button"
                  className={`btn btn--sm ${flowerType === 'sunflower-wreath' ? 'btn--primary' : 'btn--outline'}`}
                  onClick={() => setFlowerType('sunflower-wreath' as FlowerTribute['flowerType'])}
                  style={{ textAlign: 'left', padding: '10px' }}
                >
                  <div style={{ fontSize: '24px' }}>?????</div>
                  <strong>Flickering Eternal Candle</strong>
                  <div style={{ fontSize: '11px', opacity: 0.8 }}>Animated vigil light that shines forever</div>
                </button>
                <button
                  type="button"
                  className={`btn btn--sm ${flowerType === 'zimbabwe-protea' ? 'btn--primary' : 'btn--outline'}`}
                  onClick={() => setFlowerType('zimbabwe-protea' as FlowerTribute['flowerType'])}
                  style={{ textAlign: 'left', padding: '10px' }}
                >
                  <div style={{ fontSize: '24px' }}>????</div>
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
                Place in Loving Memory (10 Tokens)
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
