import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { doctor } from '../../api/client'
import RiskBadge from '../../components/RiskBadge'

// ---------------------------------------------------------------------------
// Design-system constants
// ---------------------------------------------------------------------------
const TOOLTIP_STYLE = {
  background: '#ffffff',
  border: '1px solid #dedee5',
  borderRadius: '12px',
  padding: '10px 14px',
  boxShadow: 'rgba(0,0,0,0.08) 0px 4px 16px',
  fontSize: '13px',
  color: '#101114',
}

const NOTE_TYPES = [
  { val: 'clinician_note',      label: 'Clinician Note',      color: '#0d9488', bg: 'rgba(13,148,136,0.10)'  },
  { val: 'prescription_change', label: 'Prescription Change', color: '#1d4ed8', bg: 'rgba(29,78,216,0.10)'   },
  { val: 'pharmacist_review',   label: 'Pharmacist Review',   color: '#7c3aed', bg: 'rgba(124,58,237,0.10)'  },
  { val: 'follow_up',           label: 'Follow-up',           color: '#d97706', bg: 'rgba(217,119,6,0.10)'   },
  { val: 'contact_patient',     label: 'Contact Patient',     color: '#026b3f', bg: 'rgba(20,158,97,0.10)'   },
]

const FOLLOW_UP_ACTIONS = [
  { type: 'continue_monitoring', label: 'Continue Monitoring', icon: '📊', color: '#026b3f', bg: 'rgba(20,158,97,0.12)',   border: 'rgba(2,107,63,0.25)'   },
  { type: 'contact_patient',     label: 'Contact Patient',     icon: '📞', color: '#1d4ed8', bg: 'rgba(29,78,216,0.10)',   border: 'rgba(29,78,216,0.25)'  },
  { type: 'pharmacist_review',   label: 'Pharmacist Review',   icon: '💊', color: '#d97706', bg: 'rgba(217,119,6,0.10)',   border: 'rgba(217,119,6,0.25)'  },
  { type: 'adjust_medication',   label: 'Adjust Medication',   icon: '🔄', color: '#ea580c', bg: 'rgba(234,88,12,0.10)',   border: 'rgba(234,88,12,0.25)'  },
  { type: 'send_followup',       label: 'Send Follow-up',      icon: '✉️', color: '#7c3aed', bg: 'rgba(124,58,237,0.10)', border: 'rgba(124,58,237,0.25)' },
]

const FREQUENCY_OPTIONS = [
  'Once daily',
  'Twice daily',
  'Three times daily',
  'Every 4 hours as needed',
  'Every 6 hours as needed',
  'Every 8 hours as needed',
  'As needed',
]

const TABS = [
  { id: 'overview',  label: 'Overview'          },
  { id: 'checkins',  label: 'Check-in History'  },
  { id: 'assessments', label: 'AI Assessments'  },
  { id: 'notes',     label: 'Clinical Notes'    },
  { id: 'followups', label: 'Follow-up Actions' },
]

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
function fmtDate(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtDateTime(str) {
  if (!str) return '—'
  return new Date(str).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}
function fmtShort(str) {
  if (!str) return ''
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------
function Spinner({ size = 8 }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div
        className="border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"
        style={{ width: `${size * 4}px`, height: `${size * 4}px` }}
      />
    </div>
  )
}

function Card({ children, className = '', style = {} }) {
  return (
    <div
      className={`bg-white rounded-2xl p-5 ${className}`}
      style={{ boxShadow: 'rgba(0,0,0,0.06) 0px 4px 24px', border: '1px solid #dedee5', ...style }}
    >
      {children}
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#9497a9' }}>
      {children}
    </p>
  )
}

function NoteTypeBadge({ type }) {
  const cfg = NOTE_TYPES.find((n) => n.val === type) || { label: type || 'Note', color: '#9497a9', bg: '#f3f4f8' }
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  )
}

function RiskLevelBadge({ level, score }) {
  const map = {
    low:    { bg: 'rgba(20,158,97,0.14)',  color: '#026b3f' },
    medium: { bg: 'rgba(245,158,11,0.14)', color: '#92400e' },
    high:   { bg: 'rgba(220,38,38,0.14)',  color: '#991b1b' },
  }
  const l = (level || 'low').toLowerCase()
  const cfg = map[l] || map.low
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-bold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {(level || 'LOW').toUpperCase()}
      {score != null && <span className="font-normal text-xs">· {score}/100</span>}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Inline prescription form
// ---------------------------------------------------------------------------
function PrescriptionForm({ patientId, onSuccess, onCancel }) {
  const [form, setForm] = useState({
    medication_name: '',
    dosage: '',
    frequency: 'Once daily',
    duration_days: '',
    start_date: todayISO(),
    total_pills: '',
    refills_allowed: '0',
    instructions: '',
    monitoring_notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(key, val) { setForm((f) => ({ ...f, [key]: val })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.medication_name.trim()) { setError('Medication name is required.'); return }
    if (!form.dosage.trim())          { setError('Dosage is required.'); return }
    if (!form.duration_days)          { setError('Duration (days) is required.'); return }
    if (!form.start_date)             { setError('Start date is required.'); return }
    setLoading(true)
    setError('')
    try {
      const payload = {
        medication_name:  form.medication_name.trim(),
        dosage:           form.dosage.trim(),
        frequency:        form.frequency,
        duration_days:    Number(form.duration_days),
        start_date:       form.start_date,
        total_pills:      form.total_pills     ? Number(form.total_pills)     : undefined,
        refills_allowed:  Number(form.refills_allowed) || 0,
        instructions:     form.instructions.trim()     || undefined,
        monitoring_notes: form.monitoring_notes.trim() || undefined,
      }
      await doctor.createPrescription(patientId, payload)
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to create prescription.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    border: '1.5px solid #dedee5',
    color: '#101114',
    background: '#ffffff',
    outline: 'none',
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '13px',
    width: '100%',
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9497a9' }}>Medication Name *</label>
          <input
            type="text"
            required
            value={form.medication_name}
            onChange={(e) => set('medication_name', e.target.value)}
            placeholder="e.g. Oxycodone"
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = '#1d4ed8')}
            onBlur={(e) => (e.target.style.borderColor = '#dedee5')}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9497a9' }}>Dosage *</label>
          <input
            type="text"
            required
            value={form.dosage}
            onChange={(e) => set('dosage', e.target.value)}
            placeholder="e.g. 5mg"
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = '#1d4ed8')}
            onBlur={(e) => (e.target.style.borderColor = '#dedee5')}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9497a9' }}>Frequency</label>
          <select
            value={form.frequency}
            onChange={(e) => set('frequency', e.target.value)}
            style={{ ...inputStyle }}
            onFocus={(e) => (e.target.style.borderColor = '#1d4ed8')}
            onBlur={(e) => (e.target.style.borderColor = '#dedee5')}
          >
            {FREQUENCY_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9497a9' }}>Duration (days)</label>
          <input
            type="number"
            min="1"
            value={form.duration_days}
            onChange={(e) => set('duration_days', e.target.value)}
            placeholder="e.g. 30"
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = '#1d4ed8')}
            onBlur={(e) => (e.target.style.borderColor = '#dedee5')}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9497a9' }}>Start Date</label>
          <input
            type="date"
            value={form.start_date}
            onChange={(e) => set('start_date', e.target.value)}
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = '#1d4ed8')}
            onBlur={(e) => (e.target.style.borderColor = '#dedee5')}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9497a9' }}>Total Pills (optional)</label>
          <input
            type="number"
            min="1"
            value={form.total_pills}
            onChange={(e) => set('total_pills', e.target.value)}
            placeholder="e.g. 60"
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = '#1d4ed8')}
            onBlur={(e) => (e.target.style.borderColor = '#dedee5')}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9497a9' }}>Refills Allowed</label>
          <select
            value={form.refills_allowed}
            onChange={(e) => set('refills_allowed', e.target.value)}
            style={{ ...inputStyle }}
            onFocus={(e) => (e.target.style.borderColor = '#1d4ed8')}
            onBlur={(e) => (e.target.style.borderColor = '#dedee5')}
          >
            {[0,1,2,3,4,5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9497a9' }}>Instructions</label>
        <textarea
          value={form.instructions}
          onChange={(e) => set('instructions', e.target.value)}
          rows={2}
          placeholder="Take with food. Do not drive while taking this medication."
          style={{ ...inputStyle, resize: 'vertical' }}
          onFocus={(e) => (e.target.style.borderColor = '#1d4ed8')}
          onBlur={(e) => (e.target.style.borderColor = '#dedee5')}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold mb-1.5" style={{ color: '#9497a9' }}>
          Monitoring Notes
          <span className="ml-1 font-normal" style={{ color: '#b0b3c1' }}>(Clinical context for AI monitoring)</span>
        </label>
        <textarea
          value={form.monitoring_notes}
          onChange={(e) => set('monitoring_notes', e.target.value)}
          rows={3}
          placeholder="Clinical context for AI monitoring — describe what to watch for, patient risk factors, expected recovery trajectory..."
          style={{ ...inputStyle, resize: 'vertical' }}
          onFocus={(e) => (e.target.style.borderColor = '#1d4ed8')}
          onBlur={(e) => (e.target.style.borderColor = '#dedee5')}
        />
      </div>

      {error && (
        <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(220,38,38,0.10)', color: '#991b1b' }}>
          ⚠️ {error}
        </p>
      )}

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: '#f3f4f8', color: '#9497a9', border: '1.5px solid #dedee5' }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: loading ? '#9497a9' : '#1d4ed8', cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Creating...
            </span>
          ) : 'Create Prescription'}
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function PatientDetail() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')

  // Data state
  const [profile,      setProfile]      = useState(null)
  const [checkins,     setCheckins]     = useState([])
  const [assessments,  setAssessments]  = useState([])
  const [prescriptions,setPrescriptions]= useState([])
  const [notes,        setNotes]        = useState([])
  const [followUps,    setFollowUps]    = useState([])

  // Loading state per section
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')

  // AI assessment trigger
  const [assessing,    setAssessing]    = useState(false)
  const [assessToast,  setAssessToast]  = useState('')

  // Prescription form
  const [showPrescForm, setShowPrescForm] = useState(false)

  // Note form
  const [noteForm,     setNoteForm]     = useState({ note_type: 'clinician_note', content: '' })
  const [noteLoading,  setNoteLoading]  = useState(false)
  const [noteError,    setNoteError]    = useState('')
  const [noteSuccess,  setNoteSuccess]  = useState('')

  // Follow-up form
  const [fuNotes,      setFuNotes]      = useState('')
  const [fuLoading,    setFuLoading]    = useState(false)
  const [fuError,      setFuError]      = useState('')
  const [fuSuccess,    setFuSuccess]    = useState('')

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------
  const loadProfile = useCallback(async () => {
    try {
      const res = await doctor.getPatientProfile(patientId)
      const data = res.data
      // Merge user.name into patient object so patientName works downstream
      const patient = data?.patient || data?.profile || data
      if (patient && data?.user?.name) patient.name = data.user.name
      setProfile(patient)
      const presc = data?.prescriptions || []
      if (Array.isArray(presc) && presc.length > 0) setPrescriptions(presc)
    } catch { /* ignore */ }
  }, [patientId])

  const loadPrescriptions = useCallback(async () => {
    try {
      const res = await doctor.getPrescriptions(patientId)
      const list = res.data?.prescriptions || res.data || []
      setPrescriptions(Array.isArray(list) ? list : [])
    } catch { /* ignore */ }
  }, [patientId])

  const loadCheckins = useCallback(async () => {
    try {
      const res = await doctor.getPatientCheckins(patientId, 30)
      const list = res.data?.checkins || res.data || []
      setCheckins(Array.isArray(list) ? list : [])
    } catch { /* ignore */ }
  }, [patientId])

  const loadRisk = useCallback(async () => {
    try {
      const res = await doctor.getPatientRisk(patientId)
      // Could be a list of assessments or a single latest
      const data = res.data
      const list = data?.assessments || data?.history || data?.risk_assessments || null
      if (Array.isArray(list)) {
        setAssessments(list)
      } else if (data && (data.risk_level || data.level || data.risk_score != null)) {
        setAssessments([data])
      }
    } catch { /* ignore */ }
  }, [patientId])

  const loadNotes = useCallback(async () => {
    try {
      const res = await doctor.getNotes(patientId)
      const list = res.data?.notes || res.data || []
      setNotes(Array.isArray(list)
        ? list.sort((a, b) => new Date(b.created_at || b.date || 0) - new Date(a.created_at || a.date || 0))
        : [])
    } catch { /* ignore */ }
  }, [patientId])

  const loadFollowUps = useCallback(async () => {
    try {
      const res = await doctor.getFollowUps(patientId)
      const list = res.data?.followups || res.data?.actions || res.data || []
      setFollowUps(Array.isArray(list) ? list : [])
    } catch { /* ignore */ }
  }, [patientId])

  useEffect(() => {
    let cancelled = false
    async function init() {
      setLoading(true)
      setError('')
      try {
        await Promise.allSettled([
          loadProfile(),
          loadCheckins(),
          loadRisk(),
          loadPrescriptions(),
          loadNotes(),
          loadFollowUps(),
        ])
      } catch {
        if (!cancelled) setError('Failed to load patient data.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    init()
    return () => { cancelled = true }
  }, [loadProfile, loadCheckins, loadRisk, loadPrescriptions, loadNotes, loadFollowUps])

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  const postOpDay   = profile?.post_op_day || profile?.postOpDay
  const patientName = profile?.name || 'Patient'
  const latestAssessment = assessments[0] || null
  const riskLevel   = (latestAssessment?.risk_level || latestAssessment?.level || 'low').toLowerCase()
  const riskScore   = latestAssessment?.risk_score ?? latestAssessment?.score ?? 0

  const activePrescription = Array.isArray(prescriptions)
    ? prescriptions.find((p) => p.is_active === 1 || p.is_active === true) || prescriptions[0] || null
    : null

  const sortedCheckins = [...checkins].sort(
    (a, b) => new Date(a.checkin_date || a.date || a.created_at) - new Date(b.checkin_date || b.date || b.created_at)
  )

  // Chart data
  const lineData = sortedCheckins.slice(-30).map((c) => ({
    date: fmtShort(c.checkin_date || c.date || c.created_at),
    Pain:  c.pain_score,
    Urge:  c.urge_level,
  }))

  const barData = sortedCheckins.slice(-30).map((c) => ({
    date:  fmtShort(c.checkin_date || c.date || c.created_at),
    Mood:  c.mood_score,
    Sleep: c.sleep_quality,
  }))

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  async function handleTriggerAssessment() {
    setAssessing(true)
    setAssessToast('')
    try {
      await doctor.triggerAssessment(patientId)
      setAssessToast('success')
      await loadRisk()
      setTimeout(() => setAssessToast(''), 4000)
    } catch (err) {
      setAssessToast(err.response?.data?.message || 'Assessment failed.')
      setTimeout(() => setAssessToast(''), 5000)
    } finally {
      setAssessing(false)
    }
  }

  async function handleAddNote(e) {
    e.preventDefault()
    if (!noteForm.content.trim()) return
    setNoteLoading(true)
    setNoteError('')
    setNoteSuccess('')
    try {
      await doctor.addNote(patientId, noteForm)
      setNoteSuccess('Note added successfully.')
      setNoteForm((f) => ({ ...f, content: '' }))
      await loadNotes()
    } catch (err) {
      setNoteError(err.response?.data?.message || 'Failed to add note.')
    } finally {
      setNoteLoading(false)
    }
  }

  async function handleFollowUp(actionType) {
    setFuLoading(true)
    setFuError('')
    setFuSuccess('')
    try {
      await doctor.addFollowUp(patientId, { action_type: actionType, notes: fuNotes })
      setFuSuccess(`"${actionType.replace(/_/g, ' ')}" recorded.`)
      setFuNotes('')
      await loadFollowUps()
    } catch (err) {
      setFuError(err.response?.data?.message || 'Failed to record action.')
    } finally {
      setFuLoading(false)
    }
  }

  async function handleCompleteFollowUp(id) {
    try {
      await doctor.completeFollowUp(patientId, id)
      setFollowUps((prev) =>
        prev.map((f) => (f.id === id || f.action_id === id) ? { ...f, status: 'completed' } : f)
      )
    } catch { /* silent */ }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (loading) return <Spinner size={10} />
  if (error) return (
    <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(220,38,38,0.10)', color: '#991b1b' }}>
      ⚠️ {error}
    </div>
  )

  return (
    <div className="space-y-5 pb-10">

      {/* ------------------------------------------------------------------ */}
      {/* PATIENT HEADER                                                       */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="bg-white rounded-2xl p-6"
        style={{ boxShadow: 'rgba(0,0,0,0.06) 0px 4px 24px', border: '1px solid #dedee5' }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            {/* Back + name row */}
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <button
                onClick={() => navigate('/doctor')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
                style={{ background: '#f3f4f8', color: '#9497a9' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M19 12H5M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Back
              </button>
              <h1 className="text-xl font-bold" style={{ color: '#101114' }}>{patientName}</h1>
              <RiskBadge level={riskLevel} size="md" />
            </div>

            {/* Demographics row */}
            <div className="flex items-center gap-2 flex-wrap text-sm" style={{ color: '#9497a9' }}>
              {profile?.age  && <span>Age {profile.age}</span>}
              {profile?.sex  && <span>· {profile.sex}</span>}
              {profile?.surgery_type && <span>· {profile.surgery_type}</span>}
              {postOpDay != null && (
                <span
                  className="ml-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold"
                  style={{ background: 'rgba(29,78,216,0.10)', color: '#1d4ed8' }}
                >
                  Post-op Day {postOpDay}
                </span>
              )}
            </div>

            {/* Assessment toast */}
            {assessToast && (
              <p
                className="mt-2 text-xs px-3 py-1.5 rounded-lg inline-block"
                style={assessToast === 'success'
                  ? { background: 'rgba(20,158,97,0.14)', color: '#026b3f' }
                  : { background: 'rgba(220,38,38,0.10)', color: '#991b1b' }}
              >
                {assessToast === 'success' ? '✓ Assessed just now' : `⚠️ ${assessToast}`}
              </p>
            )}
          </div>

          {/* Run AI Assessment button */}
          <button
            onClick={handleTriggerAssessment}
            disabled={assessing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white flex-shrink-0"
            style={{ background: assessing ? '#9497a9' : '#1d4ed8', cursor: assessing ? 'not-allowed' : 'pointer' }}
          >
            {assessing ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Running...
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 17L12 22L22 17M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Run AI Assessment
              </>
            )}
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* TABS                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="bg-white rounded-2xl overflow-hidden"
        style={{ boxShadow: 'rgba(0,0,0,0.04) 0px 2px 12px', border: '1px solid #dedee5' }}
      >
        {/* Tab bar */}
        <div className="flex overflow-x-auto" style={{ borderBottom: '1px solid #dedee5' }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-shrink-0 px-5 py-3.5 text-sm font-medium transition-colors"
              style={{
                color:        activeTab === tab.id ? '#1d4ed8' : '#9497a9',
                borderBottom: activeTab === tab.id ? '2.5px solid #1d4ed8' : '2.5px solid transparent',
                background:   activeTab === tab.id ? 'rgba(29,78,216,0.04)' : 'transparent',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5">

          {/* ============================================================= */}
          {/* TAB 1 — OVERVIEW                                               */}
          {/* ============================================================= */}
          {activeTab === 'overview' && (
            <div className="space-y-6">

              {/* Active Prescription */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <SectionLabel>Active Prescription</SectionLabel>
                  <button
                    onClick={() => setShowPrescForm((v) => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
                    style={{ background: '#1d4ed8' }}
                  >
                    {showPrescForm ? (
                      '✕ Cancel'
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                        </svg>
                        Create New Prescription
                      </>
                    )}
                  </button>
                </div>

                {showPrescForm && (
                  <div
                    className="mb-5 p-5 rounded-2xl"
                    style={{ background: '#f8f9fc', border: '1.5px solid #dedee5' }}
                  >
                    <p className="font-semibold text-sm mb-4" style={{ color: '#101114' }}>New Prescription</p>
                    <PrescriptionForm
                      patientId={patientId}
                      onSuccess={async () => {
                        setShowPrescForm(false)
                        await loadPrescriptions()
                        setAssessToast('✓ Prescription created successfully')
                        setTimeout(() => setAssessToast(''), 3000)
                      }}
                      onCancel={() => setShowPrescForm(false)}
                    />
                  </div>
                )}

                {!activePrescription ? (
                  <p className="text-sm py-4 text-center" style={{ color: '#9497a9' }}>
                    No active prescription. Create one above.
                  </p>
                ) : (
                  <div
                    className="p-4 rounded-2xl space-y-3"
                    style={{ background: '#f8f9fc', border: '1px solid #dedee5' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-lg">💊</span>
                          <p className="font-bold text-base" style={{ color: '#101114' }}>
                            {activePrescription.medication_name || activePrescription.name}
                          </p>
                          <span
                            className="px-2 py-0.5 rounded-lg text-xs font-semibold"
                            style={{ background: 'rgba(20,158,97,0.14)', color: '#026b3f' }}
                          >
                            Active
                          </span>
                        </div>
                        <div className="flex gap-3 mt-1 text-sm flex-wrap" style={{ color: '#9497a9' }}>
                          {activePrescription.dosage    && <span>{activePrescription.dosage}</span>}
                          {activePrescription.frequency && <span>· {activePrescription.frequency}</span>}
                          {activePrescription.duration_days && (
                            <span>· {activePrescription.duration_days} days</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {activePrescription.instructions && (
                      <p className="text-sm" style={{ color: '#101114' }}>
                        <span className="font-semibold" style={{ color: '#9497a9' }}>Instructions: </span>
                        {activePrescription.instructions}
                      </p>
                    )}

                    {activePrescription.monitoring_notes && (
                      <div
                        className="px-4 py-3 rounded-xl"
                        style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.20)' }}
                      >
                        <p className="text-xs font-semibold mb-1" style={{ color: '#92400e' }}>
                          Doctor's Monitoring Context
                        </p>
                        <p className="text-sm" style={{ color: '#92400e' }}>
                          {activePrescription.monitoring_notes}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Latest AI Assessment summary */}
              {latestAssessment && (
                <div>
                  <SectionLabel>Latest AI Assessment</SectionLabel>
                  <div
                    className="p-4 rounded-2xl space-y-3"
                    style={{ background: '#f8f9fc', border: '1px solid #dedee5' }}
                  >
                    <div className="flex items-center gap-3">
                      <RiskLevelBadge level={riskLevel} score={riskScore} />
                      {latestAssessment.assessed_at || latestAssessment.created_at ? (
                        <span className="text-xs" style={{ color: '#9497a9' }}>
                          {fmtDateTime(latestAssessment.assessed_at || latestAssessment.created_at)}
                        </span>
                      ) : null}
                    </div>

                    {latestAssessment.summary && (
                      <p className="text-sm" style={{ color: '#101114' }}>{latestAssessment.summary}</p>
                    )}

                    {(() => {
                      const factors = latestAssessment.risk_factors || latestAssessment.factors || []
                      const list = Array.isArray(factors)
                        ? factors
                        : Object.entries(factors).map(([k]) => k)
                      return list.length > 0 ? (
                        <ul className="space-y-1">
                          {list.slice(0, 4).map((f, i) => {
                            const name = typeof f === 'string' ? f : (f.factor || f.name || f.description || String(f))
                            return (
                              <li key={i} className="flex items-center gap-2 text-xs" style={{ color: '#9497a9' }}>
                                <span style={{ color: '#d97706' }}>•</span> {name}
                              </li>
                            )
                          })}
                        </ul>
                      ) : null
                    })()}
                  </div>
                </div>
              )}

              {/* Recent check-ins table (last 5) */}
              {checkins.length > 0 && (
                <div>
                  <SectionLabel>Recent Check-ins</SectionLabel>
                  <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #dedee5' }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: '#f8f9fc', borderBottom: '1px solid #dedee5' }}>
                          {['Date', 'Pain', 'Adherence', 'Urge', 'Mood', 'Sleep'].map((h) => (
                            <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#9497a9' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...sortedCheckins].reverse().slice(0, 5).map((c, i) => (
                          <tr key={c.id || i} style={{ borderBottom: '1px solid #f3f4f8' }}>
                            <td className="px-4 py-2.5 text-xs" style={{ color: '#9497a9' }}>
                              {fmtShort(c.checkin_date || c.date || c.created_at)}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`font-semibold text-sm ${(c.pain_score ?? 0) >= 7 ? 'text-red-600' : (c.pain_score ?? 0) >= 4 ? 'text-amber-600' : 'text-green-700'}`}>
                                {c.pain_score ?? '—'}{c.pain_score != null ? '/10' : ''}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              {c.medication_taken != null ? (
                                <span style={{ color: c.medication_taken ? '#026b3f' : '#991b1b' }}>
                                  {c.medication_taken ? '✓' : '✗'}
                                </span>
                              ) : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-sm" style={{ color: '#101114' }}>
                              {c.urge_level ?? '—'}{c.urge_level != null ? '/10' : ''}
                            </td>
                            <td className="px-4 py-2.5 text-sm" style={{ color: '#9497a9' }}>
                              {c.mood_score ?? '—'}{c.mood_score != null ? '/10' : ''}
                            </td>
                            <td className="px-4 py-2.5 text-sm" style={{ color: '#9497a9' }}>
                              {c.sleep_quality ?? '—'}{c.sleep_quality != null ? '/10' : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================= */}
          {/* TAB 2 — CHECK-IN HISTORY                                       */}
          {/* ============================================================= */}
          {activeTab === 'checkins' && (
            <div className="space-y-6">
              {checkins.length === 0 ? (
                <p className="text-sm text-center py-10" style={{ color: '#9497a9' }}>
                  No check-in data available yet.
                </p>
              ) : (
                <>
                  {/* Line chart: pain + urge */}
                  <div>
                    <p className="font-semibold text-sm mb-4" style={{ color: '#101114' }}>
                      Pain & Urge Levels (last 30 check-ins)
                    </p>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={lineData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f1f5" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9497a9' }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: '#9497a9' }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                        <Line type="monotone" dataKey="Pain" stroke="#dc2626" strokeWidth={2.5} dot={{ r: 3, fill: '#dc2626' }} activeDot={{ r: 5 }} />
                        <Line type="monotone" dataKey="Urge" stroke="#d97706" strokeWidth={2} dot={{ r: 3, fill: '#d97706' }} strokeDasharray="5 3" activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Bar chart: mood + sleep */}
                  <div>
                    <p className="font-semibold text-sm mb-4" style={{ color: '#101114' }}>
                      Mood & Sleep Quality
                    </p>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={barData} barSize={14} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f1f5" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9497a9' }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: '#9497a9' }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                        <Bar dataKey="Mood"  fill="rgba(29,78,216,0.70)"  radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Sleep" fill="rgba(13,148,136,0.70)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Full table */}
                  <div>
                    <p className="font-semibold text-sm mb-3" style={{ color: '#101114' }}>
                      All Check-ins ({checkins.length})
                    </p>
                    <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #dedee5' }}>
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ background: '#f8f9fc', borderBottom: '1px solid #dedee5' }}>
                            {['Date', 'Pain', 'Adherence', 'Timing', 'Urge', 'Mood', 'Sleep', 'Side Effects', 'Notes'].map((h) => (
                              <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: '#9497a9' }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[...sortedCheckins].reverse().map((c, i) => (
                            <tr key={c.id || i} className="hover:bg-gray-50" style={{ borderBottom: '1px solid #f3f4f8' }}>
                              <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: '#9497a9' }}>
                                {fmtDate(c.checkin_date || c.date || c.created_at)}
                              </td>
                              <td className="px-3 py-2.5">
                                <span className={`font-semibold text-sm ${(c.pain_score ?? 0) >= 7 ? 'text-red-600' : (c.pain_score ?? 0) >= 4 ? 'text-amber-600' : 'text-green-700'}`}>
                                  {c.pain_score ?? '—'}{c.pain_score != null ? '/10' : ''}
                                </span>
                              </td>
                              <td className="px-3 py-2.5">
                                {c.medication_taken != null ? (
                                  <span
                                    className="px-2 py-0.5 rounded-lg text-xs font-semibold"
                                    style={c.medication_taken
                                      ? { background: 'rgba(20,158,97,0.14)', color: '#026b3f' }
                                      : { background: 'rgba(220,38,38,0.10)', color: '#991b1b' }}
                                  >
                                    {c.medication_taken ? '✓ Taken' : '✗ Missed'}
                                  </span>
                                ) : <span style={{ color: '#9497a9' }}>—</span>}
                              </td>
                              <td className="px-3 py-2.5 text-xs capitalize whitespace-nowrap" style={{ color: '#9497a9' }}>
                                {(c.dose_timing || '—').replace(/_/g, ' ')}
                              </td>
                              <td className="px-3 py-2.5 text-sm font-medium" style={{ color: '#101114' }}>
                                {c.urge_level ?? '—'}{c.urge_level != null ? '/10' : ''}
                              </td>
                              <td className="px-3 py-2.5 text-sm" style={{ color: '#9497a9' }}>
                                {c.mood_score ?? '—'}{c.mood_score != null ? '/10' : ''}
                              </td>
                              <td className="px-3 py-2.5 text-sm" style={{ color: '#9497a9' }}>
                                {c.sleep_quality ?? '—'}{c.sleep_quality != null ? '/10' : ''}
                              </td>
                              <td className="px-3 py-2.5 text-xs max-w-xs" style={{ color: '#9497a9' }}>
                                {c.side_effects || '—'}
                              </td>
                              <td className="px-3 py-2.5 text-xs max-w-xs" style={{ color: '#9497a9' }}>
                                {c.notes || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ============================================================= */}
          {/* TAB 3 — AI ASSESSMENTS                                         */}
          {/* ============================================================= */}
          {activeTab === 'assessments' && (
            <div className="space-y-4">
              {assessments.length === 0 ? (
                <div className="text-center py-12">
                  <span className="text-4xl block mb-3">🤖</span>
                  <p className="font-medium" style={{ color: '#101114' }}>No assessments yet</p>
                  <p className="text-sm mt-1" style={{ color: '#9497a9' }}>
                    Click "Run AI Assessment" above to generate the first one.
                  </p>
                </div>
              ) : (
                assessments.slice(0, 5).map((a, idx) => {
                  const lvl    = (a.risk_level || a.level || 'low').toLowerCase()
                  const sc     = a.risk_score ?? a.score ?? 0
                  const factors = a.risk_factors || a.factors || []
                  const factorList = Array.isArray(factors) ? factors : Object.keys(factors)
                  const doctorRecs  = a.recommendations || a.doctor_recommendations || a.suggested_actions || []
                  const patientGuid = a.patient_guidance || a.guidance || []
                  const prescNote   = a.prescription_note || ''
                  const model       = a.model_used || a.model || 'GPT-4o'
                  const ts          = a.assessed_at || a.created_at || ''
                  return (
                    <div
                      key={a.id || idx}
                      className="rounded-2xl overflow-hidden"
                      style={{ border: '1px solid #dedee5', boxShadow: 'rgba(0,0,0,0.04) 0px 2px 12px' }}
                    >
                      {/* Assessment card header */}
                      <div
                        className="px-5 py-4 flex items-center justify-between gap-3 flex-wrap"
                        style={{ background: '#f8f9fc', borderBottom: '1px solid #dedee5' }}
                      >
                        <div className="flex items-center gap-3 flex-wrap">
                          <RiskLevelBadge level={lvl} score={sc} />
                          {ts && (
                            <span className="text-xs" style={{ color: '#9497a9' }}>{fmtDateTime(ts)}</span>
                          )}
                        </div>
                        <span
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                          style={{ background: 'rgba(29,78,216,0.10)', color: '#1d4ed8' }}
                        >
                          {model}
                        </span>
                      </div>

                      <div className="px-5 py-4 space-y-4">
                        {/* Summary */}
                        {a.summary && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#9497a9' }}>
                              AI Summary
                            </p>
                            <p className="text-sm leading-relaxed" style={{ color: '#101114' }}>{a.summary}</p>
                          </div>
                        )}

                        {/* Risk factors */}
                        {factorList.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#9497a9' }}>
                              Risk Factors
                            </p>
                            <ul className="space-y-1">
                              {factorList.map((f, i) => {
                                const name = typeof f === 'string' ? f : (f.factor || f.name || f.description || String(f))
                                return (
                                  <li key={i} className="flex items-center gap-2 text-sm" style={{ color: '#101114' }}>
                                    <span style={{ color: '#d97706' }}>⚠️</span> {name}
                                  </li>
                                )
                              })}
                            </ul>
                          </div>
                        )}

                        {/* Recommendations for doctor */}
                        {(Array.isArray(doctorRecs) ? doctorRecs : []).length > 0 && (
                          <div
                            className="px-4 py-3 rounded-xl"
                            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.20)' }}
                          >
                            <p className="text-xs font-semibold mb-2" style={{ color: '#92400e' }}>
                              Recommendations for Doctor
                            </p>
                            <ul className="space-y-1">
                              {(Array.isArray(doctorRecs) ? doctorRecs : []).map((r, i) => {
                                const text = typeof r === 'string' ? r : (r.recommendation || r.action || r.text || String(r))
                                return (
                                  <li key={i} className="text-sm flex items-start gap-2" style={{ color: '#92400e' }}>
                                    <span className="mt-0.5">•</span> {text}
                                  </li>
                                )
                              })}
                            </ul>
                          </div>
                        )}

                        {/* Patient guidance */}
                        {(Array.isArray(patientGuid) ? patientGuid : []).length > 0 && (
                          <div
                            className="px-4 py-3 rounded-xl"
                            style={{ background: 'rgba(29,78,216,0.06)', border: '1px solid rgba(29,78,216,0.12)' }}
                          >
                            <p className="text-xs font-semibold mb-2" style={{ color: '#1d4ed8' }}>
                              Patient Guidance
                            </p>
                            <ul className="space-y-1">
                              {(Array.isArray(patientGuid) ? patientGuid : []).map((g, i) => {
                                const text = typeof g === 'string' ? g : (g.message || g.text || String(g))
                                return (
                                  <li key={i} className="text-sm flex items-start gap-2" style={{ color: '#1d4ed8' }}>
                                    <span className="mt-0.5">•</span> {text}
                                  </li>
                                )
                              })}
                            </ul>
                          </div>
                        )}

                        {/* Prescription note */}
                        {prescNote && (
                          <p className="text-xs italic" style={{ color: '#9497a9' }}>
                            <span className="font-semibold not-italic">Prescription note: </span>
                            {prescNote}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* ============================================================= */}
          {/* TAB 4 — CLINICAL NOTES                                         */}
          {/* ============================================================= */}
          {activeTab === 'notes' && (
            <div className="space-y-6">
              {/* Add note form */}
              <form onSubmit={handleAddNote} className="space-y-3">
                <p className="font-semibold text-sm" style={{ color: '#101114' }}>Add Clinical Note</p>
                <select
                  value={noteForm.note_type}
                  onChange={(e) => setNoteForm((f) => ({ ...f, note_type: e.target.value }))}
                  className="w-full rounded-xl text-sm"
                  style={{ border: '1.5px solid #dedee5', color: '#101114', background: '#ffffff', padding: '10px 14px', outline: 'none' }}
                >
                  {NOTE_TYPES.map((nt) => <option key={nt.val} value={nt.val}>{nt.label}</option>)}
                </select>
                <textarea
                  value={noteForm.content}
                  onChange={(e) => setNoteForm((f) => ({ ...f, content: e.target.value }))}
                  rows={4}
                  required
                  placeholder="Enter clinical note..."
                  className="w-full rounded-xl text-sm resize-none"
                  style={{ border: '1.5px solid #dedee5', color: '#101114', background: '#ffffff', padding: '10px 14px', outline: 'none' }}
                  onFocus={(e)  => (e.target.style.borderColor = '#1d4ed8')}
                  onBlur={(e)   => (e.target.style.borderColor = '#dedee5')}
                />
                {noteError   && <p className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(220,38,38,0.10)', color: '#991b1b' }}>⚠️ {noteError}</p>}
                {noteSuccess && <p className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(20,158,97,0.12)', color: '#026b3f' }}>✓ {noteSuccess}</p>}
                <button
                  type="submit"
                  disabled={noteLoading}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                  style={{ background: noteLoading ? '#9497a9' : '#1d4ed8', cursor: noteLoading ? 'not-allowed' : 'pointer' }}
                >
                  {noteLoading ? 'Saving...' : 'Add Note'}
                </button>
              </form>

              {/* Notes list */}
              <div style={{ borderTop: '1px solid #dedee5', paddingTop: '20px' }}>
                <p className="font-semibold text-sm mb-3" style={{ color: '#101114' }}>
                  Notes History ({notes.length})
                </p>
                {notes.length === 0 ? (
                  <p className="text-sm" style={{ color: '#9497a9' }}>No clinical notes yet.</p>
                ) : (
                  <div className="space-y-3">
                    {notes.map((note, i) => (
                      <div
                        key={note.id || i}
                        className="p-4 rounded-2xl"
                        style={{ background: '#f8f9fc', border: '1px solid #dedee5' }}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                          <NoteTypeBadge type={note.note_type || note.type} />
                          <span className="text-xs" style={{ color: '#9497a9' }}>
                            {fmtDateTime(note.created_at || note.date)}
                          </span>
                        </div>
                        <p className="text-sm" style={{ color: '#101114' }}>{note.content || note.text || ''}</p>
                        {(note.doctor_name || note.author) && (
                          <p className="text-xs mt-2" style={{ color: '#9497a9' }}>
                            — {note.doctor_name || note.author}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* TAB 5 — FOLLOW-UP ACTIONS                                      */}
          {/* ============================================================= */}
          {activeTab === 'followups' && (
            <div className="space-y-6">
              {/* Quick-action buttons */}
              <div>
                <p className="font-semibold text-sm mb-3" style={{ color: '#101114' }}>Quick Actions</p>

                {/* Notes textarea */}
                <textarea
                  value={fuNotes}
                  onChange={(e) => setFuNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional notes for this action..."
                  className="w-full rounded-xl text-sm resize-none mb-3"
                  style={{ border: '1.5px solid #dedee5', color: '#101114', background: '#ffffff', padding: '10px 14px', outline: 'none' }}
                  onFocus={(e) => (e.target.style.borderColor = '#1d4ed8')}
                  onBlur={(e)  => (e.target.style.borderColor = '#dedee5')}
                />

                {/* 5 action buttons in a responsive row */}
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {FOLLOW_UP_ACTIONS.map((action) => (
                    <button
                      key={action.type}
                      onClick={() => handleFollowUp(action.type)}
                      disabled={fuLoading}
                      className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all text-left"
                      style={{
                        background: action.bg,
                        color:      action.color,
                        border:     `1.5px solid ${action.border}`,
                        cursor:     fuLoading ? 'not-allowed' : 'pointer',
                        opacity:    fuLoading ? 0.65 : 1,
                      }}
                    >
                      <span className="text-base flex-shrink-0">{action.icon}</span>
                      <span className="leading-tight">{action.label}</span>
                    </button>
                  ))}
                </div>

                {fuError   && <p className="mt-3 text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(220,38,38,0.10)', color: '#991b1b' }}>⚠️ {fuError}</p>}
                {fuSuccess && <p className="mt-3 text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(20,158,97,0.12)', color: '#026b3f' }}>✓ {fuSuccess}</p>}
              </div>

              {/* Action history */}
              <div style={{ borderTop: '1px solid #dedee5', paddingTop: '20px' }}>
                <p className="font-semibold text-sm mb-3" style={{ color: '#101114' }}>
                  Action History ({followUps.length})
                </p>
                {followUps.length === 0 ? (
                  <p className="text-sm" style={{ color: '#9497a9' }}>No follow-up actions recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {[...followUps]
                      .sort((a, b) => new Date(b.created_at || b.date || 0) - new Date(a.created_at || a.date || 0))
                      .map((fu, i) => {
                        const isComplete   = fu.status === 'completed'
                        const actionConfig = FOLLOW_UP_ACTIONS.find((a) => a.type === (fu.action_type || fu.type)) ||
                          { icon: '📋', color: '#9497a9', bg: '#f8f9fc', border: '#dedee5' }
                        const id = fu.id || fu.action_id
                        return (
                          <div
                            key={id || i}
                            className="flex items-start justify-between gap-3 p-4 rounded-2xl"
                            style={{ background: '#f8f9fc', border: '1px solid #dedee5' }}
                          >
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <span className="text-base mt-0.5 flex-shrink-0">{actionConfig.icon}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold capitalize" style={{ color: '#101114' }}>
                                  {(fu.action_type || fu.type || '').replace(/_/g, ' ')}
                                </p>
                                {fu.notes && (
                                  <p className="text-xs mt-0.5 truncate" style={{ color: '#9497a9' }}>{fu.notes}</p>
                                )}
                                {(fu.created_at || fu.date) && (
                                  <p className="text-xs mt-1" style={{ color: '#9497a9' }}>
                                    {fmtDateTime(fu.created_at || fu.date)}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span
                                className="px-2.5 py-0.5 rounded-lg text-xs font-semibold whitespace-nowrap"
                                style={isComplete
                                  ? { background: 'rgba(20,158,97,0.14)', color: '#026b3f' }
                                  : { background: 'rgba(245,158,11,0.14)', color: '#92400e' }}
                              >
                                {isComplete ? '✓ Completed' : '⏳ Pending'}
                              </span>
                              {!isComplete && id && (
                                <button
                                  onClick={() => handleCompleteFollowUp(id)}
                                  className="text-xs px-2.5 py-1.5 rounded-xl font-semibold"
                                  style={{ background: 'rgba(20,158,97,0.10)', color: '#026b3f', border: '1px solid rgba(2,107,63,0.20)' }}
                                >
                                  Mark Done
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
