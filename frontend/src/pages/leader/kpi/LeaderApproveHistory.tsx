import  { useEffect, useState } from 'react'
import axios from '../../../api/axios'
import { useAuth } from '../../../contexts/AuthContext'
import { notify } from '../../../utils/notify'
import { getUsersCached } from '../../../utils/usersCache'
import UploadModal from '../../user/kpi/UploadModal'

export default function LeaderApproveHistory() {
  const { user } = useAuth()
  const deptId = (user as any)?.department_id

  const [loading, setLoading] = useState(false)
  const [approvals, setApprovals] = useState<any[]>([])
  const [viewSnapshot, setViewSnapshot] = useState<any | null>(null)
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
    if (!a) return 'N/A'
    if (a.assignee_name) return a.assignee_name
    if (a.assignee_fullname) return a.assignee_fullname
    if (a.assignee_user && (a.assignee_user.fullname || a.assignee_user.name || a.assignee_user.user_fullname)) return a.assignee_user.fullname || a.assignee_user.name || a.assignee_user.user_fullname
    if (a.assignee_user_id) {
      const key = String(a.assignee_user_id)
      if (usersMap[key]) return usersMap[key]
      return key
    }
    if (a.assignee && typeof a.assignee === 'string') return a.assignee
    if (a.assignee && typeof a.assignee === 'object' && (a.assignee.fullname || a.assignee.name)) return a.assignee.fullname || a.assignee.name
    return 'N/A'
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!deptId) return
      setLoading(true)
      try {
        const res = await axios.get('/api/kpis/approvals')
        const rows = Array.isArray(res.data) ? res.data : (res.data?.rows ?? [])
        if (cancelled) return
        setApprovals(rows)
      } catch (err: any) {
        notify.error('Không thể tải lịch sử phê duyệt', err?.response?.data?.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [deptId])

  const parseSnapshot = (snap: any) => {
    try {
      if (!snap) return { albums: [], items: [], links: [] }
      if (typeof snap === 'string') return JSON.parse(snap)
      return snap
    } catch (e) {
      return { albums: [], items: [], links: [] }
    }
  }

  return (
    <div style={{ padding: 20 }}>
      {/** Only show approvals that were explicitly approved or rejected */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontWeight: 'bold', fontSize: 18, color: '#0b3b66' }}>Lịch sử phê duyệt KPI</h2>
        <div />
      </div>

      {loading ? (
        <div style={{ padding: 20, color: '#64748b' }}>Đang tải...</div>
      ) : (approvals.filter(a => { const s = String(a.status || '').toLowerCase(); return s === 'approved' || s === 'rejected' || s === 'reject' }).length === 0) ? (
        <div style={{ padding: 20, color: '#64748b' }}>Không có bản ghi đã phê duyệt hoặc đã từ chối.</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {approvals.filter(a => { const s = String(a.status || '').toLowerCase(); return s === 'approved' || s === 'rejected' || s === 'reject' }).map((a: any) => {
            const snapshot = parseSnapshot(a.outputs_snapshot)
            const status = String(a.status || '').toLowerCase()
            const isApproved = status === 'approved'
            const isRejected = status === 'rejected' || status === 'reject'
            const cardBorder = isRejected ? '2px solid rgba(239, 68, 68, 0.66)' : isApproved ? '1px solid rgba(15,23,42,0.06)' : '1px solid rgba(15,23,42,0.06)'
            const cardBox = isRejected ? '0 10px 36px rgba(239,68,68,0.12)' : isApproved ? '0 6px 20px rgba(15,23,42,0.04)' : 'none'
            const statusColor = isRejected ? '#ef4444' : isApproved ? '#16a34a' : '#0f172a'

            const displayStatus = isApproved ? 'Đã phê duyệt' : isRejected ? 'Đã từ chối' : (a.status || 'Chờ phê duyệp')
            const titleColor = isRejected ? '#ef4444' : '#0f172a'
            const nameColor = isRejected ? '#ef4444' : '#475569'
            const strongColor = isRejected ? '#ef4444' : '#0b3b66'
            const dateColor = isRejected ? '#ef4444' : '#64748b'
            const metaColor = isRejected ? '#ef4444' : '#94a3b8'
            const btnBg = isRejected ? '#ef4444' : '#0f172a'
            const btnColor = '#fff'

            return (
              <div key={a.approval_id} style={{ background: '#fff', borderRadius: 10, padding: 14, border: cardBorder, boxShadow: cardBox }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 800, color: titleColor }}>{Array.isArray(a.kpi_name) && a.kpi_name.length ? a.kpi_name[0] : a.description || `KPI ${a.chain_kpi_id}`}</div>
                    <div style={{ fontSize: 13, color: nameColor, marginTop: 6 }}>Nhân viên: <strong style={{ color: strongColor }}>{getAssigneeName(a)}</strong></div>
                    <div style={{ fontSize: 13, color: dateColor }}>Ngày: {a.date} • KPI giao: {a.assigned_kpi}</div>
                    <div style={{ marginTop: 8 }}>Trạng thái: <strong style={{ color: statusColor }}>{displayStatus}</strong></div>
                    {a.reject_reason && (
                      <div style={{ marginTop: 8, color: isRejected ? '#ef4444' : '#b91c1c' }}>Lý do từ chối: {a.reject_reason}</div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                    <div style={{ fontSize: 12, color: metaColor }}>Nộp: {a.submitted_at ? String(a.submitted_at).split('T')[0] : '-'}</div>
                    <div style={{ fontSize: 12, color: metaColor }}>Duyệt: {a.reviewed_at ? String(a.reviewed_at).split('T')[0] : '-'}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setViewSnapshot(snapshot)}
                        style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: btnBg, color: btnColor, cursor: 'pointer' }}
                      >
                        Xem kết quả
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {viewSnapshot && (
        <UploadModal
          onClose={() => setViewSnapshot(null)}
          mode="view"
          existing={viewSnapshot}
            disableActions={true}
          />
      )}
    </div>
  )
}
