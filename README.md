# CareArc

AI-assisted post-operative recovery monitoring system. Doctors manage prescriptions and monitor patient risk; patients submit daily check-ins that trigger GPT-4o clinical assessments.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, React Router v6, Recharts, Axios |
| Backend | Node.js, Express.js, JWT authentication |
| Database | SQLite (`node:sqlite` — built-in, no compilation required) |
| AI Engine | OpenAI GPT-4o (`response_format: json_object`) |

## Project Structure

```
CareArc/
├── backend/
│   ├── db/
│   │   ├── database.js       # Schema + DB initialization
│   │   └── seed.js           # Demo data (doctors, patients, prescriptions, check-ins)
│   ├── middleware/
│   │   └── auth.js           # JWT verification + role guard
│   ├── routes/
│   │   ├── auth.js           # POST /auth/login
│   │   ├── doctors.js        # Doctor API routes
│   │   └── patients.js       # Patient API routes
│   ├── services/
│   │   └── aiEngine.js       # GPT-4o assessment engine
│   ├── .env                  # OPENAI_API_KEY, JWT_SECRET, PORT
│   └── server.js             # Express entry point
└── frontend/
    └── src/
        ├── api/client.js     # Axios instance + all API calls
        ├── contexts/
        │   └── AuthContext.jsx
        ├── layouts/
        │   ├── DoctorLayout.jsx
        │   └── PatientLayout.jsx
        └── pages/
            ├── Login.jsx
            ├── doctor/
            │   ├── DoctorDashboard.jsx
            │   └── PatientDetail.jsx
            └── patient/
                ├── PatientDashboard.jsx
                ├── DailyCheckin.jsx
                └── MyPrescriptions.jsx
```

## Getting Started

### Prerequisites

- Node.js 22+ (uses built-in `node:sqlite`)
- OpenAI API key

### Backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```
OPENAI_API_KEY=sk-...
JWT_SECRET=your_secret_here
PORT=5001
```

Start the server (auto-seeds demo data on first run):

```bash
node server.js
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173`.

## Demo Accounts

All passwords: `password123`

| Role | Email | Patient | Risk Level |
|---|---|---|---|
| Doctor | dr.chen@hospital.com | — | — |
| Doctor | dr.martinez@hospital.com | — | — |
| Patient | john.smith@email.com | John Smith | High |
| Patient | sarah.johnson@email.com | Sarah Johnson | Medium |
| Patient | mike.wilson@email.com | Mike Wilson | Low |
| Patient | emily.davis@email.com | Emily Davis | Medium |
| Patient | robert.brown@email.com | Robert Brown | High |
| Patient | lisa.anderson@email.com | Lisa Anderson | Low |

## AI Assessment

Each daily patient check-in triggers a GPT-4o assessment. Doctors can also manually trigger assessments from the patient detail page.

The AI receives:
- Patient demographics and surgery type
- Full prescription details (medication, dosage, frequency, duration)
- Doctor's clinical monitoring notes (primary context for the AI)
- Last 14 days of check-in data (pain scores, adherence, mood, sleep, side effects)

The AI returns:

| Field | Description |
|---|---|
| `risk_level` | `low` / `medium` / `high` |
| `risk_score` | 0–100 integer |
| `summary` | 2–3 sentence clinical summary |
| `risk_factors` | List of specific concerns |
| `alert_flags` | Structured flags (e.g. `high_pain`, `low_adherence`, `missed_checkins`) |
| `recommendations` | Actionable steps for the doctor |
| `patient_guidance` | Empathetic messages written directly to the patient |
| `prescription_note` | One sentence on prescription adherence |

## API Reference

### Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/login` | Login (returns JWT + user object) |

### Doctor Routes (require `Authorization: Bearer <token>`)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/doctor/patients` | List all patients sorted by risk |
| GET | `/doctor/patients/:id` | Patient profile |
| GET | `/doctor/patients/:id/prescriptions` | List prescriptions |
| POST | `/doctor/patients/:id/prescriptions` | Create prescription |
| PUT | `/doctor/prescriptions/:prescId` | Update prescription |
| GET | `/doctor/patients/:id/assessments` | List AI assessments |
| POST | `/doctor/patients/:id/assess` | Trigger GPT-4o assessment |
| GET | `/doctor/patients/:id/notes` | List clinical notes |
| POST | `/doctor/patients/:id/notes` | Add clinical note |
| GET | `/doctor/patients/:id/follow-ups` | List follow-up actions |
| POST | `/doctor/patients/:id/follow-up` | Create follow-up action |
| PUT | `/doctor/patients/:id/follow-ups/:actionId/complete` | Mark complete |

### Patient Routes (require `Authorization: Bearer <token>`)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/patient/profile` | Patient profile |
| GET | `/patient/prescriptions` | List prescriptions |
| GET | `/patient/checkins` | Check-in history |
| POST | `/patient/checkins` | Submit check-in (triggers AI assessment) |
| GET | `/patient/risk-assessment` | Latest AI assessment |
| GET | `/patient/guidance` | Patient-facing AI guidance |

## Workflow

### Doctor

1. Log in → Doctor Dashboard (patients sorted by AI risk score)
2. Click a patient → Patient Detail (5 tabs)
3. **Overview tab**: Create/edit prescription, view latest AI assessment, trigger manual assessment
4. **Check-in History**: View all patient check-ins with trend charts
5. **AI Assessments**: Full history of GPT-4o assessments with risk factors and recommendations
6. **Clinical Notes**: Add free-text clinical observations
7. **Follow-up Actions**: Create tasks, mark them complete

### Patient

1. Log in → Patient Dashboard (AI risk card, active prescription, quick stats)
2. **Daily Check-in**: Submit pain score, medication adherence, mood, sleep, side effects — triggers AI assessment
3. **My Prescriptions**: View doctor-issued prescriptions with days remaining
