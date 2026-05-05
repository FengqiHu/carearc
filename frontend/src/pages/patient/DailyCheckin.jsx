import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { patient } from '../../api/client'

function Card({ children, title, className = '' }) {
  return (
    <div
      className={`bg-white rounded-2xl p-6 ${className}`}
      style={{ boxShadow: 'rgba(0,0,0,0.06) 0px 4px 24px', border: '1px solid #dedee5' }}
    >
      {title && (
        <h3 className="font-semibold text-base mb-4" style={{ color: '#101114' }}>{title}</h3>
      )}
      {children}
    </div>
  )
}

const PAIN_EMOJIS = ['😊','😊','🙂','🙂','😐','😐','😟','😟','😣','😰','😰']
const SIDE_EFFECTS = ['Nausea', 'Dizziness', 'Constipation', 'Fatigue', 'Headache', 'Sweating', 'Insomnia', 'None']

function ScoreSlider({ value, onChange, min = 0, max = 10, label, leftLabel, rightLabel }) {
  const pct = ((value - min) / (max - min)) * 100
  let trackColor = '#dedee5'
  if (value <= 3) trackColor = '#14be8b'
  else if (value <= 6) trackColor = '#f59e0b'
  else trackColor = '#ef4444'

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        {leftLabel && <span className="text-xs" style={{ color: '#9497a9' }}>{leftLabel}</span>}
        <span
          className="text-2xl font-bold mx-auto"
          style={{ color: trackColor }}
        >
          {value}
        </span>
        {rightLabel && <span className="text-xs" style={{ color: '#9497a9' }}>{rightLabel}</span>}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        style={{
          background: `linear-gradient(to right, ${trackColor} 0%, ${trackColor} ${pct}%, #dedee5 ${pct}%, #dedee5 100%)`,
        }}
      />
      {label && (
        <div className="flex justify-between mt-1">
          <span className="text-xs" style={{ color: '#9497a9' }}>{min}</span>
          <span className="text-xs font-medium" style={{ color: '#9497a9' }}>{label}</span>
          <span className="text-xs" style={{ color: '#9497a9' }}>{max}</span>
        </div>
      )}
    </div>
  )
}

export default function DailyCheckin() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [checkingExisting, setCheckingExisting] = useState(true)
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false)
  const [existingCheckin, setExistingCheckin] = useState(null)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    medication_taken: null,
    dose_timing: '',
    pain_score: 3,
    side_effects: [],
    urge_level: 0,
    mood_score: 5,
    sleep_quality: 6,
    notes: '',
  })

  useEffect(() => {
    let cancelled = false
    const checkToday = async () => {
      try {
        const res = await patient.getCheckins(1)
        if (cancelled) return
        const checkins = res.data?.checkins || res.data || []
        const today = new Date().toDateString()
        const todayEntry = checkins.find(
          (c) => new Date(c.date || c.created_at || c.checkin_date).toDateString() === today
        )
        if (todayEntry) {
          setAlreadyCheckedIn(true)
          setExistingCheckin(todayEntry)
        }
      } catch (err) {
        // If no checkins yet, that's fine
      } finally {
        if (!cancelled) setCheckingExisting(false)
      }
    }
    checkToday()
    return () => { cancelled = true }
  }, [])

  const toggleSideEffect = (effect) => {
    setForm((prev) => {
      if (effect === 'None') {
        return { ...prev, side_effects: prev.side_effects.includes('None') ? [] : ['None'] }
      }
      const without = prev.side_effects.filter((e) => e !== 'None')
      if (without.includes(effect)) {
        return { ...prev, side_effects: without.filter((e) => e !== effect) }
      }
      return { ...prev, side_effects: [...without, effect] }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.medication_taken === null) {
      setError('Please indicate whether you took your medication today.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await patient.submitCheckin({
        ...form,
        medication_adherence: form.medication_taken,
        side_effects: form.side_effects.join(', '),
      })
      setSuccess(true)
      setTimeout(() => navigate('/patient'), 2500)
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to submit check-in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (checkingExisting) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(20,158,97,0.14)' }}>
          <span className="text-4xl">✅</span>
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: '#101114' }}>Check-in Submitted!</h2>
        <p className="text-sm mb-4" style={{ color: '#9497a9' }}>Great job staying on track with your recovery. Redirecting to dashboard...</p>
        <div className="w-6 h-6 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (alreadyCheckedIn && existingCheckin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#101114' }}>Daily Check-in</h1>
          <p className="text-sm mt-1" style={{ color: '#9497a9' }}>Track your daily recovery progress</p>
        </div>
        <div
          className="bg-white rounded-2xl p-8 text-center"
          style={{ boxShadow: 'rgba(0,0,0,0.06) 0px 4px 24px', border: '1px solid #dedee5' }}
        >
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 mx-auto" style={{ background: 'rgba(20,158,97,0.14)' }}>
            <span className="text-3xl">✅</span>
          </div>
          <h2 className="text-lg font-bold mb-2" style={{ color: '#101114' }}>Already checked in today!</h2>
          <p className="text-sm mb-6" style={{ color: '#9497a9' }}>You've completed your check-in for today. See your summary below.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left mb-6">
            {[
              { label: 'Pain Score', value: `${existingCheckin.pain_score ?? '—'}/10` },
              { label: 'Mood', value: `${existingCheckin.mood_score ?? '—'}/10` },
              { label: 'Sleep', value: `${existingCheckin.sleep_quality ?? '—'}/10` },
              { label: 'Medication', value: existingCheckin.medication_taken ? 'Taken ✅' : 'Missed ❌' },
            ].map((item) => (
              <div key={item.label} className="p-3 rounded-xl" style={{ background: '#f8f9fc' }}>
                <p className="text-xs mb-0.5" style={{ color: '#9497a9' }}>{item.label}</p>
                <p className="font-semibold text-sm" style={{ color: '#101114' }}>{item.value}</p>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate('/patient')}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: '#1d4ed8' }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#101114' }}>Daily Check-in</h1>
        <p className="text-sm mt-1" style={{ color: '#9497a9' }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(220,38,38,0.1)', color: '#991b1b', border: '1px solid rgba(220,38,38,0.2)' }}>
          <span className="mr-2">⚠️</span>{error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 1. Medication Adherence */}
        <Card title="💊 Medication Adherence">
          <p className="text-sm mb-3" style={{ color: '#9497a9' }}>Did you take your medication today?</p>
          <div className="flex gap-3">
            {[{ val: true, label: 'Yes, I took it', color: '#026b3f', bg: 'rgba(20,158,97,0.14)' },
              { val: false, label: 'No, I missed it', color: '#991b1b', bg: 'rgba(220,38,38,0.10)' }].map((opt) => (
              <button
                key={String(opt.val)}
                type="button"
                onClick={() => setForm((f) => ({ ...f, medication_taken: opt.val }))}
                className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: form.medication_taken === opt.val ? opt.bg : '#f8f9fc',
                  color: form.medication_taken === opt.val ? opt.color : '#9497a9',
                  border: `2px solid ${form.medication_taken === opt.val ? opt.color + '55' : '#dedee5'}`,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Card>

        {/* 2. Dose Timing */}
        <Card title="⏰ Dose Timing">
          <p className="text-sm mb-3" style={{ color: '#9497a9' }}>When did you take your medication?</p>
          <div className="flex gap-2 flex-wrap">
            {[
              { val: 'on_time', label: 'On Time', icon: '✅' },
              { val: 'late', label: 'Late', icon: '⏳' },
              { val: 'missed', label: 'Missed', icon: '❌' },
              { val: 'na', label: 'N/A', icon: '—' },
            ].map((opt) => (
              <button
                key={opt.val}
                type="button"
                onClick={() => setForm((f) => ({ ...f, dose_timing: opt.val }))}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: form.dose_timing === opt.val ? 'rgba(29,78,216,0.12)' : '#f8f9fc',
                  color: form.dose_timing === opt.val ? '#1d4ed8' : '#9497a9',
                  border: `1.5px solid ${form.dose_timing === opt.val ? 'rgba(29,78,216,0.3)' : '#dedee5'}`,
                }}
              >
                <span>{opt.icon}</span> {opt.label}
              </button>
            ))}
          </div>
        </Card>

        {/* 3. Pain Score */}
        <Card title="😣 Pain Score">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">{PAIN_EMOJIS[form.pain_score]}</span>
            <div className="flex-1">
              <ScoreSlider
                value={form.pain_score}
                onChange={(v) => setForm((f) => ({ ...f, pain_score: v }))}
                label="0 = No pain, 10 = Worst pain"
                leftLabel="No pain"
                rightLabel="Worst"
              />
            </div>
          </div>
          <div className="flex justify-between text-xs mt-1" style={{ color: '#9497a9' }}>
            <span>0 — No pain</span>
            <span>5 — Moderate</span>
            <span>10 — Severe</span>
          </div>
        </Card>

        {/* 4. Side Effects */}
        <Card title="🩺 Side Effects">
          <p className="text-sm mb-3" style={{ color: '#9497a9' }}>Select all that apply today</p>
          <div className="flex flex-wrap gap-2">
            {SIDE_EFFECTS.map((effect) => {
              const selected = form.side_effects.includes(effect)
              return (
                <button
                  key={effect}
                  type="button"
                  onClick={() => toggleSideEffect(effect)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: selected ? 'rgba(29,78,216,0.12)' : '#f8f9fc',
                    color: selected ? '#1d4ed8' : '#9497a9',
                    border: `1.5px solid ${selected ? 'rgba(29,78,216,0.3)' : '#dedee5'}`,
                  }}
                >
                  {effect}
                </button>
              )
            })}
          </div>
        </Card>

        {/* 5. Urge/Craving Level */}
        <Card title="⚡ Urge / Craving Level">
          <p className="text-sm mb-4" style={{ color: '#9497a9' }}>Rate any urges or cravings you experienced today</p>
          <ScoreSlider
            value={form.urge_level}
            onChange={(v) => setForm((f) => ({ ...f, urge_level: v }))}
            label="0 = None, 10 = Very strong"
            leftLabel="None"
            rightLabel="Strong"
          />
        </Card>

        {/* 6. Mood Score */}
        <Card title="😊 Mood Score">
          <p className="text-sm mb-4" style={{ color: '#9497a9' }}>How would you describe your overall mood today?</p>
          <ScoreSlider
            value={form.mood_score}
            onChange={(v) => setForm((f) => ({ ...f, mood_score: v }))}
            label="0 = Very low, 10 = Excellent"
            leftLabel="Very low"
            rightLabel="Excellent"
          />
        </Card>

        {/* 7. Sleep Quality */}
        <Card title="🌙 Sleep Quality">
          <p className="text-sm mb-4" style={{ color: '#9497a9' }}>How well did you sleep last night?</p>
          <ScoreSlider
            value={form.sleep_quality}
            onChange={(v) => setForm((f) => ({ ...f, sleep_quality: v }))}
            label="0 = Very poor, 10 = Excellent"
            leftLabel="Very poor"
            rightLabel="Excellent"
          />
        </Card>

        {/* 8. Notes */}
        <Card title="📝 Additional Notes">
          <p className="text-sm mb-3" style={{ color: '#9497a9' }}>Anything else you'd like your care team to know? (optional)</p>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={3}
            placeholder="E.g., I felt more tired than usual today, slight soreness near the incision area..."
            className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none transition-all"
            style={{
              border: '1.5px solid #dedee5',
              color: '#101114',
              background: '#ffffff',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#1d4ed8')}
            onBlur={(e) => (e.target.style.borderColor = '#dedee5')}
          />
        </Card>

        {/* Submit */}
        <div className="flex gap-3 pb-6">
          <button
            type="button"
            onClick={() => navigate('/patient')}
            className="px-6 py-3 rounded-xl text-sm font-semibold transition-all"
            style={{ background: '#f3f4f8', color: '#9497a9', border: '1.5px solid #dedee5' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: loading ? '#93a9e8' : '#1d4ed8', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </span>
            ) : (
              'Submit Check-in'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
