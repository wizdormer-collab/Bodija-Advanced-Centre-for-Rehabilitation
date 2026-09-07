import React from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

export default function Header({ session, onLogout, title }) {
  const navigate = useNavigate()
  return (
    <header className="header">
      <div className="brand">
        <span className="brand-mark">BACR</span>
        <div className="brand-text">
          <strong>Patient Triage System</strong>
          <small>Bodija Advanced Centre for Rehabilitation</small>
        </div>
      </div>
      {session && (
        <nav className="nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            New Triage
          </NavLink>
          {session.role === 'admin' && (
            <NavLink to="/admin" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              Rules
            </NavLink>
          )}
        </nav>
      )}
      <div className="header-right">
        {session && title && <h1 className="header-title">{title}</h1>}
        {session ? (
          <div className="session">
            <span className={`role-badge role-${session.role}`}>{session.role}</span>
            <span className="session-name">{session.name || session.role}</span>
            <button
              className="btn btn-ghost"
              onClick={() => {
                onLogout()
                navigate('/login')
              }}
            >
              Log out
            </button>
          </div>
        ) : (
          <Link to="/login" className="btn btn-primary">
            Sign in
          </Link>
        )}
      </div>
    </header>
  )
}