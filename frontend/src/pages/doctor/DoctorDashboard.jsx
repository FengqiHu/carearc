import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { doctor } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import RiskBadge from '../../components/RiskBadge'

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  )
}

function StatCard({ label, value, color, bg }) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col"
      style={{ background: bg, boxShadow: 'rgba(0,0,0,0.04) 0px 2px 12px', border: '1px solid rgba(0,0,0,0.05)' }}
    >
      <span className="text-3xl font-bold" style={{ color }}>{value}</span>
      <span className="text-xs font-medium mt-1" style={{ color }}>{label}</span>
    </div>
  )
}

const RISK_ORDER = { high: 0, medium: 1, low: 2 }

function AlertChip({ label }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium"
      style={{ background: 'rgba(245,158,11,0.14)', color: '#92400e' }}
    >
      {label}
    </span>
  )
}

function PatientCard({ p, onClick }) {
  const riskLevel = (p.risk_level || p.level || 'low').toLowerCase()
  const flags = p.alert_flags || p.flags || p.alerts || []
  const flagList = Array.isArray(flags) ? flags : []
  const topFactor = p.top_risk_factor || p.primary_factor || (p.risk_factors && p.risk_factors[0]) || ''
  const topFactorText = typeof topFactor === 'string' ? topFactor : (topFactor?.factor || topFactor?.name || '')
  const lastCheckin = p.last_checkin_date || p.last_checkin || p.last_check_in
  const suggestedAction = p.suggested_action || p.follow_up_action || 'Review Patient'
  const postOpDay = p.post_op_day || p.postOpDay || '—'
  const age = p.age || '—'
  const sex = p.sex || p.gender || ''
  const surgeryType = p.surgery_type || p.surgeryType || 'Surgery'

  return (
    <div
      className="bg-white rounded-2xl p-5 cursor-pointer transition-all group"
      style={{
        boxShadow: 'rgba(0,0,0,0.06) 0px 4px 24px',
        border: '1px solid #dedee5',
      }}
      onClick={onClick}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#1d4ed8'; e.currentTarget.style.boxShadow = 'rgba(29,78,216,0.12) 0px 4px 24px' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#dedee5'; e.currentTarget.style.boxShadow = 'rgba(0,0,0,0.06) 0px 4px 24px' }}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: patient info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-base" style={{ color: '#101114' }}>{p.name || 'Unknown Patient'}</h3>
            {age !== '—' && (
              <span className="text-xs" style={{ color: '#9497a9' }}>{age}{sex ? `, ${sex}` : ''}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-sm" style={{ color: '#9497a9' }}>{surgeryType}</span>
            {postOpDay !== '—' && (
              <span
                className="px-2 py-0.5 rounded-lg text-xs font-semibold"
                style={{ background: 'rgba(29,78,216,0.10)', color: '#1d4ed8' }}
              >
                Post-op Day {postOpDay}
              </span>
            )}
          </div>

          {/* Alert flags */}
          {flagList.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {flagList.slice(0, 4).map((flag, i) => (
                <AlertChip
                  key={i}
                  label={typeof flag === 'string' ? flag : (flag.label || flag.name || flag.flag || JSON.stringify(flag))}
                />
              ))}
              {flagList.length > 4 && (
                <span className="text-xs" style={{ color: '#9497a9' }}>+{flagList.length - 4} more</span>
              )}
            </div>
          )}

          {/* Top risk factor */}
          {topFactorText && (
            <p className="text-xs mt-2" style={{ color: '#9497a9' }}>
              <span className="font-medium" style={{ color: '#101114' }}>Top factor:</span> {topFactorText}
            </p>
          )}

          {/* Last check-in */}
          {lastCheckin && (
            <p className="text-xs mt-1.5" style={{ color: '#9497a9' }}>
              Last check-in: {new Date(lastCheckin).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          )}
        </div>

        {/* Right: risk badge + action */}
        <div className="flex flex-col items-end gap-3 flex-shrink-0">
          <RiskBadge level={riskLevel} size="md" />
          <button
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
            style={{ background: '#1d4ed8' }}
          >
            Review Patient
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="ml-0.5">
              <path d="M5 12H19M12 5L19 12L12 19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DoctorDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const fetchPatients = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await doctor.getPatients()
        if (cancelled) return
        const list = res.data?.patients || res.data || []
        const normalized = (Array.isArray(list) ? list : []).map(p => ({
          ...p,
          risk_level: (p.latestRiskAssessment?.risk_level || p.risk_level || p.level || 'low').toLowerCase(),
        }))
        const sorted = [...normalized].sort((a, b) =>
          (RISK_ORDER[a.risk_level] ?? 3) - (RISK_ORDER[b.risk_level] ?? 3)
        )
        setPatients(sorted)
      } catch (err) {
        if (!cancelled) setError('Failed to load patient queue. Please refresh.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchPatients()
    return () => { cancelled = true }
  }, [])

  const highRisk = patients.filter((p) => (p.risk_level || p.level || '').toLowerCase() === 'high').length
  const medRisk = patients.filter((p) => (p.risk_level || p.level || '').toLowerCase() === 'medium').length
  const lowRisk = patients.filter((p) => (p.risk_level || p.level || '').toLowerCase() === 'low').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#101114' }}>
            Patient Queue
          </h1>
          <p className="text-sm mt-1" style={{ color: '#9497a9' }}>
            Sorted by risk priority &mdash; high risk patients shown first
          </p>
        </div>
        {!loading && (
          <span
            className="px-3 py-1 rounded-xl text-sm font-semibold"
            style={{ background: 'rgba(29,78,216,0.10)', color: '#1d4ed8' }}
          >
            {patients.length} patients
          </span>
        )}
      </div>

      {loading && <Spinner />}
      {!loading && error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(220,38,38,0.1)', color: '#991b1b' }}>
          ⚠️ {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total Patients" value={patients.length} color="#1d4ed8" bg="rgba(29,78,216,0.08)" />
            <StatCard label="High Risk" value={highRisk} color="#991b1b" bg="rgba(220,38,38,0.08)" />
            <StatCard label="Medium Risk" value={medRisk} color="#92400e" bg="rgba(245,158,11,0.10)" />
            <StatCard label="Low Risk" value={lowRisk} color="#026b3f" bg="rgba(20,158,97,0.10)" />
          </div>

          {/* Patient List */}
          {patients.length === 0 ? (
            <div
              className="bg-white rounded-2xl p-12 text-center"
              style={{ boxShadow: 'rgba(0,0,0,0.06) 0px 4px 24px', border: '1px solid #dedee5' }}
            >
              <span className="text-4xl block mb-3">🏥</span>
              <p className="font-medium" style={{ color: '#101114' }}>No patients in the queue</p>
              <p className="text-sm mt-1" style={{ color: '#9497a9' }}>Patients will appear here once they are assigned to you.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* High Risk Section */}
              {highRisk > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2.5 px-1">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#dc2626' }} />
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#9497a9' }}>
                      High Risk ({highRisk})
                    </span>
                  </div>
                  {patients
                    .filter((p) => (p.risk_level || p.level || '').toLowerCase() === 'high')
                    .map((p) => (
                      <PatientCard
                        key={p.id || p.patient_id}
                        p={p}
                        onClick={() => navigate(`/doctor/patients/${p.id || p.patient_id}`)}
                      />
                    ))}
                </div>
              )}

              {/* Medium Risk Section */}
              {medRisk > 0 && (
                <div className={highRisk > 0 ? 'mt-5' : ''}>
                  <div className="flex items-center gap-2 mb-2.5 px-1">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#d97706' }} />
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#9497a9' }}>
                      Medium Risk ({medRisk})
                    </span>
                  </div>
                  {patients
                    .filter((p) => (p.risk_level || p.level || '').toLowerCase() === 'medium')
                    .map((p) => (
                      <PatientCard
                        key={p.id || p.patient_id}
                        p={p}
                        onClick={() => navigate(`/doctor/patients/${p.id || p.patient_id}`)}
                      />
                    ))}
                </div>
              )}

              {/* Low Risk Section */}
              {lowRisk > 0 && (
                <div className={(highRisk > 0 || medRisk > 0) ? 'mt-5' : ''}>
                  <div className="flex items-center gap-2 mb-2.5 px-1">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#14be8b' }} />
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#9497a9' }}>
                      Low Risk ({lowRisk})
                    </span>
                  </div>
                  {patients
                    .filter((p) => (p.risk_level || p.level || '').toLowerCase() === 'low')
                    .map((p) => (
                      <PatientCard
                        key={p.id || p.patient_id}
                        p={p}
                        onClick={() => navigate(`/doctor/patients/${p.id || p.patient_id}`)}
                      />
                    ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
