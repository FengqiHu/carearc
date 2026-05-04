import React, { useState, useEffect } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { patient } from '../../api/client'

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  )
}

function Card({ children, className = '' }) {
  return (
    <div
      className={`bg-white rounded-2xl p-6 ${className}`}
      style={{ boxShadow: 'rgba(0,0,0,0.06) 0px 4px 24px', border: '1px solid #dedee5' }}
    >
      {children}
    </div>
  )
}

function PillsRemaining({ remaining, total }) {
  const pct = total > 0 ? (remaining / total) * 100 : 0
  let color = '#1d4ed8'
  if (pct <= 20) color = '#dc2626'
  else if (pct <= 40) color = '#d97706'
  return (
    <div>
      <div className="flex justify-between text-xs mb-1" style={{ color: '#9497a9' }}>
        <span>{remaining} pills remaining</span>
        <span>{total} total</span>
      </div>
      <div className="w-full rounded-full h-2" style={{ background: '#f3f4f8' }}>
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const isActive = (status || '').toLowerCase() === 'active'
  return (
    <span
      className="px-2 py-0.5 rounded-lg text-xs font-semibold"
      style={{
        background: isActive ? 'rgba(20,158,97,0.14)' : '#f3f4f8',
        color: isActive ? '#026b3f' : '#9497a9',
      }}
    >
      {status || 'Unknown'}
    </span>
  )
}

const CUSTOM_TOOLTIP_STYLE = {
  background: '#ffffff',
  border: '1px solid #dedee5',
  borderRadius: '12px',
  padding: '10px 14px',
  boxShadow: 'rgba(0,0,0,0.08) 0px 4px 16px',
  fontSize: '13px',
  color: '#101114',
}

export default function MyMedications() {
  const [medications, setMedications] = useState([])
  const [checkins, setCheckins] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      setLoading(true)
      try {
        const [medRes, checkinRes] = await Promise.allSettled([
          patient.getMedications(),
          patient.getCheckins(14),
        ])
        if (cancelled) return
        if (medRes.status === 'fulfilled') {
          const meds = medRes.value.data?.medications || medRes.value.data || []
          setMedications(Array.isArray(meds) ? meds : [meds])
        }
        if (checkinRes.status === 'fulfilled') {
          const list = checkinRes.value.data?.checkins || checkinRes.value.data || []
          setCheckins(Array.isArray(list) ? list : [])
        }
      } catch (err) {
        if (!cancelled) setError('Failed to load medications.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [])

  // Build adherence chart data (last 7 days)
  const adherenceData = (() => {
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toDateString()
      const entry = checkins.find(
        (c) => new Date(c.date || c.created_at || c.checkin_date).toDateString() === dateStr
      )
      days.push({
        day: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        Taken: entry ? (entry.medication_taken ? 1 : 0) : null,
        Missed: entry ? (!entry.medication_taken ? 1 : 0) : null,
        NoData: entry ? 0 : 1,
      })
    }
    return days
  })()

  // Build pain trend chart data (last 14 days)
  const painData = (() => {
    return checkins
      .slice()
      .sort((a, b) => new Date(a.date || a.created_at || a.checkin_date) - new Date(b.date || b.created_at || b.checkin_date))
      .slice(-14)
      .map((c) => ({
        date: new Date(c.date || c.created_at || c.checkin_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        Pain: c.pain_score,
        Mood: c.mood_score,
      }))
  })()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#101114' }}>My Medications</h1>
        <p className="text-sm mt-1" style={{ color: '#9497a9' }}>Current prescriptions and adherence tracking</p>
      </div>

      {loading && <Spinner />}
      {!loading && error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(220,38,38,0.1)', color: '#991b1b' }}>
          ⚠️ {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Medication Cards */}
          {medications.length === 0 ? (
            <Card>
              <div className="text-center py-8">
                <span className="text-4xl block mb-3">💊</span>
                <p className="font-medium" style={{ color: '#101114' }}>No medications on file</p>
                <p className="text-sm mt-1" style={{ color: '#9497a9' }}>Your prescriptions will appear here once added by your care team.</p>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {medications.map((med, i) => {
                const name = med.medication_name || med.name || med.drug_name || 'Unknown Medication'
                const dosage = med.dosage || med.dose || ''
                const totalPills = med.total_pills || med.pill_count || med.total_count || 0
                const remainingPills = med.pills_remaining ?? med.remaining ?? totalPills
                const startDate = med.start_date || med.prescribed_date
                const daysRemaining = med.days_remaining ?? med.refill_in_days ?? null
                const refillCount = med.refill_count ?? med.refills_remaining ?? 0
                const status = med.status || 'Active'
                const duration = med.prescription_duration || med.duration_days

                return (
                  <Card key={med.id || i}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                          style={{ background: 'rgba(29,78,216,0.10)' }}
                        >
                          💊
                        </div>
                        <div>
                          <h3 className="font-semibold text-base" style={{ color: '#101114' }}>{name}</h3>
                          {dosage && <p className="text-sm" style={{ color: '#9497a9' }}>{dosage}</p>}
                        </div>
                      </div>
                      <StatusBadge status={status} />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      {startDate && (
                        <div className="p-3 rounded-xl" style={{ background: '#f8f9fc' }}>
                          <p className="text-xs mb-0.5" style={{ color: '#9497a9' }}>Start Date</p>
                          <p className="font-semibold text-sm" style={{ color: '#101114' }}>
                            {new Date(startDate).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                      {duration && (
                        <div className="p-3 rounded-xl" style={{ background: '#f8f9fc' }}>
                          <p className="text-xs mb-0.5" style={{ color: '#9497a9' }}>Duration</p>
                          <p className="font-semibold text-sm" style={{ color: '#101114' }}>{duration} days</p>
                        </div>
                      )}
                      {daysRemaining !== null && (
                        <div className="p-3 rounded-xl" style={{ background: '#f8f9fc' }}>
                          <p className="text-xs mb-0.5" style={{ color: '#9497a9' }}>Days Left</p>
                          <p
                            className="font-semibold text-sm"
                            style={{ color: daysRemaining <= 7 ? '#dc2626' : '#101114' }}
                          >
                            {daysRemaining} days
                          </p>
                        </div>
                      )}
                      <div className="p-3 rounded-xl" style={{ background: '#f8f9fc' }}>
                        <p className="text-xs mb-0.5" style={{ color: '#9497a9' }}>Refills Left</p>
                        <p className="font-semibold text-sm" style={{ color: '#101114' }}>{refillCount}</p>
                      </div>
                    </div>

                    {totalPills > 0 && (
                      <PillsRemaining remaining={remainingPills} total={totalPills} />
                    )}

                    {med.instructions && (
                      <div
                        className="mt-3 px-3 py-2 rounded-xl text-xs"
                        style={{ background: 'rgba(29,78,216,0.06)', color: '#1d4ed8' }}
                      >
                        📋 {med.instructions}
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}

          {/* Adherence Chart */}
          {checkins.length > 0 && (
            <Card>
              <h2 className="font-semibold text-base mb-1" style={{ color: '#101114' }}>
                Medication Adherence — Last 7 Days
              </h2>
              <p className="text-xs mb-5" style={{ color: '#9497a9' }}>Whether you took your medication each day</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={adherenceData} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f1f5" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9497a9' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={CUSTOM_TOOLTIP_STYLE}
                    formatter={(value, name) => [value === 1 ? 'Yes' : value === 0 ? 'No' : '—', name]}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', color: '#9497a9' }} />
                  <Bar dataKey="Taken" fill="rgba(20,158,97,0.75)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Missed" fill="rgba(220,38,38,0.65)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Pain Trend Chart */}
          {painData.length > 1 && (
            <Card>
              <h2 className="font-semibold text-base mb-1" style={{ color: '#101114' }}>
                Pain &amp; Mood Trend — Last 14 Days
              </h2>
              <p className="text-xs mb-5" style={{ color: '#9497a9' }}>Track changes in pain and mood scores over time</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={painData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f1f5" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9497a9' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: '#9497a9' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: '12px', color: '#9497a9' }} />
                  <Line type="monotone" dataKey="Pain" stroke="#dc2626" strokeWidth={2.5} dot={{ r: 4, fill: '#dc2626' }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="Mood" stroke="#1d4ed8" strokeWidth={2.5} dot={{ r: 4, fill: '#1d4ed8' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
