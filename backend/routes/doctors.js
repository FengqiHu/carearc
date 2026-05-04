'use strict';

const express = require('express');
const db = require('../db/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { runAIAssessment, parseAssessment } = require('../services/aiEngine');

const router = express.Router();
router.use(authenticateToken, requireRole('doctor'));

function getDoctor(userId) {
  return db.prepare('SELECT * FROM doctors WHERE user_id = ?').get(userId);
}

function parseJson(str, fallback = []) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

function calcPostOpDay(surgeryDate) {
  if (!surgeryDate) return null;
  return Math.floor((Date.now() - new Date(surgeryDate).getTime()) / 86400000);
}

function assertOwnsPatient(patientId, doctorId, res) {
  const p = db.prepare('SELECT * FROM patients WHERE id = ? AND doctor_id = ?').get(patientId, doctorId);
  if (!p) { res.status(403).json({ error: 'Patient not found or not in your practice.' }); return null; }
  return p;
}

// ── GET /api/doctor/patients ─────────────────────────────────────────────────
router.get('/patients', (req, res) => {
  const doctor = getDoctor(req.user.id);
  if (!doctor) return res.status(404).json({ error: 'Doctor profile not found.' });

  const patients = db.prepare(`
    SELECT p.*, u.name, u.email
    FROM patients p JOIN users u ON u.id = p.user_id
    WHERE p.doctor_id = ?
  `).all(doctor.id);

  const enriched = patients.map(p => {
    const risk = db.prepare(
      'SELECT * FROM risk_assessments WHERE patient_id = ? ORDER BY assessed_at DESC LIMIT 1'
    ).get(p.id);
    const prescription = db.prepare(
      'SELECT * FROM prescriptions WHERE patient_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1'
    ).get(p.id);
    return {
      ...p,
      postOpDay: calcPostOpDay(p.surgery_date),
      latestRiskAssessment: parseAssessment(risk),
      activePrescription: prescription || null,
    };
  });

  const ORDER = { high: 0, medium: 1, low: 2 };
  enriched.sort((a, b) => {
    const al = a.latestRiskAssessment?.risk_level ?? 'low';
    const bl = b.latestRiskAssessment?.risk_level ?? 'low';
    return (ORDER[al] ?? 3) - (ORDER[bl] ?? 3);
  });

  res.json({ patients: enriched });
});

// ── GET /api/doctor/patients/:id/profile ─────────────────────────────────────
router.get('/patients/:id/profile', (req, res) => {
  const doctor = getDoctor(req.user.id);
  if (!doctor) return res.status(404).json({ error: 'Doctor profile not found.' });
  const patient = assertOwnsPatient(Number(req.params.id), doctor.id, res);
  if (!patient) return;

  const user = db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').get(patient.user_id);
  const prescriptions = db.prepare(
    'SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY is_active DESC, created_at DESC'
  ).all(patient.id);
  const risk = db.prepare(
    'SELECT * FROM risk_assessments WHERE patient_id = ? ORDER BY assessed_at DESC LIMIT 1'
  ).get(patient.id);
  const recentCheckins = db.prepare(
    'SELECT * FROM daily_checkins WHERE patient_id = ? ORDER BY checkin_date DESC LIMIT 7'
  ).all(patient.id);

  res.json({
    user,
    patient: { ...patient, postOpDay: calcPostOpDay(patient.surgery_date) },
    prescriptions,
    recentCheckins,
    latestRiskAssessment: parseAssessment(risk),
  });
});

// ── GET /api/doctor/patients/:id/checkins ─────────────────────────────────────
router.get('/patients/:id/checkins', (req, res) => {
  const doctor = getDoctor(req.user.id);
  if (!doctor) return res.status(404).json({ error: 'Doctor profile not found.' });
  const patient = assertOwnsPatient(Number(req.params.id), doctor.id, res);
  if (!patient) return;

  const limit = parseInt(req.query.limit, 10) || 30;
  const checkins = db.prepare(
    'SELECT * FROM daily_checkins WHERE patient_id = ? ORDER BY checkin_date DESC LIMIT ?'
  ).all(patient.id, limit);

  res.json({ checkins });
});

// ── GET /api/doctor/patients/:id/risk ────────────────────────────────────────
router.get('/patients/:id/risk', (req, res) => {
  const doctor = getDoctor(req.user.id);
  if (!doctor) return res.status(404).json({ error: 'Doctor profile not found.' });
  const patient = assertOwnsPatient(Number(req.params.id), doctor.id, res);
  if (!patient) return;

  const assessments = db.prepare(
    'SELECT * FROM risk_assessments WHERE patient_id = ? ORDER BY assessed_at DESC LIMIT 5'
  ).all(patient.id);

  res.json({ assessments: assessments.map(parseAssessment) });
});

// ── POST /api/doctor/patients/:id/assess ─────────────────────────────────────
router.post('/patients/:id/assess', async (req, res) => {
  const doctor = getDoctor(req.user.id);
  if (!doctor) return res.status(404).json({ error: 'Doctor profile not found.' });
  const patient = assertOwnsPatient(Number(req.params.id), doctor.id, res);
  if (!patient) return;

  try {
    const assessment = await runAIAssessment(patient.id, db);
    res.json({ assessment });
  } catch (err) {
    console.error('[doctor/assess]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/doctor/patients/:id/prescriptions ───────────────────────────────
router.get('/patients/:id/prescriptions', (req, res) => {
  const doctor = getDoctor(req.user.id);
  if (!doctor) return res.status(404).json({ error: 'Doctor profile not found.' });
  const patient = assertOwnsPatient(Number(req.params.id), doctor.id, res);
  if (!patient) return;

  const prescriptions = db.prepare(
    'SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY is_active DESC, created_at DESC'
  ).all(patient.id);

  res.json({ prescriptions });
});

// ── POST /api/doctor/patients/:id/prescriptions ──────────────────────────────
router.post('/patients/:id/prescriptions', (req, res) => {
  const doctor = getDoctor(req.user.id);
  if (!doctor) return res.status(404).json({ error: 'Doctor profile not found.' });
  const patient = assertOwnsPatient(Number(req.params.id), doctor.id, res);
  if (!patient) return;

  const {
    medication_name, dosage, frequency, duration_days,
    start_date, total_pills, refills_allowed,
    instructions, monitoring_notes,
  } = req.body;

  if (!medication_name || !dosage || !frequency || !duration_days || !start_date) {
    return res.status(400).json({ error: 'medication_name, dosage, frequency, duration_days, and start_date are required.' });
  }

  const result = db.prepare(`
    INSERT INTO prescriptions
      (doctor_id, patient_id, medication_name, dosage, frequency, duration_days,
       start_date, total_pills, refills_allowed, instructions, monitoring_notes, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    doctor.id, patient.id,
    medication_name.trim(), dosage.trim(), frequency.trim(),
    Number(duration_days), start_date,
    total_pills ? Number(total_pills) : null,
    refills_allowed ? Number(refills_allowed) : 0,
    instructions?.trim() || null,
    monitoring_notes?.trim() || null,
  );

  const prescription = db.prepare('SELECT * FROM prescriptions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ prescription });
});

// ── PUT /api/doctor/prescriptions/:prescId ───────────────────────────────────
router.put('/prescriptions/:prescId', (req, res) => {
  const doctor = getDoctor(req.user.id);
  if (!doctor) return res.status(404).json({ error: 'Doctor profile not found.' });

  const presc = db.prepare(
    'SELECT * FROM prescriptions WHERE id = ? AND doctor_id = ?'
  ).get(Number(req.params.prescId), doctor.id);
  if (!presc) return res.status(404).json({ error: 'Prescription not found.' });

  const {
    medication_name, dosage, frequency, duration_days,
    start_date, total_pills, refills_allowed,
    instructions, monitoring_notes, is_active,
  } = req.body;

  db.prepare(`
    UPDATE prescriptions SET
      medication_name  = COALESCE(?, medication_name),
      dosage           = COALESCE(?, dosage),
      frequency        = COALESCE(?, frequency),
      duration_days    = COALESCE(?, duration_days),
      start_date       = COALESCE(?, start_date),
      total_pills      = COALESCE(?, total_pills),
      refills_allowed  = COALESCE(?, refills_allowed),
      instructions     = COALESCE(?, instructions),
      monitoring_notes = COALESCE(?, monitoring_notes),
      is_active        = COALESCE(?, is_active)
    WHERE id = ?
  `).run(
    medication_name || null, dosage || null, frequency || null,
    duration_days != null ? Number(duration_days) : null,
    start_date || null,
    total_pills != null ? Number(total_pills) : null,
    refills_allowed != null ? Number(refills_allowed) : null,
    instructions ?? null, monitoring_notes ?? null,
    is_active != null ? (is_active ? 1 : 0) : null,
    presc.id,
  );

  const updated = db.prepare('SELECT * FROM prescriptions WHERE id = ?').get(presc.id);
  res.json({ prescription: updated });
});

// ── POST /api/doctor/patients/:id/notes ──────────────────────────────────────
router.post('/patients/:id/notes', (req, res) => {
  const doctor = getDoctor(req.user.id);
  if (!doctor) return res.status(404).json({ error: 'Doctor profile not found.' });
  const patient = assertOwnsPatient(Number(req.params.id), doctor.id, res);
  if (!patient) return;

  const { note_type, content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Note content is required.' });

  const result = db.prepare(`
    INSERT INTO clinical_notes (doctor_id, patient_id, note_type, content, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(doctor.id, patient.id, note_type || 'note', content.trim(), new Date().toISOString());

  const note = db.prepare('SELECT * FROM clinical_notes WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ note });
});

// ── GET /api/doctor/patients/:id/notes ───────────────────────────────────────
router.get('/patients/:id/notes', (req, res) => {
  const doctor = getDoctor(req.user.id);
  if (!doctor) return res.status(404).json({ error: 'Doctor profile not found.' });
  const patient = assertOwnsPatient(Number(req.params.id), doctor.id, res);
  if (!patient) return;

  const notes = db.prepare(`
    SELECT cn.*, u.name AS doctor_name
    FROM clinical_notes cn
    JOIN doctors d ON d.id = cn.doctor_id
    JOIN users u ON u.id = d.user_id
    WHERE cn.patient_id = ?
    ORDER BY cn.created_at DESC
  `).all(patient.id);

  res.json({ notes });
});

// ── POST /api/doctor/patients/:id/follow-up ──────────────────────────────────
router.post('/patients/:id/follow-up', (req, res) => {
  const doctor = getDoctor(req.user.id);
  if (!doctor) return res.status(404).json({ error: 'Doctor profile not found.' });
  const patient = assertOwnsPatient(Number(req.params.id), doctor.id, res);
  if (!patient) return;

  const { action_type, notes } = req.body;
  if (!action_type?.trim()) return res.status(400).json({ error: 'action_type is required.' });

  const result = db.prepare(`
    INSERT INTO follow_up_actions (doctor_id, patient_id, action_type, notes, completed, created_at)
    VALUES (?, ?, ?, ?, 0, ?)
  `).run(doctor.id, patient.id, action_type.trim(), notes || null, new Date().toISOString());

  const action = db.prepare('SELECT * FROM follow_up_actions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ action });
});

// ── GET /api/doctor/patients/:id/follow-ups ──────────────────────────────────
router.get('/patients/:id/follow-ups', (req, res) => {
  const doctor = getDoctor(req.user.id);
  if (!doctor) return res.status(404).json({ error: 'Doctor profile not found.' });
  const patient = assertOwnsPatient(Number(req.params.id), doctor.id, res);
  if (!patient) return;

  const actions = db.prepare(`
    SELECT fa.*, u.name AS doctor_name
    FROM follow_up_actions fa
    JOIN doctors d ON d.id = fa.doctor_id
    JOIN users u ON u.id = d.user_id
    WHERE fa.patient_id = ?
    ORDER BY fa.created_at DESC
  `).all(patient.id);

  res.json({ actions });
});

// ── PUT /api/doctor/patients/:id/follow-ups/:actionId/complete ───────────────
router.put('/patients/:id/follow-ups/:actionId/complete', (req, res) => {
  const doctor = getDoctor(req.user.id);
  if (!doctor) return res.status(404).json({ error: 'Doctor profile not found.' });
  const patient = assertOwnsPatient(Number(req.params.id), doctor.id, res);
  if (!patient) return;

  const action = db.prepare(
    'SELECT * FROM follow_up_actions WHERE id = ? AND patient_id = ? AND doctor_id = ?'
  ).get(Number(req.params.actionId), patient.id, doctor.id);
  if (!action) return res.status(404).json({ error: 'Follow-up action not found.' });
  if (action.completed) return res.status(409).json({ error: 'Already completed.' });

  const now = new Date().toISOString();
  db.prepare('UPDATE follow_up_actions SET completed = 1, completed_at = ? WHERE id = ?').run(now, action.id);
  const updated = db.prepare('SELECT * FROM follow_up_actions WHERE id = ?').get(action.id);
  res.json({ action: updated });
});

module.exports = router;
