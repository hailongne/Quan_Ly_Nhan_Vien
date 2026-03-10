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
  const weekRefs = React.useRef<Array<HTMLDivElement | null>>([])
  const [selectedWeek, setSelectedWeek] = useState<any | null>(null)
  const storedId = (() => { try { const v = localStorage.getItem('leader.publish.kpiId'); return v ? Number(v) : null } catch (_) { return null } })()
  // assignRefs and inline assign container were removed; modal popup used instead
  
  const weekBoxBase: React.CSSProperties = { borderRadius: 6, padding: 10, marginBottom: 10, position: 'relative', background: '#ffffff', border: '1px solid #E0F2FE', paddingLeft: 20 }
  const leftBarStyle: React.CSSProperties = { position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, background: 'linear-gradient(to right,#BAE6FD,transparent)', pointerEvents: 'none' }
  const hrTopStyle: React.CSSProperties = { position: 'absolute', left: 0, right: 0, top: 0, height: 1, background: 'linear-gradient(to right,#BAE6FD,transparent)', opacity: 0.9, pointerEvents: 'none' }
  const hrBottomStyle: React.CSSProperties = { position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, background: 'linear-gradient(to right,#BAE6FD,transparent)', opacity: 0.9, pointerEvents: 'none' }
  const weekHeaderRow: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6, flexWrap: 'wrap' }
  const weekLabelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#075985' }
  const weekRangeStyle: React.CSSProperties = { fontSize: 12, color: '#0284C7' }
  const weekMetaStyle: React.CSSProperties = { display: 'flex', fontSize: 12, alignItems: 'center', justifyContent: 'space-between', gap: 8, color: '#0369A1', marginBottom: 6 }
  const daysGridStyle: React.CSSProperties = { display: 'grid', fontSize: 12, gridTemplateColumns: 'repeat(7,1fr)', gap: 5 }
  const dayBaseStyle: React.CSSProperties = { textAlign: 'center', padding: 6, borderRadius: 6, minHeight: 48, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer' }
  const getDayStyle = (completed: boolean, noTarget: boolean): React.CSSProperties => {
    if (completed) return { ...dayBaseStyle, background: '#d1fae5', color: '#065f46', border: '1px solid #bbf7d0' };
    if (noTarget) return { ...dayBaseStyle, background: '#f0f9ff', color: '#60a5fa', border: '1px solid #bfdbfe' };
    return { ...dayBaseStyle, background: '#eff6ff', color: '#075985', border: '1px solid #bae6fd' };
  }
  const placeholderDayStyle: React.CSSProperties = { ...dayBaseStyle, background: '#f8fafc', color: '#94a3b8', border: '1px dashed #e2e8f0', cursor: 'default' };

  const toDateOnly = (d: string | Date) => {
    const dt = typeof d === 'string' ? new Date(d.includes('T') ? d : `${d}T00:00:00`) : new Date(d);
    return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  }
  const ymd = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const addDays = (dt: Date, n: number) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + n);

  function AssignButton({ onAssign, disabled }: { onAssign: () => void, disabled?: boolean }){
    const [hover, setHover] = useState(false);
    const base: React.CSSProperties = {
      padding: '2px 5px',
      borderRadius: 999,
      border: '1px solid #e6eefc',
      background: disabled ? '#f8fafc' : (hover ? '#2563eb' : '#fff'),
      color: disabled ? '#94a3b8' : (hover ? '#fff' : '#2563eb'),
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontWeight: 500,
      fontSize: 12,
      boxShadow: !disabled && hover ? '0 6px 14px rgba(37,99,235,0.12)' : undefined,
      transition: 'all 140ms ease',
      opacity: disabled ? 0.7 : 1
    };
    return (
      <button
        type="button"
        aria-label="Phân công"
        aria-disabled={disabled ? true : undefined}
        onClick={(e) => { e.stopPropagation(); if (!disabled) onAssign(); }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={base}
        title={disabled ? 'Tổng KPI của tuần bằng 0 — không thể phân công' : 'Phân công'}
        disabled={disabled}
      >
        Phân công
      </button>
    )
  }

  // Build map of incoming days by date string (yyyy-mm-dd)
  const daysMap: Record<string, any> = {};
  weeks.forEach((w: any) => {
    (Array.isArray(w.days) ? w.days : []).forEach((d: any) => {
      try {
        const key = ymd(toDateOnly(d.date));
        daysMap[key] = d;
      } catch (_) { /* ignore malformed */ }
    });
  });

  // Use API weeks directly instead of recalculating locally
  // This ensures that week boundaries match the server's definition
  const weekItems: Array<any> = Array.isArray(weeks) ? weeks.map((w: any) => {
    const weekStart = toDateOnly(w.start_date || '');
    const weekEnd = toDateOnly(w.end_date || '');
    const apiWeekIndex = Number(w.week_index ?? w.weekIndex ?? -1);
    
    // Build days array for this week (Monday through Sunday, 7 days)
    const monday = new Date(weekStart);
    const dayOfWeek = monday.getDay();
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const actualMonday = addDays(monday, -daysSinceMonday);
    
    const days: Array<any | null> = [];
    for (let i = 0; i < 7; i += 1) {
      const d = addDays(actualMonday, i);
      const key = ymd(d);
      const src = daysMap[key];
      if (!src) {
        days.push(null);
        continue;
      }
      const target = Number(src.target_value || 0);
      const dayIsCompleted = Number(src.kpi_current || 0) >= target;
      const hasNoTarget = target === 0;
      days.push({ 
        key, 
        date: key, // explicitly include date for LeaderAssignForm
        target, 
        target_value: target,
        dayIsCompleted, 
        hasNoTarget, 
        dayLabel: new Date(key).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' }), 
        title: dayIsCompleted ? 'Đã hoàn thành' : hasNoTarget ? 'Chưa có KPI được phân bổ' : 'Chưa hoàn thành' 
      });
    }
    
    const weekTarget = Number((Array.isArray(days) ? days.reduce((s, di: any) => s + ((di && di.target) || 0), 0) : 0)) || 0;
    return { 
      weekIndex: apiWeekIndex, 
      start_date: ymd(weekStart), 
      end_date: ymd(weekEnd), 
      weekTarget, 
      days 
    };
  }) : [];

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
        setKpi(data || null)
        setWeeks(res.data?.weeks || [])
        // reset refs
        weekRefs.current = []
        try { localStorage.setItem('leader.publish.kpiId', String(id)) } catch (_) { /* ignore */ }
      } catch (err: any) {
        if (!cancelled) setError(err?.response?.data?.message || err.message || 'Lỗi khi tải dữ liệu')
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
          return Number(did) === Number(leaderDeptId)
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
    if (!weeks || !weeks.length) return
    // pick first week that has any day with target_value > 0, otherwise first week
    let idx = 0
    for (let i = 0; i < weeks.length; i++) {
      const w = weeks[i]
      const any = Array.isArray(w.days) && w.days.some((d: any) => Number(d.target_value || 0) > 0)
      if (any) { idx = i; break }
    }
    const el = weekRefs.current[idx]
    if (el && typeof el.scrollIntoView === 'function') {
      try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }) } catch (_) { el.scrollIntoView() }
    }
  }, [weeks])

  // no inline assign scrolling needed for modal popup

  if (!initialId && !storedId) return (
    <div style={{ padding: 16, background: '#fff', borderRadius: 8 }}>
      <h3 style={{ marginTop: 0 }}>Phân công KPI</h3>
      <p style={{ marginTop: 6, color: '#475569' }}>Chọn KPI để phân công.</p>
      <div style={{ marginTop: 12 }}>
        {loadingKpis && <div>Đang tải danh sách KPI...</div>}
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
  if (!kpi) return <div style={{ padding: 16 }}>Không tìm thấy KPI.</div>

  return (
    <div style={{ padding: 12 }}>
      <div style={{ background: '#fff', padding: 12, borderRadius: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{Array.isArray(kpi.kpi_name) && kpi.kpi_name.length ? kpi.kpi_name.join(' • ') : (kpi.description || 'KPI')}</div>
            <div style={{ color: '#475569', fontSize: 13 }}>{kpi.start_date ? new Date(kpi.start_date).toLocaleDateString('vi-VN') : '—'} — {kpi.end_date ? new Date(kpi.end_date).toLocaleDateString('vi-VN') : '—'}</div>
          </div>
          <div style={{ color: '#0b3b66', fontWeight: 700 }}>Tổng KPI: {kpi.total_kpi ?? '—'}</div>
        </div>

        <div style={{ marginTop: 12 }}>
          {weekItems && weekItems.length === 0 && <div style={{ color: '#475569' }}>Không có tuần nào để hiển thị.</div>}
          {weekItems && weekItems.length > 0 && (
            <div style={{ display: 'grid', gap: 12 }}>
              {weekItems.map((item: any, idx: number) => {
                const { weekIndex, start_date, end_date, weekTarget, days } = item
                // weekIndex comes directly from API, no need to lookup apiWeek
                return (
                  <div key={weekIndex ?? idx}>
                    <div ref={(el) => { weekRefs.current[weekIndex ?? idx] = el }} style={{ ...weekBoxBase, background: '#fff', transition: 'background 220ms ease' }}>
                      <div style={leftBarStyle} aria-hidden />
                      <div style={hrTopStyle} aria-hidden />
                      <div style={hrBottomStyle} aria-hidden />
                      <div style={weekHeaderRow}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={weekLabelStyle}>Tuần {weekIndex + 1}</span>
                            <AssignButton disabled={Number(weekTarget || 0) === 0} onAssign={() => setSelectedWeek({ weekIndex, start_date, end_date, weekTarget, days })} />
                          </div>
                          <div style={weekRangeStyle}>{start_date ? new Date(start_date).toLocaleDateString('vi-VN') : '—'} - {end_date ? new Date(end_date).toLocaleDateString('vi-VN') : '—'}</div>
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
                    {/* inline assign container removed; modal is rendered once below when selectedWeek is set */}
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
