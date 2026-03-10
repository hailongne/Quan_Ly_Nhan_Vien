import React from 'react'
import UploadModal from './UploadModal'
import api from '../../../api/axios'

const AssignmentCard: React.FC<any> = ({ assign, label }) => {
  const [showUpload, setShowUpload] = React.useState(false)
  const [hasFullAlbums, setHasFullAlbums] = React.useState(false)
  const [existingOutputs, setExistingOutputs] = React.useState<any>(null)
  const isReview = assign.status === 'review'
  const inProgressLike = assign.status === 'doing'
  // Card tones by status:
  // - doing (inProgressLike): purple
  // - review: deep blue
  // - completed: green
  const bg = assign.status === 'completed'
    ? '#dcfce7' // green-50
    : inProgressLike
      ? '#f5f3ff' // purple-50
      : isReview
        ? '#e6f0ff' // blue-50
        : '#fef3c7' // default amber-100
  const border = assign.status === 'completed'
    ? '#16a34a' // green-600
    : inProgressLike
      ? '#7c3aed' // purple-600
      : isReview
        ? '#1e40af' // indigo-900
        : '#f59e0b' // amber-500
  const text = assign.status === 'completed'
    ? 'Hoàn thành ✓'
    : inProgressLike
      ? 'Đang làm'
      : isReview
        ? 'Đang phê duyệt'
        : 'Chưa thực hiện'

  const normalizeLocalYMD = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    } catch {
      return dateStr
    }
  }

  const today = new Date()
  const todayYMD = normalizeLocalYMD(today.toString())
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const tomorrowYMD = normalizeLocalYMD(tomorrow.toString())
  const assignYMD = normalizeLocalYMD(assign.date)
  const isToday = todayYMD === assignYMD
  const isTomorrow = tomorrowYMD === assignYMD

  const assignDateObj = (() => {
    try {
      const d = new Date(assign.date)
      d.setHours(0, 0, 0, 0)
      return d
    } catch {
      return null
    }
  })()
  const todayObj = new Date()
  todayObj.setHours(0, 0, 0, 0)
  const isPast = assignDateObj ? assignDateObj < todayObj : false

  const isNotCompleted = assign.status === 'pending' || assign.status === 'not_completed'
  const [weekdayPart, datePart] = typeof label === 'string' && label.includes(',') ? label.split(',').map(s => s.trim()) : [null, label]
  const canBeOverdue = assign.status === 'not_completed' || assign.status === 'doing'
  const showPastVisual = isPast && canBeOverdue

  const statusColor = showPastVisual ? '#991b1b' :
    assign.status === 'completed' ? '#16a34a' :
    assign.status === 'review' ? '#1e40af' :
    inProgressLike ? '#7c3aed' :
    isNotCompleted ? '#374151' : '#64748b'

  const dateContextLabel = showPastVisual ? 'Quá hạn' : isToday ? 'Hôm nay' : isTomorrow ? 'Ngày mai' : null

  React.useEffect(() => {
    const fetchOutputs = async () => {
      const taskId = Number(assign.taskId ?? assign.task_id)
      const chainKpiId = Number(assign.kpiId ?? assign.chain_kpi_id)
      const maxAlbums = Number(assign.assignedKpi) || 0
      if (!taskId || !chainKpiId || !maxAlbums) return
      try {
        const res = await api.get(`/api/kpis/${chainKpiId}/tasks/${taskId}/outputs`)
        const albums = res?.data?.albums || []
        setExistingOutputs(res?.data || null)
        setHasFullAlbums(Array.isArray(albums) && albums.length >= maxAlbums)
      } catch (err) {
        setHasFullAlbums(false)
      }
    }
    fetchOutputs()
    ;(fetchOutputs as any).refetch = fetchOutputs
    return () => {}
  }, [assign.taskId, assign.task_id, assign.kpiId, assign.chain_kpi_id, assign.assignedKpi])

  return (
    <div draggable
      onDragStart={(e) => {
        try {
          const payload = JSON.stringify({ ...assign, hasFullAlbums })
          console.log('[AssignmentCard] dragstart', { assign })
          e.dataTransfer.setData('application/json', payload)
          e.dataTransfer.setData('text/plain', payload)
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.dropEffect = 'move'
        } catch (err) {
          console.error('[AssignmentCard] dragstart error', err)
        }
      }}
      onDragEnd={() => {
        console.log('[AssignmentCard] dragend', { assign })
      }}
      style={{
      cursor: 'grab',
      background: showPastVisual ? '#fee2e2' : isToday ? '#e0fcfe' : isTomorrow ? '#fff7ed' : isNotCompleted ? '#f3f4f6' : bg,
      border: `1px solid ${showPastVisual ? '#dc2626' : isToday ? '#13c7c7' : isTomorrow ? '#f97316' : isNotCompleted ? '#cbd5e1' : border}`,
      borderRadius: 8,
      padding: 10,
      width: 140,
      textAlign: 'center',
      boxShadow: showPastVisual ? '0 2px 8px rgba(220, 38, 38, 0.4)' : isToday ? '0 2px 10px rgba(3, 150, 161, 0.27)' : isTomorrow ? '0 2px 8px rgba(249,115,22,0.06)' : undefined
    }}>
      {weekdayPart ? (
        <div>
          <div style={{ fontSize: 14, color: showPastVisual ? '#991b1b' : isNotCompleted ? '#374151' : '#64748b', marginBottom: 2 }}>
            {weekdayPart}
            {dateContextLabel && (
              <span style={{ fontSize: 13, fontWeight: 700, color: showPastVisual ? '#991b1b' : isToday ? '#0369a1' : isTomorrow ? '#f97316' : '#111827', marginLeft: 8 }}>
                {dateContextLabel}
              </span>
            )}
          </div>
              <div style={{ fontSize: isToday || isTomorrow || showPastVisual ? 16 : 12, color: showPastVisual ? '#991b1b' : isToday ? '#0369a1' : isTomorrow ? '#f97316' : isNotCompleted ? '#111827' : '#64748b', fontWeight: 700 }}>{datePart}</div>
        </div>
      ) : (
        <div style={{ fontSize: isToday || isTomorrow || showPastVisual ? 16 : 12, color: showPastVisual ? '#991b1b' : isToday ? '#0369a1' : isTomorrow ? '#f97316' : isNotCompleted ? '#111827' : '#64748b', fontWeight: 700 }}>{label}</div>
      )}

      <div style={{ fontSize: 20, fontWeight: 700, color: statusColor, marginTop: 8 }}>{assign.assignedKpi} KPI</div>
      {assign.status === 'doing' ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => setShowUpload(true)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowUpload(true) } }}
            style={{
              display: 'inline-block',
              padding: '8px 5px',
              borderRadius: 28,
              background: '#0f172a',
              color: '#ffffff',
              fontSize: 10,
              fontWeight: 700,
              boxShadow: '0 3px 8px rgba(2,6,23,0.22)',
              cursor: 'pointer',
              userSelect: 'none',
              lineHeight: 1
            }}
          >
            {hasFullAlbums ? 'Xem kết quả' : 'upload kết quả'}
          </div>
      ) : (
        // For 'review' (Đang phê duyệt) and 'completed' (Hoàn thành) make the status clickable to view results
        <div
          role={(assign.status === 'review' || assign.status === 'completed') ? 'button' : undefined}
          tabIndex={(assign.status === 'review' || assign.status === 'completed') ? 0 : undefined}
          onClick={() => { if (assign.status === 'review' || assign.status === 'completed') setShowUpload(true) }}
          onKeyDown={(e) => { if ((assign.status === 'review' || assign.status === 'completed') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setShowUpload(true) } }}
          style={{ cursor: (assign.status === 'review' || assign.status === 'completed') ? 'pointer' : 'default', fontSize: 11, color: statusColor, fontWeight: 600, marginTop: 4 }}
        >
          {text}
        </div>
      )}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSaved={() => {
            // refetch outputs immediately after save
            const taskId = Number(assign.taskId ?? assign.task_id)
            const chainKpiId = Number(assign.kpiId ?? assign.chain_kpi_id)
            const maxAlbums = Number(assign.assignedKpi) || 0
            if (!taskId || !chainKpiId || !maxAlbums) return
            api.get(`/api/kpis/${chainKpiId}/tasks/${taskId}/outputs`).then((res) => {
              const albums = res?.data?.albums || []
              setExistingOutputs(res?.data || null)
              setHasFullAlbums(Array.isArray(albums) && albums.length >= maxAlbums)
            }).catch(() => { setHasFullAlbums(false) })
          }}
          maxResults={Number(assign.assignedKpi) || 0}
          taskId={Number(assign.taskId ?? assign.task_id) || undefined}
          chainKpiId={Number(assign.kpiId ?? assign.chain_kpi_id) || undefined}
          kpiNames={Array.isArray(assign.kpiNames) ? assign.kpiNames : undefined}
          mode={(assign.status === 'completed' || assign.status === 'review') ? 'view' : (hasFullAlbums ? 'view' : 'upload')}
          existing={hasFullAlbums ? existingOutputs : null}
        />
      )}
    </div>
  )
}

export default AssignmentCard

