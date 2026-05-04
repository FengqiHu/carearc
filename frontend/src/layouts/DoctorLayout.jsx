import React from 'react'
import { Outlet, NavLink, useParams, useLocation } from 'react-router-dom'
import NavBar from '../components/NavBar'

export default function DoctorLayout() {
  const location = useLocation()
  const isOnPatientDetail = location.pathname.includes('/doctor/patients/')

  return (
    <div className="min-h-screen" style={{ background: '#f3f4f8' }}>
      <NavBar pageTitle="Doctor Portal" />

      <div className="flex" style={{ paddingTop: '64px', minHeight: '100vh' }}>
        {/* Sidebar */}
        <aside
          className="hidden md:flex flex-col w-56 fixed left-0 bottom-0 overflow-y-auto"
          style={{
            top: '64px',
            background: '#ffffff',
            borderRight: '1px solid #dedee5',
            boxShadow: 'rgba(0,0,0,0.03) 2px 0 12px',
          }}
        >
          <nav className="p-3 flex flex-col gap-1 mt-2">
            <NavLink
              to="/doctor"
              end
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={({ isActive }) => ({
                background: isActive ? 'rgba(29,78,216,0.10)' : 'transparent',
                color: isActive ? '#1d4ed8' : '#9497a9',
                fontWeight: isActive ? '600' : '500',
              })}
            >
              <span className="text-base">🏥</span>
              Patient Queue
            </NavLink>

            {isOnPatientDetail && (
              <div
                className="mt-2 pt-2"
                style={{ borderTop: '1px solid #dedee5' }}
              >
                <p className="text-xs font-semibold uppercase tracking-wider px-3 mb-2" style={{ color: '#9497a9' }}>
                  Current Patient
                </p>
                <NavLink
                  to={location.pathname}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium"
                  style={{
                    background: 'rgba(29,78,216,0.10)',
                    color: '#1d4ed8',
                    fontWeight: '600',
                  }}
                >
                  <span className="text-base">👤</span>
                  Patient Detail
                </NavLink>
              </div>
            )}
          </nav>

          {/* Bottom */}
          <div className="mt-auto p-4 pb-6">
            <div
              className="rounded-xl p-3 text-xs"
              style={{ background: 'rgba(220,38,38,0.06)', color: '#991b1b' }}
            >
              <p className="font-semibold mb-1">⚠️ High Priority</p>
              <p style={{ color: '#9497a9', fontSize: '11px' }}>Review all high-risk patients daily. Automated alerts do not replace clinical judgment.</p>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0" style={{ marginLeft: '224px' }}>
          <div className="max-w-5xl mx-auto p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
