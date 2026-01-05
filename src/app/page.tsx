// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

"use client";

export default function Home() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '2rem',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white'
    }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>subno.ts</h1>
      <p style={{ fontSize: '1.25rem', opacity: 0.9, marginBottom: '2rem' }}>
        Encrypted Push Notification Service
      </p>
      <div style={{ 
        display: 'flex', 
        gap: '1rem',
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        <div style={cardStyle}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>🔐 End-to-End Encryption</h3>
          <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>RSA & ECC encryption</p>
        </div>
        <div style={cardStyle}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>📡 Real-time SSE</h3>
          <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>Server-Sent Events</p>
        </div>
        <div style={cardStyle}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>🔑 Key Management</h3>
          <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>Secure key registration</p>
        </div>
      </div>
      <div style={{ marginTop: '3rem', textAlign: 'center' }}>
        <p style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: '1rem' }}>
          Service Status: <span style={{ color: '#4ade80', fontWeight: 'bold' }}>● Running</span>
        </p>
        <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>
          Version 0.1.0 | Next.js 16.1.1
        </p>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.15)',
  backdropFilter: 'blur(10px)',
  borderRadius: '12px',
  padding: '1.5rem',
  minWidth: '200px',
  border: '1px solid rgba(255,255,255,0.2)'
};