import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Callout } from '@/components/ui/Callout'
import { Section } from '@/components/ui/Section'
import { SectionHead } from '@/components/ui/SectionHead'
import { TextField } from '@/components/ui/TextField'
import { respond, suggestions as initialSuggestions, type Link as ReplyLink, type ReplyKind } from './engine'
import './assistant.css'

type Message = {
  id: number
  from: 'bot' | 'user'
  text: string
  kind?: ReplyKind
  links?: ReplyLink[]
  sources?: Array<{ title: string; category: string }>
  modelUsed?: string
}

const OPENING_TEXT =
  'Greetings. I am the Fidelity Life Assurance AI Support Assistant, trained with verified statutory guidelines, funeral policy benefits, exhumation procedures, claims requirements, and bereavement guidance. How may I assist your family today?'

const opening = (): Message[] => [{ id: 0, from: 'bot', text: OPENING_TEXT, modelUsed: 'fidelity-rag-llm' }]

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>(opening)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggested, setSuggested] = useState<string[]>(initialSuggestions)
  const logRef = useRef<HTMLDivElement>(null)
  const nextId = useRef(1)

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading])

  async function ask(text: string) {
    const q = text.trim()
    if (!q || loading) return

    const userMsgId = nextId.current++
    setMessages((m) => [...m, { id: userMsgId, from: 'user', text: q }])
    setDraft('')
    setLoading(true)

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: q,
          history: messages.map((m) => ({ role: m.from === 'user' ? 'user' : 'assistant', content: m.text })),
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const botMsgId = nextId.current++
        setMessages((m) => [
          ...m,
          {
            id: botMsgId,
            from: 'bot',
            text: data.answer,
            sources: data.sources,
            modelUsed: data.modelUsed,
          },
        ])
        if (data.suggestedQuestions && data.suggestedQuestions.length > 0) {
          setSuggested(data.suggestedQuestions)
        }
      } else {
        throw new Error('Server returned error')
      }
    } catch {
      // Fallback to local engine
      const fallback = respond(q)
      const botMsgId = nextId.current++
      setMessages((m) => [
        ...m,
        {
          id: botMsgId,
          from: 'bot',
          text: fallback.text,
          kind: fallback.kind,
          links: fallback.links,
          modelUsed: 'offline-fallback',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    ask(draft)
  }

  return (
    <Section>
      <div className="as-wrap">
        <SectionHead
          as="h1"
          eyebrow="Fidelity AI Assistant & RAG Support"
          title="Intelligent support for policies, exhumations, claims & grief care."
        />
        <Callout tone="info">
          <strong>RAG-Augmented AI Knowledge Engine:</strong> Trained on Zimbabwe Public Health Act exhumation regulations, Fidelity funeral assurance policies, mortuary logistics, and claims procedures. For human emergency dispatch, call <strong>+263 771 417 719</strong>.
        </Callout>

        <div ref={logRef} className="as-log" role="log" aria-live="polite" aria-label="Conversation">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`as-msg as-msg--${m.from}${m.kind === 'crisis' ? ' as-msg--crisis' : ''}`}
              style={{ whiteSpace: 'pre-line' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span className="as-tag">
                  {m.from === 'bot' ? 'Fidelity RAG Assistant' : 'You'}
                </span>
                {m.modelUsed && (
                  <span style={{ fontSize: '11px', color: '#64748b', opacity: 0.85 }}>
                    {m.modelUsed.includes('rag') ? '⚡ RAG Verified' : m.modelUsed}
                  </span>
                )}
              </div>

              <div>{m.text}</div>

              {m.sources && m.sources.length > 0 && (
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1', fontSize: '12px' }}>
                  <span style={{ fontWeight: 600, color: '#475569' }}>Verified Knowledge Sources:</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                    {m.sources.map((s, idx) => (
                      <span
                        key={idx}
                        style={{
                          background: '#e0e7ff',
                          color: '#3730a3',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 500,
                        }}
                      >
                        📖 {s.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {m.links && (
                <div className="as-links" style={{ marginTop: '10px' }}>
                  {m.links.map((l) => (
                    <Link key={l.to} className="btn btn--outline btn--sm" to={l.to}>
                      {l.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="as-msg as-msg--bot" style={{ opacity: 0.7 }}>
              <span className="as-tag">Fidelity RAG Assistant</span>
              <em>Searching knowledge base & generating response…</em>
            </div>
          )}
        </div>

        <div className="as-chips" aria-label="Suggested questions">
          {suggested.map((s) => (
            <button key={s} type="button" className="btn btn--outline btn--sm" onClick={() => ask(s)}>
              {s}
            </button>
          ))}
        </div>

        <form className="as-form" onSubmit={submit}>
          <TextField label="Your question" value={draft} onChange={setDraft} autoComplete="off" placeholder="Ask about exhumation permits, funeral packages, claim documents, or smart cemeteries…" />
          <button className="btn btn--primary" type="submit" disabled={!draft.trim() || loading}>
            {loading ? 'Thinking…' : 'Send'}
          </button>
        </form>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            className="btn btn--outline btn--sm"
            type="button"
            onClick={() => {
              setMessages(opening())
              setSuggested(initialSuggestions)
              nextId.current = 1
            }}
          >
            Clear conversation
          </button>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Emergency 24/7 Helpline: <strong>+263 771 417 719</strong>
          </span>
        </div>
      </div>
    </Section>
  )
}
