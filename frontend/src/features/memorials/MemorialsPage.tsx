import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { QueryState } from '@/components/ui/QueryState'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusChip } from '@/components/ui/StatusChip'
import { accountMemorialPath, memorialPath, paths } from '@/config/routes'
import { lifespan, type OwnedMemorial } from './data'
import { useMyMemorials } from './queries'
import { Portrait } from './Portrait'
import './memorial.css'
import './studio.css'

export default function MemorialsPage() {
  const memorials = useMyMemorials()

  return (
    <div className="page-stack">
      <header className="page-head page-head--row reveal">
        <div>
          <p className="eyebrow">Memorials</p>
          <h1>Keep their story alive.</h1>
          <p className="muted" style={{ marginTop: 'var(--space-2)' }}>Digital memorials can be connected to your Family History and Family Tree.</p>
        </div>
        <div className="cluster">
          <Link className="btn btn--outline" to={paths.accountFamilyHistory}>Family History & Family Tree</Link>
          {memorials.data && memorials.data.length > 0 && (
            <Link className="btn btn--primary" to={paths.accountMemorialNew}>
              <Icon name="plus" size={18} />
              Create a memorial
            </Link>
          )}
        </div>
      </header>

      {memorials.data ? (
        memorials.data.length > 0 ? (
          <ul className="memorial-list">
            {memorials.data.map((memorial, index) => (
              <li key={memorial.id} className="reveal" style={{ '--i': index } as React.CSSProperties}>
                <MemorialCard memorial={memorial} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyMemorials />
        )
      ) : memorials.isPending ? (
        <div className="memorial-list" role="status" aria-busy="true">
          <span className="visually-hidden">Loading your memorials…</span>
          <Skeleton height="9rem" className="skeleton--card" />
        </div>
      ) : (
        <QueryState isPending={false} error={memorials.error} onRetry={() => void memorials.refetch()} noun="your memorials" />
      )}
    </div>
  )
}

function EmptyMemorials() {
  return (
    <div className="card empty empty--large">
      <span className="icon-tile icon-tile--lg">
        <Icon name="flower" size={26} />
      </span>
      <h2 className="panel__title">A place for everyone who loved them</h2>
      <p className="muted" style={{ maxWidth: '46ch' }}>
        Write their life story, share photographs and the service details, and invite family and friends to leave
        flowers, light candles and share in loving memory.
      </p>
      <Link className="btn btn--primary" to={paths.accountMemorialNew}>
        Create a memorial
      </Link>
    </div>
  )
}

function MemorialCard({ memorial }: { memorial: OwnedMemorial }) {
  const flowers = memorial.flowers ?? 0
  const candles = memorial.candles ?? 0
  const tributeCount = memorial.tributeCount ?? 0
  const pendingTributes = memorial.pendingTributes ?? 0

  return (
    <article className="card memorial-card-owner">
      <Portrait memorial={memorial} size="md" />

      <div className="memorial-card-owner__main">
        <div className="memorial-card-owner__title">
          <h2>{memorial.name || 'In Loving Memory'}</h2>
          <StatusChip tone={memorial.published ? 'success' : 'neutral'}>
            {memorial.published ? 'Published' : 'Private draft'}
          </StatusChip>
        </div>
        <p className="muted">
          {lifespan(memorial.born, memorial.died)}
          {memorial.location && <> · {memorial.location}</>}
        </p>
        <ul className="memorial-card-owner__stats">
          <li>
            <Icon name="flower" size={16} /> {flowers.toLocaleString('en-US')}
          </li>
          <li>
            <Icon name="candle" size={16} /> {candles.toLocaleString('en-US')}
          </li>
          <li>
            <Icon name="heart" size={16} /> {tributeCount}
          </li>
          {pendingTributes > 0 && (
            <li>
              <Link className="memorial-card-owner__pending" to={accountMemorialPath(memorial.id, 'tributes')}>
                {pendingTributes} in loving memory to review
              </Link>
            </li>
          )}
        </ul>
      </div>

      <div className="memorial-card-owner__actions">
        <Link className="btn btn--outline btn--sm" to={memorialPath(memorial.slug || memorial.id)}>
          {memorial.published ? 'View' : 'Preview'}
        </Link>
        <Link className="btn btn--dark btn--sm" to={accountMemorialPath(memorial.id)}>
          Edit
        </Link>
      </div>
    </article>
  )
}
