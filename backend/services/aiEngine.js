'use strict';

require('dotenv').config();
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(patient, prescription, checkins) {
  const postOpDay = prescription.start_date
    ? Math.floor((Date.now() - new Date(prescription.start_date).getTime()) / 86400000)
    : '?';

  const checkinLines = checkins.slice(0, 14).map(c => {
    if (c.missed_checkin) return `  ${c.checkin_date}: [MISSED CHECK-IN]`;
    return [
      `  ${c.checkin_date}:`,
      `    Pain: ${c.pain_score ?? 'N/A'}/10`,
      `    Took medication: ${c.medication_adherence ? 'Yes' : 'No'}, Timing: ${c.dose_timing ?? 'N/A'}`,
      `    Urge/Craving: ${c.urge_level ?? 'N/A'}/10`,
      `    Mood: ${c.mood_score ?? 'N/A'}/10, Sleep: ${c.sleep_quality ?? 'N/A'}/10`,
      c.side_effects ? `    Side effects: ${c.side_effects}` : null,
      c.notes        ? `    Patient note: "${c.notes}"` : null,
    ].filter(Boolean).join('\n');
  }).join('\n');

  return `You are a clinical AI assistant for post-operative medication safety monitoring.

Analyze the following patient data against their active prescription and provide a structured risk assessment.

--- PATIENT ---
Name: ${patient.name}
Age: ${patient.age}, Sex: ${patient.sex}
Surgery: ${patient.surgery_type}
Post-op day: ${postOpDay}

--- ACTIVE PRESCRIPTION ---
Medication: ${prescription.medication_name} ${prescription.dosage}
Frequency: ${prescription.frequency}
Duration: ${prescription.duration_days} days (started ${prescription.start_date})
Instructions: ${prescription.instructions || 'None specified'}
Doctor's monitoring context: ${prescription.monitoring_notes || 'None specified'}

--- RECENT CHECK-INS (most recent first, up to 14 days) ---
${checkinLines || 'No check-ins recorded yet.'}

--- TASK ---
Based on the prescription details, the doctor's monitoring context, and the patient's check-in data, provide a clinical risk assessment.

Respond with ONLY a valid JSON object in this exact schema:
{
  "risk_level": "low" | "medium" | "high",
  "risk_score": <integer 0-100>,
  "summary": "<2-3 sentence clinical summary of the patient's current status>",
  "risk_factors": ["<specific concern>", ...],
  "alert_flags": [<subset of: "pain_increasing", "high_pain", "low_adherence", "strong_urge", "missed_checkins", "irregular_timing", "early_refill", "side_effects_concerning", "mood_decline">],
  "recommendations": ["<actionable step for the doctor>", ...],
  "patient_guidance": ["<personalized message for the patient>", ...],
  "prescription_note": "<one sentence specifically about adherence to this prescription>"
}

Scoring guidelines:
- risk_score 0-24 → low, 25-49 → medium, 50-100 → high
- Weight heavily: escalating pain trend, urge/craving levels above 7, multiple missed doses, multiple missed check-ins
- Consider the doctor's monitoring_notes as the primary clinical context
- patient_guidance should be empathetic and actionable, written directly to the patient`;
}

// ── Main assessment function ──────────────────────────────────────────────────

async function runAIAssessment(patientId, db, checkinId = null) {
  // Fetch patient with user info
  const patient = db.prepare(`
    SELECT p.*, u.name
    FROM patients p
    JOIN users u ON u.id = p.user_id
    WHERE p.id = ?
  `).get(patientId);

  if (!patient) throw new Error(`Patient ${patientId} not found`);

  // Get the active prescription (most recent)
  const prescription = db.prepare(`
    SELECT * FROM prescriptions
    WHERE patient_id = ? AND is_active = 1
    ORDER BY created_at DESC
    LIMIT 1
  `).get(patientId);

  if (!prescription) throw new Error(`No active prescription for patient ${patientId}`);

  // Get recent check-ins ordered newest first
  const checkins = db.prepare(`
    SELECT * FROM daily_checkins
    WHERE patient_id = ?
    ORDER BY checkin_date DESC
    LIMIT 14
  `).all(patientId);

  const prompt = buildPrompt(patient, prescription, checkins);

  let raw;
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 800,
    });
    raw = JSON.parse(response.choices[0].message.content);
  } catch (err) {
    console.error('[aiEngine] OpenAI error:', err.message);
    throw new Error('AI assessment failed: ' + err.message);
  }

  // Validate and normalise the response
  const riskLevel = ['low', 'medium', 'high'].includes(raw.risk_level) ? raw.risk_level : 'medium';
  const riskScore = Math.max(0, Math.min(100, Number(raw.risk_score) || 50));

  const assessment = {
    risk_level:        riskLevel,
    risk_score:        riskScore,
    summary:           raw.summary || '',
    risk_factors:      Array.isArray(raw.risk_factors)    ? raw.risk_factors    : [],
    alert_flags:       Array.isArray(raw.alert_flags)     ? raw.alert_flags     : [],
    recommendations:   Array.isArray(raw.recommendations) ? raw.recommendations : [],
    patient_guidance:  Array.isArray(raw.patient_guidance)? raw.patient_guidance: [],
    prescription_note: raw.prescription_note || '',
    model_used:        'gpt-4o',
  };

  // Persist
  db.prepare(`
    INSERT INTO risk_assessments
      (patient_id, checkin_id, risk_level, risk_score, summary, risk_factors,
       alert_flags, recommendations, patient_guidance, prescription_note, model_used, assessed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    patientId,
    checkinId,
    assessment.risk_level,
    assessment.risk_score,
    assessment.summary,
    JSON.stringify(assessment.risk_factors),
    JSON.stringify(assessment.alert_flags),
    JSON.stringify(assessment.recommendations),
    JSON.stringify(assessment.patient_guidance),
    assessment.prescription_note,
    assessment.model_used,
    new Date().toISOString()
  );

  return assessment;
}

// ── Helper: parse a stored assessment row ─────────────────────────────────────

function parseAssessment(row) {
  if (!row) return null;
  return {
    ...row,
    risk_factors:     tryParse(row.risk_factors,     []),
    alert_flags:      tryParse(row.alert_flags,      []),
    recommendations:  tryParse(row.recommendations,  []),
    patient_guidance: tryParse(row.patient_guidance, []),
  };
}

function tryParse(str, fallback) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

module.exports = { runAIAssessment, parseAssessment };
