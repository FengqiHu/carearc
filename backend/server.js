'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------
const app = express();
const PORT = process.env.PORT || 5001;

// CORS: allow Vite dev server
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
const authRouter    = require('./routes/auth');
const patientRouter = require('./routes/patients');
const doctorRouter  = require('./routes/doctors');

app.use('/api/auth',    authRouter);
app.use('/api/patient', patientRouter);
app.use('/api/doctor',  doctorRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[error]', err.stack || err.message);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal server error.',
  });
});

// ---------------------------------------------------------------------------
// Startup: auto-seed if database is empty
// ---------------------------------------------------------------------------
function startServer() {
  const db   = require('./db/database');
  const seed = require('./db/seed');

  const { cnt } = db.prepare('SELECT COUNT(*) AS cnt FROM users').get();

  if (cnt === 0) {
    console.log('[server] Empty database detected — running seed...');
    try {
      seed();
    } catch (err) {
      console.error('[server] Seed failed:', err.message);
    }
  } else {
    console.log(`[server] Database already contains ${cnt} user(s). Skipping seed.`);
  }

  app.listen(PORT, () => {
    console.log(`[server] CareArc backend running on http://localhost:${PORT}`);
    console.log(`[server] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('[server] Routes:');
    console.log('         POST  /api/auth/login');
    console.log('         GET   /api/auth/me');
    console.log('         GET   /api/patient/*');
    console.log('         GET   /api/doctor/*');
  });
}

startServer();

module.exports = app; // exported for testing
