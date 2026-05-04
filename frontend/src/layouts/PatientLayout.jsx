import React from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import NavBar from '../components/NavBar'

const NAV_ITEMS = [
  { to: '/patient', label: 'Dashboard', icon: '🏠', end: true },
  { to: '/patient/checkin', label: 'Daily Check-in', icon: '✅' },
  { to: '/patient/prescriptions', label: 'My Prescriptions', icon: '💊' },
]

export default function PatientLayout() {
  return (
    <div className="min-h-screen" style={{ background: '#f3f4f8' }}>
      <NavBar pageTitle="Patient Portal" />

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
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={({ isActive }) => ({
                  background: isActive ? 'rgba(29,78,216,0.10)' : 'transparent',
                  color: isActive ? '#1d4ed8' : '#9497a9',
                  fontWeight: isActive ? '600' : '500',
                })}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Bottom section */}
          <div className="mt-auto p-4 pb-6">
            <div
              className="rounded-xl p-3 text-xs"
              style={{ background: 'rgba(29,78,216,0.07)', color: '#1d4ed8' }}
            >
              <p className="font-semibold mb-1">Daily Reminder</p>
              <p style={{ color: '#9497a9', fontSize: '11px' }}>Complete your check-in by 9 PM each day for accurate monitoring.</p>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main
          className="flex-1 min-w-0"
          style={{ marginLeft: '224px' }}
        >
          <div className="max-w-4xl mx-auto p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
