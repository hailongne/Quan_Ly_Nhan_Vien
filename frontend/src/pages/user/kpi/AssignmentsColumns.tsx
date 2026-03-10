import React from 'react'
import { notify } from '../../../utils/notify'
import { confirm } from '../../../utils/confirm'
import AssignmentCard from './AssignmentCard'

const AssignmentsColumns: React.FC<any> = ({ assignments = [], formatDate, onChangeStatus, compact = false }) => {
  // Nhóm các trạng thái để mỗi cột có thể bao gồm nhiều trạng thái liên quan
  const pendingStatuses = ['not_completed']
  const doingStatuses = ['doing']
  const reviewStatuses = ['review']
  const completedStatuses = ['completed']

  const pending = assignments.filter((a: any) => pendingStatuses.includes(a.status))
  const inProgress = assignments.filter((a: any) => doingStatuses.includes(a.status))
  const review = assignments.filter((a: any) => reviewStatuses.includes(a.status))
  const completed = assignments.filter((a: any) => completedStatuses.includes(a.status))

  const columnPadding = compact ? 6 : 12
  const cardGap = compact ? 5 : 8

  return (
    <div>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: '#0b3b66', marginBottom: 12 }}>Danh sách phân công</h3>

      <div style={{ maxHeight: 520, overflowY: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: compact ? 2 : 5, width: '100%', boxSizing: 'border-box' }}>

          {/* Column: KPI được giao */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingRight: columnPadding, borderRight: '1px solid rgba(15,23,42,0.06)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>KPI được giao</div>
            <div style={{ display: pending.length === 0 ? 'block' : 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: cardGap, justifyContent: 'center' }}>
              {pending.length === 0 ? (
                <div style={{ color: '#94a3b8' }}>Không có</div>
              ) : (
                pending.map((a: any, i: number) => (
                  <AssignmentCard key={i} assign={a} label={formatDate ? formatDate(a.date) : a.date} hideTopRightIcon compact={compact} />
                ))
              )}
            </div>
          </div>

          {/* Column: Đang thực hiện */}
          <div
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: `0 ${columnPadding}px`, borderRight: '1px solid rgba(15,23,42,0.06)' }}
            onDragEnter={(e) => { e.preventDefault(); console.log('[AssignmentsColumns] dragenter Doing column') }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
            onDragLeave={() => console.log('[AssignmentsColumns] dragleave Doing column')}
            onDrop={(e) => {
              e.preventDefault()
              try {
                const data = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain')
                console.log('[AssignmentsColumns] drop data:', { data })
                if (!data) return
                const payload = JSON.parse(data)
                console.log('[AssignmentsColumns] parsed payload:', payload)
                const srcStatus = payload?.status
                if (srcStatus === 'not_completed' || srcStatus === 'pending') {
                  if (onChangeStatus) onChangeStatus(payload, 'doing')
                } else {
                  console.warn('[AssignmentsColumns] drop ignored - source must be not_completed/pending to move to doing', { srcStatus })
                }
              } catch (err) {
                console.error('[AssignmentsColumns] drop parse error', err)
              }
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>Đang thực hiện</div>
            <div style={{ display: inProgress.length === 0 ? 'block' : 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: cardGap, justifyContent: 'center' }}>
              {inProgress.length === 0 ? (
                <div style={{ color: '#94a3b8' }}>Không có</div>
              ) : (
                inProgress.map((a: any, i: number) => (
                  <AssignmentCard key={i} assign={a} label={formatDate ? formatDate(a.date) : a.date} compact={compact} />
                ))
              )}
            </div>
          </div>

          {/* Column: Phê duyệt */}
          <div
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingLeft: columnPadding }}
            onDragEnter={(e) => { e.preventDefault(); console.log('[AssignmentsColumns] dragenter Phê duyệt column') }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
            onDragLeave={() => console.log('[AssignmentsColumns] dragleave Phê duyệt column')}
            onDrop={async (e) => {
              e.preventDefault()
              try {
                const data = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain')
                console.log('[AssignmentsColumns] drop data on Phê duyệt:', { data })
                if (!data) return
                const payload = JSON.parse(data)
                console.log('[AssignmentsColumns] parsed payload on Phê duyệt:', payload)
                const srcStatus = payload?.status
                const hasOutputs = Boolean(payload?.hasFullAlbums)
                if (srcStatus === 'doing' && hasOutputs) {
                  const ok = await confirm({
                    title: 'Gửi phê duyệt',
                    message: 'Bạn muốn gửi kết quả KPI này sang cột Phê duyệt để leader xem xét?',
                    confirmText: 'Gửi phê duyệt',
                    cancelText: 'Hủy'
                  })
                  if (!ok) return
                  if (onChangeStatus) onChangeStatus(payload, 'review')
                } else {
                  console.warn('[AssignmentsColumns] drop ignored - must be doing and have outputs', { srcStatus, hasOutputs })
                  notify.error('Hãy upload kết quả trước khi phê duyệt')
                }
              } catch (err) {
                console.error('[AssignmentsColumns] drop parse error on Phê duyệt', err)
              }
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>Phê duyệt</div>
            <div style={{ display: review.length === 0 ? 'block' : 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: cardGap, justifyContent: 'center' }}>
              {review.length === 0 ? (
                <div style={{ color: '#94a3b8' }}>Không có</div>
              ) : (
                review.map((a: any, i: number) => (
                  <AssignmentCard key={i} assign={a} label={formatDate ? formatDate(a.date) : a.date} compact={compact} />
                ))
              )}
            </div>
          </div>

          {/* Column: Hoàn thành */}
          <div
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingLeft: columnPadding, borderLeft: '1px solid rgba(15,23,42,0.06)' }}
            onDragEnter={(e) => { e.preventDefault(); console.log('[AssignmentsColumns] dragenter Hoàn thành column') }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
            onDragLeave={() => console.log('[AssignmentsColumns] dragleave Hoàn thành column')}
            onDrop={(e) => {
              e.preventDefault()
              try {
                const data = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain')
                console.log('[AssignmentsColumns] drop data on Hoàn thành:', { data })
                if (!data) return
                const payload = JSON.parse(data)
                console.log('[AssignmentsColumns] parsed payload on Hoàn thành:', payload)
                const srcStatus = payload?.status
                if (srcStatus === 'review') {
                  if (onChangeStatus) onChangeStatus(payload, 'completed')
                } else {
                  console.warn('[AssignmentsColumns] drop ignored - source status must be review', { srcStatus })
                }
              } catch (err) {
                console.error('[AssignmentsColumns] drop parse error on Hoàn thành', err)
              }
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>Hoàn thành</div>
            <div style={{ display: completed.length === 0 ? 'block' : 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: cardGap, justifyContent: 'center' }}>
              {completed.length === 0 ? (
                <div style={{ color: '#94a3b8' }}>Không có</div>
              ) : (
                completed.map((a: any, i: number) => (
                  <AssignmentCard key={i} assign={a} label={formatDate ? formatDate(a.date) : a.date} compact={compact} />
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

export default AssignmentsColumns
