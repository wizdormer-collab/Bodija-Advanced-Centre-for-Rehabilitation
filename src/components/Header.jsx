import React from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

export default function Header({ session, onLogout }) {
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
      <div className="header-right">
        {session && (
          <nav className="nav">
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              New Triage
            </NavLink>
          </nav>
        )}
        {session ? (
          <div className="session">
            <span className={`role-badge role-${session.role}`}>{session.role}</span>
            <span className="session-name">{session.name || session.role}</span>
            <button
              className="logout-btn"
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