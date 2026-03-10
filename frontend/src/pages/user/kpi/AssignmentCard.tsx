import React from 'react'
import UploadModal from './UploadModal'
import api from '../../../api/axios'
import { notify } from '../../../utils/notify'

const AssignmentCard: React.FC<any> = ({ assign, label, hideTopRightIcon = false, compact = false }) => {
  const [showUpload, setShowUpload] = React.useState(false)
  const [hasFullAlbums, setHasFullAlbums] = React.useState(false)
  const [existingOutputs, setExistingOutputs] = React.useState<any>(null)
  const isReview = assign.status === 'review'
  const isCompleted = assign.status === 'completed'
  const inProgressLike = assign.status === 'doing'
  const bg = assign.status === 'completed'
    ? '#dcfce7'
    : inProgressLike
      ? '#f5f3ff'
      : isReview
        ? '#fff0f6'
        : '#fef3c7'
  const border = assign.status === 'completed'
    ? '#16a34a'
    : inProgressLike
      ? '#7c3aed'
      : isReview
        ? '#f472b6'
        : '#f59e0b'
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
    assign.status === 'review' ? '#be185d' :
    inProgressLike ? '#7c3aed' :
    isNotCompleted ? '#374151' : '#64748b'

  const dateContextLabel = showPastVisual ? 'Quá hạn' : isToday ? 'Hôm nay' : isTomorrow ? 'Ngày mai' : null

  const count = Number(assign.assignedKpi) || 0
  const isZero = count === 0

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
    <div draggable={!isCompleted}
      onMouseDown={(e) => {
        if (isCompleted) {
          notify.info('KPI đã hoàn thành, không thể kéo.')
          e.preventDefault()
        }
      }}
      onDragStart={(e) => {
        if (isCompleted) {
          notify.info('KPI đã hoàn thành, không thể kéo.')
          try { e.preventDefault() } catch (err) {}
          return
        }
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
        position: 'relative',
      cursor: isCompleted ? 'not-allowed' : 'grab',
      background: showPastVisual ? '#fee2e2' : isToday ? '#e0fcfe' : isTomorrow ? '#fff7ed' : isNotCompleted ? '#f3f4f6' : bg,
      border: `1px solid ${showPastVisual ? '#dc2626' : isToday ? '#13c7c7' : isTomorrow ? '#f97316' : isNotCompleted ? '#cbd5e1' : border}`,
      borderRadius: 8,
      padding: compact ? 6 : 10,
      width: compact ? 96 : 140,
      textAlign: 'center',
      boxShadow: showPastVisual ? '0 2px 8px rgba(220, 38, 38, 0.4)' : isToday ? '0 2px 10px rgba(3, 150, 161, 0.27)' : isTomorrow ? '0 2px 8px rgba(249,115,22,0.06)' : undefined
    }}>
      {weekdayPart ? (
        <div>
          <div style={{ fontSize: compact ? 11 : 14, color: showPastVisual ? '#991b1b' : isNotCompleted ? '#374151' : '#64748b', marginBottom: compact ? 1 : 2 }}>
            {weekdayPart}
            {/* dateContextLabel moved to replace status text below */}
          </div>
              <div style={{ fontSize: compact ? 12 : (isToday || isTomorrow || showPastVisual ? 16 : 12), color: showPastVisual ? '#991b1b' : isToday ? '#0369a1' : isTomorrow ? '#f97316' : isNotCompleted ? '#111827' : '#64748b', fontWeight: 700 }}>{datePart}</div>
        </div>
      ) : (
        <div style={{ fontSize: compact ? 12 : (isToday || isTomorrow || showPastVisual ? 16 : 12), color: showPastVisual ? '#991b1b' : isToday ? '#0369a1' : isTomorrow ? '#f97316' : isNotCompleted ? '#111827' : '#64748b', fontWeight: 700 }}>{label}</div>
      )}

      {/* top-right icons */}
      {!hideTopRightIcon && (
        <div style={{ position: 'absolute', top: compact ? 4 : 8, right: compact ? 4 : 8, display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            aria-label={hasFullAlbums ? 'Xem kết quả' : 'Upload kết quả'}
            style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}
          >
            <img
              src={hasFullAlbums ? '/image/eye_icon.png' : '/image/upload_black_icon.png'}
              alt={hasFullAlbums ? 'view' : 'upload'}
              style={{ width: compact ? 13 : (hasFullAlbums ? 26 : 20), height: compact ? 13 : (hasFullAlbums ? 26 : 20), display: 'block' }}
            />
          </button>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{ fontSize: compact ? 42 : 70, fontWeight: 800, lineHeight: 1, color: isZero ? '#9ca3af' : statusColor }}>{count}</div>
          <div style={{ marginLeft: compact ? 6 : 12, fontSize: compact ? 9 : 12, fontWeight: 700, color: isZero ? '#9ca3af' : statusColor }}>KPI</div>
      </div>
      <div style={{ cursor: 'default', fontSize: compact ? 9 : 11, color: statusColor, fontWeight: 600, marginTop: compact ? 1 : 4 }}>
        {dateContextLabel ? dateContextLabel : (assign.status === 'doing' ? 'Đã nhận KPI' : text)}
      </div>
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSaved={() => {
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

