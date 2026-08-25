'use client'

import { useState } from 'react'

export default function TestApiPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Test /api/hello
  const testHelloApi = async () => {
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch('/api/hello')
      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError('Failed to fetch API')
    } finally {
      setLoading(false)
    }
  }

  // Test /api/libraries
  const testLibrariesApi = async () => {
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch('/api/libraries')
      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError('Failed to fetch API')
    } finally {
      setLoading(false)
    }
  }

  // Test /api/auth/me
  const testAuthApi = async () => {
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch('/api/auth/me')
      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError('Failed to fetch API')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '30px' }}>🧪 API Testing Page</h1>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
        <button
          onClick={testHelloApi}
          disabled={loading}
          style={{
            padding: '10px 20px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          Test /api/hello
        </button>

        <button
          onClick={testLibrariesApi}
          disabled={loading}
          style={{
            padding: '10px 20px',
            background: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          Test /api/libraries
        </button>

        <button
          onClick={testAuthApi}
          disabled={loading}
          style={{
            padding: '10px 20px',
            background: '#8b5cf6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          Test /api/auth/me
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ padding: '20px', background: '#f3f4f6', borderRadius: '8px' }}>
          Loading...
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: '20px', background: '#fee2e2', color: '#dc2626', borderRadius: '8px' }}>
          ❌ {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div>
          <h2 style={{ marginBottom: '10px' }}>✅ API Response:</h2>
          <pre
            style={{
              padding: '20px',
              background: '#1f2937',
              color: '#10b981',
              borderRadius: '8px',
              overflow: 'auto',
              fontSize: '14px'
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
