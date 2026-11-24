import type { FuneralStream } from './data'

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString()

export function seedStreams(): FuneralStream[] {
  return [
    {
      id: 'fs-nyathi',
      personName: 'Grace Nyathi',
      serviceTitle: 'Funeral service and burial (recording)',
      date: '2025-09-10',
      time: '10:00 CAT',
      venue: "St Mary's Church, Makokoba / Athlone Cemetery",
      details: 'Authorised family coverage recording. Logged-in relatives can watch the full memorial service on-demand anytime.',
      status: 'ended',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      chapters: [
        { seconds: 0, time: '00:00', title: 'Procession Arrival & Opening Hymn' },
        { seconds: 45, time: '00:45', title: 'Scripture Reading & Pastoral Prayer' },
        { seconds: 120, time: '02:00', title: 'Family & Grandchildren Eulogies' },
        { seconds: 240, time: '04:00', title: 'Body Viewing & Final Tributes' },
        { seconds: 360, time: '06:00', title: 'Committal Prayer & Internment' },
      ],
      viewers: [
        { id: 'sv1', name: 'Samuel Nyathi', contact: 'samuel@example.com', status: 'accessed', invitedAt: daysAgo(28), accessedAt: daysAgo(27) },
        { id: 'sv2', name: 'Lindiwe Khumalo', contact: '+263 77 111 2222', status: 'invited', invitedAt: daysAgo(27) },
        { id: 'sv3', name: 'Super Admin', contact: '+263771417719', status: 'accessed', invitedAt: daysAgo(1), accessedAt: daysAgo(1) },
      ],
      recordingAvailable: true,
      savedToArchiveId: 'fr-nyathi',
      updatedAt: daysAgo(26),
    },
    {
      id: 'fs-upcoming',
      personName: 'Late Sekuru Moyo Memorial Service',
      serviceTitle: 'Live memorial chapel broadcast and graveside committal',
      date: '2026-11-22',
      time: '10:30 CAT',
      venue: 'Fidelity Memorial Chapel, Harare',
      details: 'Live streaming scheduled for diaspora and local family members. Video recording will be available immediately for on-demand playback upon conclusion.',
      status: 'live',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      chapters: [
        { seconds: 0, time: '00:00', title: 'Live Broadcast Commenced' },
        { seconds: 30, time: '00:30', title: 'Opening Hymn & Prayers' },
      ],
      viewers: [
        { id: 'sv4', name: 'Tariro Moyo', contact: '+263 77 333 4444', status: 'invited', invitedAt: daysAgo(1), consentForAlerts: true },
        { id: 'sv5', name: 'Super Admin', contact: '+263771417719', status: 'accessed', invitedAt: daysAgo(1), accessedAt: daysAgo(1) },
      ],
      recordingAvailable: true,
      updatedAt: daysAgo(1),
    },
  ]
}
