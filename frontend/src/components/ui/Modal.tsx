import { useEffect, useRef, type ReactNode } from 'react'

interface ModalProps {
  title: string
  children: ReactNode
  onClose: () => void
}

export function Modal({ title, children, onClose }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = dialogRef.current
    if (el && !el.open) {
      el.showModal()
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose()
      }}
      style={{
        maxWidth: '560px',
        width: '90%',
        borderRadius: '16px',
        border: '1px solid #cbd5e1',
        boxShadow: '0 20px 45px rgba(0, 0, 0, 0.25)',
        padding: '0',
        background: '#ffffff',
        margin: 'auto',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
            borderTopLeftRadius: '16px',
            borderTopRightRadius: '16px',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              fontSize: '24px',
              lineHeight: 1,
              padding: '4px 8px',
            }}
          >
            &times;
          </button>
        </header>
        <div style={{ padding: '20px', overflowY: 'auto' }}>{children}</div>
      </div>
    </dialog>
  )
}
