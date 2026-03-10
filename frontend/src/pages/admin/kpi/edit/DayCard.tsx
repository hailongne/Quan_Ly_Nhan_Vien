import React from 'react'

type KpiDay = {
  date: string
  is_completed?: boolean
  user_attending?: boolean
  is_working_day?: number | boolean
  out_of_range?: boolean
  target_value?: number
  // possible server fields indicating existing assignments
  kpi_current?: number
  assigned_total?: number
  assigned_kpi?: number
  totalAssigned?: number
  assignedTotal?: number
}

interface DayCardProps {
  day: KpiDay
  weekIndex: number
  userRole?: string
  onToggleAttending: (weekIndex: number, date: string) => void
  onDayTargetChange: (weekIndex: number, date: string, value: string) => void
  formatDayDetail: (date: string) => string
}

export function DayCard({ day, weekIndex, userRole, onToggleAttending, onDayTargetChange, formatDayDetail }: DayCardProps) {
  const assignedCandidates = [day.assignedTotal, day.assigned_total, day.totalAssigned, day.assigned_kpi]
    .map((value) => Number(value ?? 0) || 0)
  const assignedCount = Math.max(0, ...assignedCandidates)
  const alreadyAssigned = assignedCount > 0
  const disabled = day.is_completed || day.out_of_range || alreadyAssigned || (userRole !== 'admin' && userRole !== 'leader')

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    padding: 12,
    textAlign: 'center',
    transition: 'box-shadow .15s ease',
    background: day.is_completed ? '#ecfdf5' : (day.out_of_range ? '#f3f4f6' : (!day.user_attending || (userRole !== 'admin' && userRole !== 'leader')) ? '#f9fafb' : '#fff'),
    opacity: day.is_completed ? 1 : (day.out_of_range ? 0.7 : (!day.user_attending ? 0.9 : 1))
  }

  const titleStyle: React.CSSProperties = {
    marginBottom: 8,
    fontSize: 13,
    color: day.is_completed ? '#166534' : (day.out_of_range ? '#6b7280' : '#4b5563'),
    fontWeight: 600
  }

  return (
    <div style={containerStyle}>
      <div style={{ marginBottom: 8 }}>
        <p style={titleStyle}>{formatDayDetail(day.date)}</p>
        {day.is_completed && (
          <span title="Đã hoàn thành" style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 9999, background: '#16a34a' }} />
        )}
        {alreadyAssigned && !day.is_completed && (
          <div style={{ marginTop: 6, fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>(đã giao)</div>
        )}
      </div>

      {(userRole === 'admin' || userRole === 'leader') && !day.is_completed && !day.out_of_range && !alreadyAssigned && (
        <button
          type="button"
          onClick={() => onToggleAttending(weekIndex, day.date)}
          title={day.is_working_day ? 'Đi làm' : 'Nghỉ'}
          style={{
            marginBottom: 8,
            padding: '6px 10px',
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 9999,
            border: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            background: day.is_working_day ? '#ecfdf5' : '#f3f4f6',
            color: day.is_working_day ? '#166534' : '#374151',
            transition: 'transform 120ms ease, box-shadow 120ms ease',
            transform: !disabled ? 'translateY(-1px)' : 'none'
          }}
        >
          {day.is_working_day ? 'Đi làm' : 'Nghỉ'}
        </button>
      )}

      <input
        type="number"
        value={day.target_value ?? ''}
        onChange={(e) => onDayTargetChange(weekIndex, day.date, e.target.value)}
        disabled={disabled}
        style={{
          width: '100%',
          borderRadius: 8,
          border: day.is_completed ? '1px solid #bbf7d0' : (!day.is_working_day ? '1px solid transparent' : '1px solid #e5e7eb'),
          background: alreadyAssigned ? '#f8faf8' : (day.is_completed ? '#ecfdf5' : (day.out_of_range ? 'transparent' : (!day.is_working_day ? 'transparent' : '#fff'))),
          color: day.is_completed ? '#166534' : (day.out_of_range ? '#9ca3af' : (!day.is_working_day ? '#9ca3af' : '#111827')),
          padding: '8px 10px',
          fontWeight: 700,
          textAlign: 'center'
        }}
      />
    </div>
  )
}

export default DayCard
