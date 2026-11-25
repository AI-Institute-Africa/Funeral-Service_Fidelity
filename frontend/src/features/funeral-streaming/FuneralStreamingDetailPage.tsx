import { useState, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Callout } from '@/components/ui/Callout'
import { PublicShareBar } from '@/components/ui/PublicShareBar'
import { Icon } from '@/components/ui/Icon'
import { StatusChip } from '@/components/ui/StatusChip'
import { funeralRecordPath, paths } from '@/config/routes'
import { useAuth } from '@/features/auth'
import { sendAlerts, type PlanInput } from '@/features/alerts'
import { normaliseInternationalPhone } from '@/lib/phone'
import { statusLabels, statusTone, streamViewerForUser, type StreamStatus } from './data'
import { funeralStreamingStore } from './store'
import { useKuwanaTokens } from '@/features/account/tokens'
import './funeral-streaming.css'

export default function FuneralStreamingDetailPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const [stream, setStream] = useState(() => funeralStreamingStore.get(id))
  const [msg, setMsg] = useState('')
  const [invite, setInvite] = useState({ name: '', contact: '', consentForAlerts: false })
  const [replayOpened, setReplayOpened] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const { balance } = useKuwanaTokens()

  if (!stream) {
    return (
      <div className="page-stack">
        <div className="card empty empty--large">
          <h1 className="panel__title">Coverage not found</h1>
          <Link className="btn btn--primary" to={paths.accountFuneralStreaming}>
            Back
          </Link>
        </div>
      </div>
    )
  }

  const viewer = user ? streamViewerForUser(stream, user) : undefined
  const canManage = user?.role === 'admin'

  // Logged-in users have anytime VOD access
  const hasAccess = Boolean(canManage || viewer || user)

  if (!hasAccess) {
    return (
      <div className="page-stack">
        <div className="card empty empty--large">
          <h1 className="panel__title">Sign in required to view coverage</h1>
          <p className="muted">
            Please log in with your family credentials to watch the live funeral stream and anytime video on-demand replay.
          </p>
          <Link className="btn btn--primary" to={paths.login}>
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  const flash = (t: string) => {
    setMsg(t)
    window.setTimeout(() => setMsg(''), 2500)
  }

  const notifyLive = () => {
    const inputs: PlanInput[] = stream.viewers.flatMap((v): PlanInput[] => {
      const phone = v.status === 'revoked' || !v.consentForAlerts ? null : normaliseInternationalPhone(v.contact)
      return phone
        ? [
            {
              event: 'stream.live',
              recipient: { phone, consent: true },
              payload: { name: v.name, deceased: stream.personName, link: window.location.href },
              ref: `${stream.id}:live:${v.id}`,
            },
          ]
        : []
    })
    void sendAlerts(inputs)
  }

  const setStatus = (status: StreamStatus) => {
    if (!canManage) return
    if (status === 'live' && stream.status !== 'live') notifyLive()
    const n = funeralStreamingStore.setStatus(stream.id, status)
    if (n) setStream(n)
    flash(`Status changed to ${statusLabels[status]}.`)
  }

  const addViewer = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canManage || !invite.name.trim() || !invite.contact.trim()) return
    const n = funeralStreamingStore.addViewer(stream.id, invite.name.trim(), invite.contact.trim(), invite.consentForAlerts)
    if (n) setStream(n)
    setInvite({ name: '', contact: '', consentForAlerts: false })
    flash('Viewer invitation created and access granted.')
  }

  const saveRecording = () => {
    const n = funeralStreamingStore.saveRecording(stream.id, stream.savedToArchiveId ?? 'fr-nyathi')
    if (n) setStream(n)
    flash('Recording linked to Digital Funeral Records archive.')
  }

  const jumpToChapter = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds
      void videoRef.current.play()
    }
  }

  const isVideoPlayable = stream.status === 'live' || (stream.status === 'ended' && stream.recordingAvailable) || replayOpened

  return (
    <div className="page-stack fs-grid">
      <header className="page-head reveal">
        <p className="eyebrow">Funeral live stream & video-on-demand archive</p>
        <h1>{stream.personName}</h1>
        <p className="muted">{stream.serviceTitle}</p>
        <div className="fs-actions">
          <Link className="btn btn--outline btn--sm" to={paths.accountFuneralStreaming}>
            All coverage
          </Link>
          <StatusChip tone={statusTone[stream.status]}>{statusLabels[stream.status]}</StatusChip>
          <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>
            ● Logged-in VOD Access Active
          </span>
        </div>
        <PublicShareBar
          url={window.location.href}
          title={`Share funeral coverage for ${stream.personName}`}
          message={`Join or watch the funeral service coverage for ${stream.personName}:`}
          compact
        />
      </header>

      {msg && <Callout tone="success">{msg}</Callout>}

      {/* Video on Demand Player Section */}
      <section className="fs-player" aria-label="Funeral video on-demand player" style={{ background: '#090d16' }}>
        <div className="fs-player__badge">
          <span className="fs-sim" style={{ background: stream.status === 'live' ? '#dc2626' : '#2563eb' }}>
            {stream.status === 'live' ? '● LIVE BROADCAST' : 'ON-DEMAND REPLAY ARCHIVE'}
          </span>
        </div>

        {isVideoPlayable && (
          <div style={{ padding: '16px', maxWidth: '880px', margin: '0 auto', width: '100%' }}>
            <video
              ref={videoRef}
              controls
              autoPlay={stream.status === 'live'}
              playsInline
              style={{
                width: '100%',
                maxHeight: '480px',
                borderRadius: '12px',
                background: '#000000',
                boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
              }}
              src={stream.videoUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'}
            >
              Your browser does not support the video tag.
            </video>

            {/* Chapters / Timeline Scrubber */}
            {stream.chapters && stream.chapters.length > 0 && (
              <div style={{ marginTop: '12px', background: 'rgba(255,255,255,0.08)', padding: '10px 14px', borderRadius: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0', display: 'block', marginBottom: '6px' }}>
                  Jump to Service Chapters:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {stream.chapters.map((ch, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="btn btn--outline btn--sm"
                      style={{ fontSize: '11px', color: '#ffffff', borderColor: '#475569', padding: '3px 8px' }}
                      onClick={() => jumpToChapter(ch.seconds)}
                    >
                      ⏱️ {ch.time} — {ch.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!isVideoPlayable && (
          <div className="fs-player__inner">
            <Icon name={stream.status === 'scheduled' ? 'calendar' : 'alert'} size={42} />
            <h2 style={{ margin: 0, fontSize: 'var(--text-display-sm)', color: '#ffffff' }}>
              {stream.status === 'scheduled' && 'Coverage is scheduled'}
              {stream.status === 'unavailable' && 'Coverage unavailable'}
            </h2>
            <p style={{ color: '#cbd5e1' }}>
              {stream.status === 'scheduled'
                ? `The live broadcast will commence at ${stream.date} ${stream.time}. Once concluded, you can re-watch the full recording anytime.`
                : 'This event cannot be viewed right now.'}
            </p>
            <div className="fs-actions" style={{ justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setReplayOpened(true)}
              >
                Preview Archive Recording Now
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="fs-two">
        <section className="card stack">
          <p className="eyebrow">Funeral event details</p>
          <h2 className="panel__title">Coverage & Venue Information</h2>
          <div className="fs-kv">
            <div>
              <span>Date</span>
              <strong>{stream.date}</strong>
            </div>
            <div>
              <span>Time</span>
              <strong>{stream.time}</strong>
            </div>
            <div>
              <span>Venue</span>
              <strong>{stream.venue}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{statusLabels[stream.status]}</strong>
            </div>
            <div>
              <span>VOD Access</span>
              <strong>Permanent (Anytime Logged-in View)</strong>
            </div>
          </div>
          <p>{stream.details}</p>

          {canManage && (
            <div className="fs-actions">
              <span className="fs-note">Operations status controls:</span>
              {(['scheduled', 'live', 'ended', 'unavailable'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`btn btn--sm ${stream.status === s ? 'btn--dark' : 'btn--outline'}`}
                  onClick={() => setStatus(s)}
                >
                  {statusLabels[s]}
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="card stack">
          <p className="eyebrow">Recording to archive</p>
          <h2 className="panel__title">Digital Funeral Records</h2>
          {stream.recordingAvailable ? (
            <>
              <p>
                This recording is safely preserved in high definition. Authorised family members can review, download, or link it directly into their permanent Family History archive.
              </p>
              {stream.savedToArchiveId ? (
                <Link className="btn btn--primary" to={funeralRecordPath(stream.savedToArchiveId)}>
                  Open in Digital Funeral Records
                </Link>
              ) : (
                <button type="button" className="btn btn--primary" onClick={saveRecording}>
                  Save to Digital Funeral Records
                </button>
              )}
            </>
          ) : (
            <p className="muted">Recording will be generated automatically once the service concludes.</p>
          )}

          <div style={{ marginTop: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              🪙 Kuwana Token Wallet: <strong>{balance} Tokens Available</strong>
            </span>
          </div>
        </aside>
      </div>

      {canManage && (
        <section className="card stack">
          <p className="eyebrow">Invited-viewer access & WhatsApp alerts</p>
          <h2 className="panel__title">Viewer invitation and access management</h2>
          <form className="fs-form" onSubmit={addViewer}>
            <div className="split" style={{ gap: 'var(--space-3)' }}>
              <label className="field">
                <span className="field__label">Viewer name</span>
                <input
                  className="input"
                  value={invite.name}
                  onChange={(e) => setInvite({ ...invite, name: e.target.value })}
                  placeholder="e.g. Tendai Moyo"
                  required
                />
              </label>
              <label className="field">
                <span className="field__label">Phone / WhatsApp number</span>
                <input
                  className="input"
                  value={invite.contact}
                  onChange={(e) => setInvite({ ...invite, contact: e.target.value })}
                  placeholder="e.g. +263 77 123 4567"
                  required
                />
              </label>
            </div>
            <label className="fs-note">
              <input
                type="checkbox"
                checked={invite.consentForAlerts}
                onChange={(e) => setInvite({ ...invite, consentForAlerts: e.target.checked })}
              />{' '}
              Send instant WhatsApp alert when coverage goes live or replay is ready
            </label>
            <div className="fs-actions">
              <button type="submit" className="btn btn--primary btn--sm">
                Grant Viewer VOD Access & Send Alert
              </button>
            </div>
          </form>
          <div className="fs-viewers">
            {stream.viewers.map((v) => (
              <article key={v.id} className="fs-viewer">
                <div>
                  <strong>{v.name}</strong>
                  <div className="fs-note">
                    {v.contact} · Invited {new Date(v.invitedAt).toLocaleDateString('en-GB')}
                    {v.accessedAt ? ` · Last watched ${new Date(v.accessedAt).toLocaleDateString('en-GB')}` : ''}
                  </div>
                </div>
                <div className="fs-actions">
                  <StatusChip tone={v.status === 'accessed' ? 'success' : v.status === 'invited' ? 'info' : 'danger'}>
                    {v.status}
                  </StatusChip>
                  {v.status !== 'accessed' && (
                    <button
                      type="button"
                      className="btn btn--outline btn--sm"
                      onClick={() => {
                        const n = funeralStreamingStore.setViewer(stream.id, v.id, 'accessed')
                        if (n) setStream(n)
                      }}
                    >
                      Mark accessed
                    </button>
                  )}
                  {v.status !== 'revoked' && (
                    <button
                      type="button"
                      className="btn btn--outline btn--sm"
                      onClick={() => {
                        const n = funeralStreamingStore.setViewer(stream.id, v.id, 'revoked')
                        if (n) setStream(n)
                      }}
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
