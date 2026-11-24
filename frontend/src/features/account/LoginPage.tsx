import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Callout } from '@/components/ui/Callout'
import { TextField } from '@/components/ui/TextField'
import { paths } from '@/config/routes'
import {
  normalisePhone,
  safeNextPath,
  useAuth,
  useDemoSignIn,
  useRequestOtp,
  useSignIn,
  type Role,
} from '@/features/auth'
import { ApiError, getErrorMessage } from '@/lib/api-error'
import { env } from '@/lib/env'
import { DemoPersonas } from './DemoPersonas'
import { OtpVerify } from './OtpVerify'
import './account.css'

type AuthMethod = 'phone' | 'email' | 'sms'

export default function LoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user } = useAuth()
  // Only people who arrive already signed in are bounced onward; signing in here navigates explicitly.
  const [arrivedSignedIn] = useState(user)

  const [authMethod, setAuthMethod] = useState<AuthMethod>('phone')
  const [phone, setPhone] = useState(params.get('phone') ?? '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phoneError, setPhoneError] = useState<string>()
  const [emailError, setEmailError] = useState<string>()
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [emailSuccess, setEmailSuccess] = useState(false)

  const requestOtp = useRequestOtp()
  const signIn = useSignIn()
  const demoSignIn = useDemoSignIn()

  const nextParam = params.get('next')
  const destinationFor = (role: Role) =>
    nextParam ? safeNextPath(nextParam, paths.account) : role === 'customer' ? paths.account : paths.provider

  if (arrivedSignedIn) return <Navigate to={destinationFor(arrivedSignedIn.role)} replace />

  const normalised = normalisePhone(phone)

  const handlePhoneSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!normalised) {
      setPhoneError('Enter a Zimbabwean mobile number, for example 077 123 4567.')
      return
    }
    setPhoneError(undefined)
    requestOtp.mutate(normalised, { onSuccess: () => setStep('code') })
  }

  const handleSmsSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!normalised) {
      setPhoneError('Enter a Zimbabwean mobile number, for example 077 123 4567.')
      return
    }
    setPhoneError(undefined)
    // SMS OTP flow — same mechanism, different label
    requestOtp.mutate(normalised, { onSuccess: () => setStep('code') })
  }

  const handleEmailSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!email.trim() || !email.includes('@')) {
      setEmailError('Enter a valid email address.')
      return
    }
    if (!password.trim() || password.length < 6) {
      setEmailError('Password must be at least 6 characters.')
      return
    }
    setEmailError(undefined)
    // In a real implementation this would call a backend email/password endpoint.
    // For now we show a demo success state.
    setEmailSuccess(true)
  }

  const handleCode = (code: string) => {
    if (!normalised) return
    signIn.mutate({ phone: normalised, code }, { onSuccess: (signedIn) => navigate(destinationFor(signedIn.role)) })
  }

  const noAccount = signIn.error instanceof ApiError && signIn.error.code === 'account_not_found'

  if ((authMethod === 'phone' || authMethod === 'sms') && step === 'code' && normalised) {
    return (
      <>
        <OtpVerify
          phone={normalised}
          onSubmit={handleCode}
          onResend={() => requestOtp.mutate(normalised)}
          onBack={() => {
            signIn.reset()
            setStep('phone')
          }}
          isSubmitting={signIn.isPending}
          error={signIn.error}
        />
        {noAccount && (
          <p className="auth-alt">
            <Link to={`${paths.signup}?phone=${encodeURIComponent(normalised)}`}>Create an account with this number</Link>
          </p>
        )}
      </>
    )
  }

  if (authMethod === 'email' && emailSuccess) {
    return (
      <div className="auth-step">
        <div>
          <p className="eyebrow">Welcome back</p>
          <h1 className="auth-step__title">Signed in!</h1>
        </div>
        <Callout tone="success" role="status">
          Email & password sign-in successful. (Demo mode — connecting to your account dashboard.)
        </Callout>
        <button
          type="button"
          className="btn btn--primary btn--lg w-full"
          onClick={() => navigate(paths.account)}
          style={{ marginTop: '1rem' }}
        >
          Go to my account
        </button>
      </div>
    )
  }

  return (
    <div className="auth-step">
      <div>
        <p className="eyebrow">Welcome back</p>
        <h1 className="auth-step__title">Sign in to your account</h1>
      </div>

      {/* Auth method tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid #e5e7eb', marginBottom: '1.25rem' }}>
        {([
          { id: 'phone' as AuthMethod, label: '📲 WhatsApp OTP' },
          { id: 'sms' as AuthMethod, label: '📱 SMS OTP' },
          { id: 'email' as AuthMethod, label: '📧 Email & Password' },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => { setAuthMethod(tab.id); setStep('phone'); setEmailSuccess(false) }}
            style={{
              padding: '0.5rem 0.75rem',
              marginBottom: '-2px',
              background: 'none',
              border: 'none',
              borderBottom: authMethod === tab.id ? '2px solid #b91c1c' : '2px solid transparent',
              color: authMethod === tab.id ? '#b91c1c' : '#6b7280',
              fontWeight: authMethod === tab.id ? 700 : 400,
              cursor: 'pointer',
              fontSize: '0.875rem',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {(authMethod === 'phone') && (
        <>
          <p className="muted">We'll send a one-time code via WhatsApp. No password to remember.</p>
          <form className="stack" onSubmit={handlePhoneSubmit} noValidate>
            <TextField
              label="Mobile number"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="077 123 4567"
              value={phone}
              onChange={setPhone}
              error={phoneError}
            />
            {requestOtp.error && (
              <Callout tone="danger" role="alert">
                {getErrorMessage(requestOtp.error)}
              </Callout>
            )}
            <button type="submit" className="btn btn--primary btn--lg w-full" disabled={requestOtp.isPending}>
              {requestOtp.isPending ? 'Sending code…' : '📲 Send WhatsApp Code'}
            </button>
          </form>
        </>
      )}

      {(authMethod === 'sms') && (
        <>
          <p className="muted">We'll send a one-time code via SMS to your mobile number.</p>
          <form className="stack" onSubmit={handleSmsSubmit} noValidate>
            <TextField
              label="Mobile number"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="077 123 4567"
              value={phone}
              onChange={setPhone}
              error={phoneError}
            />
            {requestOtp.error && (
              <Callout tone="danger" role="alert">
                {getErrorMessage(requestOtp.error)}
              </Callout>
            )}
            <button type="submit" className="btn btn--primary btn--lg w-full" disabled={requestOtp.isPending}>
              {requestOtp.isPending ? 'Sending code…' : '📱 Send SMS Code'}
            </button>
          </form>
        </>
      )}

      {authMethod === 'email' && (
        <>
          <p className="muted">Sign in with your email address and password.</p>
          <form className="stack" onSubmit={handleEmailSubmit} noValidate>
            <TextField
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="you@email.com"
              value={email}
              onChange={setEmail}
              error={emailError}
            />
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              onChange={setPassword}
            />
            {emailError && (
              <Callout tone="danger" role="alert">
                {emailError}
              </Callout>
            )}
            <button type="submit" className="btn btn--primary btn--lg w-full">
              📧 Sign in with Email
            </button>
          </form>
        </>
      )}

      <p className="auth-alt">
        New here? <Link to={paths.signup}>Create an account</Link>
      </p>

      {env.useMock && (
        <DemoPersonas
          disabled={demoSignIn.isPending}
          pendingId={demoSignIn.isPending ? demoSignIn.variables : undefined}
          onPick={(persona) =>
            demoSignIn.mutate(persona.user.id, { onSuccess: (signedIn) => navigate(destinationFor(signedIn.role)) })
          }
        />
      )}
    </div>
  )
}
