import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Callout } from '@/components/ui/Callout'
import { TextField } from '@/components/ui/TextField'
import { paths } from '@/config/routes'
import { isEmail, normalisePhone, useAuth, useRequestOtp, useSignUp } from '@/features/auth'
import { getErrorMessage } from '@/lib/api-error'
import { env } from '@/lib/env'
import { OtpVerify } from './OtpVerify'
import { DEMO_POLICY_HINT } from './data'
import { useLinkPolicy } from './queries'
import './account.css'

type RegMethod = 'whatsapp' | 'sms' | 'email'
type FieldErrors = Partial<Record<'name' | 'phone' | 'email' | 'password' | 'policyNumber' | 'idNumber', string>>

export default function SignupPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user } = useAuth()
  const [arrivedSignedIn] = useState(user)

  const [regMethod, setRegMethod] = useState<RegMethod>('whatsapp')

  // Common fields
  const [name, setName] = useState('')
  const [phone, setPhone] = useState(params.get('phone') ?? '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [hasPolicy, setHasPolicy] = useState(false)
  const [policyNumber, setPolicyNumber] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [step, setStep] = useState<'details' | 'code'>('details')
  const [emailSuccess, setEmailSuccess] = useState(false)

  const requestOtp = useRequestOtp()
  const signUp = useSignUp()
  const linkPolicy = useLinkPolicy()

  if (arrivedSignedIn) return <Navigate to={paths.account} replace />

  const normalised = normalisePhone(phone)

  const validatePhoneBased = (): FieldErrors => {
    const found: FieldErrors = {}
    if (name.trim().length < 2) found.name = 'Enter your full name.'
    if (!normalised) found.phone = 'Enter a Zimbabwean mobile number, for example 077 123 4567.'
    if (hasPolicy && !policyNumber.trim()) found.policyNumber = 'Enter the policy number from your documents.'
    if (hasPolicy && !idNumber.trim()) found.idNumber = 'Enter the ID number you registered the policy with.'
    return found
  }

  const validateEmail = (): FieldErrors => {
    const found: FieldErrors = {}
    if (name.trim().length < 2) found.name = 'Enter your full name.'
    if (!email.trim() || !isEmail(email.trim())) found.email = 'Enter a valid email address.'
    if (!password.trim() || password.length < 8) found.password = 'Password must be at least 8 characters.'
    if (password !== confirmPassword) found.password = 'Passwords do not match.'
    if (hasPolicy && !policyNumber.trim()) found.policyNumber = 'Enter the policy number from your documents.'
    if (hasPolicy && !idNumber.trim()) found.idNumber = 'Enter the ID number you registered the policy with.'
    return found
  }

  const handlePhoneBasedSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const found = validatePhoneBased()
    setErrors(found)
    if (Object.keys(found).length > 0 || !normalised) return
    requestOtp.mutate(normalised, { onSuccess: () => setStep('code') })
  }

  const handleEmailSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const found = validateEmail()
    setErrors(found)
    if (Object.keys(found).length > 0) return
    // In production this would call POST /register-password
    setEmailSuccess(true)
  }

  const handleCode = async (code: string) => {
    if (!normalised) return
    try {
      await signUp.mutateAsync({ name: name.trim(), phone: normalised, code, email: email.trim() || undefined })
    } catch {
      return // The error is shown from the mutation state.
    }

    if (!hasPolicy) {
      navigate(paths.account, { state: { welcome: true } })
      return
    }

    // The account now exists. A policy that doesn't match shouldn't undo that, so hand over to the policy page.
    try {
      await linkPolicy.mutateAsync({ policyNumber: policyNumber.trim(), idNumber: idNumber.trim() })
      navigate(paths.account, { state: { welcome: true } })
    } catch {
      navigate(paths.accountPolicy, { state: { policyNotMatched: true } })
    }
  }

  if ((regMethod === 'whatsapp' || regMethod === 'sms') && step === 'code' && normalised) {
    return (
      <OtpVerify
        phone={normalised}
        onSubmit={(code) => void handleCode(code)}
        onResend={() => requestOtp.mutate(normalised)}
        onBack={() => {
          signUp.reset()
          setStep('details')
        }}
        isSubmitting={signUp.isPending || linkPolicy.isPending}
        error={signUp.error}
      />
    )
  }

  if (regMethod === 'email' && emailSuccess) {
    return (
      <div className="auth-step">
        <div>
          <p className="eyebrow">Welcome to Fidelity Life</p>
          <h1 className="auth-step__title">Account created!</h1>
        </div>
        <Callout tone="success" role="status">
          Your account has been created with email & password. (Demo — in production a verification email would be sent.)
        </Callout>
        <button
          type="button"
          className="btn btn--primary btn--lg w-full"
          onClick={() => navigate(paths.account, { state: { welcome: true } })}
          style={{ marginTop: '1rem' }}
        >
          Go to my account
        </button>
      </div>
    )
  }

  const policySection = (
    <>
      <label className="toggle">
        <input type="checkbox" checked={hasPolicy} onChange={(event) => setHasPolicy(event.target.checked)} />
        <span>I already have a Fidelity Life policy</span>
      </label>

      {hasPolicy && (
        <div className="stack signup-policy">
          <TextField
            label="Policy number"
            placeholder="FLA-123456"
            autoCapitalize="characters"
            value={policyNumber}
            onChange={setPolicyNumber}
            error={errors.policyNumber}
          />
          <TextField
            label="ID number"
            placeholder="63-123456-K-42"
            autoCapitalize="characters"
            value={idNumber}
            onChange={setIdNumber}
            error={errors.idNumber}
            hint="We use this once, to confirm the policy is yours."
          />
          {env.useMock && <Callout tone="info">{DEMO_POLICY_HINT}</Callout>}
        </div>
      )}
    </>
  )

  return (
    <div className="auth-step">
      <div>
        <p className="eyebrow">Get started</p>
        <h1 className="auth-step__title">Create your account</h1>
      </div>
      <p className="muted">Takes about a minute. Already insured with us? Add your policy and it's ready on day one.</p>

      {/* Registration method tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid #e5e7eb', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {([
          { id: 'whatsapp' as RegMethod, label: '📲 WhatsApp OTP' },
          { id: 'sms' as RegMethod, label: '📱 SMS OTP' },
          { id: 'email' as RegMethod, label: '📧 Email & Password' },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => { setRegMethod(tab.id); setStep('details'); setErrors({}) }}
            style={{
              padding: '0.5rem 0.75rem',
              marginBottom: '-2px',
              background: 'none',
              border: 'none',
              borderBottom: regMethod === tab.id ? '2px solid #b91c1c' : '2px solid transparent',
              color: regMethod === tab.id ? '#b91c1c' : '#6b7280',
              fontWeight: regMethod === tab.id ? 700 : 400,
              cursor: 'pointer',
              fontSize: '0.875rem',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {(regMethod === 'whatsapp' || regMethod === 'sms') && (
        <>
          <p className="muted" style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
            {regMethod === 'whatsapp'
              ? '📲 You will receive a verification code via WhatsApp.'
              : '📱 You will receive a verification code via SMS.'}
          </p>
          <form className="stack" onSubmit={handlePhoneBasedSubmit} noValidate>
            <TextField label="Full name" autoComplete="name" value={name} onChange={setName} error={errors.name} />
            <TextField
              label="Mobile number"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="077 123 4567"
              value={phone}
              onChange={setPhone}
              error={errors.phone}
            />
            <TextField
              label="Email"
              tag="Optional"
              type="email"
              autoComplete="email"
              value={email}
              onChange={setEmail}
              error={errors.email}
            />

            {policySection}

            {requestOtp.error && (
              <Callout tone="danger" role="alert">
                {getErrorMessage(requestOtp.error)}
              </Callout>
            )}

            <button type="submit" className="btn btn--primary btn--lg w-full" disabled={requestOtp.isPending}>
              {requestOtp.isPending
                ? 'Sending code…'
                : regMethod === 'whatsapp'
                ? '📲 Continue with WhatsApp'
                : '📱 Continue with SMS'}
            </button>
            <p className="auth-fineprint">By continuing you agree to the sample Terms and Privacy Notice.</p>
          </form>
        </>
      )}

      {regMethod === 'email' && (
        <>
          <p className="muted" style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
            📧 Register with your email address and a secure password.
          </p>
          <form className="stack" onSubmit={handleEmailSubmit} noValidate>
            <TextField label="Full name" autoComplete="name" value={name} onChange={setName} error={errors.name} />
            <TextField
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="you@email.com"
              value={email}
              onChange={setEmail}
              error={errors.email}
            />
            <TextField
              label="Password"
              type="password"
              autoComplete="new-password"
              placeholder="Minimum 8 characters"
              value={password}
              onChange={setPassword}
              error={errors.password}
            />
            <TextField
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={setConfirmPassword}
            />

            {policySection}

            <button type="submit" className="btn btn--primary btn--lg w-full">
              📧 Create Account with Email
            </button>
            <p className="auth-fineprint">By continuing you agree to the sample Terms and Privacy Notice.</p>
          </form>
        </>
      )}

      <p className="auth-alt">
        Already have an account? <Link to={paths.login}>Sign in</Link>
      </p>
    </div>
  )
}
