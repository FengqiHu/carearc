import axios from 'axios'

const apiClient = axios.create({
  baseURL: 'http://localhost:5001/api',
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use(config => {
  const token = localStorage.getItem('carearc_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

apiClient.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('carearc_token')
      localStorage.removeItem('carearc_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const auth = {
  login:  (email, password) => apiClient.post('/auth/login', { email, password }),
  getMe:  ()               => apiClient.get('/auth/me'),
}

export const patient = {
  getProfile:       ()           => apiClient.get('/patient/profile'),
  getPrescriptions: ()           => apiClient.get('/patient/prescriptions'),
  getCheckins:      (limit = 30) => apiClient.get(`/patient/checkins?limit=${limit}`),
  submitCheckin:    (data)       => apiClient.post('/patient/checkins', data),
  getRiskAssessment:()           => apiClient.get('/patient/risk-assessment'),
  getGuidance:      ()           => apiClient.get('/patient/guidance'),
}

export const doctor = {
  getPatients:         ()                   => apiClient.get('/doctor/patients'),
  getPatientProfile:   (id)                 => apiClient.get(`/doctor/patients/${id}/profile`),
  getPatientCheckins:  (id, limit = 30)     => apiClient.get(`/doctor/patients/${id}/checkins?limit=${limit}`),
  getPatientRisk:      (id)                 => apiClient.get(`/doctor/patients/${id}/risk`),
  triggerAssessment:   (id)                 => apiClient.post(`/doctor/patients/${id}/assess`),
  // Prescriptions
  getPrescriptions:    (id)                 => apiClient.get(`/doctor/patients/${id}/prescriptions`),
  createPrescription:  (id, data)           => apiClient.post(`/doctor/patients/${id}/prescriptions`, data),
  updatePrescription:  (prescId, data)      => apiClient.put(`/doctor/prescriptions/${prescId}`, data),
  // Notes
  addNote:             (id, data)           => apiClient.post(`/doctor/patients/${id}/notes`, data),
  getNotes:            (id)                 => apiClient.get(`/doctor/patients/${id}/notes`),
  // Follow-ups
  addFollowUp:         (id, data)           => apiClient.post(`/doctor/patients/${id}/follow-up`, data),
  getFollowUps:        (id)                 => apiClient.get(`/doctor/patients/${id}/follow-ups`),
  completeFollowUp:    (patientId, actionId)=> apiClient.put(`/doctor/patients/${patientId}/follow-ups/${actionId}/complete`),
}

export default apiClient
