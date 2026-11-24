/**
 * Fidelity Life Assurance Funeral Services Knowledge Base for RAG.
 * Authoritative operational and policy corpus for customer support assistant.
 */

export interface KnowledgeDocument {
  id: string
  title: string
  category: 'policy' | 'exhumation' | 'operations' | 'claims' | 'smart_services' | 'bereavement'
  keywords: string[]
  content: string
}

export const KNOWLEDGE_BASE: KnowledgeDocument[] = [
  {
    id: 'kb-policy-overview',
    title: 'Fidelity Funeral Assurance Policy Overview & Plans',
    category: 'policy',
    keywords: ['policy', 'plans', 'tsigiro', 'standard', 'executive', 'super executive', 'diaspora', 'premium', 'cover'],
    content: `Fidelity Life Assurance of Zimbabwe offers comprehensive funeral assurance packages designed to provide dignified farewells without financial stress.
Key packages include:
1. Tsigiro Plan: Entry-level dignity plan covering principal member and core family. Includes standard casket, mortuary storage up to 5 days, hearse transport within 50km radius, grave fee contribution.
2. Standard Plan: Complete funeral arrangement including two-tier polished coffin/casket, full mortuary services (body washing, dressing, embalming), hearse transport up to 100km, grocery allowance, chapel service, and grave marker.
3. Executive Plan: Premium package featuring executive solid wood casket, luxury hearse and family limousine escort, 100-seater canopy tent, 100 chairs, luxury mobile toilet unit, $500 grocery/chema cash benefit, and live streaming coverage.
4. Super Executive Plan: Full VIP funeral arrangement with two hearse options, dome casket, luxury transport up to 500km nationwide, floral wreaths, full catering support, dedicated funeral director, obituary publication, and digital memorial suite.
5. Diaspora Funeral Cash Plan: Covers Zimbabweans living in South Africa, United Kingdom, USA, Australia, and worldwide, with repatriation transport or cash payout in USD.
Waiting periods: 3 months for natural causes; immediate cover for accidental death from first premium payment.`,
  },
  {
    id: 'kb-cash-walkin',
    title: 'Cash Walk-in Funerals & Immediate Service',
    category: 'operations',
    keywords: ['cash', 'walk-in', 'uninsured', 'immediate', 'cost', 'quotation', 'no policy', 'pricing'],
    content: `Fidelity Life Funeral Services provides immediate cash walk-in arrangements for families who do not hold an active funeral policy.
- Immediate 24/7 body removal and dignified refrigerated mortuary care.
- Transparent itemised quotations tailored to family budget, payable in USD cash, EcoCash, Swipe, or bank transfer.
- Chema Wallet integration allows diaspora and local relatives to pool contributions directly toward the service bill in real time.
- Standard cash walk-in packages start from $450 (Economy) up to $2,800+ for Executive full-service packages.
- All walk-in families receive a dedicated Funeral Coordinator who handles cemetery bookings, burial orders, and day-of-burial logistics.`,
  },
  {
    id: 'kb-exhumation-process',
    title: 'Statutory Exhumation Process, Costs & Permits in Zimbabwe',
    category: 'exhumation',
    keywords: ['exhumation', 'exhume', 'reburial', 'reinterment', 'permit', 'ministry of health', 'police', 'council', 'zinc liner', 'cost'],
    content: `Exhumation in Zimbabwe is strictly regulated under the Public Health Act [Chapter 15:09] and municipal cemetery bylaws.
Requirements and Mandatory Permits:
1. Written consent/affidavit from the deceased's closest next-of-kin or executor.
2. Council Exhumation Permit: Issued by the local municipal authority (e.g. City of Harare, Bulawayo City Council).
3. Ministry of Health & Child Care clearance: A designated Environmental Health Officer/Inspector must inspect, approve, and be present during the exhumation.
4. Zimbabwe Republic Police (ZRP) Clearance: Clearance certificate verifying no pending criminal or forensic investigation requires obstruction.
5. Re-interment destination plot allocation or landowner consent.
6. Hermetically sealed coffin / zinc liner: Disinterred remains must be transferred into an airtight zinc-lined secondary coffin for hygienic transport.
Fidelity Services provided:
Fidelity provides full turnkey exhumation management including permit filing, health inspector scheduling, specialized disinterment team, zinc hermetic sealing, hearse transfer, and re-burial ceremony.
Estimated turnaround: 10 to 21 working days for permit approvals. Expedited fast-track advisory available.`,
  },
  {
    id: 'kb-claims-documentation',
    title: 'Funeral Claims Process & Required Documents',
    category: 'claims',
    keywords: ['claim', 'documents', 'burial order', 'death certificate', 'payout', 'waiting period', 'how to claim'],
    content: `To register a funeral claim with Fidelity Life Assurance, the following documents are required:
1. Certified copy of the Death Certificate or official Burial Order issued by the Registrar or Hospital.
2. Original or certified copy of the deceased's National Identity card or passport.
3. Claimant's National ID and proof of relationship to deceased (e.g. marriage certificate, birth certificate).
4. Policy Number or national ID of principal policyholder.
5. Police Report (Form 231) if death resulted from road traffic accident, workplace incident, or unnatural causes.
Claims Processing:
- Claims can be reported 24/7 via the customer portal, WhatsApp hotline (+263 771 417 719), or at any Fidelity branch.
- Service delivery (hearse, casket, mortuary) is activated immediately upon validation.
- Cash allowances (grocery or Chema benefit) are disbursed within 2 to 4 hours via EcoCash or bank transfer.`,
  },
  {
    id: 'kb-smart-cemetery-graves',
    title: 'Smart Cemetery Locator, GPS Grave Pins & Virtual Flowers',
    category: 'smart_services',
    keywords: ['cemetery', 'grave', 'map', 'google maps', 'flowers', 'virtual flowers', 'locate', 'plot', 'gps'],
    content: `Fidelity Smart Cemetery allows families to easily find cemetery information, locate loved ones' graves, and send tributes:
1. Cemetery Directory: Real-time plot guidance and availability across Warren Hills, Glen Forest, Granville (Mbudzi), Zororo Memorial Park, West Park Bulawayo, and Riverside Mutare.
2. GPS Grave Pinning: Search verified burial records to pinpoint section and plot numbers with direct Google Maps walking routes.
3. Virtual Flowers & Floral Tributes:
   - Visitors can leave permanent virtual floral arrangements (White Lilies, Red Roses, Sunflower Wreaths, Everlasting Proteas) with personalized condolence ribbons.
   - Powered by Kuwana tokens (10 tokens per floral tribute).
   - Tributes appear on the deceased's grave record and memorial page.`,
  },
  {
    id: 'kb-media-streaming-kuwana',
    title: 'AI Media Studio (Music, Video, Biography) & Kuwana Tokens',
    category: 'smart_services',
    keywords: ['media', 'suno', 'music', 'video', 'biography', 'ai', 'live stream', 'streaming', 'replay', 'kuwana', 'tokens'],
    content: `Fidelity Life Digital Memorials offer cutting-edge multimedia commemoration powered by Kuwana Tokens:
1. Suno AI Music Generator: Compose personalized tribute songs and hymns (Gospel, Mbira, Acoustic, Orchestral) from custom lyrics or prompt (25 Kuwana Tokens).
2. AI Video Tribute: Upload family photos and audio voice notes to automatically generate a moving memorial montage with transitions and music (30 Kuwana Tokens).
3. AI Biography Generator: Synthesizes a comprehensive, touching biography and life milestone timeline from photos and key memories in seconds (15 Kuwana Tokens).
4. Video-on-Demand (VOD) Live Streaming: Authorised family members can view the live broadcast or access high-definition replay anytime by logging into their account.
5. Kuwana Tokens: The digital currency for Fidelity Life digital memorial services, redeemable for media generation, floral tributes, and expedited operations. Top-ups available via Chema Wallet, EcoCash, or Card.`,
  },
  {
    id: 'kb-bereavement-48hrs',
    title: 'First 48 Hours: Practical Steps Following a Bereavement',
    category: 'bereavement',
    keywords: ['48 hours', 'death', 'what to do', 'first steps', 'hospital', 'home death', 'mortuary', 'grief'],
    content: `Gentle first steps when a loved one passes away:
1. If death occurs in hospital/clinic: The attending doctor issues the Medical Cause of Death certificate. Contact Fidelity immediately for dignified transfer to the mortuary.
2. If death occurs at home: Contact the Zimbabwe Republic Police (ZRP) and local medical doctor/ambulance for certification before body collection.
3. Obtain the Burial Order from the Civil Registry office or hospital administration.
4. Notify Fidelity Funeral Services (+263 771 417 719) with policy number or request cash walk-in coordination.
5. Convene core family members to designate the funeral coordinator and decide on burial venue and cemetery.
6. Fidelity provides an estate checklist and emotional aftercare support throughout the journey.`,
  },
]
