import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { patient as patientApi } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import RiskBadge from '../../components/RiskBadge'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function isToday(dateStr) {
  if (!dateStr) return false
  return new Date(dateStr).toDateString() === new Date().toDateString()
}

function fmt(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-9 h-9 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  )
}

function Card({ children, className = '', style = {} }) {
  return (
    <div
      className={`bg-white rounded-2xl p-6 ${className}`}
      style={{ boxShadow: 'rgba(0,0,0,0.06) 0px 4px 24px', border: '1px solid #dedee5', ...style }}
    >
      {children}
    </div>
  )
}

function ProgressBar({ value, max = 100, color = '#1d4ed8' }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="w-full rounded-full h-2" style={{ background: '#f0f1f5' }}>
      <div
        className="h-2 rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  )
}

function ScorePill({ label, value, max = 10 }) {
  let color = '#026b3f'
  let bg = 'rgba(20,158,97,0.10)'
  const ratio = value / max
  if (ratio > 0.7) { color = '#991b1b'; bg = 'rgba(220,38,38,0.10)' }
  else if (ratio > 0.4) { color = '#92400e'; bg = 'rgba(245,158,11,0.10)' }

  return (
    <div className="flex flex-col items-center gap-1 px-4 py-3 rounded-2xl flex-1" style={{ background: bg }}>
      <span className="text-xl font-bold" style={{ color }}>{value ?? '—'}{value != null ? `/${max}` : ''}</span>
      <span className="text-xs font-medium" style={{ color }}>{label}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Risk score bar with gradient track
// ---------------------------------------------------------------------------
function RiskScoreBar({ score }) {
  let color = '#14be8b'
  if (score >= 70) color = '#dc2626'
  else if (score >= 40) color = '#d97706'
  return (
    <div>
      <div className="flex justify-between items-center text-xs mb-1.5">
        <span style={{ color: '#9497a9' }}>Low risk</span>
        <span className="font-bold text-sm" style={{ color: '#101114' }}>{score}<span className="text-xs font-normal" style={{ color: '#9497a9' }}>/100</span></span>
        <span style={{ color: '#9497a9' }}>High risk</span>
      </div>
      <ProgressBar value={score} max={100} color={color} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Days remaining bar
// ---------------------------------------------------------------------------
function DaysBar({ startDate, durationDays }) {
  if (!startDate || !durationDays) return null
  const start = new Date(startDate)
  const end = new Date(start)
  end.setDate(end.getDate() + durationDays)
  const now = new Date()
  const elapsed = Math.max(0, now - start)
  const total = end - start
  const pct = total > 0 ? Math.min(100, (elapsed / total) * 100) : 100
  const daysLeft = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)))
  const color = daysLeft <= 3 ? '#dc2626' : daysLeft <= 7 ? '#d97706' : '#1d4ed8'
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span style={{ color: '#9497a9' }}>Started {start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        <span className="font-semibold" style={{ color }}>{daysLeft} day{daysLeft !== 1 ? 's' : ''} left</span>
      </div>
      <ProgressBar value={pct} max={100} color={color} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Risk factor icon helper
// ---------------------------------------------------------------------------
function getRiskFactorIcon(text) {
  const t = (text || '').toLowerCase()
  if (t.includes('pain')) return '😣'
  if (t.includes('adher') || t.includes('medic') || t.includes('miss')) return '💊'
  if (t.includes('urge') || t.includes('crav')) return '⚡'
  if (t.includes('mood') || t.includes('anxi') || t.includes('depress')) return '😔'
  if (t.includes('sleep')) return '😴'
  return '⚠️'
}

// ---------------------------------------------------------------------------
// RISK LEVEL meta
// ---------------------------------------------------------------------------
const RISK_META = {
  low:    { borderColor: '#14be8b', tintBg: 'rgba(20,158,97,0.05)',  label: 'LOW'    },
  medium: { borderColor: '#d97706', tintBg: 'rgba(245,158,11,0.06)', label: 'MEDIUM' },
  high:   { borderColor: '#dc2626', tintBg: 'rgba(220,38,38,0.05)',  label: 'HIGH'   },
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function PatientDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [profileData, setProfileData]   = useState(null)
  const [assessmentData, setAssessmentData] = useState(null)
  const [guidanceData, setGuidanceData] = useState(null)
  const [latestCheckin, setLatestCheckin] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')

  useEffect(() => {
    let cancelled = false
    async function fetchAll() {
      setLoading(true)
      setError('')
      try {
        const [profRes, checkinRes, guidanceRes] = await Promise.allSettled([
          patientApi.getProfile(),
          patientApi.getCheckins(1),
          patientApi.getGuidance(),
        ])
        if (cancelled) return

        if (profRes.status === 'fulfilled') {
          setProfileData(profRes.value.data)
          // latestRiskAssessment can live inside profile
          const inner = profRes.value.data
          const assessment =
            inner?.latestRiskAssessment ||
            inner?.latest_risk_assessment ||
            inner?.risk_assessment ||
            null
          if (assessment) setAssessmentData(assessment)
        }

        if (checkinRes.status === 'fulfilled') {
          const raw = checkinRes.value.data
          const list = raw?.checkins || raw?.data || (Array.isArray(raw) ? raw : [])
          setLatestCheckin(Array.isArray(list) && list.length > 0 ? list[0] : null)
        }

        if (guidanceRes.status === 'fulfilled') {
          setGuidanceData(guidanceRes.value.data)
        }
      } catch {
        if (!cancelled) setError('Failed to load your dashboard. Please refresh.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchAll()
    return () => { cancelled = true }
  }, [])

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------
  const patient     = profileData?.patient || profileData?.profile || {}
  const patientName = patient?.name || user?.name || 'there'
  const firstName   = patientName.split(' ')[0]
  const postOpDay   = patient?.post_op_day ?? patient?.postOpDay ?? null
  const surgeryType = patient?.surgery_type || patient?.surgeryType || 'Post-operative recovery'

  // Prescriptions
  const prescriptions = profileData?.prescriptions || patient?.prescriptions || []
  const activePrescription = Array.isArray(prescriptions)
    ? prescriptions.find((p) => (p.status || '').toLowerCase() === 'active') || prescriptions[0] || null
    : null

  // Assessment — may come from profile or separate state
  const assessment = assessmentData ||
    profileData?.latestRiskAssessment ||
    profileData?.latest_risk_assessment ||
    null

  const riskLevel   = (assessment?.risk_level || assessment?.level || 'low').toLowerCase()
  const riskScore   = assessment?.risk_score ?? assessment?.score ?? 0
  const riskMeta    = RISK_META[riskLevel] || RISK_META.low
  const riskFactors = assessment?.risk_factors || assessment?.factors || []
  const riskFactorList = Array.isArray(riskFactors)
    ? riskFactors
    : Object.entries(riskFactors).map(([k, v]) => ({ name: k, value: v }))

  const summary         = assessment?.summary || ''
  const patientGuidance = assessment?.patient_guidance || assessment?.guidance || []
  const prescriptionNote = assessment?.prescription_note || ''
  const assessedAt       = assessment?.assessed_at || assessment?.created_at || assessment?.last_assessed || ''

  // Guidance from /patient/guidance (may overlap or complement)
  const guidanceLevel    = guidanceData?.level || ''
  const guidanceMessages = guidanceData?.guidance || guidanceData?.messages || []
  const guidancePrescNote = guidanceData?.prescription_note || ''

  // Today's check-in
  const checkedInToday = latestCheckin
    ? isToday(latestCheckin.checkin_date || latestCheckin.date || latestCheckin.created_at)
    : false

  if (loading) return <Spinner />

  if (error) return (
    <div className="rounded-xl px-4 py-3 text-sm mt-8" style={{ background: 'rgba(220,38,38,0.10)', color: '#991b1b', border: '1px solid rgba(220,38,38,0.20)' }}>
      ⚠️ {error}
    </div>
  )

  return (
    <div className="space-y-6 pb-10">

      {/* ------------------------------------------------------------------ */}
      {/* 1. WELCOME HEADER                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#101114' }}>
            {getGreeting()}, {firstName}
          </h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-sm" style={{ color: '#9497a9' }}>{surgeryType}</span>
            {postOpDay != null && (
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold"
                style={{ background: 'rgba(29,78,216,0.10)', color: '#1d4ed8' }}
              >
                Post-op Day {postOpDay}
              </span>
            )}
          </div>
        </div>
        {/* Quick checkin status chip top-right on desktop */}
        {checkedInToday && (
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold self-start"
            style={{ background: 'rgba(20,158,97,0.14)', color: '#026b3f' }}
          >
            ✓ Checked in today
          </span>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. DAILY CHECK-IN BANNER                                            */}
      {/* ------------------------------------------------------------------ */}
      {!checkedInToday && (
        <div
          className="rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap"
          style={{
            background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
            boxShadow: 'rgba(29,78,216,0.35) 0px 8px 32px',
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.18)' }}
            >
              <span className="text-2xl">📋</span>
            </div>
            <div>
              <p className="font-bold text-base text-white">Daily Check-in Due</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
                Track your recovery — takes less than 2 minutes
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/patient/checkin')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold flex-shrink-0 transition-all"
            style={{ background: '#ffffff', color: '#1d4ed8' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#eff4ff' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff' }}
          >
            Check In Now
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M5 12H19M12 5L19 12L12 19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 3. AI RISK ASSESSMENT CARD (visual centerpiece)                     */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="bg-white rounded-2xl overflow-hidden"
        style={{
          boxShadow: 'rgba(0,0,0,0.06) 0px 4px 24px',
          border: '1px solid #dedee5',
          borderLeft: `5px solid ${riskMeta.borderColor}`,
        }}
      >
        {/* Card header */}
        <div
          className="px-6 pt-5 pb-4"
          style={{ background: riskMeta.tintBg, borderBottom: '1px solid #dedee5' }}
        >
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#9497a9' }}>
                  AI Risk Assessment
                </p>
                <div className="flex items-center gap-3">
                  <RiskBadge level={riskLevel} size="lg" />
                  {assessedAt && (
                    <span className="text-xs" style={{ color: '#9497a9' }}>
                      Last assessed: {fmt(assessedAt)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background: 'rgba(29,78,216,0.10)', color: '#1d4ed8' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              GPT-4o
            </div>
          </div>
        </div>

        {!assessment ? (
          <div className="px-6 py-10 text-center">
            <span className="text-4xl block mb-3">🤖</span>
            <p className="font-medium" style={{ color: '#101114' }}>No assessment yet</p>
            <p className="text-sm mt-1" style={{ color: '#9497a9' }}>
              Complete your daily check-in to trigger your first AI assessment.
            </p>
            {!checkedInToday && (
              <button
                onClick={() => navigate('/patient/checkin')}
                className="mt-4 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: '#1d4ed8' }}
              >
                Check In Now →
              </button>
            )}
          </div>
        ) : (
          <div className="px-6 py-5 space-y-5">

            {/* Risk score bar */}
            <RiskScoreBar score={riskScore} />

            {/* AI Summary */}
            {summary && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#9497a9' }}>
                  AI Summary
                </p>
                <p className="text-sm leading-relaxed" style={{ color: '#101114' }}>
                  {summary}
                </p>
              </div>
            )}

            {/* Risk factors */}
            {riskFactorList.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#9497a9' }}>
                  What flagged your assessment
                </p>
                <div className="space-y-2">
                  {riskFactorList.map((factor, i) => {
                    const name = typeof factor === 'string'
                      ? factor
                      : (factor.factor || factor.name || factor.description || String(factor))
                    const detail = typeof factor === 'object'
                      ? (factor.description || factor.detail || factor.value || '')
                      : ''
                    return (
                      <div
                        key={i}
                        className="flex items-start gap-3 px-4 py-3 rounded-xl"
                        style={{ background: '#f8f9fc', border: '1px solid #f0f1f5' }}
                      >
                        <span className="text-base flex-shrink-0 mt-0.5">{getRiskFactorIcon(name)}</span>
                        <div>
                          <p className="text-sm font-medium" style={{ color: '#101114' }}>{name}</p>
                          {detail && (
                            <p className="text-xs mt-0.5" style={{ color: '#9497a9' }}>{String(detail)}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* AI-Generated Guidance */}
            {(Array.isArray(patientGuidance) ? patientGuidance : []).length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#9497a9' }}>
                  AI-Generated Guidance
                </p>
                <div className="space-y-2">
                  {(Array.isArray(patientGuidance) ? patientGuidance : []).map((g, i) => {
                    const text = typeof g === 'string' ? g : (g.message || g.text || g.content || String(g))
                    return (
                      <div
                        key={i}
                        className="flex items-start gap-3 px-4 py-3 rounded-xl"
                        style={{ background: 'rgba(29,78,216,0.05)', border: '1px solid rgba(29,78,216,0.10)' }}
                      >
                        <span className="flex-shrink-0 mt-0.5">💬</span>
                        <p className="text-sm" style={{ color: '#101114' }}>{text}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Prescription note */}
            {(prescriptionNote || guidancePrescNote) && (
              <div
                className="px-4 py-3 rounded-xl"
                style={{ background: 'rgba(29,78,216,0.07)', border: '1px solid rgba(29,78,216,0.15)' }}
              >
                <p className="text-xs font-semibold mb-1" style={{ color: '#1d4ed8' }}>About your prescription</p>
                <p className="text-sm" style={{ color: '#101114' }}>
                  {prescriptionNote || guidancePrescNote}
                </p>
              </div>
            )}

          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 4. ACTIVE PRESCRIPTION CARD                                         */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-base" style={{ color: '#101114' }}>Active Prescription</h2>
          <button
            onClick={() => navigate('/patient/prescriptions')}
            className="text-xs font-semibold flex items-center gap-1"
            style={{ color: '#1d4ed8' }}
          >
            View all
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M5 12H19M12 5L19 12L12 19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {!activePrescription ? (
          <div className="py-6 text-center">
            <span className="text-3xl block mb-2">💊</span>
            <p className="text-sm" style={{ color: '#9497a9' }}>No active prescription on file.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Medication header */}
            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(29,78,216,0.10)' }}
              >
                <span className="text-2xl">💊</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-base" style={{ color: '#101114' }}>
                    {activePrescription.medication_name || activePrescription.name || 'Medication'}
                  </p>
                  <span
                    className="px-2 py-0.5 rounded-lg text-xs font-semibold"
                    style={{ background: 'rgba(20,158,97,0.14)', color: '#026b3f' }}
                  >
                    Active
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 mt-1 text-sm" style={{ color: '#9497a9' }}>
                  {activePrescription.dosage && (
                    <span>{activePrescription.dosage}</span>
                  )}
                  {activePrescription.frequency && (
                    <span>· {activePrescription.frequency}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Instructions */}
            {activePrescription.instructions && (
              <div
                className="px-4 py-3 rounded-xl text-sm"
                style={{ background: '#f8f9fc', color: '#101114' }}
              >
                <span className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: '#9497a9' }}>
                  Instructions
                </span>
                {activePrescription.instructions}
              </div>
            )}

            {/* Days remaining */}
            {(activePrescription.start_date && activePrescription.duration_days) && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: '#9497a9' }}>
                  Treatment Progress
                </span>
                <DaysBar
                  startDate={activePrescription.start_date}
                  durationDays={activePrescription.duration_days}
                />
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* 5. QUICK STATS ROW (from most recent check-in)                      */}
      {/* ------------------------------------------------------------------ */}
      {latestCheckin && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3 px-1" style={{ color: '#9497a9' }}>
            Last Check-in Scores
            {latestCheckin.checkin_date || latestCheckin.date || latestCheckin.created_at
              ? ` · ${new Date(latestCheckin.checkin_date || latestCheckin.date || latestCheckin.created_at)
                  .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
              : ''}
          </p>
          <div className="flex gap-3">
            <ScorePill
              label="Pain"
              value={latestCheckin.pain_score}
              max={10}
            />
            <ScorePill
              label="Mood"
              value={latestCheckin.mood_score}
              max={10}
            />
            <ScorePill
              label="Sleep"
              value={latestCheckin.sleep_quality}
              max={10}
            />
          </div>
        </div>
      )}

    </div>
  )
}
