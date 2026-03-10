import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from '../../../api/axios'
import { useAuth } from '../../../contexts/AuthContext'
import DashboardLayout from '../../components/layout/DashboardLayout'

interface Assignment {
  date: string
  assigned_kpi: number
  status: string
}

interface KpiDay {
  kpi_day_id: number
  date: string
  target_value: number
  kpi_current?: number
  totalAssigned?: number
}

interface Week {
  week_index: number
  start_date: string
  end_date: string
  days: KpiDay[]
}

interface KPI {
  chain_kpi_id: number
  kpi_name: string[]
  description: string
  start_date: string
  end_date: string
  total_kpi: number
  weeks: Week[]
}

export default function UserKpiDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, signout } = useAuth()
  const userId = (user as any)?.user_id
  const displayName = (user as any)?.name || (user as any)?.username || 'User'

  const [kpi, setKpi] = useState<KPI | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)

        if (!id) {
          setError('KPI không xác định')
          return
        }

        // Lấy chi tiết KPI
        const kpiRes = await axios.get(`/api/kpis/${id}`)
        const kpiData = kpiRes.data
        setKpi(kpiData)

        // Lấy phân công của user
        const assignRes = await axios.get(`/api/kpis/${id}/assignments?assigned_to=${userId}`)
        const rows = Array.isArray(assignRes.data) ? assignRes.data : (assignRes.data?.rows ?? [])
        setAssignments(rows)
      } catch (err: any) {
        setError(err?.response?.data?.message || err.message || 'Lỗi khi tải KPI')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [id, userId])

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('vi-VN')
    } catch {
      return dateStr
    }
  }

  const formatDateFull = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('vi-VN', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    } catch {
      return dateStr
    }
  }



  const totalAssigned = assignments.reduce((sum, a) => sum + (Number(a.assigned_kpi ?? 0) || 0), 0)
  const completedTasks = assignments.filter(a => a.status === 'completed').length

  const content = kpi ? (
    <div style={{ padding: 24, background: '#f9fafb', minHeight: '100vh' }}>
      {/* Back Button */}
      <button
        onClick={() => navigate('/user/kpi')}
        style={{
          padding: '8px 16px',
          background: '#f3f4f6',
          color: '#0b3b66',
          border: '1px solid #d1d5db',
          borderRadius: 6,
          cursor: 'pointer',
          marginBottom: 20,
          fontWeight: 500
        }}
      >
        ← Quay lại
      </button>

      {/* Header */}
      <div style={{
        background: '#fff',
        borderRadius: 12,
        padding: 24,
        marginBottom: 24,
        boxShadow: '0 4px 6px rgba(0,0,0,0.07)',
        borderLeft: '6px solid #0369a1'
      }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0b3b66', marginBottom: 8 }}>
          {Array.isArray(kpi.kpi_name) && kpi.kpi_name.length
            ? kpi.kpi_name.join(' • ')
            : kpi.description || 'KPI'}
        </h1>
        <p style={{ color: '#64748b', marginBottom: 16 }}>
          {formatDate(kpi.start_date)} — {formatDate(kpi.end_date)}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Tổng KPI phòng ban</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#0369a1' }}>{kpi.total_kpi}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>KPI được giao cho bạn</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#059669' }}>{totalAssigned}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Hoàn thành</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#7c3aed' }}>{completedTasks}</div>
          </div>
        </div>
      </div>

      {/* Weekly Breakdown */}
      {kpi.weeks && kpi.weeks.length > 0 && (
        <div style={{
          background: '#fff',
          borderRadius: 12,
          padding: 24,
          marginBottom: 24,
          boxShadow: '0 4px 6px rgba(0,0,0,0.07)'
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0b3b66', marginBottom: 16 }}>
            Chi tiết theo tuần
          </h2>

          <div style={{ display: 'grid', gap: 16 }}>
            {kpi.weeks.map((week) => {
              const weekAssignments = assignments.filter(a => {
                const aDate = new Date(a.date)
                const wStart = new Date(week.start_date)
                const wEnd = new Date(week.end_date)
                return aDate >= wStart && aDate <= wEnd
              })
              const weekTotal = weekAssignments.reduce((s, a) => s + (Number(a.assigned_kpi ?? 0) || 0), 0)

              return (
                <div key={week.week_index} style={{
                  background: weekAssignments.length > 0 ? '#f0f9ff' : '#f9fafb',
                  border: weekAssignments.length > 0 ? '2px solid #0369a1' : '1px dashed #cbd5e1',
                  borderRadius: 10,
                  padding: 16,
                  overflow: 'hidden'
                }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#0b3b66',
                    marginBottom: 12
                  }}>
                    📅 Tuần {week.week_index + 1}: {formatDate(week.start_date)} - {formatDate(week.end_date)}
                  </div>

                  {weekAssignments.length > 0 ? (
                    <>
                      <div style={{
                        background: '#ffffff',
                        padding: 12,
                        borderRadius: 8,
                        marginBottom: 12,
                        borderLeft: '4px solid #0369a1'
                      }}>
                        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                          KPI được giao tuần này
                        </div>
                        <div style={{
                          fontSize: 20,
                          fontWeight: 700,
                          color: '#0369a1'
                        }}>
                          {weekTotal} KPI
                        </div>
                      </div>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                        gap: 8
                      }}>
                        {weekAssignments.map((assign, idx) => (
                          <div key={idx} style={{
                            background: assign.status === 'completed' ? '#dbeafe' : '#fef3c7',
                            border: `2px solid ${assign.status === 'completed' ? '#3b82f6' : '#f59e0b'}`,
                            borderRadius: 8,
                            padding: 10,
                            textAlign: 'center'
                          }}>
                            <div style={{
                              fontSize: 11,
                              color: '#64748b',
                              marginBottom: 4,
                              fontWeight: 500
                            }}>
                              {new Date(assign.date).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit' })}
                            </div>
                            <div style={{
                              fontSize: 16,
                              fontWeight: 700,
                              color: assign.status === 'completed' ? '#1e40af' : '#b45309',
                              marginBottom: 4
                            }}>
                              {assign.assigned_kpi}
                            </div>
                            <div style={{
                              fontSize: 9,
                              color: assign.status === 'completed' ? '#1e40af' : '#b45309',
                              fontWeight: 600
                            }}>
                              {assign.status === 'completed' ? '✓' : '⏳'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div style={{
                      background: '#f3f4f6',
                      padding: 12,
                      borderRadius: 8,
                      textAlign: 'center',
                      color: '#64748b',
                      fontSize: 13
                    }}>
                      Chưa có phân công cho tuần này
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* All Assignments */}
      {assignments.length > 0 && (
        <div style={{
          background: '#fff',
          borderRadius: 12,
          padding: 24,
          boxShadow: '0 4px 6px rgba(0,0,0,0.07)'
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0b3b66', marginBottom: 16 }}>
            Danh sách phân công chi tiết
          </h2>

          <div style={{
            overflow: 'x',
            borderRadius: 8,
            border: '1px solid #e5e7eb'
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}>
              <thead>
                <tr style={{ background: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, color: '#0b3b66' }}>Ngày</th>
                  <th style={{ padding: 12, textAlign: 'center', fontWeight: 600, color: '#0b3b66' }}>KPI</th>
                  <th style={{ padding: 12, textAlign: 'center', fontWeight: 600, color: '#0b3b66' }}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assign, idx) => (
                  <tr key={idx} style={{
                    borderBottom: '1px solid #e5e7eb',
                    background: idx % 2 === 0 ? '#ffffff' : '#f9fafb'
                  }}>
                    <td style={{ padding: 12, color: '#0b3b66', fontWeight: 500 }}>
                      {formatDateFull(assign.date)}
                    </td>
                    <td style={{
                      padding: 12,
                      textAlign: 'center',
                      fontSize: 16,
                      fontWeight: 700,
                      color: '#0369a1'
                    }}>
                      {assign.assigned_kpi}
                    </td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 600,
                        background: assign.status === 'completed' ? '#d1fae5' : '#fef3c7',
                        color: assign.status === 'completed' ? '#065f46' : '#92400e'
                      }}>
                        {assign.status === 'completed' ? '✓ Hoàn thành' : '⏳ Đang làm'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {assignments.length === 0 && (
        <div style={{
          background: '#fff',
          borderRadius: 12,
          padding: 40,
          textAlign: 'center',
          boxShadow: '0 4px 6px rgba(0,0,0,0.07)'
        }}>
          <p style={{ color: '#64748b', fontSize: 14 }}>
            Bạn chưa được giao KPI này
          </p>
        </div>
      )}
    </div>
  ) : null

  if (loading) {
    return (
      <DashboardLayout roleLabel="Chi tiết KPI" userName={displayName} onSignOut={signout} activeMenuKey="kpi_task">
        <div style={{ padding: 40, textAlign: 'center' }}>
          <p style={{ color: '#64748b' }}>Đang tải dữ liệu...</p>
        </div>
      </DashboardLayout>
    )
  }

  if (error || !kpi) {
    return (
      <DashboardLayout roleLabel="Chi tiết KPI" userName={displayName} onSignOut={signout} activeMenuKey="kpi_task">
        <div style={{
          background: '#fee2e2',
          color: '#991b1b',
          padding: 20,
          borderRadius: 8
        }}>
          <p><strong>Lỗi:</strong> {error || 'Không tìm thấy KPI'}</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout roleLabel="Chi tiết KPI" userName={displayName} onSignOut={signout} activeMenuKey="kpi_task">
      {content}
    </DashboardLayout>
  )
}
