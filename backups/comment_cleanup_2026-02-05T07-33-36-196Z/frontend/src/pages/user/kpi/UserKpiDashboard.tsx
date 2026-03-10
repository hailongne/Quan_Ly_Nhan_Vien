import { useEffect, useState } from 'react'
import ProgressBar from './ProgressBar'
import KpiCard from './KpiCard'
import AssignmentsColumns from './AssignmentsColumns'
import { useNavigate } from 'react-router-dom'
import axios from '../../../api/axios'
import { useAuth } from '../../../contexts/AuthContext'

interface KpiDay {
  kpi_day_id: number
  date: string
  target_value: number
  totalAssigned?: number
  kpi_current?: number
}

interface Week {
  chain_kpi_week_id?: number
  week_index: number
  start_date: string
  end_date: string
  total_target_value?: number
  days?: KpiDay[]
}

interface KPI {
  chain_kpi_id: number
  kpi_name?: string[]
  description?: string
  start_date: string
  end_date: string
  total_kpi: number
  weeks?: Week[]
  department_name?: string
}

interface UserAssignment {
  kpiId: number
  weekIndex: number
  date: string
  assignedKpi: number
  taskId?: number
  kpiNames?: string[]
  status: 'pending' | 'in_progress' | 'completed' | 'doing' | 'not_completed' | 'review'
}

export default function UserKpiDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const userId = (user as any)?.user_id
  const deptId = (user as any)?.department_id
  
  const [kpis, setKpis] = useState<KPI[]>([])
  const [userAssignments, setUserAssignments] = useState<UserAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedKpiId, setSelectedKpiId] = useState<number | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [availableMonths, setAvailableMonths] = useState<string[]>([])

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)

        if (!deptId) {
          setError('Không xác định phòng ban')
          return
        }

        // Lấy danh sách KPI của phòng ban
        const kpiRes = await axios.get(`/api/kpis/department`, { params: { department_id: deptId } })
        const kpiList = Array.isArray(kpiRes.data) ? kpiRes.data : (kpiRes.data?.kpis ?? [])

        // Lấy chi tiết phân công của user từ database
        const assignmentsMap: UserAssignment[] = []
        for (const kpi of kpiList) {
          try {
            const assignRes = await axios.get(`/api/kpis/${kpi.chain_kpi_id}/assignments?assigned_to=${userId}`)
            const rows = Array.isArray(assignRes.data) ? assignRes.data : (assignRes.data?.rows ?? [])
            
            for (const row of rows) {
              // Normalize DB statuses to UI statuses (strict mapping)
              const status = row.status === 'completed'
                ? 'completed'
                : row.status === 'doing'
                  ? 'doing'
                  : row.status === 'review'
                    ? 'review'
                    : row.status === 'not_completed'
                      ? 'not_completed'
                      : 'pending'
              assignmentsMap.push({
                kpiId: kpi.chain_kpi_id,
                weekIndex: 0, // Sẽ tính từ date
                date: row.date,
                assignedKpi: Number(row.assigned_kpi ?? 0),
                taskId: row.task_id,
                kpiNames: Array.isArray(kpi.kpi_name) ? kpi.kpi_name : [],
                status
              })
            }
          } catch (e) {
            // Bỏ qua lỗi
          }
        }

        setKpis(kpiList)
        setUserAssignments(assignmentsMap)

        // Tính toán các tháng có KPI
        const monthsSet = new Set<string>()
        for (const kpi of kpiList) {
          const startDate = new Date(kpi.start_date)
          const endDate = new Date(kpi.end_date)
          
          for (let d = new Date(startDate); d <= endDate; d.setMonth(d.getMonth() + 1)) {
            const year = d.getFullYear()
            const month = String(d.getMonth() + 1).padStart(2, '0')
            monthsSet.add(`${year}-${month}`)
          }
        }

        const months = Array.from(monthsSet).sort()
        setAvailableMonths(months)

        // Chọn tháng mặc định: tháng hiện tại hoặc tháng gần nhất trong tương lai
        const now = new Date()
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        
        if (months.includes(currentMonth)) {
          setSelectedMonth(currentMonth)
        } else {
          const futureMonth = months.find(m => m > currentMonth)
          setSelectedMonth(futureMonth || months[0] || currentMonth)
        }
      } catch (err: any) {
        setError(err?.response?.data?.message || err.message || 'Lỗi khi tải dữ liệu')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [userId, deptId])

  const getMonthLabel = (monthStr: string) => {
    if (!monthStr) return ''
    const [year, month] = monthStr.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1)
    return date.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })
  }

  const isKpiInMonth = (kpi: KPI, monthStr: string) => {
    if (!monthStr) return true
    const [year, month] = monthStr.split('-')
    const targetYear = parseInt(year)
    const targetMonth = parseInt(month)

    const startDate = new Date(kpi.start_date)
    const endDate = new Date(kpi.end_date)

    // Kiểm tra nếu KPI nằm trong tháng được chọn
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      if (d.getFullYear() === targetYear && d.getMonth() + 1 === targetMonth) {
        return true
      }
    }
    return false
  }

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      const weekdays: Record<number, string> = {
        0: 'Chủ nhật',
        1: 'Thứ 2',
        2: 'Thứ 3',
        3: 'Thứ 4',
        4: 'Thứ 5',
        5: 'Thứ 6',
        6: 'Thứ 7'
      }
      const yy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const wd = weekdays[d.getDay()] || ''
      return `${wd}, ${dd}/${mm}/${yy}`
    } catch {
      return dateStr
    }
  }

  const formatFullDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('vi-VN')
    } catch {
      return dateStr
    }
  }

  const calculateWorkDays = (startDate: string, endDate: string): { completed: number; total: number } => {
    try {
      const start = new Date(startDate)
      const end = new Date(endDate)
      let workDays = 0
      let completedDays = 0

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay()
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          workDays++
          const dateStr = d.toISOString().split('T')[0]
          const dayAssignments = userAssignments.filter(
            a => a.date === dateStr && a.status === 'completed'
          )
          if (dayAssignments.length > 0) {
            completedDays++
          }
        }
      }
      return { completed: completedDays, total: workDays }
    } catch {
      return { completed: 0, total: 0 }
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <p>Đang tải dữ liệu...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 20, background: '#fee2e2', color: '#991b1b', borderRadius: 8 }}>
        <p><strong>Lỗi:</strong> {error}</p>
      </div>
    )
  }

  // Lọc phân công theo tháng được chọn, sau đó theo KPI nếu cần
  const assignmentsInMonth = selectedMonth
    ? userAssignments.filter(a => a.date.startsWith(selectedMonth))
    : userAssignments

  const filteredAssignments = selectedKpiId
    ? assignmentsInMonth.filter(a => a.kpiId === selectedKpiId)
    : assignmentsInMonth

  const filteredCompletedTasks = filteredAssignments.filter(a => a.status === 'completed').length
  const filteredTotalTasks = filteredAssignments.length
  
  const handleAssignmentStatusChange = (payload: any, newStatus: UserAssignment['status']) => {
    console.log('[UserKpiDashboard] handleAssignmentStatusChange', { payload, newStatus })
    if (!payload) {
      console.warn('[UserKpiDashboard] missing payload', payload)
      return
    }

    const applyUpdate = async (taskId: any) => {
      // Optimistically update local state (compare IDs as strings to avoid type mismatch)
      setUserAssignments((prev: UserAssignment[]) => prev.map(a => String(a.taskId) === String(taskId) ? { ...a, status: newStatus } : a))

      // Persist to backend
      try {
        console.log('[UserKpiDashboard] calling API to update status', { url: `/api/kpis/${payload.kpiId}/assignments/${taskId}/status`, body: { status: newStatus } })
        const res = await axios.post(`/api/kpis/${payload.kpiId}/assignments/${taskId}/status`, { status: newStatus })
        console.log('[UserKpiDashboard] update status response', res && res.data)
      } catch (err) {
        console.error('[UserKpiDashboard] update status error', err)
        // revert on failure (use functional update to avoid stale closures)
        setUserAssignments((prev: UserAssignment[]) => prev.map(a => String(a.taskId) === String(taskId) ? { ...a, status: payload.status } : a))
      }
    }

    // If taskId present, use it; otherwise do an optimistic update by matching locally,
    // then fetch server rows to resolve the real taskId and persist.
    if (payload.taskId) {
      applyUpdate(payload.taskId)
      return
    }

    // Optimistic local update: match by kpiId + date + assignedKpi
    setUserAssignments((prev: UserAssignment[]) => prev.map(a => (a.kpiId === payload.kpiId && a.date === payload.date && Number(a.assignedKpi) === Number(payload.assignedKpi)) ? { ...a, status: newStatus } : a));

    (async () => {
      try {
        console.log('[UserKpiDashboard] fetching assignments to resolve taskId', { kpiId: payload.kpiId })
        const res = await axios.get(`/api/kpis/${payload.kpiId}/assignments`, { params: { assigned_to: userId } })
        const rows = Array.isArray(res.data) ? res.data : (res.data?.rows || [])
        // find by date + assigned_kpi (assignee may vary depending on endpoint)
        const found = rows.find((r: any) => r.date === payload.date && Number(r.assigned_kpi) === Number(payload.assignedKpi))
        if (found && found.task_id) {
          console.log('[UserKpiDashboard] resolved taskId', found.task_id)
          await applyUpdate(found.task_id)
        } else {
          console.warn('[UserKpiDashboard] could not resolve taskId from server response', { rowsSample: rows.slice(0,5) })
          // If not found, revert the optimistic change
          setUserAssignments((prev: UserAssignment[]) => prev.map(a => (a.kpiId === payload.kpiId && a.date === payload.date && Number(a.assignedKpi) === Number(payload.assignedKpi)) ? { ...a, status: payload.status } : a))
        }
      } catch (err) {
        console.error('[UserKpiDashboard] error fetching assignments to resolve taskId', err)
        // revert on error
        setUserAssignments((prev: UserAssignment[]) => prev.map(a => (a.kpiId === payload.kpiId && a.date === payload.date && Number(a.assignedKpi) === Number(payload.assignedKpi)) ? { ...a, status: payload.status } : a))
      }
    })()
  }

  return (
    <div style={{ minHeight: '100vh', padding: 24}}>

      {/* KPI Filter - Horizontal Scroll Cards */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: 16, marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0b3b66', whiteSpace: 'nowrap' }}>
            📊 Các KPI của phòng ban:
          </div>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: '#fff',
              color: '#0b3b66',
              fontWeight: 500,
              cursor: 'pointer',
              fontSize: 13,
              whiteSpace: 'nowrap'
            }}
          >
            {availableMonths.map(month => (
              <option key={month} value={month}>
                {getMonthLabel(month)}
              </option>
            ))}
          </select>

          {/* Progress Bar */}
          {filteredTotalTasks > 0 && (
            <ProgressBar completed={filteredCompletedTasks} total={filteredTotalTasks} />
          )}
        </div>
        <div style={{
          display: 'flex',
          gap: 16,
          overflowX: 'auto',
          paddingBottom: 8
        }}>
          {/* KPI Cards */}
          {kpis.filter(kpi => isKpiInMonth(kpi, selectedMonth)).map((kpi) => (
            <KpiCard
              key={kpi.chain_kpi_id}
              kpi={kpi}
              isSelected={selectedKpiId === kpi.chain_kpi_id}
              onClick={() => setSelectedKpiId(selectedKpiId === kpi.chain_kpi_id ? null : kpi.chain_kpi_id)}
              formatFullDate={formatFullDate}
              calculateWorkDays={calculateWorkDays}
            />
          ))}
        </div>
      </div>

      {/* KPI List */}
      {kpis.length === 0 ? (
        <div style={{
          background: '#fff',
          borderRadius: 12,
          padding: 40,
          textAlign: 'center',
          color: '#64748b'
        }}>
          <p>Chưa có KPI nào được giao cho phòng ban của bạn.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 20 }}>
          {kpis
            .filter(kpi => isKpiInMonth(kpi, selectedMonth) && (selectedKpiId ? kpi.chain_kpi_id === selectedKpiId : assignmentsInMonth.some(a => a.kpiId === kpi.chain_kpi_id)))
            .map((kpi) => {
            const kpiAssignments = assignmentsInMonth.filter(a => a.kpiId === kpi.chain_kpi_id)

            return (
              <div key={kpi.chain_kpi_id} style={{
                background: '#fff',
                borderRadius: 12,
                border: '1px solid #e5e7eb',
                overflow: 'hidden',
                boxShadow: '0 4px 6px rgba(0,0,0,0.07)'
              }}>
                {/* KPI Header */}
                <div style={{
                  background: 'linear-gradient(135deg, #0369a1 0%, #0284c7 100%)',
                  color: '#fff',
                  padding: 20,
                  cursor: 'pointer',
                  transition: 'opacity 0.2s'
                }} onClick={() => navigate(`/user/kpi/${kpi.chain_kpi_id}`)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                        {Array.isArray(kpi.kpi_name) && kpi.kpi_name.length
                          ? kpi.kpi_name.join(' • ')
                          : kpi.description || 'KPI'}
                      </h2>
                      <p style={{ fontSize: 13, opacity: 0.9 }}>
                        {formatFullDate(kpi.start_date)} — {formatFullDate(kpi.end_date)}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, opacity: 0.9 }}>Tổng KPI phòng</div>
                      <div style={{ fontSize: 24, fontWeight: 700 }}>{kpi.total_kpi}</div>
                    </div>
                  </div>
                </div>

                {/* KPI Content */}
                <div style={{ padding: 20 }}>
                  {kpiAssignments.length === 0 ? (
                    <div style={{
                      background: '#f0fdf4',
                      border: '1px dashed #86efac',
                      borderRadius: 8,
                      padding: 16,
                      textAlign: 'center',
                      color: '#166534'
                    }}>
                      <p>Bạn chưa được giao KPI này</p>
                    </div>
                  ) : (
                    <>
                      {/* Weekly Details */}
                      {kpi.weeks && kpi.weeks.length > 0 && (
                        <div>
                          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#0b3b66', marginBottom: 12 }}>
                            Chi tiết theo tuần
                          </h3>
                          <div style={{ display: 'grid', gap: 8 }}>
                            {kpi.weeks.map((week) => {
                              const weekAssignments = kpiAssignments.filter(a => {
                                const aDate = new Date(a.date)
                                const wStart = new Date(week.start_date)
                                const wEnd = new Date(week.end_date)
                                return aDate >= wStart && aDate <= wEnd
                              })
                              const weekTotal = weekAssignments.reduce((s, a) => s + a.assignedKpi, 0)
                              const weekCompleted = weekAssignments.filter(a => a.status === 'completed').length

                              return (
                                <div key={week.chain_kpi_week_id} style={{
                                  background: weekAssignments.length > 0 ? '#f8fafc' : '#f9fafb',
                                  border: weekAssignments.length > 0 ? '1px solid #cbd5e1' : '1px dashed #e2e8f0',
                                  borderRadius: 8,
                                  padding: 12
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: '#0b3b66' }}>
                                      Tuần {week.week_index + 1} ({formatFullDate(week.start_date)} - {formatFullDate(week.end_date)})
                                    </div>
                                    {weekAssignments.length > 0 && (
                                      <div style={{ fontSize: 11, color: '#64748b' }}>
                                        {weekCompleted}/{weekTotal} ✓
                                      </div>
                                    )}
                                  </div>
                                  
                                  {weekAssignments.length > 0 ? (
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                      {weekAssignments.map((assign, idx) => (
                                        <div key={idx} style={{
                                          background: assign.status === 'completed' ? '#d1fae5' : '#fef3c7',
                                          color: assign.status === 'completed' ? '#065f46' : '#92400e',
                                          border: `1px solid ${assign.status === 'completed' ? '#a7f3d0' : '#fcd34d'}`,
                                          borderRadius: 6,
                                          padding: '6px 10px',
                                          fontSize: 11,
                                          fontWeight: 500
                                        }}>
                                          <span>{formatDate(assign.date)}</span>
                                          <span style={{ marginLeft: 6, fontWeight: 700 }}>
                                            {assign.assignedKpi} KPI {assign.status === 'completed' ? '✓' : ''}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p style={{ fontSize: 11, color: '#94a3b8' }}>Chưa có phân công</p>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Assignments columns */}
                      <AssignmentsColumns assignments={kpiAssignments} formatDate={formatDate} onChangeStatus={handleAssignmentStatusChange} />
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
