'use strict';

const express = require('express');
const db = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { runAIAssessment, parseAssessment } = require('../services/aiEngine');

const router = express.Router();
router.use(authenticateToken, requireRole('patient'));

function getPatient(userId) {
  return db.prepare('SELECT * FROM patients WHERE user_id = ?').get(userId);
}

function calcPostOpDay(surgeryDate) {
  if (!surgeryDate) return null;
  return Math.floor((Date.now() - new Date(surgeryDate).getTime()) / 86400000);
}

// ── GET /api/patient/profile ──────────────────────────────────────────────────
router.get('/profile', (req, res) => {
  const patient = getPatient(req.user.id);
  if (!patient) return res.status(404).json({ error: 'Patient profile not found.' });

  const user = db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').get(req.user.id);
  const prescriptions = db.prepare(
    'SELECT * FROM prescriptions WHERE patient_id = ? AND is_active = 1 ORDER BY created_at DESC'
  ).all(patient.id);
  const latestRisk = db.prepare(
    'SELECT * FROM risk_assessments WHERE patient_id = ? ORDER BY assessed_at DESC LIMIT 1'
  ).get(patient.id);

  res.json({
    user,
    patient: { ...patient, postOpDay: calcPostOpDay(patient.surgery_date) },
    prescriptions,
    latestRiskAssessment: parseAssessment(latestRisk),
  });
});

// ── GET /api/patient/prescriptions ───────────────────────────────────────────
router.get('/prescriptions', (req, res) => {
  const patient = getPatient(req.user.id);
  if (!patient) return res.status(404).json({ error: 'Patient profile not found.' });

  const prescriptions = db.prepare(`
    SELECT pr.*, u.name AS doctor_name, d.specialty AS doctor_specialty
    FROM prescriptions pr
    JOIN doctors d ON d.id = pr.doctor_id
    JOIN users u ON u.id = d.user_id
    WHERE pr.patient_id = ?
    ORDER BY pr.is_active DESC, pr.created_at DESC
  `).all(patient.id);

  res.json({ prescriptions });
});

// ── GET /api/patient/checkins ─────────────────────────────────────────────────
router.get('/checkins', (req, res) => {
  const patient = getPatient(req.user.id);
  if (!patient) return res.status(404).json({ error: 'Patient profile not found.' });

  const limit = parseInt(req.query.limit, 10) || 30;
  const checkins = db.prepare(
    'SELECT * FROM daily_checkins WHERE patient_id = ? ORDER BY checkin_date DESC LIMIT ?'
  ).all(patient.id, limit);

  res.json({ checkins });
});

// ── POST /api/patient/checkins ────────────────────────────────────────────────
router.post('/checkins', async (req, res) => {
  const patient = getPatient(req.user.id);
  if (!patient) return res.status(404).json({ error: 'Patient profile not found.' });

  const today = new Date().toISOString().split('T')[0];
  const existing = db.prepare(
    'SELECT id FROM daily_checkins WHERE patient_id = ? AND checkin_date = ?'
  ).get(patient.id, today);
  if (existing) return res.status(409).json({ error: 'Already checked in for today.' });

  const {
    pain_score, medication_adherence, dose_timing,
    side_effects, craving_level, urge_level,
    mood_score, sleep_quality, notes,
  } = req.body;

  if (pain_score === undefined || medication_adherence === undefined) {
    return res.status(400).json({ error: 'pain_score and medication_adherence are required.' });
  }

  // Get active prescription for linking
  const prescription = db.prepare(
    'SELECT id FROM prescriptions WHERE patient_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1'
  ).get(patient.id);

  const result = db.prepare(`
    INSERT INTO daily_checkins
      (patient_id, prescription_id, checkin_date, medication_adherence, dose_timing,
       pain_score, side_effects, craving_level, urge_level, mood_score, sleep_quality,
       missed_checkin, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).run(
    patient.id,
    prescription?.id ?? null,
    today,
    medication_adherence ? 1 : 0,
    dose_timing || 'on-time',
    parseInt(pain_score, 10),
    side_effects || null,
    craving_level != null ? parseInt(craving_level, 10) : null,
    urge_level    != null ? parseInt(urge_level,    10) : null,
    mood_score    != null ? parseInt(mood_score,    10) : null,
    sleep_quality != null ? parseInt(sleep_quality, 10) : null,
    notes || null,
    new Date().toISOString()
  );

  const checkin = db.prepare('SELECT * FROM daily_checkins WHERE id = ?').get(result.lastInsertRowid);

  // Run AI assessment based on prescription + check-in history
  let assessment = null;
  try {
    assessment = await runAIAssessment(patient.id, db, checkin.id);
  } catch (err) {
    console.error('[patient/checkins] AI assessment error:', err.message);
    // Return the check-in even if AI fails
  }

  res.status(201).json({ checkin, assessment });
});

// ── GET /api/patient/risk-assessment ─────────────────────────────────────────
router.get('/risk-assessment', (req, res) => {
  const patient = getPatient(req.user.id);
  if (!patient) return res.status(404).json({ error: 'Patient profile not found.' });

  const assessment = db.prepare(
    'SELECT * FROM risk_assessments WHERE patient_id = ? ORDER BY assessed_at DESC LIMIT 1'
  ).get(patient.id);

  res.json({ assessment: parseAssessment(assessment) });
});

// ── GET /api/patient/guidance ─────────────────────────────────────────────────
router.get('/guidance', (req, res) => {
  const patient = getPatient(req.user.id);
  if (!patient) return res.status(404).json({ error: 'Patient profile not found.' });

  const assessment = db.prepare(
    'SELECT * FROM risk_assessments WHERE patient_id = ? ORDER BY assessed_at DESC LIMIT 1'
  ).get(patient.id);

  if (!assessment) return res.json({ level: 'low', guidance: [], summary: null });

  const parsed = parseAssessment(assessment);
  res.json({
    level: parsed.risk_level,
    guidance: parsed.patient_guidance,
    summary: parsed.summary,
    prescription_note: parsed.prescription_note,
  });
});

module.exports = router;
