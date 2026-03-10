import type { MouseEvent } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import axios from '../../../../api/axios'
import { notify } from '../../../../utils/notify'
import WeekCard from './WeekCard'
import KpiEditActions from './KpiEditActions'

const OVERLAY_STYLE = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' } as const
const MODAL_STYLE = { width: 1200, maxWidth: '95%', background: '#fff', borderRadius: 8, boxShadow: '0 8px 30px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' } as const
const HEADER_STYLE = { display: 'flex', color:'#044263',alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #eee',  background: 'linear-gradient(90deg, #e0f2fe, #bae6fd)' } as const
const BODY_STYLE = { padding: 16, overflow: 'auto', flex: '1 1 auto' } as const
const FOOTER_STYLE = { padding: 12, display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' } as const

const sumDayTargets = (days: DayEdit[] = []) => days.reduce((sd: number, d: any) => sd + (Number(d.target_value) || 0), 0)

const computeCurrentUiTotal = (weeks: WeekEdit[] = []) => {
  return weeks.reduce((s, w: any) => s + sumDayTargets(w.days || []), 0)
}

const formatDateLabel = (dateStr: string | undefined) => {
  if (!dateStr) return '—'
  try { return new Date(dateStr).toLocaleDateString() } catch { return dateStr }
}

const formatDayDetailLabel = (date: string) => {
  try {
    const d = new Date(date)
    return d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })
  } catch { return date }
}

const normalizeDateKey = (value: any): string => {
  if (!value) return ''
  if (value instanceof Date) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const raw = String(value).trim()
  if (!raw) return ''
  const direct = raw.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return direct
  const y = parsed.getFullYear()
  const m = String(parsed.getMonth() + 1).padStart(2, '0')
  const d = String(parsed.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const matchesWeekByKey = (week: WeekEdit, key: number | string) => week.week_index === key || week.id === key

const distributeTargetsEvenly = (total: number, sourceWeeks: WeekEdit[]) => {
  const eligible: Array<{ weekIndex: number | string; date: string }> = []
  let lockedSum = 0

  sourceWeeks.forEach((w: any) => {
    (w.days || []).forEach((d: any) => {
      const targetVal = Number(d.target_value || 0)
      if (d.is_completed) {
        lockedSum += targetVal
        return
      }
      if (d.is_working_day) {
        eligible.push({ weekIndex: w.week_index ?? w.id, date: d.date })
      }
    })
  })

  const remainingTotal = Math.max(0, Number(total || 0) - lockedSum)
  const count = eligible.length
  if (count === 0) return sourceWeeks

  const base = Math.floor(remainingTotal / count)
  let remainder = remainingTotal - base * count

  return sourceWeeks.map((w: any) => {
    if (!Array.isArray(w.days)) return w
    const days = w.days.map((d: any) => {
      if (d.is_completed) return d
      if (d.is_working_day) {
        const add = remainder > 0 ? 1 : 0
        const tv = base + add
        if (remainder > 0) remainder -= 1
        return { ...d, target_value: tv }
      }
      return d
    })
    const weekTarget = sumDayTargets(days)
    return { ...w, days, target_value: weekTarget }
  })
}

interface DayEdit {
  date: string
  is_completed?: boolean
  user_attending?: boolean
  is_working_day?: number | boolean
  target_value?: number
  out_of_range?: boolean
  __placeholder?: boolean
  __sourceWeekIndex?: number | string
}

interface WeekEdit {
  id?: number | string
  week_index?: number | string
  display_week_number?: number
  name?: string
  weeklyTarget?: number
  days?: DayEdit[]
  target_value?: number
}

const toDateOnly = (value: any) => {
  if (!value) return null
  const dt = value instanceof Date ? value : new Date(String(value).includes('T') ? String(value) : `${String(value)}T00:00:00`)
  if (Number.isNaN(dt.getTime())) return null
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())
}

const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

const buildCalendarWeeksForEdit = (sourceWeeks: WeekEdit[] = [], kpiStart?: any, kpiEnd?: any): WeekEdit[] => {
  const daysMap: Record<string, any> = {}
  for (const w of sourceWeeks || []) {
    const srcWeekIndex = (w as any).week_index ?? (w as any).id
    for (const d of Array.isArray((w as any).days) ? (w as any).days : []) {
      const dt = toDateOnly((d as any).date)
      if (!dt) continue
      const key = dateKey(dt)
      daysMap[key] = { ...d, date: key, __sourceWeekIndex: srcWeekIndex }
    }
  }

  let globalStart = toDateOnly(kpiStart)
  let globalEnd = toDateOnly(kpiEnd)
  const keys = Object.keys(daysMap).sort()
  if (!globalStart && keys.length) globalStart = toDateOnly(keys[0])
  if (!globalEnd && keys.length) globalEnd = toDateOnly(keys[keys.length - 1])
  if (!globalStart || !globalEnd || globalStart > globalEnd) return sourceWeeks || []

  const out: WeekEdit[] = []
  let cursor = new Date(globalStart)
  let guard = 0
  while (cursor <= globalEnd && guard < 120) {
    guard += 1
    const dow = cursor.getDay()
    let blockStart = new Date(cursor)
    let blockEnd: Date
    if (out.length === 0) {
      const daysToSunday = dow === 0 ? 0 : 7 - dow
      blockEnd = addDays(blockStart, daysToSunday)
    } else {
      const startDOW = blockStart.getDay()
      if (startDOW !== 1) blockStart = addDays(blockStart, (8 - startDOW) % 7)
      blockEnd = addDays(blockStart, 6)
    }
    if (blockEnd > globalEnd) blockEnd = new Date(globalEnd)

    const blockDOW = blockStart.getDay()
    const daysSinceMon = blockDOW === 0 ? 6 : blockDOW - 1
    const monday = addDays(blockStart, -daysSinceMon)

    const weekDays: DayEdit[] = []
    let weekTarget = 0
    for (let i = 0; i < 7; i += 1) {
      const d = addDays(monday, i)
      const key = dateKey(d)
      if (d < globalStart || d > globalEnd) {
        weekDays.push({ date: key, out_of_range: true, __placeholder: true, user_attending: false, target_value: 0 })
        continue
      }
      const src = daysMap[key]
      if (!src) {
        weekDays.push({ date: key, out_of_range: true, __placeholder: true, user_attending: false, target_value: 0 })
        continue
      }
      const target = Number((src as any).target_value || 0)
      weekTarget += target
      weekDays.push({
        ...src,
        date: key,
        user_attending: typeof (src as any).is_working_day !== 'undefined' ? !!(src as any).is_working_day : !!(src as any).user_attending,
        is_working_day: typeof (src as any).is_working_day !== 'undefined' ? !!(src as any).is_working_day : !!(src as any).user_attending,
        out_of_range: false,
        __placeholder: false
      })
    }

    out.push({
      id: `display-${out.length}`,
      week_index: out.length,
      display_week_number: out.length + 1,
      start_date: dateKey(blockStart),
      end_date: dateKey(blockEnd),
      target_value: weekTarget,
      days: weekDays
    })

    cursor = addDays(blockEnd, 1)
  }

  return out
}

interface KpiEditModalProps {
  open: boolean
  onClose: () => void
  kpi?: {
    id?: number | string
    title?: string
    weeks?: WeekEdit[]
  }
  onSave?: (updated: { id?: number | string; weeks?: WeekEdit[] }) => Promise<void> | void
}

export default function KpiEditModal({ open, onClose, kpi, onSave }: KpiEditModalProps) {
  const [weeks, setWeeks] = useState<WeekEdit[]>([])
  const [saving, setSaving] = useState(false)
  const [hoverCancel, setHoverCancel] = useState(false)
  const [hoverSave, setHoverSave] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [totalKpiFromDb, setTotalKpiFromDb] = useState<number | undefined>(undefined)
  const [actionsLoading, setActionsLoading] = useState(false)

  useEffect(() => {
    const normalized = (kpi && kpi.weeks) ? kpi.weeks.map((w: any) => ({
      ...w,
      days: Array.isArray(w.days) ? w.days.map((d: any) => ({
        ...d,
        user_attending: typeof d.is_working_day !== 'undefined' ? !!d.is_working_day : !!d.user_attending,
        is_completed: (Number(d.target_value || 0) > 0 && Number(d.kpi_current || 0) >= Number(d.target_value || 0))
      })) : w.days
    })) : []
    setWeeks(buildCalendarWeeksForEdit(normalized as any, (kpi as any)?.start_date, (kpi as any)?.end_date))
    const provided = (kpi as any)?.total_kpi
    if (typeof provided !== 'undefined' && provided !== null) setTotalKpiFromDb(Number(provided))
    else setTotalKpiFromDb(undefined)
  }, [kpi, open])

  useEffect(() => {
    let cancelled = false
    async function loadDetails() {
      if (!open || !kpi?.id) return
      // always attempt to enrich weeks with assignment totals
      // (do not skip fetching just because `kpi.weeks` was provided)
      try {
        setFetching(true)
        const resp = await axios.get(`/api/kpis/${kpi.id}`)
        if (cancelled) return
        if (resp && resp.data) {
          const serverWeeks = resp.data?.weeks ?? kpi.weeks ?? []

          let assignRows: any[] = []
          try {
            const ares = await axios.get(`/api/kpis/${kpi.id}/assignments`)
            assignRows = Array.isArray(ares.data) ? ares.data : (ares.data?.rows ?? ares.data?.assignments ?? [])
          } catch (err) {
            console.debug('[KpiEditModal] no assignments available or failed to load', err)
            assignRows = []
          }

          const aggByDate: Record<string, number> = {}
          for (const r of assignRows || []) {
            const dateKey = normalizeDateKey(r.date || r.date_time || r.key)
            if (!dateKey) continue
            const rawAssigned = r.assigned_kpi ?? r.assigned ?? r.value ?? r.assigned_total ?? r.totalAssigned
            const parsedAssigned = Number(rawAssigned)
            const val = (rawAssigned === null || typeof rawAssigned === 'undefined' || Number.isNaN(parsedAssigned) || parsedAssigned <= 0)
              ? 1
              : parsedAssigned
            aggByDate[dateKey] = (aggByDate[dateKey] || 0) + val
          }

          const enriched = Array.isArray(serverWeeks) ? serverWeeks.map((w: any) => ({
            ...w,
            days: Array.isArray(w.days) ? w.days.map((d: any) => {
              const normalized = {
                ...d,
                user_attending: typeof d.is_working_day !== 'undefined' ? !!d.is_working_day : !!d.user_attending,
                is_completed: (Number(d.target_value || 0) > 0 && Number(d.kpi_current || 0) >= Number(d.target_value || 0))
              }
              try {
                const dk = normalizeDateKey(d.date || d.key)
                const assignedVal = aggByDate[dk] || 0
                if (assignedVal > 0) {
                  // provide multiple possible fields consumed elsewhere in the app
                  normalized.assignedTotal = assignedVal
                  normalized.assigned_kpi = assignedVal
                  normalized.assigned_total = assignedVal
                  normalized.totalAssigned = assignedVal
                }
              } catch (e) {
                // ignore
              }
              return normalized
            }) : w.days
          })) : []

          setWeeks(buildCalendarWeeksForEdit(enriched as any, resp.data?.kpi?.start_date ?? (kpi as any)?.start_date, resp.data?.kpi?.end_date ?? (kpi as any)?.end_date))

          if (typeof resp.data.total_kpi !== 'undefined' && resp.data.total_kpi !== null) {
            setTotalKpiFromDb(Number(resp.data.total_kpi))
          } else if (resp.data.kpi && typeof resp.data.kpi.total_kpi !== 'undefined' && resp.data.kpi.total_kpi !== null) {
            setTotalKpiFromDb(Number(resp.data.kpi.total_kpi))
          } else {
            setTotalKpiFromDb(undefined)
          }
        }
      } catch (err) {
        console.error('Failed to fetch KPI details', err)
      } finally {
        if (!cancelled) setFetching(false)
      }
    }
    loadDetails()
    return () => { cancelled = true }
  }, [open, kpi?.id])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const matchesWeek = useCallback((week: WeekEdit, key: number | string) => matchesWeekByKey(week, key), [])

  const canEditWeek = useCallback((week: WeekEdit) => {
    if (!week || !Array.isArray(week.days)) return false
    const realDays = week.days.filter((d: any) => !d.out_of_range)
    const hasWorking = realDays.some((d) => d.user_attending)
    const allCompleted = realDays.length > 0 && realDays.every((d) => d.is_completed)
    return hasWorking && !allCompleted
  }, [])

  const onWeekTargetChange = useCallback((weekIndex: number, value: string) => {
    const numericValue = Number(value)
    setWeeks(prev => prev.map(w => matchesWeek(w, weekIndex) ? { ...w, target_value: numericValue } : w))
  }, [matchesWeek])

  const currentUiTotal = useMemo(() => computeCurrentUiTotal(weeks), [weeks])

  const distributeTargets = useCallback((total: number, sourceWeeks: WeekEdit[]) => distributeTargetsEvenly(total, sourceWeeks), [])

  const onDistributeEvenly = useCallback(() => {
    const total = (typeof totalKpiFromDb === 'number' ? totalKpiFromDb : 0)
    setWeeks(prev => distributeTargets(total, prev))
  }, [distributeTargets, totalKpiFromDb])

  const onSaveNewTotalKpi = useCallback(async (rawValue: string) => {
    setActionsLoading(true)
    try {
      if (kpi?.id) {
        const parsed = Number(String(rawValue ?? '').trim())
        if (Number.isNaN(parsed)) {
          notify.error('Giá trị không hợp lệ', 'Vui lòng nhập số hợp lệ')
          return
        }
        const payloadTotal = parsed
        try {
          await axios.post(`/api/kpis/${kpi.id}/total`, { total_kpi: payloadTotal })
          notify.success('Lưu thành công', 'Đã cập nhật tổng KPI')
          // refresh KPI total from server to reflect saved value
          try {
            const resp = await axios.get(`/api/kpis/${kpi.id}`)
            if (resp && resp.data) {
              if (typeof resp.data.total_kpi !== 'undefined' && resp.data.total_kpi !== null) {
                setTotalKpiFromDb(Number(resp.data.total_kpi))
              } else if (resp.data.kpi && typeof resp.data.kpi.total_kpi !== 'undefined' && resp.data.kpi.total_kpi !== null) {
                setTotalKpiFromDb(Number(resp.data.kpi.total_kpi))
              }
            }
          } catch (err) {
            console.error('Failed to refresh KPI after save', err)
          }
        } catch (err: any) {
          console.error('Failed to persist total_kpi', err)
          notify.error('Lưu thất bại', err?.response?.data?.message || 'Không thể lưu tổng KPI')
        }
      }
    } finally {
      setActionsLoading(false)
    }
  }, [kpi?.id])

  const onToggleAttending = useCallback(async (weekIndex: number, date: string) => {
    const prevDay = weeks?.find((w: any) => matchesWeek(w, weekIndex))?.days?.find((d: any) => d.date === date)
    const current = prevDay ? (typeof prevDay.is_working_day !== 'undefined' ? !!prevDay.is_working_day : !!prevDay.user_attending) : false
    const newVal = !current

    setWeeks(prev => prev.map(w => {
      if (matchesWeek(w, weekIndex)) {
        const days = Array.isArray(w.days) ? w.days.map((d: any) => d.date === date ? { ...d, is_working_day: newVal, target_value: newVal ? (d.target_value ?? 0) : 0 } : d) : []
        return { ...w, days }
      }
      return w
    }))

    try {
      await axios.post(`/api/kpis/${kpi?.id}/days/working`, { date, is_working_day: newVal })
    } catch (err) {
      console.error('Failed to update working day', err)
      setWeeks(prev => prev.map(w => {
        if (matchesWeek(w, weekIndex)) {
          const days = Array.isArray(w.days) ? w.days.map((d: any) => d.date === date ? { ...d, is_working_day: current, target_value: prevDay ? prevDay.target_value : d.target_value } : d) : []
          return { ...w, days }
        }
        return w
      }))
    }
  }, [kpi?.id, matchesWeek, weeks])

  const onDayTargetChange = useCallback((weekIndex: number, date: string, value: string) => {
    const numeric = Number(value)
    setWeeks(prev => prev.map(w => {
      if (matchesWeek(w, weekIndex)) {
        const days = Array.isArray(w.days) ? w.days.map((d: any) => d.date === date ? { ...d, target_value: numeric } : d) : []
        return { ...w, days }
      }
      return w
    }))
  }, [matchesWeek])

  const formatDate = useCallback((dateStr: string | undefined) => formatDateLabel(dateStr), [])

  const formatDayDetail = useCallback((date: string) => formatDayDetailLabel(date), [])

  const handleSave = useCallback(async () => {
    try {
      setSaving(true)
      const payload = { id: kpi?.id, weeks }
      if (onSave) {
        await onSave(payload)
      } else {
        const grouped = new Map<any, any>()
        ;(weeks || []).forEach((w: any) => {
          ;(Array.isArray(w.days) ? w.days : []).forEach((d: any) => {
            if (!d || d.out_of_range || d.__placeholder) return
            const srcWeekIndex = d.__sourceWeekIndex
            if (typeof srcWeekIndex === 'undefined' || srcWeekIndex === null) return
            if (!grouped.has(srcWeekIndex)) grouped.set(srcWeekIndex, { week_index: srcWeekIndex, days: [] as any[] })
            grouped.get(srcWeekIndex).days.push({ date: d.date, target_value: d.target_value ?? 0, user_attending: !!d.user_attending })
          })
        })
        const payloadWeeks = Array.from(grouped.values())
        await axios.post(`/api/kpis/${kpi?.id}/weeks`, { weeks: payloadWeeks })
      }
      onClose()
      window.location.reload()
    } catch (err) {
      console.error('Failed to save KPI weeks', err)
    } finally {
      setSaving(false)
    }
  }, [kpi?.id, onClose, onSave, weeks])

  const weekCards = useMemo(() => {
    return weeks.map((w: any) => (
      <WeekCard
        key={w.id ?? w.week_index}
        week={w}
        userRole={'admin'}
        canEditWeek={canEditWeek}
        onWeekTargetChange={onWeekTargetChange}
        onToggleAttending={onToggleAttending}
        onDayTargetChange={onDayTargetChange}
        formatDate={formatDate}
        formatDayDetail={formatDayDetail}
      />
    ))
  }, [weeks, canEditWeek, onDayTargetChange, onToggleAttending, onWeekTargetChange, formatDate, formatDayDetail])

  const cancelButtonStyle = {
    padding: '8px 12px',
    borderRadius: 20,
    border: '1px solid #ff0000',
    color: '#ff0000',
    background: '#fff',
    cursor: saving ? 'not-allowed' : 'pointer',
    opacity: saving ? 0.6 : 1,
    transition: 'background-color 180ms ease, color 180ms ease, transform 150ms ease, box-shadow 150ms ease',
    transform: !saving && hoverCancel ? 'translateY(-2px) scale(1.02)' : 'none',
    boxShadow: !saving && hoverCancel ? '0 6px 18px rgba(0,0,0,0.12)' : 'none'
  } as const
  const confirmButtonStyle = {
    padding: '8px 12px',
    borderRadius: 20,
    border: '1px solid #2563eb',
    color: '#2563eb',
    background: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    cursor: saving ? 'not-allowed' : 'pointer',
    opacity: saving ? 0.6 : 1,
    transition: 'background-color 180ms ease, color 180ms ease, transform 150ms ease, box-shadow 150ms ease',
    transform: !saving && hoverSave ? 'translateY(-2px) scale(1.02)' : 'none',
    boxShadow: !saving && hoverSave ? '0 6px 20px rgba(37,99,235,0.12)' : 'none'
  } as const

  const handleOverlayClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !saving) onClose()
  }, [onClose, saving])

  return (
    <div onClick={handleOverlayClick} style={OVERLAY_STYLE}>
      <div onClick={(e) => e.stopPropagation()} style={MODAL_STYLE}>
        <div style={HEADER_STYLE}>
          <div style={{ fontWeight: 600 }}>Chỉnh sửa KPI</div>
        </div>

        <div style={BODY_STYLE}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{kpi?.title || '—'}</div>
            <div style={{ color: '#666', fontSize: 13 }}>Giao diện chỉnh sửa chỉ tiêu theo tuần. Sửa giá trị và nhấn "Gửi" để lưu.</div>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {fetching && <div style={{ color: '#777' }}>Đang tải dữ liệu...</div>}
            {weekCards}
          </div>
        </div>

        <div style={FOOTER_STYLE}>
          <div style={{ marginRight: 'auto' }}>
            <KpiEditActions
              totalKpiFromDb={totalKpiFromDb}
              onSaveNewTotalKpi={onSaveNewTotalKpi}
              currentUiTotal={currentUiTotal}
              onDistributeEvenly={onDistributeEvenly}
              weeksLength={weeks.length}
              loading={actionsLoading}
              onClose={onClose}
            />
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            onMouseEnter={() => setHoverCancel(true)}
            onMouseLeave={() => setHoverCancel(false)}
            style={cancelButtonStyle}
          >
            Hủy
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            onMouseEnter={() => setHoverSave(true)}
            onMouseLeave={() => setHoverSave(false)}
            style={confirmButtonStyle}
          >
            {saving ? 'Đang xác nhận...' : 'Xác nhận'}
            <img src="/image/send_icon.png" alt="send" style={{ width: 25, height: 15 }} />
          </button>
        </div>
      </div>
    </div>
  )
}
