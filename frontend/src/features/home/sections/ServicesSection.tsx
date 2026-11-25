import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { Reveal } from '@/components/ui/Reveal'
import { Section } from '@/components/ui/Section'
import { anchor } from '@/config/routes'

const services = [
  { title: 'Funeral Services', detail: 'Wakes, church services and burial, coordinated from the first call to the last hymn.' },
  { title: 'Cremation', detail: 'Respectful cremation arrangements with clear guidance and support for the family.' },
  { title: 'Memorial services', detail: 'Flexible options, with guided remembrance and keepsakes for the family.' },
  { title: 'Repatriation', detail: 'Paperwork, transport and clear guidance for families abroad.' },
  { title: 'Cemetery guidance', detail: 'Help finding a plot, locating a grave and working with the cemetery.' },
  { title: 'Digital memorials', detail: 'A life story, photographs and tributes that relatives can visit from anywhere.' },
  { title: 'Aftercare and estate help', detail: 'Practical checklists and check-ins once the service is over.' },
  { title: 'Exhumations', detail: 'Lawful, dignified exhumation and reburial coordination with full statutory clearance.' },
]

export function ServicesSection() {
  return (
    <Section id="services" soft containerClassName="services">
      <Reveal className="services__intro">
        <p className="eyebrow">What we arrange</p>
        <h2>Everything a funeral asks of a family, handled with you.</h2>
        <p className="muted">
          You decide what matters. We take care of the calls, the paperwork and the logistics around it.
        </p>
        <Link to={anchor('plans')} className="link-arrow">
          See how funeral plans work <Icon name="arrow-right" size={16} />
        </Link>
      </Reveal>

      <ol className="services__list">
        {services.map((item, index) => (
          <Reveal as="li" key={item.title} index={index} className="services__item">
            <span className="services__num" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div>
              <h3>
                <Link to={anchor('plans')} style={{ color: 'inherit', textDecoration: 'none' }}>
                  {item.title}
                </Link>
              </h3>
              <p>{item.detail}</p>
              <Link to={anchor('plans')} className="link-arrow" style={{ marginTop: '0.45rem', fontSize: '0.9rem' }}>
                View funeral plans <Icon name="arrow-right" size={14} />
              </Link>
            </div>
          </Reveal>
        ))}
      </ol>
    </Section>
  )
}
