import React from 'react'

const ProgressBar: React.FC<any> = ({ completed = 0, total = 0 }) => {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div style={{
      flex: 1,
      background: '#e5e7eb',
      height: 32,
      borderRadius: 8,
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      position: 'relative'
    }}>
      <div style={{
        background: `linear-gradient(to right, #0369a1, #06b6d4)`,
        height: '100%',
        width: `${percent}%`,
        transition: 'width 0.3s ease'
      }} />

      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none'
      }}>
        <span style={{ color: '#0b3b66', fontSize: 13, fontWeight: 700 }}>
          Tổng {completed}/{total} KPI - Hoàn thành {percent}%
        </span>
      </div>
    </div>
  )
}

export default ProgressBar
