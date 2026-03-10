
import { useEffect, useMemo, useState } from 'react'
import ReactDOM from 'react-dom'
import axios from '../../../api/axios'
import { useAuth } from '../../../contexts/AuthContext'
import { notify } from '../../../utils/notify'
import UploadModal from '../../user/kpi/UploadModal'
import ApprovalList from './ApprovalList'
import LeaderApproveHistory from './LeaderApproveHistory'

type LeaderApprovePageProps = {
  hideFloatingControls?: boolean
  externalView?: 'pending' | 'approved'
  onExternalViewChange?: (v: 'pending' | 'approved') => void
}

export default function LeaderApprovePage({ hideFloatingControls, externalView, onExternalViewChange }: LeaderApprovePageProps) {
  const { user } = useAuth()
  const deptId = (user as any)?.department_id

  const [kpis, setKpis] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [outputsByTask, setOutputsByTask] = useState<Record<string, { uploaded: number; total: number; files?: any[]; links?: any[]; existing?: { albums: any[]; items: any[]; links?: any[] } }>>({})
  const [approvalsByTask, setApprovalsByTask] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [viewTaskId, setViewTaskId] = useState<number | null>(null)
  const [rejectModal, setRejectModal] = useState<{ taskId: number; approvalId?: number } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [approvalView, setApprovalView] = useState<'pending' | 'approved'>('pending')
  const [pendingHover, setPendingHover] = useState(false)
  const [approvedHover, setApprovedHover] = useState(false)

  const effectiveView = externalView ?? approvalView

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!deptId) return
      setLoading(true)
      try {
        const res = await axios.get('/api/kpis/department', { params: { department_id: deptId } })
        const list = Array.isArray(res.data) ? res.data : (res.data?.kpis ?? [])
        if (cancelled) return
        setKpis(list)

        const rows: any[] = []
        await Promise.all(list.map(async (k: any) => {
          try {
            const aRes = await axios.get(`/api/kpis/${encodeURIComponent(String(k.chain_kpi_id))}/assignments`)
            const items = Array.isArray(aRes.data) ? aRes.data : (aRes.data?.rows ?? aRes.data?.assignments ?? [])
            items.forEach((r: any) => rows.push({ ...r, chain_kpi_id: k.chain_kpi_id }))
          } catch {
          }
        }))
        if (cancelled) return
        setAssignments(rows)

        const outputMap: Record<string, { uploaded: number; total: number; files?: any[]; links?: any[]; existing?: { albums: any[]; items: any[]; links?: any[] } }> = {}
        await Promise.all(rows.map(async (r: any) => {
          if (!r.task_id) return
          try {
            const oRes = await axios.get(`/api/kpis/${encodeURIComponent(String(r.chain_kpi_id))}/tasks/${r.task_id}/outputs`)
            const albums = Array.isArray(oRes.data?.albums) ? oRes.data.albums : []
            const items = Array.isArray(oRes.data?.items) ? oRes.data.items : []
            const links = Array.isArray(oRes.data?.links) ? oRes.data.links : []
            const files = Array.isArray(oRes.data?.files) ? oRes.data.files : []
            const albumSet = new Set<number>()
            items.forEach((i: any) => albumSet.add(Number(i.album_id)))
            links.forEach((l: any) => albumSet.add(Number(l.album_id)))
            const uploaded = albumSet.size
            const total = Number(oRes.data?.assigned_kpi ?? r.assigned_kpi ?? albums.length ?? 0) || 0
            outputMap[String(r.task_id)] = { uploaded, total, files, links, existing: { albums, items, links } }
          } catch {
            outputMap[String(r.task_id)] = { uploaded: 0, total: Number(r.assigned_kpi ?? 0) || 0, files: [], links: [], existing: { albums: [], items: [], links: [] } }
          }
        }))
        if (!cancelled) setOutputsByTask(outputMap)

        if (!cancelled) setApprovalsByTask({})
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [deptId])

  const kpiMap = useMemo(() => {
    const map: Record<string, any> = {}
    kpis.forEach((k: any) => { map[String(k.chain_kpi_id)] = k })
    return map
  }, [kpis])

  const reviewAssignments = useMemo(() => {
    return assignments.filter((a: any) => String(a.status || '').toLowerCase() === 'review')
  }, [assignments])

  const groupedByKpi = useMemo(() => {
    const map: Record<string, any[]> = {}
    reviewAssignments.forEach((a: any) => {
      const id = String(a.chain_kpi_id)
      if (!map[id]) map[id] = []
      map[id].push(a)
    })
    return map
  }, [reviewAssignments])

  

  const refreshApprovals = async (view?: 'pending' | 'approved') => {
    const status = view ?? effectiveView
    try {
      const approvalsRes = await axios.get('/api/kpis/approvals', { params: { status } })
      const approvals = Array.isArray(approvalsRes.data) ? approvalsRes.data : (approvalsRes.data?.rows ?? [])
      const map: Record<string, any> = {}
      approvals.forEach((a: any) => { map[String(a.task_id)] = a })
      setApprovalsByTask(map)

      // If we just requested pending and there are none, auto-switch to approved (history)
      if (status === 'pending' && Object.keys(map).length === 0 && effectiveView === 'pending') {
        // No pending approvals — if parent provided a handler, ask it to switch to 'approved'
        if (typeof onExternalViewChange === 'function') {
          try {
            onExternalViewChange('approved')
            const approvedRes = await axios.get('/api/kpis/approvals', { params: { status: 'approved' } })
            const approved = Array.isArray(approvedRes.data) ? approvedRes.data : (approvedRes.data?.rows ?? [])
            const map2: Record<string, any> = {}
            approved.forEach((a: any) => { map2[String(a.task_id)] = a })
            setApprovalsByTask(map2)
            return map2
          } catch (e) {
            setApprovalsByTask({})
            return {}
          }
        }
        // Fallback: switch local view
        setApprovalView('approved')
        try {
          const approvedRes = await axios.get('/api/kpis/approvals', { params: { status: 'approved' } })
          const approved = Array.isArray(approvedRes.data) ? approvedRes.data : (approvedRes.data?.rows ?? [])
          const map2: Record<string, any> = {}
          approved.forEach((a: any) => { map2[String(a.task_id)] = a })
          setApprovalsByTask(map2)
          return map2
        } catch (e) {
          setApprovalsByTask({})
          return {}
        }
      }

      return map
    } catch (err) {
      setApprovalsByTask({})
      return {}
    }
  }

  const ApprovalViewControl = () => {
    const isPendingActive = effectiveView === 'pending' || pendingHover
    const isApprovedActive = effectiveView === 'approved' || approvedHover

    const pendingColor = '#ef4444'
    const approvedColor = '#16a34a'

    const pendingBox = isPendingActive ? `0 8px 24px rgba(239,68,68,0.18)` : 'none'
    const approvedBox = isApprovedActive ? `0 8px 24px rgba(22,163,74,0.18)` : 'none'

    return (
      <div style={{ position: 'fixed', top: 115, right: 80, zIndex: 1000, display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={async () => {
            setApprovalView('pending')
            try {
              const res = await axios.get('/api/kpis/approvals', { params: { status: 'pending' } })
              const approvals = Array.isArray(res.data) ? res.data : (res.data?.rows ?? [])
              if (!approvals || approvals.length === 0) {
                notify.info('chưa có yêu cầu phê duyệt')
                setApprovalView('approved')
                await refreshApprovals('approved')
                return
              }
              const map: Record<string, any> = {}
              approvals.forEach((a: any) => { map[String(a.task_id)] = a })
              setApprovalsByTask(map)
            } catch (err) {
              setApprovalsByTask({})
            }
          }}
          onMouseEnter={() => setPendingHover(true)}
          onMouseLeave={() => setPendingHover(false)}
          aria-pressed={effectiveView === 'pending'}
          style={{
            padding: '8px 12px',
            borderRadius: 999,
            border: `1px solid ${isPendingActive ? pendingColor : '#cbd5e1'}`,
            background: '#ffffff',
            color: isPendingActive ? pendingColor : '#64748b',
            boxShadow: pendingBox,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <img src="/image/rejected_icon.png" alt="chờ phê duyệt" style={{ width:30, height: 30 }} />
          <span>Chờ phê duyệt</span>
        </button>

        <button
          type="button"
          onClick={async () => { setApprovalView('approved'); await refreshApprovals() }}
          onMouseEnter={() => setApprovedHover(true)}
          onMouseLeave={() => setApprovedHover(false)}
          aria-pressed={effectiveView === 'approved'}
          style={{
            padding: '8px 12px',
            borderRadius: 999,
            border: `1px solid ${isApprovedActive ? approvedColor : '#cbd5e1'}`,
            background: '#ffffff',
            color: isApprovedActive ? approvedColor : '#64748b',
            boxShadow: approvedBox,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <img src="/image/approve_icon.png" alt="phê duyệt" style={{ width: 28, height: 28, filter: isApprovedActive ? 'none' : 'none' }} />
          <span>Phê duyệt</span>
        </button>
      </div>
    )
  }

  // if externalView prop is provided, keep local view in sync
  useEffect(() => {
    if (externalView) {
      setApprovalView(externalView)
    }
  }, [externalView])

  const handleReject = async () => {
    if (!rejectModal) return
    const approvalId = rejectModal.approvalId
    const reason = rejectReason.trim()
    if (!approvalId) {
      notify.error('Không tìm thấy yêu cầu phê duyệt')
      return
    }
    if (!reason) {
      notify.error('Vui lòng nhập lý do từ chối')
      return
    }
    try {
      const resp = await axios.post(`/api/kpis/approvals/${approvalId}/status`, { status: 'rejected', reason })
      const updatedTask = resp.data?.task
      const dayUpdated = resp.data?.dayUpdated
      if (updatedTask) {
        setAssignments((prev: any[]) => prev.map((t) => (Number(t.task_id) === Number(updatedTask.task_id) ? { ...t, ...updatedTask } : t)))
      } else {
        setAssignments((prev: any[]) => prev.map((t) => (Number(t.task_id) === Number(rejectModal.taskId) ? { ...t, status: 'doing' } : t)))
      }

      if (dayUpdated) {
        setAssignments((prev: any[]) => prev.map((t) => {
          if (String(t.chain_kpi_id) === String(dayUpdated.chain_kpi_id) && String(t.date) === String(dayUpdated.date)) {
            return { ...t, kpi_current: dayUpdated.kpi_current ?? dayUpdated.target_value ?? t.kpi_current }
          }
          return t
        }))
      }
      await refreshApprovals()
      setRejectModal(null)
      setRejectReason('')
      notify.success('Đã từ chối phê duyệt')
    } catch (err: any) {
      notify.error('Không thể từ chối phê duyệt')
    }
  }

  useEffect(() => {
    if (!deptId) return
    // refresh approvals whenever view or department changes
    refreshApprovals()
  }, [effectiveView, deptId])

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {loading ? (
        <div style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>Đang tải dữ liệu...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {effectiveView === 'pending' ? (
              <ApprovalList
                groupedByKpi={groupedByKpi}
                kpiMap={kpiMap}
                outputsByTask={outputsByTask}
                approvalsByTask={approvalsByTask}
                refreshApprovals={refreshApprovals}
                setAssignments={setAssignments}
                setViewTaskId={setViewTaskId}
                setRejectReason={setRejectReason}
                setRejectModal={setRejectModal}
              />
            ) : (
              <LeaderApproveHistory />
            )}
        </div>
      )}

          {!hideFloatingControls && <ApprovalViewControl />}

      {viewTaskId && (() => {
        const found = reviewAssignments.find((r: any) => Number(r.task_id) === Number(viewTaskId))
        const output = outputsByTask[String(viewTaskId)]
        if (!found || !output?.existing) return null
           return (
          <UploadModal
            onClose={() => setViewTaskId(null)}
            maxResults={Number(found.assigned_kpi) || 0}
            taskId={Number(found.task_id) || undefined}
            chainKpiId={Number(found.chain_kpi_id) || undefined}
            kpiNames={Array.isArray(kpiMap[String(found.chain_kpi_id)]?.kpi_name) ? kpiMap[String(found.chain_kpi_id)]?.kpi_name : undefined}
            mode="view"
            existing={output.existing}
                disableActions={true}
              />
        )
      })()}

      {rejectModal && ReactDOM.createPortal(
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setRejectModal(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: 460, maxWidth: '100%', padding: 18, boxShadow: '0 20px 48px rgba(15,23,42,0.22)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#c00000' }}>Lý do từ chối phê duyệt</div>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Nhập lý do từ chối..."
              style={{ width: '100%', minHeight: 90, borderRadius: 10, border: '1px solid #e2e8f0', padding: '10px 12px', fontSize: 14, resize: 'vertical' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setRejectModal(null)}
                style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#e2e8f0', color: '#0f172a', fontWeight: 700, cursor: 'pointer' }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleReject}
                style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  )
}
