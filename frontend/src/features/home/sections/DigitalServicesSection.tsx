import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Section } from '@/components/ui/Section'
import { SectionHead } from '@/components/ui/SectionHead'
import { StatusChip } from '@/components/ui/StatusChip'
import { memorialPath, paths } from '@/config/routes'
import { useAuth } from '@/features/auth'

const SAMPLE_TRACKS = [
  { id: 'home-trk-1', title: 'Peaceful Sunset (Mbira & Choir)', honouree: 'Grace Nyathi', style: 'Mbira Reflection', duration: '02:45' },
  { id: 'home-trk-2', title: 'Walk in Eternal Light', honouree: 'Tendai Moyo', style: 'Shona Acoustic Hymn', duration: '03:12' },
]

export function DigitalServicesSection() {
  const { user } = useAuth()
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
      void audioCtxRef.current?.close()
    }
  }, [])

  function stopAudio() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close()
      audioCtxRef.current = null
    }
    setPlayingId(null)
  }

  function togglePlay(id: string) {
    if (playingId === id) {
      stopAudio()
      return
    }
    stopAudio()
    setPlayingId(id)
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioCtx) {
        const ctx = new AudioCtx()
        audioCtxRef.current = ctx
        const notes = [261.63, 329.63, 392.0, 523.25, 392.0, 329.63]
        let step = 0
        const playNote = () => {
          if (!audioCtxRef.current) return
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.value = notes[step % notes.length]!
          gain.gain.setValueAtTime(0.05, ctx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.85)
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start()
          osc.stop(ctx.currentTime + 0.9)
          step++
        }
        playNote()
        timerRef.current = window.setInterval(playNote, 950)
      }
    } catch {
      /* AudioContext unavailable */
    }
  }

  const createTarget = (anchorHash?: string) =>
    user
      ? `${paths.digitalServices}${anchorHash ? `#${anchorHash}` : ''}`
      : `${paths.signup}?next=${encodeURIComponent(paths.digitalServices)}`

  return (
    <Section id="digital-services" soft>
      <SectionHead
        eyebrow="Digital Services"
        title="Explore AI memorial music, tribute videos, livestreaming & digital flowers."
      />
      <p className="muted" style={{ textAlign: 'center', maxWidth: '68ch', margin: '-0.75rem auto 1.5rem' }}>
        Explore everything freely right here. When you are ready to create your own AI memorial music, video, or livestream, create an account or use an invitation from the account holder.
      </p>

      <div className="grid grid--2" style={{ gap: '1.25rem' }}>
        {/* AI Memorial Music */}
        <article className="card stack">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
            <p className="tiny-label" style={{ margin: 0 }}>🎵 AI Memorial Music</p>
            <StatusChip tone="info">Explore &amp; Play</StatusChip>
          </div>
          <h3>Listen to existing memorial songs or compose a tribute</h3>
          <div className="stack" style={{ gap: '0.5rem' }}>
            {SAMPLE_TRACKS.map((trk) => {
              const isPlaying = playingId === trk.id
              return (
                <div
                  key={trk.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.6rem',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '8px',
                    background: isPlaying ? '#fdf2f8' : '#f8fafc',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '0.92rem' }}>{trk.title}</strong>
                    <div className="muted" style={{ fontSize: '0.8rem' }}>
                      {trk.honouree} · {trk.style} ({trk.duration})
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`btn btn--sm ${isPlaying ? 'btn--dark' : 'btn--outline'}`}
                    onClick={() => togglePlay(trk.id)}
                  >
                    {isPlaying ? '⏸ Pause' : '▶ Play'}
                  </button>
                </div>
              )
            })}
          </div>
          <div className="cluster">
            <Link className="btn btn--primary btn--sm" to={createTarget('create-music')}>
              {user ? 'Create AI Music' : 'Create account to compose AI Music'}
            </Link>
            <Link className="btn btn--outline btn--sm" to={paths.digitalServices}>
              Explore all music
            </Link>
          </div>
        </article>

        {/* Memorial Videos */}
        <article className="card stack">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
            <p className="tiny-label" style={{ margin: 0 }}>🎬 Memorial Videos</p>
            <StatusChip tone="info">Explore Reels</StatusChip>
          </div>
          <h3>Life-story tribute videos &amp; slideshow reels</h3>
          <div style={{ padding: '0.75rem', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <strong>A Life of Service &amp; Love (1954–2026)</strong>
            <div className="muted" style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
              Honouree: Grace Nyathi · Golden Memories Reel · By Tariro Nyathi
            </div>
          </div>
          <p className="muted">
            Combine family photographs, captions, and tribute music into a lasting video keepsake for relatives everywhere.
          </p>
          <div className="cluster">
            <Link className="btn btn--primary btn--sm" to={createTarget('create-video')}>
              {user ? 'Create Memorial Video' : 'Create account to make a Video'}
            </Link>
            <Link className="btn btn--outline btn--sm" to={paths.digitalServices}>
              Explore videos
            </Link>
          </div>
        </article>

        {/* Digital Flowers & Candles */}
        <article className="card stack">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
            <p className="tiny-label" style={{ margin: 0 }}>🌸🕯️ Digital Flowers &amp; Candles</p>
            <StatusChip tone="success">Open to Everyone</StatusChip>
          </div>
          <h3>Place flowers &amp; candles directly on the grave on Google Maps</h3>
          <p className="muted">
            Drag a flower or vigil candle onto your loved one&apos;s grave on Google Maps with your name recorded, or visit a digital memorial garden.
          </p>
          <div className="cluster">
            <Link className="btn btn--primary btn--sm" to={`${paths.cemeteries}?grave=Grace+Nyathi`}>
              🌸🕯️ Place on Grave Map
            </Link>
            <Link className="btn btn--outline btn--sm" to={memorialPath('grace-nyathi')}>
              Open Memorial Garden
            </Link>
          </div>
        </article>

        {/* Funeral Livestreaming */}
        <article className="card stack">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
            <p className="tiny-label" style={{ margin: 0 }}>📡 Funeral Livestreaming</p>
            <StatusChip tone="info">Diaspora &amp; Family</StatusChip>
          </div>
          <h3>Live chapel &amp; graveside coverage with recorded replay</h3>
          <p className="muted">
            Share private livestream links with relatives abroad so nobody misses the service, hymns, or final farewell.
          </p>
          <div className="cluster">
            <Link className="btn btn--primary btn--sm" to={paths.digitalServices}>
              Explore Digital Services
            </Link>
            <Link className="btn btn--outline btn--sm" to={user ? paths.accountFuneralStreaming : `${paths.signup}?next=${encodeURIComponent(paths.accountFuneralStreaming)}`}>
              {user ? 'Manage Livestream' : 'Create account to host Livestream'}
            </Link>
          </div>
        </article>
      </div>
    </Section>
  )
}
