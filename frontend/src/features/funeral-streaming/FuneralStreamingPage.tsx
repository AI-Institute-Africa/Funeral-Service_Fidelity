import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { StatusChip } from '@/components/ui/StatusChip'
import { funeralRecordPath, funeralStreamingPath, paths } from '@/config/routes'
import { useAuth } from '@/features/auth'
import { statusLabels, statusTone, streamViewerForUser } from './data'
import { funeralStreamingStore } from './store'
import './funeral-streaming.css'

export default function FuneralStreamingPage() {
  const { user } = useAuth()
  const allStreams = funeralStreamingStore.list()
  const streams = user?.role === 'admin'
    ? allStreams
    : allStreams.filter((stream) => Boolean(user && streamViewerForUser(stream, user)))
  return (
    <div className="page-stack fs-grid">
      <header className="page-head page-head--row reveal">
        <div>
          <p className="eyebrow">Live Funeral Coverage</p>
          <h1>Funeral coverage and replays</h1>
          <p className="muted" style={{ maxWidth: '72ch' }}>Signed-in invitees can return to their coverage record at any time. Administrators can manage sample invitations and link completed recordings to the Digital Funeral Records archive.</p>
        </div>
        <Link className="btn btn--outline" to={paths.accountFuneralRecords}><Icon name="archive" size={18} /> Funeral records</Link>
      </header>
      <div className="callout callout--warning"><Icon name="alert" size={20} /><div><strong>Demonstration only.</strong> This prototype uses simulated video and placeholder footage. It does not integrate with real live streaming services and must not be presented as an actual funeral broadcast.</div></div>
      <div className="fs-list">
        {streams.map((s) => (
          <article key={s.id} className="card stack">
            <div className="fs-card__top">
              <div>
                <p className="eyebrow">{s.date} · {s.time}</p>
                <h2 className="panel__title" style={{ margin: 0 }}>{s.personName}</h2>
                <p className="muted">{s.serviceTitle} · {s.venue}</p>
              </div>
              <StatusChip tone={statusTone[s.status]}>{statusLabels[s.status]}</StatusChip>
            </div>
            <p>{s.details}</p>
            <div className="fs-actions">
              <Link className="btn btn--primary btn--sm" to={funeralStreamingPath(s.id)}>Open coverage</Link>
              <span className="badge">{s.viewers.length} viewer records</span>
              {s.recordingAvailable && <span className="badge">Recording available</span>}
              {s.savedToArchiveId && <Link className="btn btn--outline btn--sm" to={funeralRecordPath(s.savedToArchiveId)}>Saved to archive</Link>}
            </div>
          </article>
        ))}
        {streams.length === 0 && <div className="card empty"><h2 className="panel__title">No coverage invitations</h2><p className="muted">Coverage records appear here after the family administrator invites your signed-in phone number or email address.</p></div>}
      </div>
    </div>
  )
}
