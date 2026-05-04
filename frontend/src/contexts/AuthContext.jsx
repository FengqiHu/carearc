import React, { createContext, useContext, useState, useEffect } from 'react'
import { auth } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('carearc_token'))
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('carearc_user')
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const restoreSession = async () => {
      const storedToken = localStorage.getItem('carearc_token')
      if (!storedToken) {
        setLoading(false)
        return
      }
      try {
        const response = await auth.getMe()
        setUser(response.data.user || response.data)
        setToken(storedToken)
      } catch (err) {
        localStorage.removeItem('carearc_token')
        localStorage.removeItem('carearc_user')
        setUser(null)
        setToken(null)
      } finally {
        setLoading(false)
      }
    }
    restoreSession()
  }, [])

  const login = async (email, password) => {
    const response = await auth.login(email, password)
    const { token: newToken, user: newUser } = response.data
    localStorage.setItem('carearc_token', newToken)
    localStorage.setItem('carearc_user', JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
    return newUser
  }

  const logout = () => {
    localStorage.removeItem('carearc_token')
    localStorage.removeItem('carearc_user')
    setToken(null)
    setUser(null)
  }

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    isAuthenticated: !!token && !!user,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
