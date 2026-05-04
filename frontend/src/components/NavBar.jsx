import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function NavBar({ pageTitle }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6"
      style={{
        height: '64px',
        background: '#1d4ed8',
        boxShadow: '0 2px 12px rgba(29,78,216,0.25)',
      }}
    >
      {/* Left: Logo */}
      <div className="flex items-center gap-2.5">
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.18)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L3 7V12C3 16.55 6.84 20.74 12 22C17.16 20.74 21 16.55 21 12V7L12 2Z" fill="white" fillOpacity="0.9"/>
            <path d="M10 14.5L7.5 12L6.5 13L10 16.5L17.5 9L16.5 8L10 14.5Z" fill="#1d4ed8"/>
          </svg>
        </div>
        <span className="text-white font-bold text-lg tracking-tight">CareArc</span>
      </div>

      {/* Center: Page Title */}
      {pageTitle && (
        <div className="hidden md:block">
          <span className="text-white font-medium text-sm opacity-90">{pageTitle}</span>
        </div>
      )}

      {/* Right: User info + logout */}
      <div className="flex items-center gap-3">
        {user && (
          <>
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-white text-sm font-semibold leading-tight">
                {user.name || user.email}
              </span>
              <span
                className="text-xs font-medium capitalize px-2 py-0.5 rounded-md mt-0.5"
                style={{
                  background: 'rgba(255,255,255,0.18)',
                  color: 'rgba(255,255,255,0.9)',
                }}
              >
                {user.role === 'doctor' ? '👨‍⚕️ Doctor' : '🏥 Patient'}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: 'rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.9)',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Logout
            </button>
          </>
        )}
      </div>
    </header>
  )
}
