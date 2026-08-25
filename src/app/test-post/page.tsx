'use client'

import { useState } from 'react'

export default function TestPostPage() {
  const [result, setResult] = useState(null)

  const testPost = async () => {
    const response = await fetch('/api/hello', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Rahul', age: 25 })
    })
    
    const data = await response.json()
    setResult(data)
  }

  return (
    <div style={{ padding: '40px' }}>
      <h1>Test POST API</h1>
      
      <button
        onClick={testPost}
        style={{
          padding: '15px 30px',
          background: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          cursor: 'pointer'
        }}
      >
        Send POST Request
      </button>

      {result && (
        <div style={{ marginTop: '20px' }}>
          <h2>Response:</h2>
          <pre style={{
            background: '#1f2937',
            color: '#10b981',
            padding: '20px',
            borderRadius: '8px',
            fontSize: '14px'
          }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
