import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from '../../../api/axios'
import { showToast } from '../../../utils/toast'

interface Props {
  kpiId: number | string
  departmentId: number | string | null
  week: any
  onClose: () => void
  theme?: 'default' | 'pink'
}

export default function LeaderAssignForm({ kpiId, departmentId, week, onClose, theme = 'default' }: Props) {
  const displayWeekNo = Math.max(1, Number(week?.displayWeekNumber ?? ((Number(week?.weekIndex ?? 0) || 0) + 1)))
  const isPinkTheme = theme === 'pink'
  const palette = isPinkTheme
    ? {
        panelBorder: '#fbcfe8',
        headerBg: '#fdf2f8',
        headerTitle: '#9d174d',
        rowBorder: '#fbcfe8',
        rowName: '#9d174d',
        chevron: '#db2777',
        assignBtnBorder: '#ec4899'
      }
    : {
        panelBorder: '#e6eefc',
        headerBg: '#EFF6FF',
        headerTitle: '#083344',
        rowBorder: '#e6eefc',
        rowName: '#0b3b66',
        chevron: '#0369a1',
        assignBtnBorder: '#006eff'
      }
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Cho phép mở đồng thời nhiều nhân viên trong danh sách.
  const [openEmployees, setOpenEmployees] = useState<Record<string, boolean>>({})
  // Bản đồ phân công theo từng nhân viên: { employeeId: { yyyy-mm-dd: số_kpi } }.
  const [assignmentDaysMap, setAssignmentDaysMap] = useState<Record<string, Record<string, number>>>({})
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [serverAssignedMap, setServerAssignedMap] = useState<Record<string, number>>({})
  const [assignedEmployeeMap, setAssignedEmployeeMap] = useState<Record<string, boolean>>({})
  const [assignedEmployeeStatusMap, setAssignedEmployeeStatusMap] = useState<Record<string, Record<string, string>>>({})
  const [editingEmployeeKey, setEditingEmployeeKey] = useState<string | null>(null)
  const originalAssignmentRef = useRef<Record<string, Record<string, number>>>({})

  const isLockedAssignmentStatus = useCallback((rawStatus: string | null | undefined) => {
    const status = String(rawStatus || '').toLowerCase().trim()
    if (!status) return false
    return status === 'doing'
      || status === 'in_progress'
      || status === 'review'
      || status === 'approving'
      || status === 'in_review'
      || status === 'completed'
  }, [])
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!departmentId) {
        setEmployees([])
        return
      }
      setLoading(true)
      setError(null)
      try {
        const res = await axios.get(`/api/users/department/${departmentId}`)
        if (cancelled) return
        const list = Array.isArray(res.data) ? res.data : (res.data?.users ?? [])
        const filtered = list.filter((u: any) => (u.department_id ?? u.departmentId ?? u.department) === departmentId)
        setEmployees(filtered)
      } catch (err: any) {
        if (!cancelled) setError(err?.response?.data?.message || err.message || 'Lỗi khi tải danh sách nhân viên')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [departmentId])

  const displayDays = useMemo(() => {
    if (!Array.isArray(week?.days)) return []
    return week.days
      .filter((d: any) => !!d && (d.date || d.key))
      .map((d: any) => ({ ...d, date: d.date || d.key, target_value: d.target_value ?? d.target }))
  }, [week])

  const loadAssigned = useCallback(async () => {
    if (!kpiId) return
    try {
      const dateSet = new Set(displayDays.map((d: any) => String(d.date || d.key || '').slice(0, 10)).filter(Boolean))
      const res = await axios.get(`/api/kpis/${encodeURIComponent(String(kpiId))}`)
      const weeks = res.data?.weeks ?? []

      const allDays: any[] = []
      for (const w of weeks) {
        if (Array.isArray(w.days)) allDays.push(...w.days)
      }

      const fallbackMap: Record<string, number> = {}
      for (const d of allDays) {
        const dateKey = String(d.date || d.key || '').slice(0, 10)
        if (dateSet.size > 0 && !dateSet.has(dateKey)) continue
        fallbackMap[dateKey] = (fallbackMap[dateKey] || 0) + (Number(d.totalAssigned ?? d.assigned_kpi ?? d.assigned_total ?? 0) || 0)
      }

      let map: Record<string, number> = { ...fallbackMap }

      try {
        const assignRes = await axios.get(`/api/kpis/${encodeURIComponent(String(kpiId))}/assignments`)
        const rows = Array.isArray(assignRes.data) ? assignRes.data : (assignRes.data?.rows ?? assignRes.data?.assignments ?? [])
        if (rows.length > 0) {
          const rowTotals: Record<string, number> = {}
          const empMap: Record<string, boolean> = {}
          const empStatusMap: Record<string, Record<string, string>> = {}
          for (const r of rows) {
            const dateKey = String(r.date || r.date_time || r.key || '').slice(0, 10)
            if (dateSet.size > 0 && !dateSet.has(dateKey)) continue
            rowTotals[dateKey] = (rowTotals[dateKey] || 0) + (Number(r.assigned_kpi ?? r.assigned ?? r.value ?? 0) || 0)
            const empId = r.employee_id ?? r.employeeId ?? r.assignee_user_id ?? r.assigneeUserId ?? r.user_id ?? r.userId ?? r.employee ?? null
            if (empId) {
              const id = String(empId)
              empMap[id] = true
              const status = (r.status ?? r.assignment_status ?? r.state ?? r.stage ?? null) as string | null
              if (!empStatusMap[id]) empStatusMap[id] = {}
              empStatusMap[id][dateKey] = status || 'assigned'
            }
          }
          map = { ...map, ...rowTotals }
          // Lưu danh sách nhân viên đã có phân công trong tuần.
          setAssignedEmployeeMap(empMap)
          setAssignedEmployeeStatusMap(empStatusMap)
        } else {
          setAssignedEmployeeMap({})
          setAssignedEmployeeStatusMap({})
        }
        console.debug('[LeaderAssign] assignments endpoint rows sample:', rows.slice ? rows.slice(0,5) : rows)
      } catch (e) {
        console.debug('[LeaderAssign] fallback aggregated from all days sample:', allDays.slice(0,5))
        setAssignedEmployeeMap({})
      }

      setServerAssignedMap(map)
    } catch (err) {
    }
  }, [kpiId, displayDays])

  useEffect(() => {
    loadAssigned()
  }, [loadAssigned])

  // Ref và chiều cao động để đóng/mở từng khối nhân viên mượt hơn.
  const detailRefs = useRef<Record<string, HTMLElement | null>>({})
  const [detailMaxHeights, setDetailMaxHeights] = useState<Record<string, string>>({})

  // Tải phân công của một nhân viên cụ thể và lưu vào map theo nhân viên.
  const loadForEmployee = useCallback(async (empId: string | number) => {
    if (!empId || !kpiId) return
    try {
      const res = await axios.get(`/api/kpis/${encodeURIComponent(String(kpiId))}/assignments`)
      const rows = Array.isArray(res.data) ? res.data : (res.data?.rows ?? res.data?.assignments ?? [])
      const daySet = new Set(displayDays.map((d: any) => String(d.date || d.key || '').slice(0, 10)).filter(Boolean))
      const map: Record<string, number> = {}
      for (const r of rows) {
        const empIdRow = r.employee_id ?? r.employeeId ?? r.assignee_user_id ?? r.assigneeUserId ?? r.user_id ?? r.userId ?? r.employee ?? null
        if (String(empIdRow) !== String(empId)) continue
        const dateKey = String(r.date || r.date_time || r.key || '').slice(0, 10)
        if (!daySet.has(dateKey)) continue
        map[dateKey] = Number(r.assigned_kpi ?? r.assigned ?? r.value ?? r.assigned_total ?? 0) || 0
      }
      setAssignmentDaysMap(prev => ({ ...prev, [String(empId)]: map }))
      originalAssignmentRef.current = { ...originalAssignmentRef.current, [String(empId)]: { ...map } }
    } catch (err) {
      setAssignmentDaysMap(prev => ({ ...prev, [String(empId)]: {} }))
    }
  }, [kpiId, displayDays])

  const disabledAssign = useMemo(() => {
    if (!displayDays.length) return true
    return !displayDays.some((d: any) => Number(d.target_value ?? d.target ?? 0) > 0)
  }, [displayDays])

  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const COLLAPSE_PAINT_MS = 40
  const COLLAPSE_ANIM_MS = 480
  const COLLAPSE_TOTAL_MS = COLLAPSE_PAINT_MS + COLLAPSE_ANIM_MS

  // Cho phép đóng popup bằng phím Escape.
  useEffect(() => {
    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' || ev.key === 'Esc') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleSubmitForEmployee = async (employeeId: string | number | null) => {
    if (!kpiId) {
      try { window.dispatchEvent(new CustomEvent('assignKpi', { detail: {} })) } catch (_) {}
      return
    }
    if (typeof week?.weekIndex === 'undefined' || week?.weekIndex === null) {
      showToast('Tuần phân công không hợp lệ.', 'error')
      return
    }
    const employeeKey = String(employeeId)
    if (editingEmployeeKey !== employeeKey) {
      showToast('Bấm nút chỉnh sửa để bật chế độ cập nhật cho nhân viên này.', 'warning')
      return
    }

    const empMap = assignmentDaysMap[employeeKey] || {}
    const original = (originalAssignmentRef.current && originalAssignmentRef.current[employeeKey]) || {}
    const candidateDates = Array.from(new Set([...Object.keys(original), ...Object.keys(empMap)]))

    if (!candidateDates.length) {
      showToast('Không có dữ liệu để cập nhật.', 'warning')
      return
    }

    if ((window as any).__leaderAssignSubmitting) return
    setSubmitting(true)
    ;(window as any).__leaderAssignSubmitting = true
    try {
      const apiWeekIndex = Math.max(0, Number(week.weekIndex ?? 0))  // Backend dùng chỉ số tuần bắt đầu từ 0.
      const assignmentUpdates: Record<string, number> = {}
      candidateDates.forEach((d) => {
        const newVal = Number(empMap[d] || 0)
        const oldVal = Number(original[d] || 0)
        if (newVal !== oldVal) assignmentUpdates[d] = newVal
      })

      if (Object.keys(assignmentUpdates).length === 0) {
        showToast('Không có thay đổi để cập nhật.', 'warning')
        return
      }

      const payload = { employeeId, weekIndex: apiWeekIndex, assignment_days: assignmentUpdates }
      console.debug('[LeaderAssign] sending (absolute updates)', { kpiId, payload, original })
      const res = await axios.post(`/api/kpis/${encodeURIComponent(String(kpiId))}/assign-week`, payload)

      // Cập nhật lại tổng KPI đã giao theo dữ liệu phản hồi từ server.
      const updatedDays = Array.isArray(res?.data?.updatedDays)
        ? res.data.updatedDays
        : Array.isArray(res?.data?.data)
          ? res.data.data
          : Array.isArray(res?.data?.rows)
            ? res.data.rows
            : []
      if (Array.isArray(updatedDays) && updatedDays.length > 0) {
        setServerAssignedMap(prev => {
          const next = { ...prev }
          for (const d of updatedDays) {
            if (!d || !d.date) continue
            const dateKey = String(d.date || '').slice(0, 10)
            next[dateKey] = Number(d.totalAssigned ?? d.total_assigned ?? d.assigned_kpi ?? d.sumAssigned ?? d.assigned ?? 0) || 0
          }
          console.debug('[LeaderAssign] updatedDays from assign-week:', updatedDays)
          return next
        })
      }

      // Đồng bộ lại dữ liệu gốc sau khi cập nhật thành công và phát sự kiện làm mới giao diện.
      originalAssignmentRef.current = { ...originalAssignmentRef.current, [employeeKey]: { ...(originalAssignmentRef.current[employeeKey] || {}), ...(empMap || {}) } }
      const detail = { kpiId, weekIndex: week.weekIndex, employeeId, assignment_days: empMap, day_titles: {}, updatedDays }
      window.dispatchEvent(new CustomEvent('assignKpiToEmployees', { detail }))
      showToast('Phân công KPI thành công', 'success')
      setEditingEmployeeKey(null)
      // Tải lại tổng đã giao để hiển thị chính xác ngay lập tức.
      await loadAssigned()
    } catch (err: any) {
      console.error('assign error', err)
      const backendMsg: string | undefined = err?.response?.data?.message || err?.message
      const translate = (m?: string) => {
        if (!m) return 'Lỗi khi phân công KPI'
        const low = String(m).toLowerCase()
        if (low.includes('missing parameters') || low.includes('missing')) return 'Thiếu tham số yêu cầu.'
        if (low.includes('forbidden')) return 'Không có quyền thực hiện hành động này.'
        if (low.includes('kpi not found')) return 'Không tìm thấy KPI.'
        if (low.includes('employee not found')) return 'Không tìm thấy nhân viên.'
        if (low.includes('week not found')) return 'Tuần phân công không tồn tại.'
        if (low.includes('invalid date')) return 'Ngày phân công không hợp lệ.'
        if (low.includes('no valid assignment days')) return 'Không có ngày phân công hợp lệ.'
        if (low.includes('exceeds remaining')) return 'Giá trị phân công vượt quá phần còn lại của ngày.'
        if (low.includes('failed to assign')) return 'Phân công KPI thất bại.'
        if (low.includes('request failed with status code 400')) return 'Yêu cầu không hợp lệ.'
        return m
      }
      const msg = translate(backendMsg)
      showToast(msg, 'error')
    } finally {
      setSubmitting(false)
      ;(window as any).__leaderAssignSubmitting = false
    }
  }

  return (
    console.debug('[LeaderAssign] render snapshot', { serverAssignedMap, displayDays, assignmentDaysMap }),
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,23,0.35)' }} />

      <div style={{ width: 'min(980px,96%)', maxHeight: '86vh', overflow: 'auto', background: '#fff', borderRadius: 10, border: `1px solid ${palette.panelBorder}`, boxShadow: '0 12px 36px rgba(2,6,23,0.12)', position: 'relative', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px', background: palette.headerBg, borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottom: `1px solid ${palette.panelBorder}`, position: 'sticky', top: 0, zIndex: 30 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: palette.headerTitle }}>Phân công KPI - Tuần {displayWeekNo}</div>
            <div style={{ color: '#475569', fontSize: 13 }}>Từ {week.start_date} đến {week.end_date}</div>
          </div>
          <div style={{ maxWidth: 420, textAlign: 'right', color: '#64748b', fontSize: 12, lineHeight: 1.45 }}>
            Nhấn <strong>Chỉnh sửa</strong> để mở quyền cập nhật cho từng nhân viên.
            Giá trị có thể nhập theo ngày = <strong>Tổng KPI ngày</strong> trừ <strong>KPI đã giao cho nhân viên khác</strong>.
            Khi nhân viên đã nhận việc (<strong>đang làm</strong> trở lên) thì không thể sửa.
          </div>
        </header>

        <main style={{ padding: "5px 20px" }}>
          {loading && <div style={{ color: '#475569' }}>Đang tải nhân viên...</div>}
          {error && <div style={{ color: '#b91c1c' }}>Lỗi: {error}</div>}

          {!loading && !error && (
            <div>
              {employees.length === 0 && <div style={{ color: '#475569' }}>Không có nhân viên trong phòng ban này.</div>}

              {employees.length > 0 && (
                <div style={{ display: 'grid', gap: 12 }}>
                  {employees.map((u: any) => {
                    const key = String(u.id ?? u._id ?? u.user_id ?? u.userId ?? u.email)
                    const isOpen = Boolean(openEmployees[key])
                    const isEditingThisEmployee = editingEmployeeKey === key
                    const assignedFlag = Boolean(assignedEmployeeMap[String(key)])
                    const id = u.user_id ?? u.id ?? u._id ?? u.userId ?? key

                    const handleToggleEmployee = () => {
                      if (isOpen) {
                        // Thu gọn phần chi tiết của nhân viên hiện tại.
                        setDetailMaxHeights(prev => ({ ...prev, [key]: '0px' }))
                        setTimeout(() => {
                          setOpenEmployees(prev => { const next = { ...prev }; delete next[key]; return next })
                          const el = itemRefs.current[key]
                          if (el && typeof (el as any).scrollIntoView === 'function') try { (el as any).scrollIntoView({ behavior: 'smooth', block: 'start' }) } catch (_) { (el as any).scrollIntoView() }
                        }, COLLAPSE_TOTAL_MS)
                      } else {
                        // Mở phần chi tiết, tải dữ liệu và tính chiều cao để animate.
                        setOpenEmployees(prev => ({ ...prev, [key]: true }))
                        loadForEmployee(id)
                        requestAnimationFrame(() => {
                          const el = detailRefs.current[key]
                          const h = el ? el.scrollHeight : 0
                          setDetailMaxHeights(prev => ({ ...prev, [key]: h ? `${h + 12}px` : '0px' }))
                        })
                      }
                    }

                    return (
                      <div key={key} ref={(el) => { itemRefs.current[key] = el }} style={{ overflow: 'visible', marginBottom: 8 }}>
                        <div onClick={handleToggleEmployee} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: 14, borderRadius: 10, border: `1px solid ${palette.rowBorder}`, background: '#fff', boxShadow: isOpen ? '0 10px 30px rgba(2,6,23,0.06)' : '0 6px 18px rgba(15,23,42,0.04)', cursor: 'pointer', transition: 'transform 160ms ease, box-shadow 160ms ease' }}>
                          <div>
                            <div style={{ fontWeight: 700, color: palette.rowName }}>{u.name ?? u.full_name ?? u.email}</div>
                            {assignedFlag && <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>(đã giao)</div>}
                            <div style={{ fontSize: 13, color: '#64748b' }}>{u.department_position ?? '—'}</div>
                          </div>

                          <div style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 180ms ease' }}>
                              <path d="M6 9l6 6 6-6" stroke={palette.chevron} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </div>

                        {/* Hiển thị phần phân công ngay dưới nhân viên đang mở để bố cục ổn định. */}
                        <div style={{ transition: 'max-height 480ms cubic-bezier(.2,.9,.2,1), opacity 320ms ease', overflow: 'hidden', maxHeight: isOpen ? (detailMaxHeights[key] || '0px') : '0px', opacity: isOpen ? 1 : 0, marginBottom: 16 }}>
                          {isOpen && (
                            <section ref={(el) => { detailRefs.current[key] = el }}>
                              <div style={{ marginTop: 8 }}>
                                {displayDays.length === 0 && <div style={{ color: '#475569' }}>Không có ngày để phân công trong tuần này.</div>}

                                {displayDays.length > 0 && (
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                                    {displayDays.map((day: any) => {
                                      const dateIso = day.date
                                      const planned = Number(day.target_value || day.target || 0)
                                      const dateKey = String(dateIso || '').slice(0, 10)
                                      const serverAssigned = Number(serverAssignedMap[dateKey] ?? day.totalAssigned ?? day.assigned_total ?? day.assigned_kpi ?? day.assigned) || 0
                                      const remainingForOthers = Math.max(0, planned - serverAssigned)
                                      const empMap = assignmentDaysMap[key] || {}
                                      const currentAssigned = empMap[dateKey] || 0
                                      const employeeAssigned = Number((originalAssignmentRef.current[String(key)] || {})[dateKey] || 0)
                                      const editableMax = Math.max(0, remainingForOthers + employeeAssigned)
                                      const statusMapForEmp = assignedEmployeeStatusMap[String(key)] || {}
                                      const status = statusMapForEmp[dateKey] ?? (employeeAssigned > 0 ? 'assigned' : null)
                                      const inputDisabled = !isEditingThisEmployee || isLockedAssignmentStatus(status)
                                      const normalizedStatus = String(status || '').toLowerCase().trim()
                                      const statusBorder = normalizedStatus === 'completed'
                                        ? '2px solid #16a34a'
                                        : normalizedStatus === 'review' || normalizedStatus === 'approving' || normalizedStatus === 'in_review'
                                          ? '2px solid #2563eb'
                                          : normalizedStatus === 'doing' || normalizedStatus === 'in_progress'
                                            ? '2px solid #f59e0b'
                                            : '1px solid #0d93b475'
                                      const statusColor = normalizedStatus === 'completed'
                                        ? '#16a34a'
                                        : normalizedStatus === 'review' || normalizedStatus === 'approving' || normalizedStatus === 'in_review'
                                          ? '#2563eb'
                                          : normalizedStatus === 'doing' || normalizedStatus === 'in_progress'
                                            ? '#f59e0b'
                                            : undefined
                                      return (
                                        <div key={dateIso} style={{ padding: 12, borderRadius: 10, border: statusBorder }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                              <div style={{ fontSize: 13, fontWeight: 600 }}>{new Date(dateIso).toLocaleDateString('vi-VN')}</div>
                                              <div style={{ fontSize: 12, color: '#64748b' }}>Tổng {planned} · Còn lại {remainingForOthers} KPI</div>
                                              <div style={{ fontSize: 12, color: '#0f766e' }}>Đã giao {serverAssigned} KPI</div>
                                            </div>
                                            <div style={{ minWidth: 10, position: 'relative'}}>
                                              <input
                                                type="number"
                                                min={0}
                                                max={editableMax}
                                                value={String(currentAssigned)}
                                                disabled={inputDisabled}
                                                title={isLockedAssignmentStatus(status)
                                                  ? 'Nhân viên đã nhận/bắt đầu KPI ngày này nên không thể sửa'
                                                  : (!isEditingThisEmployee ? 'Bấm nút chỉnh sửa để cập nhật KPI cho nhân viên này' : undefined)
                                                }
                                                onChange={(e) => {
                                                  const raw = Number(e.target.value) || 0
                                                  if (editableMax <= 0 && raw > 0) {
                                                    showToast('Đã giao đủ KPI ngày này', 'warning')
                                                    setAssignmentDaysMap(prev => ({ ...prev, [key]: { ...(prev[key] || {}), [dateKey]: 0 } }))
                                                    return
                                                  }
                                                  const v = Math.max(0, Math.min(editableMax, raw))
                                                  setAssignmentDaysMap(prev => ({ ...prev, [key]: { ...(prev[key] || {}), [dateKey]: v } }))
                                                }}
                                                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: statusBorder, fontSize: 14, textAlign: 'center', color: statusColor }}
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      )
                                    })}

                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginRight: 16, marginTop: 15 }}>
                                      <button
                                        onClick={() => {
                                          setEditingEmployeeKey(prev => prev === key ? null : key)
                                        }}
                                        style={{
                                          width: 48,
                                          height: 48,
                                          padding: 8,
                                          borderRadius: 999,
                                          border: `1px solid ${palette.assignBtnBorder}`,
                                          background: isEditingThisEmployee ? '#fdf2f8' : '#fff',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          cursor: 'pointer'
                                        }}
                                        aria-label="Chỉnh sửa"
                                        title={isEditingThisEmployee ? 'Đang chỉnh sửa nhân viên này' : 'Bật chế độ chỉnh sửa cho nhân viên này'}
                                      >
                                        <img src="/image/edit_icon.png" alt="Chỉnh sửa" style={{ width: 28, height: 28, display: 'block', filter: disabledAssign ? 'grayscale(100%)' : 'none' }} />
                                      </button>

                                      <button onClick={() => { handleSubmitForEmployee(key) }} disabled={disabledAssign || submitting} style={{ width: 48, height: 48, padding: 8, borderRadius: 999, border: `1px solid ${palette.assignBtnBorder}`, background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: (disabledAssign || submitting) ? 'not-allowed' : 'pointer' }} aria-label="Phân công">
                                        <img src="/image/assignment_icon.png" alt="Phân công" style={{ width: 28, height: 28, display: 'block', filter: disabledAssign ? 'grayscale(100%)' : 'none' }} />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </section>
                          )}
                        </div>
                      </div>
                    )
                  })}
                      </div>
              )}

              
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

