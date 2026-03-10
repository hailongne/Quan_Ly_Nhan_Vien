import { useEffect, useState, useRef } from 'react'
import api from '../../../../api/axios'
import { notify } from '../../../../utils/notify'
import UploadModal from '../../../user/kpi/UploadModal'
import LeaderApprovePage from '../LeaderApprovePage'
import { getUsersCached } from '../../../../utils/usersCache'

export default function TransferredManageStaffKpi() {
  const [kpis, setKpis] = useState<any[]>([])
  const [selectedKpiId, setSelectedKpiId] = useState<number | null>(null)
  const [assignments, setAssignments] = useState<any[]>([])
  const [usersMap, setUsersMap] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [approveModalView, setApproveModalView] = useState<'pending' | 'approved'>('pending')
  useEffect(() => {
    if (!showApproveModal) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        setShowApproveModal(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showApproveModal])
  const [viewExisting, setViewExisting] = useState<any>(null)
  const [viewTaskId, setViewTaskId] = useState<number | null>(null)
  const [viewChainKpiId, setViewChainKpiId] = useState<number | null>(null)
  const [viewMaxResults, setViewMaxResults] = useState<number>(0)
  const [dayTargetsByDate, setDayTargetsByDate] = useState<Record<string, number>>({})
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)

  const weekScrollRef = useRef<HTMLDivElement | null>(null)
  const autoScrolled = useRef<boolean>(false)
  const CELL_WIDTH = 130 // width per day cell (reduced to show more)
  const ROW_HEIGHT = 110 // fixed height per staff row to keep alignment (reduced)
  const ROW_GAP = 8


  const formatDate = (raw: any) => {
    if (!raw) return ''
    try {
      const s = String(raw)
      // always parse full datetime first to keep timezone-correct displayed day in VN
      const d = new Date(s)
      if (isNaN(d.getTime())) return String(raw).split('T')[0]
      return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d)
    } catch (e) {
      return String(raw).split('T')[0]
    }
  }

  const vnDateKey = (date: Date) => date.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
  const vnWeekday = (date: Date) => new Intl.DateTimeFormat('vi-VN', { weekday: 'long', timeZone: 'Asia/Ho_Chi_Minh' }).format(date)

  const toVnDateKey = (raw: any) => {
    if (!raw) return ''
    const s = String(raw)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    const parsed = new Date(s)
    if (isNaN(parsed.getTime())) return ''
    return vnDateKey(parsed)
  }

  const parseDateKey = (key: string) => {
    if (!key) return new Date('')
    const [y, m, d] = key.split('-').map(Number)
    return new Date(Date.UTC(y, (m || 1) - 1, d || 1))
  }

  // Build date keys from startRaw to endRaw inclusive (start is the first day of KPI)
  const buildDateKeys = (startRaw: any, endRaw: any) => {
    const startKey = toVnDateKey(startRaw)
    const endKey = toVnDateKey(endRaw)
    if (!startKey || !endKey) return []
    // parse from YYYY-MM-DD to UTC-midnight
    const start = parseDateKey(startKey)
    const end = parseDateKey(endKey)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return []
    const keys: string[] = []
    const cur = new Date(start)
    while (cur <= end) {
      keys.push(vnDateKey(cur))
      cur.setDate(cur.getDate() + 1)
      if (keys.length > 370) break
    }
    return keys
  }

  

  useEffect(() => {
    async function load() {
      try {
        const [kpiRes] = await Promise.all([api.get('/api/kpis/department')])
        const rawList = Array.isArray(kpiRes.data) ? kpiRes.data : []
        const list = rawList.filter((it: any) => Number(it?.transfer_source_kpi_id ?? 0) > 0)
        setKpis(list)
        const users = await getUsersCached()
        const map: Record<number, string> = {}
        for (const u of users) map[Number(u.user_id)] = u.full_name || u.name || `${u.user_id}`
        setUsersMap(map)
      } catch (err) {
        console.error('[ManageStaffKpi] load error', err)
      }
    }
    load()
  }, [])

  // when kpis are loaded, default-select the first KPI if none selected
  useEffect(() => {
    if ((!selectedKpiId || Number(selectedKpiId) === 0) && Array.isArray(kpis) && kpis.length > 0) {
      const first = kpis[0]
      const id = Number(first?.chain_kpi_id ?? first?.id ?? 0)
      if (id) setSelectedKpiId(id)
    }
  }, [kpis])

  // fetch assignments: when none selected, load for all KPIs
  useEffect(() => {
    let cancelled = false
    async function loadAssignments() {
      setLoading(true)
      try {
        if (!selectedKpiId) {
          setAssignments([])
          return
        }
        const res = await api.get(`/api/kpis/${selectedKpiId}/assignments`)
        if (cancelled) return
        setAssignments(Array.isArray(res.data) ? res.data : [])
      } catch (err) {
        console.error('[ManageStaffKpi] fetch assignments', err)
        if (!cancelled) setAssignments([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadAssignments()
    return () => {
      cancelled = true
    }
  }, [selectedKpiId])

  // listen for updates from other parts of the app (e.g., when assignments change)
  useEffect(() => {
    const handler = (e: any) => {
      try {
        const id = Number(e?.detail?.chain_kpi_id || 0)
        if (!id || !selectedKpiId) return
        if (Number(id) !== Number(selectedKpiId)) return
        // refetch assignments and day targets for the current KPI
        (async () => {
          try {
            const [res] = await Promise.all([api.get(`/api/kpis/${selectedKpiId}/assignments`), api.get(`/api/kpis/${selectedKpiId}`)])
            setAssignments(Array.isArray(res.data) ? res.data : [])
          } catch (err) {
            console.error('[ManageStaffKpi] refresh after event failed', err)
          }
        })()
      } catch (err) { /* ignore */ }
    }
    window.addEventListener('kpiAssignmentsUpdated', handler)
    return () => window.removeEventListener('kpiAssignmentsUpdated', handler)
  }, [selectedKpiId])

  // listen for a direct day update payload from backend and update local day targets map
  useEffect(() => {
    const handler = (e: any) => {
      try {
        const day = e && e.detail ? e.detail : null
        if (!day || !selectedKpiId) return
        if (Number(day.chain_kpi_id) !== Number(selectedKpiId)) return
        const key = toVnDateKey(day.date)
        if (!key) return
        // prefer target_value if present, otherwise fall back to kpi_current
        const val = Number(day.target_value ?? day.kpi_current ?? 0)
        setDayTargetsByDate(prev => ({ ...prev, [key]: val }))
      } catch (err) { /* ignore */ }
    }
    window.addEventListener('kpiDayUpdated', handler)
    return () => window.removeEventListener('kpiDayUpdated', handler)
  }, [selectedKpiId])

  // fetch chain_kpi_days targets for the selected KPI so footer shows target_value
  useEffect(() => {
    let cancelled = false
    async function loadDayTargets() {
      if (!selectedKpiId) {
        setDayTargetsByDate({})
        return
      }
      try {
        const res = await api.get(`/api/kpis/${selectedKpiId}`)
        const weeks = res.data?.weeks || res.data?.weeks || []
        const map: Record<string, number> = {}
        for (const w of weeks) {
          const days = Array.isArray(w.days) ? w.days : []
          for (const d of days) {
            try {
              const key = toVnDateKey(d.date)
              if (!key) continue
              map[key] = Number(d.target_value || 0)
            } catch (e) { /* ignore malformed */ }
          }
        }
        if (!cancelled) setDayTargetsByDate(map)
      } catch (err) {
        console.error('[ManageStaffKpi] loadDayTargets error', err)
        if (!cancelled) setDayTargetsByDate({})
      }
    }
    loadDayTargets()
    return () => { cancelled = true }
  }, [selectedKpiId])

  const selectedKpi = selectedKpiId ? kpis.find((k) => Number(k.chain_kpi_id) === Number(selectedKpiId)) : null
  const dateKeys = selectedKpi ? buildDateKeys(selectedKpi.start_date, selectedKpi.end_date) : []

  const weekChunks: string[][] = []
  for (let i = 0; i < dateKeys.length; i += 7) {
    weekChunks.push(dateKeys.slice(i, i + 7))
  }

  // group assignments by user
  const grouped: Record<string, { userId: number; name: string; total: number; completed: number; byDate: Record<string, number>; byDateCompleted: Record<string, boolean>; byDateStatus: Record<string, string> }> = {}
  const statusPriority = ['completed', 'review', 'doing', 'in_progress', 'pending', 'not_completed']
  for (const a of assignments) {
    const uid = Number(a.assignee_user_id || 0)
    const date = toVnDateKey(a?.date)
    const val = Number(a.assigned_kpi || 0)
    const status = (a.status || '').toString().toLowerCase()
    if (!grouped[uid]) grouped[uid] = { userId: uid, name: usersMap[uid] || String(uid), total: 0, completed: 0, byDate: {}, byDateCompleted: {}, byDateStatus: {} }
    grouped[uid].total += val
    grouped[uid].byDate[date] = (grouped[uid].byDate[date] || 0) + val
    if (status === 'completed') {
      grouped[uid].byDateCompleted[date] = true
      grouped[uid].completed = (grouped[uid].completed || 0) + val
    }
    // compute the highest-priority status for this date
    const prev = grouped[uid].byDateStatus[date]
    if (!prev) {
      grouped[uid].byDateStatus[date] = status
    } else {
      const prevIdx = statusPriority.indexOf(prev) === -1 ? statusPriority.length : statusPriority.indexOf(prev)
      const newIdx = statusPriority.indexOf(status) === -1 ? statusPriority.length : statusPriority.indexOf(status)
      if (newIdx < prevIdx) grouped[uid].byDateStatus[date] = status
    }
  }

  const rows = Object.values(grouped).sort((a, b) => b.total - a.total)
  const visibleRows = selectedUserId ? rows.filter(r => Number(r.userId) === Number(selectedUserId)) : rows

  // totals per date across all users for the selected KPI (flat across dateKeys)
  const totalsByDate: Record<string, number> = {}
  for (const k of dateKeys) {
    totalsByDate[k] = 0
  }
  for (const r of visibleRows) {
    for (const k of dateKeys) {
      totalsByDate[k] = (totalsByDate[k] || 0) + (r.byDate[k] || 0)
    }
  }
  // also compute assigned people and completed people per date (for footer completion check)
  const assignedPeopleByDate: Record<string, number> = {}
  const completedPeopleByDate: Record<string, number> = {}
  for (const a of assignments) {
    const dk = toVnDateKey(a?.date)
    if (!dk) continue
    assignedPeopleByDate[dk] = (assignedPeopleByDate[dk] || 0) + 1
    if ((a.status || '').toString().toLowerCase() === 'completed') completedPeopleByDate[dk] = (completedPeopleByDate[dk] || 0) + 1
  }

  useEffect(() => {
    if (!weekChunks || weekChunks.length === 0) return
    const todayKey = vnDateKey(new Date())
    const idx = weekChunks.findIndex((w) => Array.isArray(w) && w.includes(todayKey))
    if (idx === -1) return
    // scroll the shared week scroll container to the page for today's week
    try {
      const sc = weekScrollRef.current
      if (sc && !autoScrolled.current) {
        const pageWidth = CELL_WIDTH * 7
        requestAnimationFrame(() => {
          sc.scrollTo({ left: idx * pageWidth, behavior: 'smooth' })
        })
        autoScrolled.current = true
      }
    } catch (e) {
      // ignore
    }
  }, [weekChunks, rows.length, selectedKpiId])

  return (
    <div style={{ padding: 12, background: '#fff', borderRadius: 8 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }}>
              {kpis.map((k) => {
                const id = Number(k.chain_kpi_id)
                const active = selectedKpiId === id
                const title = (Array.isArray(k.kpi_name) ? k.kpi_name.join(', ') : k.kpi_name) || `KPI #${id}`
                const start = formatDate(k.start_date)
                const end = formatDate(k.end_date)
                const total = k.total_kpi || k.total_kpi || 0
                // Ẩn thông tin số ngày làm việc ở thẻ KPI để giao diện gọn hơn.
                return (
                  <button
                    key={id}
                    onClick={() => setSelectedKpiId(id)}
                    style={{
                      minWidth: 180,
                      maxWidth: 260,
                      background: '#fff',
                      borderRadius: 10,
                      padding: '12px',
                      boxShadow: active ? '0 6px 18px rgba(219,39,119,0.12)' : '0 1px 6px rgba(16,24,40,0.04)',
                      border: active ? '2px solid #db2777' : '1px solid #f3e8ef',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      boxSizing: 'border-box',
                      flexShrink: 0
                    }}
                  >
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', width: '100%' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#9d174d', marginBottom: 6, lineHeight: '1.1' }}>{title}</div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{start} — {end}</div>
                      
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', marginLeft: 8 }}>
                        <div style={{ background: '#fdf2f8', color: '#be185d', padding: '10px 14px', borderRadius: 8, fontWeight: 800, fontSize: 16, minWidth: 68, textAlign: 'center' }}>{total} KPI</div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              disabled={!selectedKpiId}
              onClick={() => {
                if (!selectedKpiId) {
                  try { notify.info('Chọn KPI', 'Vui lòng chọn một KPI để phê duyệt') } catch (e) {}
                  return
                }
                setShowApproveModal(true)
              }}
              style={{
                background: selectedKpiId ? '#000000' : '#f1f5f9',
                color: selectedKpiId ? '#ffffff' : '#94a3b8',
                border: selectedKpiId ? '1px solid #0b0b0b' : '1px solid #e6eef8',
                padding: '10px 14px',
                borderRadius: 50,
                cursor: selectedKpiId ? 'pointer' : 'not-allowed'
              }}
            >
              Phê duyệt
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 5 }}>
        {loading ? (
          <div style={{ color: '#64748b' }}>Đang tải phân công...</div>
        ) : rows.length === 0 ? (
          <div style={{ color: '#64748b' }}>Chưa có phân công.</div>
          ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Left column: staff names and totals */}
            <div style={{ minWidth: 180, borderRadius: 8, boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {rows.map((r) => {
                  const isHidden = selectedUserId ? Number(r.userId) !== Number(selectedUserId) : false
                  return (
                    <div
                      key={r.userId}
                      onClick={() => setSelectedUserId(prev => prev === r.userId ? null : r.userId)}
                      onMouseEnter={() => setHoveredRow(r.userId)}
                      onMouseLeave={() => setHoveredRow(null)}
                      style={{
                        height: ROW_HEIGHT,
                        boxSizing: 'border-box',
                        display: 'flex',
                        alignItems: 'center',
                        cursor: isHidden ? 'default' : 'pointer',
                        transition: 'transform 220ms ease, opacity 200ms ease, box-shadow 200ms ease',
                        opacity: isHidden ? 0.18 : 1,
                        transform: isHidden ? 'scaleY(0.98)' : 'none',
                        pointerEvents: isHidden ? 'none' : 'auto',
                        marginBottom: ROW_GAP
                      }}
                    >
                      <div style={{ borderRadius: 10, padding: '12px 12px', border: selectedUserId === r.userId ? '2px solid #db2777' : (hoveredRow === r.userId ? '2px solid #fbcfe8' : '1px solid #f3e8ef'), display: 'flex', gap: 10, alignItems: 'center', background: selectedUserId === r.userId ? '#fdf2f8' : (hoveredRow === r.userId ? '#fff1f7' : '#fff'), width: '100%', boxShadow: selectedUserId === r.userId ? '0 12px 34px rgba(219,39,119,0.10)' : (hoveredRow === r.userId ? '0 10px 30px rgba(2,6,23,0.06)' : '0 6px 18px rgba(2,6,23,0.04)'), transition: 'all 160ms ease' }}>
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <div style={{ fontWeight: 900, color: '#9d174d', fontSize: 14, lineHeight: '1.05' }}>{r.name}</div>
                          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ fontSize: 12, color: '#475569' }}>hoàn thành:</div>
                            <div style={{ fontWeight: 900, color: '#16a34a', fontSize: 13 }}>{(r.completed || 0)}/{r.total || 0}kpi</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Right: horizontally scrollable week pages */}
            <div style={{ flex: 1, overflowX: 'auto' }} ref={weekScrollRef}>
              <div style={{ display: 'flex', gap: 8, paddingBottom: 8, alignItems: 'flex-start' }}>
                {weekChunks.map((weekDates, pageIdx) => (
                  <div key={pageIdx} style={{ flex: '0 0 auto', width: CELL_WIDTH * 7, scrollSnapAlign: 'start' }}>
                    <div style={{ borderRadius: 8 }}>
                      {/* For each staff row, render a row of 7 cells */}
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {rows.map((r) => (
                          <div key={`${pageIdx}-${r.userId}`} style={{ display: 'grid', gridTemplateColumns: `repeat(7, 1fr)`, gap: 8, minHeight: ROW_HEIGHT, alignItems: 'stretch', transition: 'transform 220ms ease, opacity 200ms ease', opacity: selectedUserId && Number(r.userId) !== Number(selectedUserId) ? 0.12 : 1, transform: selectedUserId && Number(r.userId) !== Number(selectedUserId) ? 'scaleY(0.98)' : 'none', pointerEvents: selectedUserId && Number(r.userId) !== Number(selectedUserId) ? 'none' : 'auto', marginBottom: ROW_GAP }}>
                            {weekDates.map((d) => {
                              const dt = parseDateKey(d)
                              const weekday = vnWeekday(dt)
                              const count = r.byDate[d] || 0
                              const isZero = count === 0
                              const todayKey = vnDateKey(new Date())
                              const isToday = d === todayKey
                              const isCompleted = !!(r.byDateCompleted && r.byDateCompleted[d])
                              const isReview = (r.byDateStatus && r.byDateStatus[d]) === 'review'
                              const primaryColor = isToday ? '#db2777' : (isReview ? '#be185d' : (isCompleted ? '#16a34a' : '#a21caf'))
                              return (
                                <div
                                  key={d}
                                  onMouseEnter={() => setHoveredRow(r.userId)}
                                  onMouseLeave={() => setHoveredRow(null)}
                                  style={{
                                    position: 'relative',
                                    padding: 6,
                                    borderRadius: 10,
                                    background: isZero ? (isCompleted ? '#d1fae5' : (isReview ? '#fff0f6' : '#f3f4f6')) : (isCompleted ? '#d1fae5' : (isReview ? '#fff0f6' : '#fff')),
                                    border: isToday ? `2px solid ${primaryColor}` : (isReview ? `2px solid #f472b6` : (isCompleted ? `2px solid #16a34a` : (isZero ? '1px solid #e5e7eb' : '1px solid #ede9fe'))),
                                    boxShadow: isToday ? '0 2px 20px rgba(219,39,119,0.45)' : 'none',
                                    transition: 'all 150ms ease',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between'
                                  }}
                                >
                                  <div>
                                    <div style={{ fontSize: 11, color: isZero ? '#9ca3af' : '#9d174d' }}>
                                      <span>{weekday}, </span>
                                      <span style={{ fontWeight: 800, color: isZero ? '#9ca3af' : (isToday ? primaryColor : '#9d174d') }}>{formatDate(d)}</span>
                                    </div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: (() => {
                                      if (isZero) return '#9ca3af'
                                      const s = (r.byDateStatus && r.byDateStatus[d]) || ''
                                      if (s === 'doing' || s === 'in_progress') return '#f59e0b'
                                      if (isToday) return primaryColor
                                      if (isReview) return '#be185d'
                                      if (isCompleted) return '#065f46'
                                      return '#6b7280'
                                    })() }}>
                                      {(() => {
                                        const s = (r.byDateStatus && r.byDateStatus[d]) || ''
                                        if (!s || s === 'pending' || s === 'not_completed') return 'Chưa thực hiện'
                                        if (s === 'doing' || s === 'in_progress') return 'Đang làm'
                                        if (s === 'review') return 'Đang phê duyệt'
                                        if (s === 'completed') return 'Hoàn thành ✓'
                                        return 'Đã nhận KPI'
                                      })()}
                                    </div>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <div style={{ fontSize: 30, fontWeight: 800, color: isZero ? '#9ca3af' : (isToday ? primaryColor : '#9d174d') }}>{count}</div>
                                    <div style={{ marginLeft: 6, fontSize: 12, fontWeight: 700, color: isZero ? '#9ca3af' : '#9d174d' }}>KPI</div>
                                  </div>

                                  {(() => {
                                    const foundAssignment = assignments.find((a: any) => Number(a.assignee_user_id) === Number(r.userId) && toVnDateKey(a?.date) === d)
                                    if (!(isCompleted || isReview)) return null
                                    return (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          const found = foundAssignment
                                          const taskId = Number(found?.task_id ?? found?.taskId)
                                          const chainKpiId = Number(found?.chain_kpi_id ?? found?.kpiId ?? selectedKpiId)
                                          const maxResults = Number(found?.assigned_kpi ?? found?.assignedKpi ?? 0)
                                          setViewTaskId(taskId || null)
                                          setViewChainKpiId(chainKpiId || null)
                                          setViewMaxResults(maxResults || 0)
                                          if (!taskId || !chainKpiId) {
                                            setViewExisting(null)
                                            try {
                                              if (typeof window !== 'undefined' && String(window.location.pathname).includes('/leader')) {
                                                notify.info('Chưa có kết quả', 'Không có kết quả để xem')
                                                return
                                              }
                                            } catch (e) {
                                              // ignore
                                            }
                                            setShowUpload(true)
                                            return
                                          }
                                          try {
                                            const res = await api.get(`/api/kpis/${chainKpiId}/tasks/${taskId}/outputs`)
                                            setViewExisting(res?.data || null)
                                          } catch (err) {
                                            setViewExisting(null)
                                          }
                                          setShowUpload(true)
                                        }}
                                        style={{ position: 'absolute', top: 40, right: 0, width: 36, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
                                        title="Xem kết quả"
                                      >
                                        <img src="/image/eye_icon.png" alt="view" style={{ width: 18, height: 18 }} />
                                      </button>
                                    )
                                  })()}
                                </div>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Per-page footer rows that align exactly under each week page */}
              <div style={{ marginTop: 12, paddingBottom: 8 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {weekChunks.map((weekDates, pageIdx) => (
                    <div key={`footer-page-${pageIdx}`} style={{ flex: '0 0 auto', width: CELL_WIDTH * 7, scrollSnapAlign: 'start' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(7, 1fr)`, gap: 8 }}>
                        {weekDates.map((d) => {
                          const total = (dayTargetsByDate[d] ?? totalsByDate[d]) || 0
                          const isZero = total === 0
                          const assignedCount = assignedPeopleByDate[d] || 0
                          const completedCount = completedPeopleByDate[d] || 0
                          const isFullyCompleted = assignedCount > 0 && assignedCount === completedCount
                          if (isFullyCompleted) {
                            return (
                              <div key={`footer-${d}`} style={{ padding: '6px 6px', borderRadius: 10, background: '#d1fae5', border: '1px solid #16a34a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, fontWeight: 700, color: '#065f46' }}>
                                  <div>{formatDate(d)}</div>
                                  <div style={{ fontSize: 13,fontWeight: 700 }}> ✓</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                                  <div style={{ fontSize: 24, fontWeight: 900, color: '#065f46' }}>{total}</div>
                                  <div style={{ fontSize: 11, fontWeight: 800, color: '#065f46' }}>KPI</div>
                                </div>
                              </div>
                            )
                          }
                          return (
                            <div key={`footer-${d}`} style={{ padding: '6px 6px', borderRadius: 10, background: isZero ? '#f8fafc' : '#ffffff', border: isZero ? '1px solid #e6eaf0' : '1px solid #e6eef8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: isZero ? 'none' : '0 6px 18px rgba(2,6,23,0.04)', opacity: isZero ? 0.85 : 1 }}>
                              <div style={{ fontSize: 11, color: isZero ? '#9ca3af' : '#6b7280', marginBottom: 6 }}>{formatDate(d)}</div>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                                <div style={{ fontSize: 22, fontWeight: 900, color: isZero ? '#9ca3af' : '#9d174d' }}>{total}</div>
                                <div style={{ fontSize: 11, fontWeight: 800, color: isZero ? '#9ca3af' : '#9d174d' }}>KPI</div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
        {showUpload && (
          <UploadModal
            onClose={() => setShowUpload(false)}
            existing={viewExisting || null}
            taskId={viewTaskId ?? undefined}
            chainKpiId={viewChainKpiId ?? undefined}
            maxResults={viewMaxResults || undefined}
              mode={viewExisting ? 'view' : 'upload'}
              disableActions={true}
            />
        )}
            {showApproveModal && (
              <div
                role="dialog"
                aria-modal="true"
                onClick={() => setShowApproveModal(false)}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}
              >
                <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: '98%', maxWidth: 1200, maxHeight: '94%', overflow: 'auto', boxShadow: '0 20px 48px rgba(15,23,42,0.22)' }}>
                  {/* Modal header with approval buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #eef2f7' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={async () => { setApproveModalView('pending'); /* LeaderApprovePage will pick this up via prop */ }}
                        onMouseEnter={() => {}}
                        onMouseLeave={() => {}}
                        aria-pressed={approveModalView === 'pending'}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 999,
                          border: `1px solid ${approveModalView === 'pending' ? '#ef4444' : '#cbd5e1'}`,
                          background: '#fff',
                          color: approveModalView === 'pending' ? '#ef4444' : '#64748b',
                          boxShadow: approveModalView === 'pending' ? '0 8px 22px rgba(239,68,68,0.22)' : '0 6px 16px rgba(15,23,42,0.12)',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          cursor: 'pointer'
                        }}
                      >
                        <img src="/image/rejected_icon.png" alt="chờ phê duyệt" style={{ width:20, height: 20 }} />
                        <span>Chờ phê duyệt</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => { setApproveModalView('approved'); }}
                        aria-pressed={approveModalView === 'approved'}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 999,
                          border: `1px solid ${approveModalView === 'approved' ? '#16a34a' : '#cbd5e1'}`,
                          background: '#fff',
                          color: approveModalView === 'approved' ? '#16a34a' : '#64748b',
                          boxShadow: approveModalView === 'approved' ? '0 8px 22px rgba(22,163,74,0.22)' : '0 6px 16px rgba(15,23,42,0.12)',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          cursor: 'pointer'
                        }}
                      >
                        <img src="/image/approve_icon.png" alt="phê duyệt" style={{ width:20, height: 20 }} />
                        <span>Phê duyệt</span>
                      </button>
                    </div>
                  </div>

                  <div style={{ padding: 12 }}>
                      <LeaderApprovePage hideFloatingControls externalView={approveModalView} onExternalViewChange={(v) => setApproveModalView(v)} />
                    </div>
                </div>
              </div>
            )}
    </div>
  )
}
