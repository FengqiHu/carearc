import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const MOCK_CREDENTIALS = {
  patient: [
    { name: 'John Smith (High Risk)', email: 'john.smith@email.com' },
    { name: 'Emily Johnson (Medium Risk)', email: 'emily.j@email.com' },
    { name: 'Maria Garcia (High Risk)', email: 'maria.g@email.com' },
    { name: 'Robert Davis (Low Risk)', email: 'robert.d@email.com' },
    { name: 'James Wilson (Medium Risk)', email: 'james.w@email.com' },
    { name: 'Lisa Chen (Low Risk)', email: 'lisa.c@email.com' },
  ],
  doctor: [
    { name: 'Dr. Sarah Chen', email: 'sarah.chen@carearc.com' },
    { name: 'Dr. Michael Torres', email: 'michael.torres@carearc.com' },
  ],
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  const [role, setRole] = useState('patient')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(email, password)
      const from = location.state?.from?.pathname
      if (from && from !== '/') {
        navigate(from, { replace: true })
      } else {
        navigate(user.role === 'doctor' ? '/doctor' : '/patient', { replace: true })
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          'Invalid email or password. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  const fillCredential = (cred) => {
    setEmail(cred.email)
    setPassword('password123')
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #e0f2fe 50%, #f0fdf4 100%)' }}
    >
      <div className="w-full max-w-md">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ background: '#1d4ed8' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L3 7V12C3 16.55 6.84 20.74 12 22C17.16 20.74 21 16.55 21 12V7L12 2Z" fill="white" fillOpacity="0.9"/>
              <path d="M10 14.5L7.5 12L6.5 13L10 16.5L17.5 9L16.5 8L10 14.5Z" fill="#1d4ed8"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold" style={{ color: '#101114' }}>CareArc</h1>
          <p className="text-sm mt-1 font-medium" style={{ color: '#9497a9' }}>AI-Assisted Recovery Monitoring</p>
        </div>

        {/* Login Card */}
        <div
          className="bg-white rounded-2xl p-8"
          style={{ boxShadow: 'rgba(0,0,0,0.06) 0px 4px 24px' }}
        >
          <h2 className="text-xl font-semibold mb-6 text-center" style={{ color: '#101114' }}>
            Sign in to your account
          </h2>

          {/* Role Toggle */}
          <div className="flex rounded-xl p-1 mb-6" style={{ background: '#f3f4f8' }}>
            {['patient', 'doctor'].map((r) => (
              <button
                key={r}
                onClick={() => { setRole(r); setEmail(''); setPassword(''); setError('') }}
                className="flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all capitalize"
                style={
                  role === r
                    ? { background: '#1d4ed8', color: '#ffffff', boxShadow: 'rgba(0,0,0,0.08) 0px 2px 8px' }
                    : { background: 'transparent', color: '#9497a9' }
                }
              >
                {r === 'patient' ? '🏥 Patient' : '👨‍⚕️ Doctor'}
              </button>
            ))}
          </div>

          {error && (
            <div
              className="rounded-xl px-4 py-3 mb-4 text-sm font-medium"
              style={{ background: 'rgba(220,38,38,0.1)', color: '#991b1b' }}
            >
              <span className="mr-2">⚠️</span>{error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#101114' }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder={role === 'patient' ? 'your.name@email.com' : 'dr.name@carearc.com'}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                style={{
                  border: '1.5px solid #dedee5',
                  color: '#101114',
                  background: '#ffffff',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#1d4ed8')}
                onBlur={(e) => (e.target.style.borderColor = '#dedee5')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#101114' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                style={{
                  border: '1.5px solid #dedee5',
                  color: '#101114',
                  background: '#ffffff',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#1d4ed8')}
                onBlur={(e) => (e.target.style.borderColor = '#dedee5')}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all mt-2"
              style={{
                background: loading ? '#93a9e8' : '#1d4ed8',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Mock Credentials */}
          <div className="mt-6 pt-5" style={{ borderTop: '1px solid #dedee5' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#9497a9' }}>
              Demo {role} accounts — click to fill
            </p>
            <div className="space-y-2">
              {MOCK_CREDENTIALS[role].map((cred) => (
                <button
                  key={cred.email}
                  onClick={() => fillCredential(cred)}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all group"
                  style={{ background: 'rgba(29,78,216,0.06)', border: '1px solid rgba(29,78,216,0.12)' }}
                >
                  <div className="font-medium" style={{ color: '#1d4ed8' }}>{cred.name}</div>
                  <div style={{ color: '#9497a9' }} className="text-xs mt-0.5">{cred.email} · password123</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#9497a9' }}>
          CareArc &copy; 2025 · AI-Assisted Post-Operative Monitoring
        </p>
      </div>
    </div>
  )
}
