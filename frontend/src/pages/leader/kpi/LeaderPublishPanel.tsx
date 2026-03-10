import { useEffect, useState } from 'react'
import React from 'react'
import axios from '../../../api/axios'
import LeaderAssignForm from './LeaderAssignForm'
import { useAuth } from '../../../contexts/AuthContext'

interface Props {
  initialId?: number | null
}

export default function LeaderPublishPanel({ initialId = null }: Props) {
  const { user } = useAuth()
  const leaderDeptId = (user as any)?.department_id ?? null
  const [availableKpis, setAvailableKpis] = useState<any[] | null>(null)
  const [loadingKpis, setLoadingKpis] = useState(false)
  const [kpi, setKpi] = useState<any | null>(null)
  const [weeks, setWeeks] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emptyNotice, setEmptyNotice] = useState<string | null>(null)
  const weekRefs = React.useRef<Array<HTMLDivElement | null>>([])
  const [selectedWeek, setSelectedWeek] = useState<any | null>(null)
  const isTransferredKpi = (it: any) => Number(it?.transfer_source_kpi_id ?? 0) > 0
  const storedId = (() => { try { const v = localStorage.getItem('leader.publish.kpiId'); return v ? Number(v) : null } catch (_) { return null } })()
  
  const weekBoxBase: React.CSSProperties = { borderRadius: 6, padding: 10, marginBottom: 10, position: 'relative', background: '#ffffff', border: '1px solid #E0F2FE', paddingLeft: 20 }
  const leftBarStyle: React.CSSProperties = { position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, background: 'linear-gradient(to right,#BAE6FD,transparent)', pointerEvents: 'none' }
  const hrTopStyle: React.CSSProperties = { position: 'absolute', left: 0, right: 0, top: 0, height: 1, background: 'linear-gradient(to right,#BAE6FD,transparent)', opacity: 0.9, pointerEvents: 'none' }
  const hrBottomStyle: React.CSSProperties = { position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, background: 'linear-gradient(to right,#BAE6FD,transparent)', opacity: 0.9, pointerEvents: 'none' }
  const weekHeaderRow: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6, flexWrap: 'wrap' }
  const weekRangeStyle: React.CSSProperties = { fontSize: 12, color: '#0284C7' }
  const weekMetaStyle: React.CSSProperties = { display: 'flex', fontSize: 12, alignItems: 'center', justifyContent: 'space-between', gap: 8, color: '#0369A1', marginBottom: 6 }
  const headerAreaStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
  const daysGridStyle: React.CSSProperties = { display: 'grid', fontSize: 12, gridTemplateColumns: 'repeat(7,1fr)', gap: 5 }
  const dayBaseStyle: React.CSSProperties = { textAlign: 'center', padding: 6, borderRadius: 6, minHeight: 48, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer' }
  // Use consistent 2px border / box-sizing so adding selection visuals doesn't shift layout
  const dayBaseSized: React.CSSProperties = { ...dayBaseStyle, boxSizing: 'border-box', border: '2px solid transparent', position: 'relative', transition: 'transform 180ms ease, box-shadow 220ms ease, background 180ms ease' }
  const getDayStyle = (completed: boolean, noTarget: boolean): React.CSSProperties => {
    if (completed) return { ...dayBaseSized, background: '#d1fae5', color: '#065f46', borderColor: '#bbf7d0' };
    if (noTarget) return { ...dayBaseSized, background: '#f0f9ff', color: '#60a5fa', borderColor: '#bfdbfe' };
    return { ...dayBaseSized, background: '#eff6ff', color: '#075985', borderColor: '#bae6fd' };
  }
  const placeholderDayStyle: React.CSSProperties = { ...dayBaseStyle, background: '#f8fafc', color: '#94a3b8', border: '1px dashed #e2e8f0', cursor: 'default' };

  const toDateOnly = (d: string | Date) => {
    const dt = typeof d === 'string' ? new Date(d.includes('T') ? d : `${d}T00:00:00`) : new Date(d);
    return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  }
  const ymd = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const addDays = (dt: Date, n: number) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + n);

  function AssignButton({ onAssign, disabled, children }: { onAssign: () => void, disabled?: boolean, children?: React.ReactNode }){
    const [hover, setHover] = useState(false);
    const base: React.CSSProperties = {
      padding: '6px 10px',
      borderRadius: 12,
      border: '1px solid rgba(3,105,161,0.12)',
      background: disabled ? '#ffffff' : (hover ? 'linear-gradient(90deg,#f0f8ff,#e6f2ff)' : '#fff'),
      color: disabled ? '#94a3b8' : '#04538a',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontWeight: 600,
      fontSize: 13,
      boxShadow: !disabled && hover ? '0 6px 18px rgba(3,105,161,0.08)' : 'none',
      transition: 'all 140ms ease',
      opacity: disabled ? 0.85 : 1,
      lineHeight: 1
    };
    return (
      <button
        type="button"
        aria-label={typeof children === 'string' ? String(children) : 'Phân công'}
        aria-disabled={disabled ? true : undefined}
        onClick={(e) => { e.stopPropagation(); if (!disabled) onAssign(); }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={base}
        title={disabled ? 'Tổng KPI của tuần bằng 0 — không thể phân công' : 'Phân công'}
        disabled={disabled}
      >
        {children ?? 'Phân công cho nhân viên'}
      </button>
    )
  }

  // Build map of incoming days by date string (yyyy-mm-dd)
  const daysMap: Record<string, any> = {};
  weeks.forEach((w: any) => {
    const backendWeekIndex = Number(w.week_index ?? w.weekIndex ?? -1);
    (Array.isArray(w.days) ? w.days : []).forEach((d: any) => {
      try {
        if (!d || typeof d !== 'object' || !d.date) return
        const key = ymd(toDateOnly(d.date));
        if (!key || key.includes('NaN')) return
        daysMap[key] = { ...d, __backendWeekIndex: backendWeekIndex };
      } catch (_) { /* ignore malformed */ }
    });
  });

  let globalStart: Date | null = null
  let globalEnd: Date | null = null
  try {
    if (kpi?.start_date) globalStart = toDateOnly(kpi.start_date)
    if (kpi?.end_date) globalEnd = toDateOnly(kpi.end_date)
  } catch (_) { /* ignore */ }

  const dayKeys = Object.keys(daysMap).sort()
  if (!globalStart && dayKeys.length) globalStart = toDateOnly(dayKeys[0])
  if (!globalEnd && dayKeys.length) globalEnd = toDateOnly(dayKeys[dayKeys.length - 1])

  const weekItems: Array<any> = []
  if (globalStart && globalEnd && globalStart <= globalEnd) {
    let cursor = new Date(globalStart)
    let weekCounter = 0
    let guard = 0

    while (cursor <= globalEnd && guard < 120) {
      guard += 1
      const dayOfWeek = cursor.getDay()
      let blockStart = new Date(cursor)
      let blockEnd: Date

      if (weekCounter === 0) {
        const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
        blockEnd = addDays(blockStart, daysToSunday)
      } else {
        const startDOW = blockStart.getDay()
        if (startDOW !== 1) {
          const offset = (8 - startDOW) % 7
          blockStart = addDays(blockStart, offset)
        }
        blockEnd = addDays(blockStart, 6)
      }

      if (blockEnd > globalEnd) blockEnd = new Date(globalEnd)
      if (Number.isNaN(blockStart.getTime()) || Number.isNaN(blockEnd.getTime())) break

      const bDayOfWeek = blockStart.getDay()
      const daysSinceMonday = bDayOfWeek === 0 ? 6 : bDayOfWeek - 1
      const monday = addDays(blockStart, -daysSinceMonday)

      const days: Array<any | null> = []
      const realDays: Array<any> = []
      for (let i = 0; i < 7; i += 1) {
        const d = addDays(monday, i)
        const key = ymd(d)
        if (d < globalStart || d > globalEnd) {
          days.push(null)
          continue
        }
        const src = daysMap[key]
        if (!src) {
          days.push(null)
          continue
        }
        const target = Number(src.target_value || 0)
        const dayIsCompleted = Number(src.kpi_current || 0) >= target
        const hasNoTarget = target === 0
        const dayObj = {
          key,
          date: key,
          target,
          target_value: target,
          totalAssigned: Number(src.totalAssigned ?? src.assigned_total ?? src.assigned_kpi ?? src.assigned ?? 0) || 0,
          assigned_total: Number(src.assigned_total ?? src.totalAssigned ?? src.assigned_kpi ?? src.assigned ?? 0) || 0,
          assigned_kpi: Number(src.assigned_kpi ?? src.assigned_total ?? src.totalAssigned ?? src.assigned ?? 0) || 0,
          dayIsCompleted,
          hasNoTarget,
          dayLabel: new Date(key).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' }),
          title: dayIsCompleted ? 'Đã hoàn thành' : hasNoTarget ? 'Chưa có KPI được phân bổ' : 'Chưa hoàn thành',
          __backendWeekIndex: Number(src.__backendWeekIndex ?? -1)
        }
        days.push(dayObj)
        realDays.push(dayObj)
      }

      const weekTarget = realDays.reduce((sum: number, d: any) => sum + (Number(d?.target || 0) || 0), 0)
      const representativeWeekIndex = realDays.find((d: any) => Number(d.__backendWeekIndex) >= 0)?.__backendWeekIndex

      weekItems.push({
        weekIndex: Number(representativeWeekIndex ?? weekCounter),
        displayWeekNumber: weekItems.length + 1,
        start_date: ymd(blockStart),
        end_date: ymd(blockEnd),
        display_start: ymd(blockStart),
        display_end: ymd(blockEnd),
        weekTarget,
        days
      })

      cursor = addDays(blockEnd, 1)
      if (Number.isNaN(cursor.getTime())) break
      weekCounter += 1
    }
  }

  useEffect(() => {
    let cancelled = false
    async function load(id?: number | null) {
      if (!id) return
      setLoading(true)
      setError(null)
      try {
        const res = await axios.get(`/api/kpis/${id}`)
        if (cancelled) return
        const data = res.data?.kpi ?? res.data
        if (isTransferredKpi(data)) {
          try { localStorage.removeItem('leader.publish.kpiId') } catch (_) {}
          setKpi(null)
          setWeeks([])
          setEmptyNotice('Tab Giao KPI chỉ hiển thị KPI ban hành. KPI điều phối nằm ở tab KPI điều phối.')
          try {
            const listRes = await axios.get('/api/kpis/department')
            const items = Array.isArray(listRes.data) ? listRes.data : listRes.data?.kpis ?? listRes.data?.items ?? []
            const filtered = items.filter((it: any) => {
              if (!leaderDeptId) return false
              const did = it.department_id ?? it.departmentId ?? it.department ?? null
              return Number(did) === Number(leaderDeptId) && !isTransferredKpi(it)
            })
            setAvailableKpis(filtered)
          } catch (_) {
            setAvailableKpis([])
          }
          return
        }
        setKpi(data || null)
        setWeeks(res.data?.weeks || [])
        setEmptyNotice(null)
        // reset refs
        weekRefs.current = []
        try { localStorage.setItem('leader.publish.kpiId', String(id)) } catch (_) { /* ignore */ }
      } catch (err: any) {
        if (cancelled) return
        const status = err?.response?.status
        const backendMsg = err?.response?.data?.message || err?.message
        if (status === 403 || status === 404 || String(backendMsg).toLowerCase().includes('kpi not found')) {
          try { localStorage.removeItem('leader.publish.kpiId') } catch (_) {}
          setKpi(null)
          setWeeks([])
          setEmptyNotice(status === 403
            ? 'Bạn không có quyền truy cập KPI này. Vui lòng chọn KPI thuộc phòng ban của bạn.'
            : 'Hiện chưa có KPI để hiển thị. Vui lòng chọn KPI thuộc phòng ban của bạn.')
          try {
            const listRes = await axios.get('/api/kpis/department')
            const items = Array.isArray(listRes.data) ? listRes.data : listRes.data?.kpis ?? listRes.data?.items ?? []
            const filtered = items.filter((it: any) => {
              if (!leaderDeptId) return false
              const did = it.department_id ?? it.departmentId ?? it.department ?? null
              return Number(did) === Number(leaderDeptId) && !isTransferredKpi(it)
            })
            setAvailableKpis(filtered)
          } catch (_) {
            setAvailableKpis([])
          }
          setError(null)
        } else {
          setError(backendMsg || 'Lỗi khi tải dữ liệu')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const stored = (() => { try { const v = localStorage.getItem('leader.publish.kpiId'); return v ? Number(v) : null } catch (_) { return null } })()
    const idToLoad = initialId ?? stored
    load(idToLoad)
    return () => { cancelled = true }
  }, [initialId])

  // fetch department KPIs for selection when no KPI selected
  useEffect(() => {
    let mounted = true
    async function loadList() {
      if (initialId || storedId) return
      setLoadingKpis(true)
      try {
        const res = await axios.get('/api/kpis/department')
        const items = Array.isArray(res.data) ? res.data : res.data?.kpis ?? res.data?.items ?? []
        const filtered = items.filter((it: any) => {
          if (!leaderDeptId) return false
          const did = it.department_id ?? it.departmentId ?? it.department ?? null
          return Number(did) === Number(leaderDeptId) && !isTransferredKpi(it)
        })
        if (mounted) setAvailableKpis(filtered)
      } catch (_) {
        if (mounted) setAvailableKpis([])
      } finally {
        if (mounted) setLoadingKpis(false)
      }
    }
    loadList()
    return () => { mounted = false }
  }, [leaderDeptId, initialId, storedId])

  const selectKpi = async (id: number | string) => {
    try { localStorage.setItem('leader.publish.kpiId', String(id)) } catch (_) {}
    try {
      setLoading(true)
      const res = await axios.get(`/api/kpis/${id}`)
      const data = res.data?.kpi ?? res.data
      if (isTransferredKpi(data)) {
        try { localStorage.removeItem('leader.publish.kpiId') } catch (_) {}
        setKpi(null)
        setWeeks([])
        setEmptyNotice('Tab Giao KPI chỉ hiển thị KPI ban hành. KPI điều phối nằm ở tab KPI điều phối.')
        return
      }
      setKpi(data || null)
      setWeeks(res.data?.weeks || [])
      weekRefs.current = []
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Lỗi khi tải KPI')
    } finally {
      setLoading(false)
    }
  }

  // auto-scroll to the most relevant week after weeks loaded
  useEffect(() => {
    if (!weekItems || !weekItems.length) return
    // pick first week that has any day with target_value > 0, otherwise first week
    let idx = 0
    for (let i = 0; i < weekItems.length; i++) {
      const w = weekItems[i]
      const any = Array.isArray(w.days) && w.days.some((d: any) => Number((d?.target_value ?? d?.target ?? 0) || 0) > 0)
      if (any) { idx = i; break }
    }
    const el = weekRefs.current[idx]
    const smoothScrollTo = (targetEl: HTMLElement, baseDuration = 180) => {
      const start = window.scrollY || window.pageYOffset
      const rect = targetEl.getBoundingClientRect()
      const rawTarget = start + rect.top - (window.innerHeight - rect.height) / 2
      const maxScroll = Math.max(0, (document.documentElement?.scrollHeight || document.body.scrollHeight) - window.innerHeight)
      const target = Math.max(0, Math.min(rawTarget, maxScroll))
      const startTime = performance.now()

      // If target is above start, make upward scroll 2x faster so remaining items render sooner
      const scrollingUp = target < start
      const duration = scrollingUp ? Math.max(40, Math.round(baseDuration / 2)) : baseDuration

      const easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t)
      const easeOutQuad = (t: number) => t * (2 - t)

      const step = (now: number) => {
        const t = Math.min(1, (now - startTime) / duration)
        const eased = scrollingUp ? easeOutQuad(t) : easeInOutQuad(t)
        window.scrollTo(0, Math.round(start + (target - start) * eased))
        if (t < 1) requestAnimationFrame(step)
      }

      requestAnimationFrame(step)
    }

    if (el instanceof HTMLElement) {
      smoothScrollTo(el, 260)
    } else if (el && typeof (el as any).scrollIntoView === 'function') {
      try { (el as any).scrollIntoView({ behavior: 'smooth', block: 'center' }) } catch (_) { (el as any).scrollIntoView() }
    }
  }, [weekItems])


  if (!initialId && !storedId) return (
    <div style={{ padding: 16, background: '#fff', borderRadius: 8 }}>
      <div>
        {loadingKpis && <div>Đang tải danh sách KPI...</div>}
        {!loadingKpis && emptyNotice && <div style={{ color: '#1d4ed8', marginBottom: 8 }}>{emptyNotice}</div>}
        {!loadingKpis && Array.isArray(availableKpis) && availableKpis.length === 0 && <div style={{ color: '#475569' }}>Không tìm thấy KPI cho phòng ban của bạn.</div>}
        {!loadingKpis && Array.isArray(availableKpis) && availableKpis.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12, marginTop: 8 }}>
            {availableKpis.map((kp: any) => {
              const title = Array.isArray(kp.kpi_name) && kp.kpi_name.length ? kp.kpi_name.join(' • ') : (kp.description || 'KPI')
              return (
                <div key={kp.id ?? kp._id ?? kp.chain_kpi_id} onClick={() => selectKpi(kp.id ?? kp._id ?? kp.chain_kpi_id)} style={{ padding: 12, borderRadius: 8, background: '#fff', border: '1px solid #e6eefc', cursor: 'pointer', boxShadow: '0 6px 18px rgba(15,23,42,0.04)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontWeight: 700, color: '#0b3b66' }}>{title}</div>
                  <div style={{ color: '#475569', fontSize: 13 }}>{kp.start_date ? new Date(kp.start_date).toLocaleDateString('vi-VN') : '—'} — {kp.end_date ? new Date(kp.end_date).toLocaleDateString('vi-VN') : '—'}</div>
                  <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ color: '#0369a1', fontWeight: 700 }}>{kp.total_kpi ?? '—'} KPI</div>
                    <button style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: '#0369a1', color: '#fff', cursor: 'pointer' }}>Chọn</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  if (loading) return <div style={{ padding: 16 }}>Đang tải dữ liệu KPI...</div>
  if (error) return <div style={{ padding: 16, color: '#b91c1c' }}>Lỗi: {error}</div>
  if (!kpi) return <div style={{ padding: 16 }}>{emptyNotice || 'Hiện chưa có KPI để hiển thị.'}</div>

  return (
    <div style={{ padding: 12 }}>
      <div style={{ background: '#fff', padding: 12, borderRadius: 8 }}>
        <div style={headerAreaStyle}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{Array.isArray(kpi.kpi_name) && kpi.kpi_name.length ? kpi.kpi_name.join(' • ') : (kpi.description || 'KPI')}</div>
            <div style={{ color: '#475569', fontSize: 13 }}>{kpi.start_date ? new Date(kpi.start_date).toLocaleDateString('vi-VN') : '—'} — {kpi.end_date ? new Date(kpi.end_date).toLocaleDateString('vi-VN') : '—'}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ color: '#0b3b66', fontWeight: 700 }}>Tổng KPI: {kpi.total_kpi ?? '—'}</div>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          {weekItems && weekItems.length === 0 && <div style={{ color: '#475569' }}>Không có tuần nào để hiển thị.</div>}
          {weekItems && weekItems.length > 0 && (
            <div style={{ display: 'grid', gap: 12 }}>
              {weekItems.map((item: any, idx: number) => {
                const { weekIndex, start_date, end_date, weekTarget, days } = item
                // weekIndex lấy trực tiếp từ API.
                return (
                  <div key={`${idx}-${weekIndex}`}>
                    <div ref={(el) => { weekRefs.current[idx] = el }} style={{ ...weekBoxBase, background: '#fff', transition: 'background 220ms ease' }}>
                      <div style={leftBarStyle} aria-hidden />
                      <div style={hrTopStyle} aria-hidden />
                      <div style={hrBottomStyle} aria-hidden />
                      <div style={weekHeaderRow}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <AssignButton disabled={Number(weekTarget || 0) === 0} onAssign={() => setSelectedWeek({ weekIndex, start_date, end_date, weekTarget, days, displayWeekNumber: item.displayWeekNumber })}>
                              {`Tuần ${item.displayWeekNumber ?? (idx + 1)}`}
                            </AssignButton>
                          </div>
                          <div style={weekRangeStyle}>{item.display_start ? new Date(item.display_start).toLocaleDateString('vi-VN') : '—'} - {item.display_end ? new Date(item.display_end).toLocaleDateString('vi-VN') : '—'}</div>
                        </div>
                        <div style={weekMetaStyle}>
                          <span>Tổng KPI theo tuần: <strong style={{ fontWeight: 700 }}>{weekTarget} KPI</strong></span>
                        </div>
                      </div>
                      <div style={daysGridStyle}>
                        {days.map((day: any | null, di: number) => (
                          day ? (
                            <div key={day.key} style={{ ...getDayStyle(day.dayIsCompleted, day.hasNoTarget), cursor: 'default' }} title={day.title}>
                              <div style={{ fontWeight: 500, textAlign: 'center', lineHeight: '1.1' }}>{day.dayLabel}</div>
                              <div style={{ marginTop: 8, fontWeight: 700, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                                {day.dayIsCompleted && <span style={{ color: '#16a34a' }}>✓</span>}
                                {day.hasNoTarget ? <span style={{ color: '#dc2626' }}>⚠</span> : null}
                                <span>{day.target} KPI</span>
                              </div>
                            </div>
                          ) : (
                            <div key={`empty-${weekIndex ?? idx}-${di}`} style={placeholderDayStyle} aria-hidden />
                          )
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        {selectedWeek && (
          <div style={{ marginTop: 12 }}>
            <LeaderAssignForm
              kpiId={kpi.chain_kpi_id ?? kpi.chainKpiId ?? kpi.kpi_id ?? kpi.id ?? kpi._id}
              departmentId={kpi.department_id ?? kpi.departmentId ?? kpi.department ?? null}
              week={selectedWeek}
              onClose={() => setSelectedWeek(null)}
            />
          </div>
        )}
    </div>
  </div>
)
}
