import React from 'react'
import axios from '../../../api/axios'
import { notify } from '../../../utils/notify'
import { confirm } from '../../../utils/confirm'
import { getUsersCached } from '../../../utils/usersCache'
import { useEffect, useState } from 'react'

type Props = {
  groupedByKpi: Record<string, any[]>
  kpiMap: Record<string, any>
  outputsByTask: Record<string, any>
  approvalsByTask: Record<string, any>
  refreshApprovals: () => Promise<Record<string, any>>
  setAssignments: (fn: any) => void
  setViewTaskId: (id: number | null) => void
  setRejectReason: (s: string) => void
  setRejectModal: (v: { taskId: number; approvalId?: number } | null) => void
  setTooltip?: (t: { taskId: number; type: 'approve' | 'reject' } | null) => void
}

const ApprovalList: React.FC<Props> = ({ groupedByKpi, kpiMap, outputsByTask, approvalsByTask, refreshApprovals, setAssignments, setViewTaskId, setRejectReason, setRejectModal, setTooltip }) => {
  const [usersMap, setUsersMap] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    getUsersCached().then(users => {
      if (cancelled) return
      const map: Record<string, string> = {}
      for (const u of users || []) {
        if (u && (u.user_id || u.id)) {
          const id = String(u.user_id ?? u.id)
          map[id] = u.fullname || u.name || u.user_fullname || `${u.first_name || ''} ${u.last_name || ''}`.trim() || map[id] || id
        }
      }
      setUsersMap(map)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const getAssigneeName = (a: any) => {
    if (!a) return 'Chưa rõ'
    if (a.assignee_name) return a.assignee_name
    if (a.assignee_fullname) return a.assignee_fullname
    if (a.assignee_user && (a.assignee_user.fullname || a.assignee_user.name || a.assignee_user.user_fullname)) return a.assignee_user.fullname || a.assignee_user.name || a.assignee_user.user_fullname
    // resolve by numeric id via usersMap
    if (a.assignee_user_id) {
      const key = String(a.assignee_user_id)
      if (usersMap[key]) return usersMap[key]
    }
    if (a.assignee && typeof a.assignee === 'string') return a.assignee
    if (a.assignee && typeof a.assignee === 'object' && (a.assignee.fullname || a.assignee.name)) return a.assignee.fullname || a.assignee.name
    if (a.assignee_user_name) return a.assignee_user_name
    return 'Chưa rõ'
  }

  const getProgress = (taskId: any, assigned: any) => {
    const output = outputsByTask[String(taskId)]
    const total = (output?.total ?? Number(assigned ?? 0)) || 0
    const uploaded = output?.uploaded ?? 0
    const percent = total > 0 ? Math.min(100, Math.round((uploaded / total) * 100)) : 0
    return { uploaded, total, percent }
  }

  const getDateTag = (dateStr: any) => {
    try {
      const d = new Date(dateStr)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const target = new Date(d)
      target.setHours(0, 0, 0, 0)
      const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      if (diff === 0) return { text: 'Hôm nay', color: '#0ea5e9' }
      if (diff < 0) return { text: 'Quá hạn', color: '#ef4444' }
      if (diff === 1) return { text: 'Ngày mai', color: '#ff7300' }
      return null
    } catch (e) {
      return null
    }
  }

  const handleApprove = async (a: any) => {
    const ok = await confirm({ title: 'Xác nhận phê duyệt', message: 'Bạn có chắc muốn phê duyệt kết quả này?', confirmText: 'Phê duyệt', cancelText: 'Hủy' })
    if (!ok) return

    let approval = approvalsByTask[String(a.task_id)]
    if (!approval) approval = (await refreshApprovals())[String(a.task_id)]
    if (!approval) {
      notify.error('Không tìm thấy yêu cầu phê duyệt')
      return
    }
    try {
      const resp = await axios.post(`/api/kpis/approvals/${approval.approval_id}/status`, { status: 'approved' })
      const updatedTask = resp.data?.task
      const dayUpdated = resp.data?.dayUpdated
      if (updatedTask) {
        setAssignments((prev: any[]) => prev.map((t) => (Number(t.task_id) === Number(updatedTask.task_id) ? { ...t, ...updatedTask } : t)))
      } else {
        setAssignments((prev: any[]) => prev.map((t) => (Number(t.task_id) === Number(a.task_id) ? { ...t, status: 'completed' } : t)))
      }

      // If backend returned an updated day (kpi_current updated to target), propagate to assignments
      if (dayUpdated) {
        setAssignments((prev: any[]) => prev.map((t) => {
          if (String(t.chain_kpi_id) === String(dayUpdated.chain_kpi_id) && String(t.date) === String(dayUpdated.date)) {
            return { ...t, kpi_current: dayUpdated.kpi_current ?? dayUpdated.target_value ?? t.kpi_current }
          }
          return t
        }))
      }
      await refreshApprovals()
      notify.success('Đã phê duyệt')
    } catch (err) {
      notify.error('Không thể phê duyệt yêu cầu')
    }
  }

  const handleOpenReject = async (a: any) => {
    let approval = approvalsByTask[String(a.task_id)]
    if (!approval) approval = (await refreshApprovals())[String(a.task_id)]
    if (!approval) {
      notify.error('Không tìm thấy yêu cầu phê duyệt')
      return
    }
    setRejectReason('')
    setRejectModal({ taskId: Number(a.task_id), approvalId: approval.approval_id })
  }

  return (
    <>
      {Object.keys(groupedByKpi).length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: 28, textAlign: 'center', color: '#64748b' }}>Chưa có kết quả nào cần phê duyệt.</div>
      ) : (
        Object.entries(groupedByKpi).map(([kpiId, rows]: [string, any[]]) => {
          const kpi = kpiMap[kpiId]
          return (
            <div key={kpiId}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'end', marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: '#00acfc' }}>{(rows || []).length} kết quả chờ duyệt</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 12 }}>
                {(rows || []).map((a: any) => {
                  const progress = getProgress(a.task_id, a.assigned_kpi)
                  const output = outputsByTask[String(a.task_id)]
                  const links = output?.links ?? []
                  const files = output?.files ?? []
                  const hasOutputs = links.length > 0 || files.length > 0
                  const dateTag = getDateTag(a.date)
                  const cardBorder = dateTag ? `2px solid ${dateTag.color}` : '2px solid #02020286'
                  return (
                    <div key={a.task_id ?? `${a.chain_kpi_id}-${a.date}-${a.assigned_kpi}`} style={{ borderRadius: 10, padding: 14, border: cardBorder, background: '#ffffff' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{Array.isArray(kpi?.kpi_name) && kpi.kpi_name.length ? kpi.kpi_name[0] : kpi?.description || `KPI ${kpiId}`}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Tổng KPI: <strong>{kpi?.total_kpi ?? 0}</strong></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#000000' }}>{new Date(a.date).toLocaleDateString('vi-VN')}</div>
                        {(() => {
                          const tag = getDateTag(a.date)
                          if (!tag) return null
                          return (
                            <div style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: tag.color, color: '#fff', fontWeight: 700 }}>
                              {tag.text}
                            </div>
                          )
                        })()}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0b3b66', marginTop: 6 }}>Nhân viên: {getAssigneeName(a)}</div>
                      <div style={{ marginTop: 10, height: 8, background: '#e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${progress.percent}%`, background: progress.percent >= 100 ? '#16a34a' : '#0ea5e9' }} />
                      </div>
                      <div style={{ fontSize: 12, color: '#475569', marginTop: 8 }}>{progress.uploaded}/{progress.total} album ({progress.percent}%)</div>

                      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => setViewTaskId(Number(a.task_id))}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 8,
                            border: 'none',
                            background: hasOutputs ? '#0f172a' : '#e2e8f0',
                            color: hasOutputs ? '#fff' : '#64748b',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: hasOutputs ? 'pointer' : 'not-allowed'
                          }}
                          disabled={!hasOutputs}
                        >
                          Xem kết quả
                        </button>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <div style={{ position: 'relative', display: 'inline-flex' }}>
                            <button
                              type="button"
                              aria-label="Từ chối"
                              onClick={() => handleOpenReject(a)}
                              onMouseEnter={() => setTooltip?.({ taskId: Number(a.task_id), type: 'reject' })}
                              onMouseLeave={() => setTooltip?.(null)}
                              style={{ padding: 0, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <img src="/image/rejected_icon.png" alt="reject" style={{ width: 50, height: 50 }} />
                            </button>
                          </div>
                          <div style={{ position: 'relative', display: 'inline-flex' }}>
                            <button
                              type="button"
                              aria-label="Phê duyệt"
                              onClick={() => handleApprove(a)}
                              onMouseEnter={() => setTooltip?.({ taskId: Number(a.task_id), type: 'approve' })}
                              onMouseLeave={() => setTooltip?.(null)}
                              style={{ padding: 0, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <img src="/image/approve_icon.png" alt="approve" style={{ width: 45, height: 45 }} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}
    </>
  )
}

export default ApprovalList
