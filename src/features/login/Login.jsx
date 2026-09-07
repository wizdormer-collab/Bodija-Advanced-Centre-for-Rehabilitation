import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login({ onLogin }) {
  const navigate = useNavigate()
  const [role, setRole] = useState('staff')
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (name.trim().length === 0) {
      setError('Please enter your name to continue.')
      return
    }
    onLogin({ name: name.trim(), role })
    navigate('/')
  }

  return (
    <div className="login-card">
      <h1>Sign in</h1>
      <p className="muted">Demo-only authentication for the frontend build. Real auth is out of scope for this phase.</p>
      <form onSubmit={submit} className="form">
        <label className="field">
          <span>Your name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sarah O." autoComplete="off" />
        </label>
        <label className="field">
          <span>Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="staff">Staff (intake / front desk / clinical)</option>
            <option value="admin">Administrator (rule editing)</option>
          </select>
        </label>
        {error && <div className="alert alert-error">{error}</div>}
        <button type="submit" className="btn btn-primary btn-block">
          Sign in
        </button>
      </form>
    </div>
  )
}