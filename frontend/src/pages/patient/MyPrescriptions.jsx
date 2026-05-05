import React, { useState, useEffect } from 'react'
import { patient as patientApi } from '../../api/client'

function fmtDate(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function calcEndDate(startDate, durationDays) {
  if (!startDate || !durationDays) return null
  const end = new Date(startDate)
  end.setDate(end.getDate() + durationDays)
  return end
}

function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl p-6 ${className}`}
      style={{ boxShadow: 'rgba(0,0,0,0.06) 0px 4px 24px', border: '1px solid #dedee5' }}>
      {children}
    </div>
  )
}

function StatusBadge({ active }) {
  return active ? (
    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold"
      style={{ background: 'rgba(20,158,97,0.14)', color: '#026b3f' }}>
      ● Active
    </span>
  ) : (
    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold"
      style={{ background: 'rgba(104,107,130,0.12)', color: '#686b82' }}>
      Completed
    </span>
  )
}

function DaysRemaining({ startDate, durationDays }) {
  if (!startDate || !durationDays) return null
  const end = new Date(startDate)
  end.setDate(end.getDate() + durationDays)
  const today = new Date()
  const remaining = Math.ceil((end - today) / 86400000)
  if (remaining <= 0) return <span className="text-xs" style={{ color: '#9497a9' }}>Course completed</span>
  const pct = Math.max(0, Math.min(100, (remaining / durationDays) * 100))
  const color = remaining <= 3 ? '#dc2626' : remaining <= 7 ? '#f59e0b' : '#1d4ed8'
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5" style={{ color: '#9497a9' }}>
        <span>{remaining} day{remaining !== 1 ? 's' : ''} remaining</span>
        <span>of {durationDays} days</span>
      </div>
      <div className="w-full rounded-full h-1.5" style={{ background: '#f3f4f8' }}>
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

export default function MyPrescriptions() {
  const [prescriptions, setPrescriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    patientApi.getPrescriptions()
      .then(r => setPrescriptions(r.data.prescriptions || []))
      .catch(() => setError('Failed to load prescriptions.'))
      .finally(() => setLoading(false))
  }, [])

  const active = prescriptions.filter(p => p.is_active)
  const past   = prescriptions.filter(p => !p.is_active)

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="p-8">
      <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(220,38,38,0.1)', color: '#991b1b' }}>
        ⚠️ {error}
      </div>
    </div>
  )

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#101114' }}>My Prescriptions</h1>
        <p className="text-sm mt-1" style={{ color: '#9497a9' }}>Prescriptions issued by your doctor</p>
      </div>

      {prescriptions.length === 0 && (
        <Card>
          <div className="text-center py-8">
            <div className="text-4xl mb-3">💊</div>
            <p className="font-medium" style={{ color: '#101114' }}>No prescriptions yet</p>
            <p className="text-sm mt-1" style={{ color: '#9497a9' }}>Your doctor hasn't issued a prescription yet.</p>
          </div>
        </Card>
      )}

      {active.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#9497a9' }}>
            Active Prescriptions
          </h2>
          {active.map(p => <PrescriptionCard key={p.id} prescription={p} />)}
        </div>
      )}

      {past.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#9497a9' }}>
            Past Prescriptions
          </h2>
          {past.map(p => <PrescriptionCard key={p.id} prescription={p} />)}
        </div>
      )}
    </div>
  )
}

function PrescriptionCard({ prescription: p }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-white rounded-2xl overflow-hidden"
      style={{ boxShadow: 'rgba(0,0,0,0.06) 0px 4px 24px', border: '1px solid #dedee5' }}>

      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: p.is_active ? 'rgba(29,78,216,0.10)' : 'rgba(104,107,130,0.10)' }}>
              <span className="text-xl">💊</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-base" style={{ color: '#101114' }}>
                  {p.medication_name}
                </h3>
                <span className="text-sm font-medium" style={{ color: '#1d4ed8' }}>{p.dosage}</span>
                <StatusBadge active={p.is_active} />
              </div>
              <p className="text-sm mt-0.5" style={{ color: '#9497a9' }}>
                {p.frequency}
              </p>
              {p.doctor_name && (
                <p className="text-xs mt-1" style={{ color: '#9497a9' }}>
                  Prescribed by {p.doctor_name}{p.doctor_specialty ? ` · ${p.doctor_specialty}` : ''}
                </p>
              )}
            </div>
          </div>
          <button onClick={() => setExpanded(e => !e)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg flex-shrink-0"
            style={{ background: 'rgba(29,78,216,0.08)', color: '#1d4ed8' }}>
            {expanded ? 'Less ▲' : 'Details ▼'}
          </button>
        </div>

        <div className="mt-4">
          <DaysRemaining startDate={p.start_date} durationDays={p.duration_days} />
        </div>

        {/* Dosing summary box */}
        <div className="mt-4 rounded-xl px-4 py-3"
          style={{ background: p.is_active ? 'rgba(29,78,216,0.06)' : '#f8f9fc', border: `1px solid ${p.is_active ? 'rgba(29,78,216,0.15)' : '#ebebf0'}` }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: p.is_active ? '#1d4ed8' : '#9497a9' }}>
            How to take
          </p>
          <p className="text-sm font-semibold" style={{ color: '#101114' }}>
            {p.medication_name} {p.dosage}
          </p>
          <p className="text-sm mt-0.5" style={{ color: '#686b82' }}>
            {p.frequency}
            {p.total_pills != null && ` · ${p.total_pills} pills total`}
          </p>
        </div>

        {/* Key info chips */}
        <div className="flex flex-wrap gap-2 mt-3">
          <InfoChip label="Start" value={fmtDate(p.start_date)} />
          <InfoChip label="End" value={(() => { const e = calcEndDate(p.start_date, p.duration_days); return e ? fmtDate(e.toISOString()) : '—' })()} />
          <InfoChip label="Duration" value={`${p.duration_days} days`} />
          <InfoChip label="Refills" value={p.refills_allowed || '0'} />
        </div>
      </div>

      {/* Expanded instructions */}
      {expanded && (
        <div className="px-5 pb-5 space-y-3" style={{ borderTop: '1px solid #f3f4f8' }}>
          {p.instructions && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9497a9' }}>
                Instructions from your doctor
              </p>
              <p className="text-sm leading-relaxed" style={{ color: '#101114' }}>{p.instructions}</p>
            </div>
          )}
          <div className="rounded-xl p-3 mt-2"
            style={{ background: 'rgba(29,78,216,0.05)', border: '1px solid rgba(29,78,216,0.12)' }}>
            <p className="text-xs font-semibold mb-1" style={{ color: '#1d4ed8' }}>💡 Take note</p>
            <p className="text-xs" style={{ color: '#1e3a8a' }}>
              Follow your prescription exactly as written. If you have questions or notice side effects, contact your doctor immediately. Do not adjust your dose without medical guidance.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoChip({ label, value }) {
  return (
    <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs"
      style={{ background: '#f3f4f8', color: '#686b82' }}>
      <span style={{ color: '#9497a9' }}>{label}:</span>
      <span className="font-semibold" style={{ color: '#101114' }}>{value}</span>
    </div>
  )
}
