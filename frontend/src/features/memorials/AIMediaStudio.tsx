import { useState, useRef } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Callout } from '@/components/ui/Callout'
import { TextField } from '@/components/ui/TextField'
import { useKuwanaTokens, TOKEN_COSTS } from '@/features/account/tokens'

export type MediaStudioTab = 'music' | 'video' | 'biography'

interface AIMediaStudioProps {
  initialTab?: MediaStudioTab
  deceasedName?: string
  onClose: () => void
  onApplyBiography?: (bio: string, timeline: Array<{ year: number; title: string; text?: string }>) => void
}

export function AIMediaStudio({
  initialTab = 'music',
  deceasedName = 'our beloved departed',
  onClose,
  onApplyBiography,
}: AIMediaStudioProps) {
  const [activeTab, setActiveTab] = useState<MediaStudioTab>(initialTab)
  const { balance, spend } = useKuwanaTokens()

  // Suno Music State
  const [musicGenre, setMusicGenre] = useState('Gospel Choral Hymn (Shona/English)')
  const [musicPrompt, setMusicPrompt] = useState(`In loving remembrance of ${deceasedName}, a life well-lived in grace, faith and love.`)
  const [musicAudioFile, setMusicAudioFile] = useState<string | null>(null)
  const [generatingMusic, setGeneratingMusic] = useState(false)
  const [generatedSong, setGeneratedSong] = useState<{ title: string; audioUrl: string; lyrics: string } | null>(null)

  // AI Video State
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([])
  const [videoTheme, setVideoTheme] = useState('Golden Memories (Ken Burns Elegance)')
  const [generatingVideo, setGeneratingVideo] = useState(false)
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null)

  // AI Biography State
  const [bioNotes, setBioNotes] = useState('')
  const [bioTone, setBioTone] = useState<'dignified' | 'celebratory' | 'ancestral'>('dignified')
  const [generatingBio, setGeneratingBio] = useState(false)
  const [generatedBio, setGeneratedBio] = useState<{
    text: string
    timeline: Array<{ year: number; title: string; text?: string }>
  } | null>(null)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const photoInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)

  // SUNO MUSIC GENERATOR
  const handleGenerateMusic = async () => {
    setError('')
    if (balance < TOKEN_COSTS.SUNO_MUSIC) {
      setError(`Insufficient Kuwana tokens. You need ${TOKEN_COSTS.SUNO_MUSIC} tokens (balance: ${balance}). Top up your wallet in the header.`)
      return
    }

    const deducted = spend(TOKEN_COSTS.SUNO_MUSIC, 'suno-music', `Suno AI tribute track for late ${deceasedName}`)
    if (!deducted) {
      setError('Could not deduct tokens. Please verify your token balance.')
      return
    }

    setGeneratingMusic(true)
    setTimeout(() => {
      setGeneratingMusic(false)
      setGeneratedSong({
        title: `Tribute to ${deceasedName} (${musicGenre})`,
        // Sample tranquil public audio asset
        audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        lyrics: [
          `[Verse 1]`,
          `Famba zvakanaka, rest in eternal peace,`,
          `Your gentle footsteps on this earth shall never cease.`,
          `In our hearts your light remains so bright,`,
          `Guiding us through the sorrow and the night.`,
          ``,
          `[Chorus]`,
          `Lala ngokuthula, eternal love we send,`,
          `Until on that peaceful shore we meet again.`,
        ].join('\n'),
      })
      setSuccess('Suno AI tribute music track generated successfully!')
    }, 2500)
  }

  // AI VIDEO GENERATOR
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const urls: string[] = []
    for (let i = 0; i < files.length; i++) {
      urls.push(URL.createObjectURL(files[i]))
    }
    setUploadedPhotos((prev) => [...prev, ...urls])
  }

  const handleGenerateVideo = () => {
    setError('')
    if (uploadedPhotos.length === 0) {
      setError('Please upload at least 1 photo for the memorial video montage.')
      return
    }
    if (balance < TOKEN_COSTS.AI_VIDEO) {
      setError(`Insufficient Kuwana tokens. You need ${TOKEN_COSTS.AI_VIDEO} tokens (balance: ${balance}).`)
      return
    }

    const deducted = spend(TOKEN_COSTS.AI_VIDEO, 'ai-video', `AI memorial video tribute for late ${deceasedName}`)
    if (!deducted) {
      setError('Could not deduct tokens.')
      return
    }

    setGeneratingVideo(true)
    setTimeout(() => {
      setGeneratingVideo(false)
      setGeneratedVideoUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4')
      setSuccess('AI memorial video generated and ready to stream!')
    }, 3000)
  }

  // AI BIOGRAPHY GENERATOR
  const handleGenerateBio = () => {
    setError('')
    if (!bioNotes.trim()) {
      setError('Please enter a few memory bullet points or notes to guide the biography.')
      return
    }
    if (balance < TOKEN_COSTS.AI_BIOGRAPHY) {
      setError(`Insufficient Kuwana tokens. You need ${TOKEN_COSTS.AI_BIOGRAPHY} tokens (balance: ${balance}).`)
      return
    }

    const deducted = spend(TOKEN_COSTS.AI_BIOGRAPHY, 'ai-biography', `AI biography generation for late ${deceasedName}`)
    if (!deducted) {
      setError('Could not deduct tokens.')
      return
    }

    setGeneratingBio(true)
    setTimeout(() => {
      setGeneratingBio(false)
      const currentYear = new Date().getFullYear()
      const paragraphs = [
        `The life of ${deceasedName} was one of profound devotion, generosity, and resilience. Born with a vibrant spirit, they touched countless hearts through their unwavering kindness and steadfast commitment to family and community.`,
        `Throughout their journey, ${deceasedName} was known as a pillar of strength. Those who walked beside them recall their infectious warmth, wise counsel, and laughter that filled every gathering. ${bioNotes}`,
        `They leave behind a lasting legacy of love, faith, and cherished memories that will forever echo through their children, grandchildren, relatives, and lifelong friends. Though deeply missed, their spirit rests in eternal dignity and peace.`,
      ]

      setGeneratedBio({
        text: paragraphs.join('\n\n'),
        timeline: [
          { year: currentYear - 65, title: `Birth of ${deceasedName}`, text: 'Entered into the world, bringing joy to their parents and family.' },
          { year: currentYear - 40, title: 'Marriage & Family Milestones', text: 'Built a loving home blessed with children and lasting happiness.' },
          { year: currentYear - 15, title: 'Community & Professional Leadership', text: 'Served faithfully, mentoring youth and guiding community members.' },
          { year: currentYear, title: 'Peaceful Departure', text: 'Surrounded by prayer and love as they transitioned to glory.' },
        ],
      })
      setSuccess('AI biography and life milestone timeline generated successfully!')
    }, 2000)
  }

  return (
    <Modal title={`AI Media Studio — ${deceasedName}`} onClose={onClose}>
      <div className="stack" style={{ gap: '16px' }}>
        {/* Token Balance Indicator */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f8fafc',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '13px',
          }}
        >
          <span>
            🪙 Available Kuwana Tokens: <strong style={{ color: '#d97706' }}>{balance} Tokens</strong>
          </span>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Fidelity Creative Engine</span>
        </div>

        {error && <Callout tone="danger">{error}</Callout>}
        {success && <Callout tone="success">{success}</Callout>}

        {/* Studio Navigation Tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          <button
            type="button"
            className={`btn btn--sm ${activeTab === 'music' ? 'btn--primary' : 'btn--outline'}`}
            onClick={() => {
              setActiveTab('music')
              setError('')
              setSuccess('')
            }}
          >
            🎵 Suno AI Music ({TOKEN_COSTS.SUNO_MUSIC} TK)
          </button>
          <button
            type="button"
            className={`btn btn--sm ${activeTab === 'video' ? 'btn--primary' : 'btn--outline'}`}
            onClick={() => {
              setActiveTab('video')
              setError('')
              setSuccess('')
            }}
          >
            🎬 AI Video ({TOKEN_COSTS.AI_VIDEO} TK)
          </button>
          <button
            type="button"
            className={`btn btn--sm ${activeTab === 'biography' ? 'btn--primary' : 'btn--outline'}`}
            onClick={() => {
              setActiveTab('biography')
              setError('')
              setSuccess('')
            }}
          >
            ✍️ AI Biography ({TOKEN_COSTS.AI_BIOGRAPHY} TK)
          </button>
        </div>

        {/* TAB 1: SUNO AI MUSIC CREATION */}
        {activeTab === 'music' && (
          <div className="stack" style={{ gap: '12px' }}>
            <p className="muted" style={{ margin: 0, fontSize: '13px' }}>
              Create an original commemorative song or hymn using the Suno AI Music Engine. Upload reference audio or select a traditional Zimbabwean choral/acoustic style.
            </p>

            <div className="field">
              <label className="field__label">Select Musical Style / Arrangement</label>
              <select
                className="select"
                value={musicGenre}
                onChange={(e) => setMusicGenre(e.target.value)}
              >
                <option value="Gospel Choral Hymn (Shona/English)">Gospel Choral Hymn (Shona / English)</option>
                <option value="Acoustic Mbira & Guitar Eulogy">Acoustic Mbira & Guitar Eulogy</option>
                <option value="Gentle Piano & Strings Reflection">Gentle Piano & Strings Reflection</option>
                <option value="Traditional Ndebele Choral Praise">Traditional Ndebele Choral Praise</option>
              </select>
            </div>

            <TextField
              label="Tribute Theme / Prompt"
              value={musicPrompt}
              onChange={setMusicPrompt}
              placeholder="e.g. A loving tribute celebrating a mother's kindness and deep faith."
            />

            <div className="field">
              <label className="field__label">Reference Voice Note or Melody (Optional)</label>
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) setMusicAudioFile(f.name)
                }}
              />
              {musicAudioFile && (
                <small className="field__hint" style={{ color: '#16a34a' }}>
                  ✓ Loaded audio sample: {musicAudioFile}
                </small>
              )}
            </div>

            <button
              type="button"
              className="btn btn--primary"
              disabled={generatingMusic}
              onClick={handleGenerateMusic}
            >
              {generatingMusic ? 'Generating Suno AI Music (synthesizing arrangement)…' : `Compose Track with Suno AI (${TOKEN_COSTS.SUNO_MUSIC} Tokens)`}
            </button>

            {generatedSong && (
              <div
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '14px',
                  marginTop: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '24px' }}>💿</span>
                  <div>
                    <strong>{generatedSong.title}</strong>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Generated via Suno AI Engine</div>
                  </div>
                </div>
                <audio controls src={generatedSong.audioUrl} style={{ width: '100%', marginBottom: '10px' }} />
                <div
                  style={{
                    background: '#ffffff',
                    padding: '10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    whiteSpace: 'pre-line',
                    maxHeight: '120px',
                    overflowY: 'auto',
                  }}
                >
                  {generatedSong.lyrics}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: AI VIDEO TRIBUTE CREATION */}
        {activeTab === 'video' && (
          <div className="stack" style={{ gap: '12px' }}>
            <p className="muted" style={{ margin: 0, fontSize: '13px' }}>
              Upload family photos and audio to produce a high-definition memorial slideshow montage with transitions and background music.
            </p>

            <div className="field">
              <label className="field__label">Upload Photos (Select 1 to 10 photos)</label>
              <input
                ref={photoInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handlePhotoUpload}
              />
              {uploadedPhotos.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {uploadedPhotos.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt="Uploaded preview"
                      style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '6px' }}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="field">
              <label className="field__label">Visual Theme & Cinematic Style</label>
              <select
                className="select"
                value={videoTheme}
                onChange={(e) => setVideoTheme(e.target.value)}
              >
                <option value="Golden Memories (Ken Burns Elegance)">Golden Memories (Ken Burns Elegance)</option>
                <option value="African Sunset Remembrance">African Sunset Remembrance</option>
                <option value="Celestial Clouds & Light">Celestial Clouds & Light</option>
              </select>
            </div>

            <button
              type="button"
              className="btn btn--primary"
              disabled={generatingVideo}
              onClick={handleGenerateVideo}
            >
              {generatingVideo ? 'Rendering Memorial Video (applying Ken Burns transitions)…' : `Generate AI Video Montage (${TOKEN_COSTS.AI_VIDEO} Tokens)`}
            </button>

            {generatedVideoUrl && (
              <div style={{ marginTop: '8px' }}>
                <video
                  controls
                  src={generatedVideoUrl}
                  style={{ width: '100%', maxHeight: '280px', borderRadius: '8px', background: '#000000' }}
                />
                <a
                  className="btn btn--outline btn--sm"
                  href={generatedVideoUrl}
                  download="memorial-tribute.mp4"
                  style={{ marginTop: '8px', display: 'inline-block' }}
                >
                  Download Memorial Video
                </a>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: AI BIOGRAPHY GENERATION */}
        {activeTab === 'biography' && (
          <div className="stack" style={{ gap: '12px' }}>
            <p className="muted" style={{ margin: 0, fontSize: '13px' }}>
              Convert memories, spoken recollections or photo notes into a beautifully written life story and milestone timeline.
            </p>

            <div className="field">
              <label className="field__label">Key Memories, Milestones & Family Notes</label>
              <textarea
                className="textarea"
                rows={4}
                value={bioNotes}
                onChange={(e) => setBioNotes(e.target.value)}
                placeholder="e.g. Born in Masvingo, passionate teacher for 35 years at Goromonzi High, loved choir singing, married for 42 years to Sekuru Moyo, blessed with 4 children and 9 grandchildren."
              />
            </div>

            <div className="field">
              <label className="field__label">Narrative Tone</label>
              <select
                className="select"
                value={bioTone}
                onChange={(e) => setBioTone(e.target.value as any)}
              >
                <option value="dignified">Dignified & Reverent (Formal Memorial Tribute)</option>
                <option value="celebratory">Warm & Celebratory (Celebrating a Joyful Life)</option>
                <option value="ancestral">Traditional & Heritage Honour</option>
              </select>
            </div>

            <button
              type="button"
              className="btn btn--primary"
              disabled={generatingBio}
              onClick={handleGenerateBio}
            >
              {generatingBio ? 'Writing Life Story & Milestones…' : `Generate AI Biography (${TOKEN_COSTS.AI_BIOGRAPHY} Tokens)`}
            </button>

            {generatedBio && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '12px',
                  marginTop: '8px',
                }}
              >
                <h4 style={{ margin: '0 0 6px 0', fontSize: '14px' }}>Generated Life Story</h4>
                <div style={{ fontSize: '13px', whiteSpace: 'pre-line', maxHeight: '160px', overflowY: 'auto' }}>
                  {generatedBio.text}
                </div>

                <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  {onApplyBiography && (
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={() => {
                        onApplyBiography(generatedBio.text, generatedBio.timeline)
                        onClose()
                      }}
                    >
                      ✓ Insert into Life Story Editor
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
