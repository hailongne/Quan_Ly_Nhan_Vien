import React from 'react'
import DayCard from './DayCard'

type KpiDay = {
  date: string
  is_completed?: boolean
  user_attending?: boolean
  out_of_range?: boolean
  target_value?: number
}

type KpiWeek = {
  week_index: number
  display_week_number?: number
  start_date?: string
  end_date?: string
  days: KpiDay[]
  target_value?: number
}

interface WeekCardProps {
  week: KpiWeek
  userRole?: string
  canEditWeek: (week: KpiWeek) => boolean
  onWeekTargetChange: (weekIndex: number, value: string) => void
  onToggleAttending: (weekIndex: number, date: string) => void
  onDayTargetChange: (weekIndex: number, date: string, value: string) => void
  formatDate: (dateStr: string | undefined) => string
  formatDayDetail: (date: string) => string
}

export function WeekCard({ week, userRole, canEditWeek, onWeekTargetChange, onToggleAttending, onDayTargetChange, formatDate, formatDayDetail }: WeekCardProps) {
  const orderedDays = Array.isArray(week.days) ? week.days : []
  const displayWeekNo = Number(week.display_week_number ?? (Number(week.week_index || 0) + 1))

  // Determine week target: prefer explicit week.target_value, otherwise sum real day targets
  const weekTarget = (typeof week.target_value !== 'undefined' && week.target_value !== null)
    ? Number(week.target_value)
    : orderedDays.reduce((s: number, d: any) => s + ((d && !(d as any).out_of_range) ? (Number((d as any).target_value) || 0) : 0), 0)

  const headerStyle: React.CSSProperties = { background: 'linear-gradient(90deg,#fff,#f0f9ff)', padding: '12px 16px', borderBottom: '1px solid #bae6fd' }
  const cardStyle: React.CSSProperties = { borderRadius: 12, overflow: 'hidden', border: '2px solid #e0f2fe', boxShadow: '0 1px 6px rgba(14,165,233,0.06)' }

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, background: '#0ea5e9', borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>{displayWeekNo}</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0369a1' }}>Tuần {displayWeekNo}</div>
              <div style={{ fontSize: 13, color: '#075985' }}>{formatDate(week.start_date)} - {formatDate(week.end_date)}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ textAlign: 'right',  color: '#075985', fontSize: 14 }}>
              <span>Tổng KPI theo tuần: <strong style={{ fontWeight: 700 }}>{weekTarget} KPI</strong></span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {(() => {
          if (!orderedDays.length) return <div />
          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12 }}>
              {orderedDays.map((day: any, idx: number) => (
                day && day.out_of_range ? (
                  <div key={`empty-${displayWeekNo}-${idx}`} style={{ borderRadius: 12, border: '1px dashed #d1d5db', background: '#f3f4f6', minHeight: 138 }} aria-hidden />
                ) : (
                  <DayCard
                    key={day.date}
                    day={day}
                    weekIndex={Number(week.week_index || 0)}
                    userRole={userRole}
                    onToggleAttending={onToggleAttending}
                    onDayTargetChange={onDayTargetChange}
                    formatDayDetail={formatDayDetail}
                  />
                )
              ))}
            </div>
          )
        })()}
      </div>
    </div>
  )
}

export default WeekCard
