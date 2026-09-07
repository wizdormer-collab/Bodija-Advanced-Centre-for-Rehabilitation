import React from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { loadSession, saveSession, clearSession } from './lib/storage.js'
import Login from './features/login/Login.jsx'
import Triage from './features/triage/Triage.jsx'
import Result from './features/result/Result.jsx'
import Admin from './features/admin/Admin.jsx'
import Header from './components/Header.jsx'

function RequireAuth({ children }) {
  const location = useLocation()
  const session = loadSession()
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return children
}

export default function App() {
  const [session, setSession] = useState(() => loadSession())

  const login = (s) => {
    saveSession(s)
    setSession(s)
  }

  const logout = () => {
    clearSession()
    setSession(null)
  }

  return (
    <div className="app">
      <Header session={session} onLogout={logout} />
      <main className="content">
        <Routes>
          <Route path="/login" element={<Login onLogin={login} />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <Triage />
              </RequireAuth>
            }
          />
          <Route
            path="/result"
            element={
              <RequireAuth>
                <Result />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <Admin />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}