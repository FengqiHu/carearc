'use strict';

const bcrypt = require('bcryptjs');
const db = require('./database');

function dateOffset(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function seed() {
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
  if (existing.cnt > 0) {
    console.log('[seed] Already seeded. Skipping.');
    return;
  }

  console.log('[seed] Seeding database...');
  const pw = bcrypt.hashSync('password123', 10);

  // ── Doctors ──────────────────────────────────────────────────────────────
  const insUser = db.prepare(
    'INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?)'
  );
  const insDoctor = db.prepare(
    'INSERT INTO doctors (user_id, specialty, license_number) VALUES (?, ?, ?)'
  );

  const drChenUid   = insUser.run('sarah.chen@carearc.com',    pw, 'doctor', 'Dr. Sarah Chen').lastInsertRowid;
  const drChenId    = insDoctor.run(drChenUid, 'Orthopedic Surgery', 'MD-001-CHEN').lastInsertRowid;

  const drTorresUid = insUser.run('michael.torres@carearc.com', pw, 'doctor', 'Dr. Michael Torres').lastInsertRowid;
  const drTorresId  = insDoctor.run(drTorresUid, 'Pain Management', 'MD-002-TORR').lastInsertRowid;

  console.log('[seed] Doctors created.');

  // ── Patients ──────────────────────────────────────────────────────────────
  const insPatient = db.prepare(
    `INSERT INTO patients (user_id, doctor_id, age, sex, surgery_type, surgery_date)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const patientDefs = [
    { email: 'john.smith@email.com',  name: 'John Smith',     doctorId: drChenId,   age: 58, sex: 'male',   surgery: 'Total Knee Replacement', daysAgo: 20, risk: 'high'   },
    { email: 'emily.j@email.com',     name: 'Emily Johnson',  doctorId: drChenId,   age: 45, sex: 'female', surgery: 'Hip Replacement',         daysAgo: 14, risk: 'medium' },
    { email: 'robert.d@email.com',    name: 'Robert Davis',   doctorId: drChenId,   age: 62, sex: 'male',   surgery: 'Shoulder Repair',         daysAgo: 35, risk: 'low'    },
    { email: 'maria.g@email.com',     name: 'Maria Garcia',   doctorId: drTorresId, age: 41, sex: 'female', surgery: 'Spinal Fusion',           daysAgo: 12, risk: 'high'   },
    { email: 'james.w@email.com',     name: 'James Wilson',   doctorId: drTorresId, age: 55, sex: 'male',   surgery: 'ACL Reconstruction',      daysAgo:  8, risk: 'medium' },
    { email: 'lisa.c@email.com',      name: 'Lisa Chen',      doctorId: drTorresId, age: 38, sex: 'female', surgery: 'Rotator Cuff Repair',     daysAgo: 45, risk: 'low'    },
  ];

  const patients = patientDefs.map(p => {
    const uid = insUser.run(p.email, pw, 'patient', p.name).lastInsertRowid;
    const pid = insPatient.run(uid, p.doctorId, p.age, p.sex, p.surgery, dateOffset(p.daysAgo)).lastInsertRowid;
    return { ...p, id: pid };
  });

  const [john, emily, robert, maria, james, lisa] = patients;
  console.log('[seed] Patients created.');

  // ── Prescriptions (doctor-created, with AI monitoring context) ──────────
  const insPrescription = db.prepare(
    `INSERT INTO prescriptions
       (doctor_id, patient_id, medication_name, dosage, frequency, duration_days,
        start_date, total_pills, refills_allowed, instructions, monitoring_notes, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  );

  const prescriptionDefs = [
    {
      doctorId: drChenId, patient: john,
      med: 'Oxycodone', dosage: '5mg', freq: 'Every 6 hours as needed for pain',
      days: 30, pills: 120, refills: 0,
      instructions: 'Take with food. Do not drive or operate machinery. Do not combine with alcohol.',
      monitoring: 'Patient is 58M post total knee replacement. Monitor closely for escalating dose requests, early refill attempts, and rising craving/urge scores — prior surgery patients in this age group carry elevated dependency risk. Flag if pain scores fail to decrease by post-op week 4 or if urge level exceeds 7 on two consecutive days.',
    },
    {
      doctorId: drChenId, patient: emily,
      med: 'Hydrocodone/Acetaminophen', dosage: '5mg/325mg', freq: 'Every 4-6 hours as needed',
      days: 14, pills: 56, refills: 0,
      instructions: 'Do not exceed 4g acetaminophen per day from all sources. Taper off after day 10.',
      monitoring: 'Patient is 45F post hip replacement, first-time opioid prescription. Baseline pain expected to decline steadily. Alert if pain is not trending down by day 10, or if patient requests early refill. Watch for irregular dosing patterns which may indicate misuse or overuse.',
    },
    {
      doctorId: drChenId, patient: robert,
      med: 'Ibuprofen', dosage: '600mg', freq: 'Three times daily with meals',
      days: 21, pills: 63, refills: 1,
      instructions: 'Take with food or milk to avoid GI upset. Avoid NSAIDs from other sources.',
      monitoring: 'Patient is 62M post shoulder repair, using NSAID-only protocol — good candidate given no opioid need. Monitor pain levels to confirm NSAID sufficiency. If pain scores remain above 5 after day 14, consider reassessment. Low dependency risk profile.',
    },
    {
      doctorId: drTorresId, patient: maria,
      med: 'Oxycodone', dosage: '10mg', freq: 'Every 8 hours',
      days: 30, pills: 90, refills: 0,
      instructions: 'Strictly scheduled dosing — do not take extra doses. Store securely.',
      monitoring: 'Patient is 41F post spinal fusion, higher-dose opioid regimen. CRITICAL: Patient verbally disclosed anxiety about managing pain at home. Monitor daily for craving/urge scores above 6, any mention of taking extra doses, irregular timing, or sharp pill count discrepancies. Immediate escalation if urge score exceeds 8 or pill count drops faster than prescribed rate. Family support is limited.',
    },
    {
      doctorId: drTorresId, patient: maria,
      med: 'Cyclobenzaprine', dosage: '10mg', freq: 'Three times daily for muscle spasms',
      days: 14, pills: 42, refills: 0,
      instructions: 'May cause drowsiness. Do not combine with alcohol or other CNS depressants.',
      monitoring: 'Adjunct muscle relaxant alongside Oxycodone for Maria Garcia. Monitor for sedation signs (very low mood scores, very low sleep quality paradoxically). Report if patient notes feeling overly sedated.',
    },
    {
      doctorId: drTorresId, patient: james,
      med: 'Tramadol', dosage: '50mg', freq: 'Every 6 hours as needed',
      days: 14, pills: 56, refills: 0,
      instructions: 'Do not exceed 400mg per day. Avoid in patients with seizure history.',
      monitoring: 'Patient is 55M post ACL reconstruction, moderate opioid prescription. Expected recovery is good. Monitor for adherence consistency and pain trajectory — ACL recovery is typically linear. Flag if patient takes more than prescribed on consecutive days or if mood/sleep scores both drop below 4.',
    },
    {
      doctorId: drTorresId, patient: lisa,
      med: 'Ibuprofen', dosage: '400mg', freq: 'Twice daily with meals',
      days: 14, pills: 28, refills: 1,
      instructions: 'Take with food. Can switch to OTC dose once pain is manageable.',
      monitoring: 'Patient is 38F post rotator cuff repair, NSAID-only protocol. Recovery is expected to be straightforward. Low monitoring priority — flag only if pain scores are not declining or if patient reports unexpected side effects.',
    },
  ];

  const prescriptionIds = {};
  for (const p of prescriptionDefs) {
    const pid = insPrescription.run(
      p.doctorId, p.patient.id,
      p.med, p.dosage, p.freq, p.days,
      dateOffset(p.patient.daysAgo), p.pills, p.refills,
      p.instructions, p.monitoring
    ).lastInsertRowid;
    // Track primary prescription per patient (first one)
    if (!prescriptionIds[p.patient.id]) prescriptionIds[p.patient.id] = pid;
  }

  console.log('[seed] Prescriptions created.');

  // ── Daily check-ins (30 days per patient) ────────────────────────────────
  const insCheckin = db.prepare(
    `INSERT INTO daily_checkins
       (patient_id, prescription_id, checkin_date, medication_adherence, dose_timing,
        pain_score, side_effects, craving_level, urge_level, mood_score, sleep_quality,
        missed_checkin, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  function seedCheckins(patient, risk) {
    const prescId = prescriptionIds[patient.id];
    const missedDays = risk === 'high'   ? new Set([3, 7, 11, 15, 19, 24])
                     : risk === 'medium' ? new Set([5, 12, 21])
                     :                    new Set([17]);

    for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
      const date = dateOffset(daysAgo);
      const ts   = new Date(Date.now() - daysAgo * 86400000).toISOString();

      if (missedDays.has(daysAgo)) {
        insCheckin.run(patient.id, prescId, date, 0, 'missed',
          null, null, null, null, null, null, 1, null, ts);
        continue;
      }

      const progress = (29 - daysAgo) / 29;
      let pain, adherence, timing, sideEffects, craving, urge, mood, sleep, notes;

      if (risk === 'high') {
        pain       = clamp(Math.round(6 + progress * 3 + (Math.random() - 0.3)), 4, 10);
        adherence  = Math.random() < 0.65 ? 1 : 0;
        timing     = Math.random() < 0.35 ? 'missed' : Math.random() < 0.65 ? 'late' : 'on-time';
        sideEffects = Math.random() < 0.5 ? (Math.random() < 0.5 ? 'nausea' : 'dizziness') : null;
        craving    = clamp(Math.round(6 + Math.random() * 3), 0, 10);
        urge       = clamp(Math.round(6 + Math.random() * 3), 0, 10);
        mood       = clamp(Math.round(3 + Math.random() * 2), 0, 10);
        sleep      = clamp(Math.round(3 + Math.random() * 2), 0, 10);
        notes      = Math.random() < 0.3 ? 'Struggling with pain today.' : null;
      } else if (risk === 'medium') {
        pain       = clamp(Math.round(4 + progress * 2 + (Math.random() - 0.5)), 2, 8);
        adherence  = Math.random() < 0.80 ? 1 : 0;
        timing     = Math.random() < 0.75 ? 'on-time' : 'late';
        sideEffects = Math.random() < 0.2 ? 'mild nausea' : null;
        craving    = clamp(Math.round(3 + Math.random() * 2), 0, 10);
        urge       = clamp(Math.round(3 + Math.random() * 2), 0, 10);
        mood       = clamp(Math.round(5 + Math.random() * 2), 0, 10);
        sleep      = clamp(Math.round(5 + Math.random() * 2), 0, 10);
        notes      = null;
      } else {
        pain       = clamp(Math.round(4 - progress * 3 + (Math.random() - 0.5)), 0, 5);
        adherence  = Math.random() < 0.95 ? 1 : 0;
        timing     = 'on-time';
        sideEffects = null;
        craving    = clamp(Math.round(Math.random() * 2), 0, 10);
        urge       = clamp(Math.round(Math.random() * 2), 0, 10);
        mood       = clamp(Math.round(7 + Math.random() * 2), 0, 10);
        sleep      = clamp(Math.round(7 + Math.random() * 2), 0, 10);
        notes      = Math.random() < 0.1 ? 'Feeling much better today.' : null;
      }

      insCheckin.run(patient.id, prescId, date, adherence, timing,
        pain, sideEffects, craving, urge, mood, sleep, 0, notes, ts);
    }
  }

  for (const [p, risk] of [[john,'high'],[emily,'medium'],[robert,'low'],[maria,'high'],[james,'medium'],[lisa,'low']]) {
    seedCheckins(p, risk);
  }
  console.log('[seed] Check-ins created.');

  // ── Clinical notes ────────────────────────────────────────────────────────
  const insNote = db.prepare(
    `INSERT INTO clinical_notes (doctor_id, patient_id, note_type, content, created_at)
     VALUES (?, ?, ?, ?, ?)`
  );
  const notes = [
    { d: drChenId,   p: john.id,   t: 'progress',   c: 'Patient reports significant post-op pain. Adherence concerns noted. Discussing importance of consistent dosing.',     ago: 18 },
    { d: drChenId,   p: john.id,   t: 'concern',    c: 'Multiple missed doses reported. Called patient. High urge/craving scores emerging — monitoring closely.',            ago: 10 },
    { d: drChenId,   p: john.id,   t: 'follow_up',  c: 'Discussing referral to addiction medicine given persistent urge scores. Family notified.',                            ago:  3 },
    { d: drChenId,   p: emily.id,  t: 'progress',   c: 'Hip replacement recovery progressing. Pain fluctuation noted, adherence generally good.',                            ago: 12 },
    { d: drChenId,   p: emily.id,  t: 'note',       c: 'Advised patient: contact clinic if pain exceeds 7/10 on two consecutive days.',                                     ago:  2 },
    { d: drChenId,   p: robert.id, t: 'progress',   c: 'Excellent recovery. Pain scores declining as expected. NSAID protocol working well.',                               ago: 10 },
    { d: drTorresId, p: maria.id,  t: 'concern',    c: 'Patient admitted to extra dose use on two occasions. Pill count discrepancy confirmed. Urgent review triggered.',   ago:  5 },
    { d: drTorresId, p: maria.id,  t: 'follow_up',  c: 'Contacted patient. Engaging family support. Referred to pain psychologist. Daily AI monitoring escalated.',         ago:  1 },
    { d: drTorresId, p: james.id,  t: 'progress',   c: 'ACL recovery on track. Some missed check-ins noted — encouraged consistency.',                                      ago:  6 },
    { d: drTorresId, p: lisa.id,   t: 'progress',   c: 'Rotator cuff healing well. Near end of medication course. Patient essentially pain-free.',                          ago: 14 },
  ];
  for (const n of notes) {
    insNote.run(n.d, n.p, n.t, n.c,
      new Date(Date.now() - n.ago * 86400000).toISOString());
  }
  console.log('[seed] Clinical notes created.');

  // ── Follow-up actions ─────────────────────────────────────────────────────
  const insFollowUp = db.prepare(
    `INSERT INTO follow_up_actions (doctor_id, patient_id, action_type, notes, completed, completed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const followUps = [
    { d: drChenId,   p: john.id,  t: 'contact_patient',          n: 'Call to discuss missed doses and high urge scores. Assess dependency risk.',        done: 0, ago: 3 },
    { d: drChenId,   p: john.id,  t: 'pharmacist_review',        n: 'Request pharmacist medication review given irregular adherence pattern.',            done: 0, ago: 2 },
    { d: drTorresId, p: maria.id, t: 'urgent_review',            n: 'In-clinic urgent review — extra dose use confirmed.',                               done: 0, ago: 5 },
    { d: drTorresId, p: maria.id, t: 'contact_patient',          n: 'Daily check-in call until next appointment.',                                       done: 1, ago: 2 },
    { d: drChenId,   p: emily.id, t: 'schedule_followup',        n: 'Schedule 48-hour follow-up to check pain trajectory.',                              done: 0, ago: 2 },
  ];
  for (const f of followUps) {
    insFollowUp.run(f.d, f.p, f.t, f.n, f.done,
      f.done ? new Date(Date.now() - 86400000).toISOString() : null,
      new Date(Date.now() - f.ago * 86400000).toISOString());
  }
  console.log('[seed] Follow-up actions created.');
  console.log('[seed] Done.');
}

if (require.main === module) seed();
module.exports = seed;
