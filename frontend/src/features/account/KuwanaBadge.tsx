import { useState } from 'react'
import { useKuwanaTokens } from './tokens'
import { Modal } from '@/components/ui/Modal'
import { Callout } from '@/components/ui/Callout'

export function KuwanaBadge() {
  const { balance, transactions, topUp } = useKuwanaTokens()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(100)
  const [success, setSuccess] = useState('')

  const handleTopUp = () => {
    topUp(amount, `Purchased ${amount} Kuwana tokens`)
    setSuccess(`Successfully added ${amount} Kuwana tokens!`)
    setTimeout(() => setSuccess(''), 3000)
  }

  return (
    <>
      <button
        type="button"
        className="btn btn--sm"
        style={{
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          color: '#ffffff',
          fontWeight: 600,
          border: 'none',
          boxShadow: '0 2px 6px rgba(217, 119, 6, 0.3)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          borderRadius: '20px',
          padding: '4px 12px',
          cursor: 'pointer',
        }}
        onClick={() => setOpen(true)}
        title="Kuwana Token Wallet"
      >
        <span style={{ fontSize: '14px' }}>🪙</span>
        <span>{balance} Kuwana Tokens</span>
      </button>

      {open && (
        <Modal title="Kuwana Token Wallet" onClose={() => setOpen(false)}>
          <div className="stack" style={{ gap: '16px', padding: '8px 0' }}>
            <div
              style={{
                background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
                color: '#ffffff',
                padding: '20px',
                borderRadius: '12px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8 }}>
                Current Balance
              </div>
              <div style={{ fontSize: '36px', fontWeight: 700, margin: '8px 0', color: '#fbbf24' }}>
                {balance} <span style={{ fontSize: '20px', fontWeight: 500 }}>Tokens</span>
              </div>
              <p style={{ margin: 0, fontSize: '13px', opacity: 0.9 }}>
                Use Kuwana Tokens for AI Music (Suno), In Loving Memory Videos, AI Biography, Virtual Flowers & VOD Live Streams.
              </p>
            </div>

            {success && <Callout tone="success">{success}</Callout>}

            <div className="card stack" style={{ gap: '12px', padding: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>Top-Up Tokens</h3>
              <p className="muted" style={{ fontSize: '13px', margin: 0 }}>
                Select token package to top up using Chema Wallet, EcoCash, or Card:
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {[
                  { tokens: 50, price: '$5' },
                  { tokens: 100, price: '$10' },
                  { tokens: 250, price: '$20' },
                ].map((pkg) => (
                  <button
                    key={pkg.tokens}
                    type="button"
                    className={`btn btn--sm ${amount === pkg.tokens ? 'btn--primary' : 'btn--outline'}`}
                    onClick={() => setAmount(pkg.tokens)}
                    style={{ padding: '10px 4px', textAlign: 'center' }}
                  >
                    <strong>+{pkg.tokens}</strong>
                    <div style={{ fontSize: '11px', opacity: 0.8 }}>{pkg.price}</div>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleTopUp}
                style={{ width: '100%', marginTop: '6px' }}
              >
                Top Up +{amount} Tokens
              </button>
            </div>

            <div className="stack" style={{ gap: '8px' }}>
              <h4 style={{ margin: '8px 0 0 0', fontSize: '14px' }}>Recent Token Activity</h4>
              {transactions.length === 0 ? (
                <p className="muted" style={{ fontSize: '13px' }}>No transactions recorded yet.</p>
              ) : (
                <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {transactions.slice(0, 10).map((tx) => (
                    <div
                      key={tx.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        background: '#f8fafc',
                        borderRadius: '6px',
                        fontSize: '13px',
                      }}
                    >
                      <div>
                        <strong>{tx.description}</strong>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {new Date(tx.timestamp).toLocaleString('en-GB')}
                        </div>
                      </div>
                      <span
                        style={{
                          fontWeight: 700,
                          color: tx.amount >= 0 ? '#16a34a' : '#dc2626',
                        }}
                      >
                        {tx.amount >= 0 ? `+${tx.amount}` : tx.amount}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
