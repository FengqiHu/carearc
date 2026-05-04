'use strict';

const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, 'carearc.db');
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL CHECK(role IN ('patient', 'doctor')),
    name          TEXT    NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS doctors (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    specialty      TEXT    NOT NULL,
    license_number TEXT
  );

  CREATE TABLE IF NOT EXISTS patients (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    doctor_id    INTEGER REFERENCES doctors(id) ON DELETE SET NULL,
    age          INTEGER,
    sex          TEXT,
    surgery_type TEXT,
    surgery_date TEXT
  );

  CREATE TABLE IF NOT EXISTS prescriptions (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    doctor_id         INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    patient_id        INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    medication_name   TEXT    NOT NULL,
    dosage            TEXT    NOT NULL,
    frequency         TEXT    NOT NULL,
    duration_days     INTEGER NOT NULL,
    start_date        TEXT    NOT NULL,
    total_pills       INTEGER,
    refills_allowed   INTEGER DEFAULT 0,
    instructions      TEXT,
    monitoring_notes  TEXT,
    is_active         INTEGER NOT NULL DEFAULT 1,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS daily_checkins (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id           INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    prescription_id      INTEGER REFERENCES prescriptions(id) ON DELETE SET NULL,
    checkin_date         DATE    NOT NULL,
    medication_adherence INTEGER NOT NULL DEFAULT 1,
    dose_timing          TEXT,
    pain_score           INTEGER CHECK(pain_score BETWEEN 0 AND 10),
    side_effects         TEXT,
    craving_level        INTEGER CHECK(craving_level BETWEEN 0 AND 10),
    urge_level           INTEGER CHECK(urge_level BETWEEN 0 AND 10),
    mood_score           INTEGER CHECK(mood_score BETWEEN 0 AND 10),
    sleep_quality        INTEGER CHECK(sleep_quality BETWEEN 0 AND 10),
    missed_checkin       INTEGER NOT NULL DEFAULT 0,
    notes                TEXT,
    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS risk_assessments (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id       INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    checkin_id       INTEGER REFERENCES daily_checkins(id) ON DELETE SET NULL,
    risk_level       TEXT    NOT NULL CHECK(risk_level IN ('low', 'medium', 'high')),
    risk_score       INTEGER NOT NULL,
    summary          TEXT,
    risk_factors     TEXT,
    alert_flags      TEXT,
    recommendations  TEXT,
    patient_guidance TEXT,
    prescription_note TEXT,
    model_used       TEXT,
    assessed_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS clinical_notes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    doctor_id  INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    note_type  TEXT,
    content    TEXT    NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS follow_up_actions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    doctor_id    INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    patient_id   INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    action_type  TEXT    NOT NULL,
    notes        TEXT,
    completed    INTEGER NOT NULL DEFAULT 0,
    completed_at DATETIME,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

module.exports = db;
