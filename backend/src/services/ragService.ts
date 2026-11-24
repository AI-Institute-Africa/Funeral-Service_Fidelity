import { KNOWLEDGE_BASE, type KnowledgeDocument } from './ragKnowledgeBase'

export interface RAGQueryOptions {
  query: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  topK?: number
}

export interface RAGResponse {
  answer: string
  sources: Array<{ title: string; category: string }>
  suggestedQuestions: string[]
  modelUsed: string
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
}

/** Rank knowledge documents by query relevance */
export function retrieveRelevantDocuments(query: string, topK = 3): KnowledgeDocument[] {
  const queryTokens = tokenize(query)
  if (queryTokens.length === 0) return KNOWLEDGE_BASE.slice(0, topK)

  const scored = KNOWLEDGE_BASE.map((doc) => {
    let score = 0
    const docTextTokens = tokenize(`${doc.title} ${doc.keywords.join(' ')} ${doc.content}`)

    for (const token of queryTokens) {
      // Keyword exact match bonus
      if (doc.keywords.some((kw) => kw.toLowerCase().includes(token))) {
        score += 8
      }
      // Title match bonus
      if (doc.title.toLowerCase().includes(token)) {
        score += 5
      }
      // Content occurrence
      const occurrences = docTextTokens.filter((t) => t === token).length
      score += Math.min(occurrences, 4) * 1.5
    }

    return { doc, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, topK).map((s) => s.doc)
}

/** Check if crisis safety rules apply */
const CRISIS_PATTERN = /\b(suicid\w*|kill (myself|me)|end (my|it all)|end my life|harm myself|want to die)\b/i

/** Call external LLM if API key is present (OpenAI or Gemini), otherwise fallback to RAG synthesizer */
async function callExternalLLM(prompt: string, context: string): Promise<string | null> {
  const openAiKey = process.env.OPENAI_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY

  if (openAiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are the compassionate, knowledgeable AI Customer Support Assistant for Fidelity Life Assurance of Zimbabwe. Answer customer inquiries professionally, warmly, and accurately using the provided Fidelity Knowledge Base context. State clear requirements, policy terms, and contact numbers when relevant.',
            },
            {
              role: 'user',
              content: `KNOWLEDGE BASE CONTEXT:\n${context}\n\nUSER QUESTION:\n${prompt}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 650,
        }),
      })

      if (res.ok) {
        const data = (await res.json()) as any
        return data?.choices?.[0]?.message?.content || null
      }
    } catch (e) {
      console.warn('[rag-llm] OpenAI call failed, falling back:', e)
    }
  }

  if (geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: `You are the empathetic, knowledgeable AI Customer Support Assistant for Fidelity Life Assurance of Zimbabwe.\n\nKNOWLEDGE BASE CONTEXT:\n${context}\n\nUSER QUESTION:\n${prompt}`,
                  },
                ],
              },
            ],
          }),
        },
      )

      if (res.ok) {
        const data = (await res.json()) as any
        return data?.candidates?.[0]?.content?.parts?.[0]?.text || null
      }
    } catch (e) {
      console.warn('[rag-llm] Gemini call failed, falling back:', e)
    }
  }

  return null
}

export async function answerCustomerQuery(options: RAGQueryOptions): Promise<RAGResponse> {
  const { query } = options

  // 1. Safety check
  if (CRISIS_PATTERN.test(query)) {
    return {
      answer:
        'I am deeply sorry you are experiencing such difficult pain. If you or someone you know is in immediate distress, please do not be alone. Please reach out to emergency services, a local clinic, or a trusted pastor or family member. For bereavement counseling and practical help, Fidelity Life also provides human advisor support at +263 771 417 719.',
      sources: [{ title: 'Crisis Support Protocol', category: 'bereavement' }],
      suggestedQuestions: ['Request an adviser call back', 'What should we do in the first 48 hours?'],
      modelUsed: 'safety-rule',
    }
  }

  // 2. Retrieve relevant documents
  const retrievedDocs = retrieveRelevantDocuments(query, 3)
  const context = retrievedDocs.map((d) => `### ${d.title}\n${d.content}`).join('\n\n')

  // 3. Attempt external LLM
  const externalAnswer = await callExternalLLM(query, context)
  if (externalAnswer) {
    return {
      answer: externalAnswer,
      sources: retrievedDocs.map((d) => ({ title: d.title, category: d.category })),
      suggestedQuestions: generateSuggestedQuestions(query),
      modelUsed: 'fidelity-rag-llm',
    }
  }

  // 4. Built-in RAG Synthesis Engine (Empathetic & Structured)
  const synthesis = synthesizeRAGAnswer(query, retrievedDocs)
  return {
    answer: synthesis,
    sources: retrievedDocs.map((d) => ({ title: d.title, category: d.category })),
    suggestedQuestions: generateSuggestedQuestions(query),
    modelUsed: 'fidelity-rag-native',
  }
}

function synthesizeRAGAnswer(query: string, docs: KnowledgeDocument[]): string {
  const primaryDoc = docs[0]
  if (!primaryDoc) {
    return 'Thank you for reaching out to Fidelity Life Assurance Funeral Services. Our operations desk is available 24/7 to assist with policy verification, walk-in funeral arrangements, cemetery bookings, and exhumations. Please contact our coordinator at +263 771 417 719 or visit our Harare branch.'
  }

  const q = query.toLowerCase()

  if (q.includes('exhum') || q.includes('reburial') || q.includes('permit')) {
    return [
      '⚖️ **Exhumation Services & Legal Clearances in Zimbabwe**',
      '',
      'Under the Public Health Act [Chapter 15:09], exhumations require statutory compliance before any disinterment can take place:',
      '• **Mandatory Permits**: Local Council Exhumation Permit, Ministry of Health & Child Care clearance (with an Environmental Health Officer supervising), and Zimbabwe Republic Police (ZRP) clearance certificate.',
      '• **Next of Kin Consent**: A sworn legal affidavit by the immediate family or estate executor.',
      '• **Health & Transport Requirements**: Disinterred remains must be placed in a hermetically sealed zinc-lined secondary coffin for hygienic transport.',
      '• **Fidelity Support**: We handle the entire turnkey process—permit applications, health authority coordination, transport, and re-interment at the destination cemetery.',
      '',
      'Would you like to open an exhumation request with our compliance coordinator today?',
    ].join('\n')
  }

  if (q.includes('claim') || q.includes('death certificate') || q.includes('burial order')) {
    return [
      '📋 **Fidelity Funeral Claim Guidelines**',
      '',
      'To lodge a claim with Fidelity Life Assurance, please prepare:',
      '1. Official **Burial Order** or certified copy of the **Death Certificate**.',
      '2. Deceased’s **National ID** or valid passport.',
      '3. Claimant’s **National ID** and proof of relationship to the policyholder.',
      '4. **Police Traffic Accident Report (Form 231)** if the death was accidental or unnatural.',
      '',
      'Once verified, immediate body collection and mortuary preparation begin right away. Any grocery or Chema cash benefit is disbursed within 2 to 4 hours.',
    ].join('\n')
  }

  if (q.includes('walk') || q.includes('cash') || q.includes('no policy') || q.includes('cost') || q.includes('price')) {
    return [
      '🤝 **Cash Walk-in Funerals (Uninsured Immediate Service)**',
      '',
      'If your family does not currently hold a policy, Fidelity provides full immediate care on a cash walk-in basis:',
      '• **Immediate 24/7 Response**: Dignified removal from home or hospital and cold-storage mortuary care.',
      '• **Flexible Packages**: Transparent itemised plans ranging from Economy ($450) up to Executive and VIP packages.',
      '• **Chema Wallet Integration**: Your diaspora and local relatives can contribute securely via EcoCash, Card, or mobile money to cover the service invoice directly.',
      '• **Dedicated Coordinator**: We assist with church service, hearse transport, and cemetery plot booking.',
    ].join('\n')
  }

  if (q.includes('flower') || q.includes('cemetery') || q.includes('grave') || q.includes('map')) {
    return [
      '🌸 **Smart Cemetery, Grave Locator & Virtual Flowers**',
      '',
      'Fidelity Life’s Smart Cemetery system lets you:',
      '• Locate burial plots with **exact GPS pins and Google Maps navigation** across Warren Hills, Glen Forest, Granville, Zororo, and West Park.',
      '• **Leave Virtual Flowers**: Tribute bouquets (White Lilies, Red Roses, Sunflower Wreaths) can be permanently placed on a loved one’s grave with a personalized message (10 Kuwana tokens).',
      '• Check published plot prices and section availability directly in the Cemeteries tab.',
    ].join('\n')
  }

  if (q.includes('music') || q.includes('suno') || q.includes('video') || q.includes('biography') || q.includes('media') || q.includes('token')) {
    return [
      '🎵 **Fidelity AI Media Studio & Kuwana Tokens**',
      '',
      'You can create lasting digital tributes directly from your memorial page:',
      '• **Suno AI Music Generation**: Compose custom acoustic, gospel, or Mbira tribute tracks (25 tokens).',
      '• **AI Memorial Video**: Upload family photos to generate a touching tribute video montage (30 tokens).',
      '• **AI Biography**: Convert uploaded photos and spoken memories into a beautifully written life story (15 tokens).',
      '• **Live Stream Replay**: Watch recorded live services on-demand anytime you log in.',
      'Kuwana tokens can be managed and topped up in your account using Chema Wallet or EcoCash.',
    ].join('\n')
  }

  // General synthesis using retrieved primary content
  return [
    `🕊️ **Fidelity Life Assurance Support**`,
    '',
    primaryDoc.content,
    '',
    'If you need immediate assistance or would like to speak directly with an operations supervisor, please call **+263 771 417 719**.',
  ].join('\n')
}

function generateSuggestedQuestions(query: string): string[] {
  const q = query.toLowerCase()
  if (q.includes('exhum')) {
    return [
      'What permits are required for exhumation in Zimbabwe?',
      'How much does an exhumation permit and zinc liner cost?',
      'How do I book an exhumation with Fidelity?',
    ]
  }
  if (q.includes('claim')) {
    return [
      'What documents do I need for a death certificate or burial order?',
      'How fast are grocery and Chema allowances paid out?',
      'What is the waiting period for natural death?',
    ]
  }
  return [
    'How do I arrange an immediate cash walk-in funeral?',
    'What exhumation services and permits does Fidelity handle?',
    'How do I view a gravesite and leave virtual flowers?',
    'How can I create an AI tribute video or music with Suno?',
  ]
}
