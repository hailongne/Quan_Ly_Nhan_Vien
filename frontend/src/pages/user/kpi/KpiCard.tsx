import React from 'react'

const KpiCard: React.FC<any> = ({ kpi, isSelected, onClick, formatFullDate}) => {
  const compact = Boolean(kpi?.compact)
  const monthLabel = String(kpi?.monthLabel || '')

  return (
    <button
      onClick={onClick}
      style={{
        flex: '0 0 auto',
        width: compact ? '240px' : '280px',
        padding: compact ? '10px 12px' : '16px',
        borderRadius: 10,
        border: isSelected ? '2px solid #059669' : '1px solid #e5e7eb',
        background: isSelected ? '#f0fdf4' : '#fff',
        cursor: 'pointer',
        transition: 'all 0.2s',
        textAlign: 'left',
        boxShadow: isSelected ? '0 4px 12px rgba(5, 150, 105, 0.1)' : '0 2px 4px rgba(0,0,0,0.05)',
        textDecoration: 'none',
        color: 'inherit'
      }}
    >
      <div style={{ marginBottom: compact ? 2 : 5 }}>
        <h3 style={{
          fontSize: compact ? 12 : 13,
          fontWeight: 700,
          color: '#0b3b66',
          margin: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {Array.isArray(kpi.kpi_name) && kpi.kpi_name.length ? kpi.kpi_name[0] : kpi.description || 'KPI'}
        </h3>
        <p style={{ fontSize: compact ? 11 : 11, color: '#64748b', margin: compact ? '2px 0 0 0' : '4px 0 0 0' }}>
          {compact ? (monthLabel || '-') : `${formatFullDate ? formatFullDate(kpi.start_date) : kpi.start_date} — ${formatFullDate ? formatFullDate(kpi.end_date) : kpi.end_date}`}
        </p>
      </div>

      {!compact && (
        <div style={{ borderTop: '1px solid #e5e7eb', marginBottom: 12 }}>
          {kpi.department_name && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>Phòng ban phụ trách</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#0369a1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {kpi.department_name}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ background: isSelected ? '#dcfce7' : '#f0f9ff', borderRadius: 8, padding: compact ? '4px 10px' : '5px 12px', textAlign: compact ? 'right' : 'center', borderLeft: isSelected ? '4px solid #059669' : '4px solid #0369a1' }}>
        <div style={{ fontSize: compact ? 14 : 18, fontWeight: 700, color: isSelected ? '#059669' : '#0369a1' }}>{kpi.total_kpi} KPI</div>
      </div>
    </button>
  )
}

export default KpiCard
