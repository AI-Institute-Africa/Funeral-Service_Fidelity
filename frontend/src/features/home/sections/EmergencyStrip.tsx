import { contact } from '@/config/site'

export function EmergencyStrip() {
  return (
    <section className="emergency-strip" data-header-tone="dark" aria-label="Emergency support details">
      <div className="container emergency-strip__inner">
        <div>
          <p className="eyebrow">Immediate assistance</p>
          <h2>Need help today? Speak to a funeral care adviser.</h2>
        </div>
        <div>
          <p>
            For urgent arrangements, repatriation inquiries or cemetery guidance, our 24/7 support team can help families navigate the next steps with care and clarity.
          </p>
        </div>
        <a href={contact.tollFreeHref} className="btn btn--deep btn--lg" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
          📞 Call 24/7 Helpline: {contact.tollFree}
        </a>
      </div>
    </section>
  )
}
