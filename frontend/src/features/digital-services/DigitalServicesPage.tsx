import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Callout } from '@/components/ui/Callout'
import { Section } from '@/components/ui/Section'
import { SectionHead } from '@/components/ui/SectionHead'
import { StatusChip } from '@/components/ui/StatusChip'
import { PublicShareBar } from '@/components/ui/PublicShareBar'
import { memorialPath, paths } from '@/config/routes'
import { useAuth } from '@/features/auth'

type MusicTrack = {
  id: string
  title: string
  honouree: string
  style: string
  createdBy: string
  duration: string
  createdAt: string
}

type VideoTribute = {
  id: string
  title: string
  honouree: string
  theme: string
  createdBy: string
  createdAt: string
}

const MUSIC_KEY = 'fidelity.digitalServices.music.v1'
const VIDEOS_KEY = 'fidelity.digitalServices.videos.v1'

const SEED_TRACKS: MusicTrack[] = [
  {
    id: 'trk-1',
    title: 'Peaceful Sunset (Mbira & Choir)',
    honouree: 'Grace Nyathi',
    style: 'Mbira Reflection',
    createdBy: 'Nyathi Family',
    duration: '02:45',
    createdAt: '2026-11-18T10:00:00.000Z',
  },
  {
    id: 'trk-2',
    title: 'Walk in Eternal Light',
    honouree: 'Tendai Moyo',
    style: 'Shona Acoustic Hymn',
    createdBy: 'Moyo Family',
    duration: '03:12',
    createdAt: '2026-11-20T14:20:00.000Z',
  },
]

const SEED_VIDEOS: VideoTribute[] = [
  {
    id: 'vid-1',
    title: 'A Life of Service & Love (1954–2026)',
    honouree: 'Grace Nyathi',
    theme: 'Golden Memories Reel',
    createdBy: 'Tariro Nyathi',
    createdAt: '2026-11-19T09:15:00.000Z',
  },
]

function readStored<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as T[]
  } catch {
    /* ignore */
  }
  return fallback
}

export default function DigitalServicesPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const inviteParam = searchParams.get('invite') ?? ''
  const hostParam = searchParams.get('host') ?? ''

  const [inviteCodeInput, setInviteCodeInput] = useState(inviteParam)
  const [unlockedByInvite, setUnlockedByInvite] = useState(Boolean(inviteParam))
  const [inviteError, setInviteError] = useState('')

  const [tracks, setTracks] = useState<MusicTrack[]>(() => readStored(MUSIC_KEY, SEED_TRACKS))
  const [videos, setVideos] = useState<VideoTribute[]>(() => readStored(VIDEOS_KEY, SEED_VIDEOS))

  // Music creator state
  const [musicTitle, setMusicTitle] = useState('')
  const [musicHonouree, setMusicHonouree] = useState('')
  const [musicStyle, setMusicStyle] = useState('Shona Acoustic Hymn')
  const [musicPrompt, setMusicPrompt] = useState('')
  const [musicNotice, setMusicNotice] = useState('')
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const audioTimerRef = useRef<number | null>(null)

  // Video creator state
  const [videoTitle, setVideoTitle] = useState('')
  const [videoHonouree, setVideoHonouree] = useState('')
  const [videoTheme, setVideoTheme] = useState('Golden Memories Reel')
  const [videoNotice, setVideoNotice] = useState('')

  const hasAccess = Boolean(user) || unlockedByInvite
  const myInviteToken = user ? `FLA-${user.id.slice(0, 6).toUpperCase()}` : inviteParam || 'FLA-INVITE'
  const shareUrl = `${window.location.origin}${paths.digitalServices}?invite=${encodeURIComponent(myInviteToken)}&host=${encodeURIComponent(user?.name ?? hostParam ?? 'Family Host')}`

  useEffect(() => {
    return () => {
      if (audioTimerRef.current) window.clearInterval(audioTimerRef.current)
      void audioCtxRef.current?.close()
    }
  }, [])

  function stopPlayback() {
    if (audioTimerRef.current) {
      window.clearInterval(audioTimerRef.current)
      audioTimerRef.current = null
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close()
      audioCtxRef.current = null
    }
    setPlayingTrackId(null)
  }

  function togglePlayTrack(track: MusicTrack) {
    if (playingTrackId === track.id) {
      stopPlayback()
      return
    }
    stopPlayback()
    setPlayingTrackId(track.id)

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
          gain.gain.setValueAtTime(0.06, ctx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.85)
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start()
          osc.stop(ctx.currentTime + 0.9)
          step++
        }
        playNote()
        audioTimerRef.current = window.setInterval(playNote, 950)
      }
    } catch {
      /* AudioContext unavailable */
    }
  }

  function handleUnlockInvite(e: FormEvent) {
    e.preventDefault()
    const code = inviteCodeInput.trim()
    if (code.length < 4) {
      setInviteError('Please enter a valid invitation code or link token from the account holder.')
      return
    }
    setInviteError('')
    setUnlockedByInvite(true)
    setSearchParams({ invite: code, host: hostParam || 'Account Holder' })
  }

  function handleCreateMusic(e: FormEvent) {
    e.preventDefault()
    if (!musicTitle.trim() || !musicHonouree.trim()) return
    const nextTrack: MusicTrack = {
      id: `trk-${Date.now().toString(36)}`,
      title: musicTitle.trim(),
      honouree: musicHonouree.trim(),
      style: musicStyle,
      createdBy: user?.name ?? hostParam ?? 'Invited Family Member',
      duration: '02:30',
      createdAt: new Date().toISOString(),
    }
    const updated = [nextTrack, ...tracks]
    setTracks(updated)
    try {
      localStorage.setItem(MUSIC_KEY, JSON.stringify(updated))
    } catch {
      /* ignore */
    }
    setMusicTitle('')
    setMusicHonouree('')
    setMusicPrompt('')
    setMusicNotice(`AI memorial track "${nextTrack.title}" generated and ready to play!`)
  }

  function handleCreateVideo(e: FormEvent) {
    e.preventDefault()
    if (!videoTitle.trim() || !videoHonouree.trim()) return
    const nextVideo: VideoTribute = {
      id: `vid-${Date.now().toString(36)}`,
      title: videoTitle.trim(),
      honouree: videoHonouree.trim(),
      theme: videoTheme,
      createdBy: user?.name ?? hostParam ?? 'Invited Family Member',
      createdAt: new Date().toISOString(),
    }
    const updated = [nextVideo, ...videos]
    setVideos(updated)
    try {
      localStorage.setItem(VIDEOS_KEY, JSON.stringify(updated))
    } catch {
      /* ignore */
    }
    setVideoTitle('')
    setVideoHonouree('')
    setVideoNotice(`Memorial video "${nextVideo.title}" created and added to this page!`)
  }

  return (
    <>
      <Section>
        <SectionHead
          as="h1"
          eyebrow="Fidelity Digital Services"
          title="Create & share digital memories: AI music, videos, livestreaming & flowers."
        />

        {!hasAccess ? (
          <div className="grid grid--2" style={{ gap: '1.5rem', marginTop: '1rem' }}>
            <article className="card stack">
              <p className="eyebrow">Account access</p>
              <h2>Create an account or sign in</h2>
              <p className="muted">
                Digital Services are accessed through an account or an invitation from the account holder. Create your account to host and share digital memories.
              </p>
              <div className="cluster">
                <Link className="btn btn--primary" to={`${paths.signup}?next=${encodeURIComponent(paths.digitalServices)}`}>
                  Create account
                </Link>
                <Link className="btn btn--outline" to={`${paths.login}?next=${encodeURIComponent(paths.digitalServices)}`}>
                  Sign in
                </Link>
              </div>
            </article>

            <form className="card stack" onSubmit={handleUnlockInvite}>
              <p className="eyebrow">Invited relative or friend</p>
              <h2>Access via invitation</h2>
              <p className="muted">
                If an account holder invited you, enter their invitation code below or open the link they shared with you.
              </p>
              <label className="field">
                <span className="field__label">Invitation code</span>
                <input
                  className="input"
                  placeholder="e.g. FLA-INVITE"
                  value={inviteCodeInput}
                  onChange={(e) => setInviteCodeInput(e.target.value)}
                  required
                />
              </label>
              {inviteError && <Callout tone="danger">{inviteError}</Callout>}
              <button type="submit" className="btn btn--dark">
                Open Digital Services
              </button>
            </form>
          </div>
        ) : (
          <div className="stack" style={{ gap: '1.25rem' }}>
            <Callout tone="success">
              <strong>Workspace unlocked</strong>{' '}
              {user
                ? `Signed in as ${user.name}. Invite family & friends using the share link below so they can create digital memories here too.`
                : `Accessed via invitation (${inviteParam}${hostParam ? ` · Hosted by ${hostParam}` : ''}). You can create AI music, videos, livestreaming links, and flowers.`}
            </Callout>

            <div className="card stack">
              <p className="eyebrow" style={{ marginBottom: 0 }}>Invite others to Digital Services</p>
              <PublicShareBar
                title="Share Digital Services Invitation Link"
                url={shareUrl}
                message="You are invited to create digital memories (AI music, videos, livestreaming, and flowers) on Fidelity Life Digital Services:"
              />
            </div>
          </div>
        )}
      </Section>

      {hasAccess && (
        <>
          {/* 1. AI Memorial Music (Create & Play Existing) */}
          <Section soft>
            <div className="grid grid--2" style={{ gap: '1.5rem', alignItems: 'start' }}>
              <div className="card stack">
                <p className="eyebrow">🎵 AI Memorial Music</p>
                <h2 style={{ margin: 0 }}>Play existing memorial music</h2>
                <p className="muted">Listen to existing tribute songs or newly generated AI compositions.</p>
                <div className="stack" style={{ gap: '0.75rem' }}>
                  {tracks.map((trk) => {
                    const isPlaying = playingTrackId === trk.id
                    return (
                      <div
                        key={trk.id}
                        style={{
                          padding: '0.85rem',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          background: isPlaying ? '#fdf2f8' : '#ffffff',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '0.75rem',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div>
                          <strong>{trk.title}</strong>
                          <div className="muted" style={{ fontSize: '0.84rem' }}>
                            In memory of {trk.honouree} · {trk.style} · {trk.duration}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>By {trk.createdBy}</div>
                        </div>
                        <button
                          type="button"
                          className={`btn btn--sm ${isPlaying ? 'btn--dark' : 'btn--primary'}`}
                          onClick={() => togglePlayTrack(trk)}
                        >
                          {isPlaying ? '⏸ Pause' : '▶ Play'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>

              <form className="card stack" onSubmit={handleCreateMusic}>
                <p className="eyebrow">Create new</p>
                <h2 style={{ margin: 0 }}>Generate AI memorial music</h2>
                <label className="field">
                  <span className="field__label">Song title</span>
                  <input className="input" value={musicTitle} onChange={(e) => setMusicTitle(e.target.value)} placeholder="e.g. Forever in Our Hearts" required />
                </label>
                <label className="field">
                  <span className="field__label">In memory of</span>
                  <input className="input" value={musicHonouree} onChange={(e) => setMusicHonouree(e.target.value)} placeholder="e.g. Grace Nyathi" required />
                </label>
                <label className="field">
                  <span className="field__label">Musical style</span>
                  <select className="select" value={musicStyle} onChange={(e) => setMusicStyle(e.target.value)}>
                    <option>Shona Acoustic Hymn</option>
                    <option>Mbira Reflection</option>
                    <option>Gospel Choir Tribute</option>
                    <option>Gentle Piano Ballad</option>
                  </select>
                </label>
                <label className="field">
                  <span className="field__label">Dedication / lyrics theme (optional)</span>
                  <textarea className="textarea" rows={2} value={musicPrompt} onChange={(e) => setMusicPrompt(e.target.value)} placeholder="Describe memories, favourite hymns, or family message…" />
                </label>
                {musicNotice && <Callout tone="success">{musicNotice}</Callout>}
                <button type="submit" className="btn btn--primary">
                  ✨ Generate AI Memorial Music
                </button>
              </form>
            </div>
          </Section>

          {/* 2. Memorial Videos */}
          <Section>
            <div className="grid grid--2" style={{ gap: '1.5rem', alignItems: 'start' }}>
              <div className="card stack">
                <p className="eyebrow">🎬 Memorial Videos</p>
                <h2 style={{ margin: 0 }}>Existing tribute videos</h2>
                <div className="stack" style={{ gap: '0.75rem' }}>
                  {videos.map((vid) => (
                    <div key={vid.id} style={{ padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                        <strong>{vid.title}</strong>
                        <StatusChip tone="success">Ready</StatusChip>
                      </div>
                      <div className="muted" style={{ fontSize: '0.84rem', marginTop: '0.25rem' }}>
                        Honouree: {vid.honouree} · {vid.theme}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                        Created by {vid.createdBy}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <form className="card stack" onSubmit={handleCreateVideo}>
                <p className="eyebrow">Create new</p>
                <h2 style={{ margin: 0 }}>Create a memorial video</h2>
                <label className="field">
                  <span className="field__label">Video title</span>
                  <input className="input" value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)} placeholder="e.g. Remembering Baba Moyo" required />
                </label>
                <label className="field">
                  <span className="field__label">In memory of</span>
                  <input className="input" value={videoHonouree} onChange={(e) => setVideoHonouree(e.target.value)} placeholder="e.g. Tendai Moyo" required />
                </label>
                <label className="field">
                  <span className="field__label">Visual theme</span>
                  <select className="select" value={videoTheme} onChange={(e) => setVideoTheme(e.target.value)}>
                    <option>Golden Memories Reel</option>
                    <option>Chapel Service Highlight</option>
                    <option>Family Tribute Slideshow</option>
                  </select>
                </label>
                {videoNotice && <Callout tone="success">{videoNotice}</Callout>}
                <button type="submit" className="btn btn--primary">
                  🎬 Create Memorial Video
                </button>
              </form>
            </div>
          </Section>

          {/* 3. Livestreaming & 4. Flowers / Candles on Grave Map */}
          <Section soft>
            <div className="grid grid--2" style={{ gap: '1.5rem' }}>
              <article className="card stack">
                <p className="eyebrow">📡 Funeral Livestreaming</p>
                <h2 style={{ margin: 0 }}>Broadcast &amp; watch live coverage</h2>
                <p className="muted">
                  Allow relatives at home and in the diaspora to join the funeral service live, share condolences, and replay recorded coverage.
                </p>
                <div className="cluster">
                  <Link className="btn btn--primary" to={user ? paths.accountFuneralStreaming : `${paths.login}?next=${encodeURIComponent(paths.accountFuneralStreaming)}`}>
                    Open Live Funeral Coverage
                  </Link>
                </div>
              </article>

              <article className="card stack">
                <p className="eyebrow">🌸🕯️ Flowers &amp; Candles</p>
                <h2 style={{ margin: 0 }}>Place flowers &amp; candles on the grave</h2>
                <p className="muted">
                  Drag and drop virtual flowers and vigil candles directly onto the grave on Google Maps with your name recorded, or visit a digital memorial.
                </p>
                <div className="cluster">
                  <Link className="btn btn--primary" to={`${paths.cemeteries}?grave=Grace+Nyathi`}>
                    Place Flower / Candle on Grave Map
                  </Link>
                  <Link className="btn btn--outline" to={memorialPath('grace-nyathi')}>
                    Visit Digital Memorial
                  </Link>
                </div>
              </article>
            </div>
          </Section>
        </>
      )}
    </>
  )
}
