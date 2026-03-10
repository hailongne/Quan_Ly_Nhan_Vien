import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import axios from '../../api/axios';
import { useNavigate } from 'react-router-dom';
import ProgressBar from './kpi/ProgressBar';
import KpiCard from './kpi/KpiCard';
import AssignmentsColumns from './kpi/AssignmentsColumns';

type DashboardStatusFilter = 'all' | 'in_progress' | 'completed' | 'pending' | 'overdue' | 'upcoming';

const toDateOnly = (value: string | Date) => {
  const dt = typeof value === 'string' ? new Date(value.includes('T') ? value : `${value}T00:00:00`) : new Date(value);
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
};

const inSelectedMonth = (dateRaw: string, selectedMonth: string) => {
  if (!dateRaw || !selectedMonth) return false;

  const text = String(dateRaw);
  // Fast path for YYYY-MM-DD or ISO strings
  if (/^\d{4}-\d{2}/.test(text)) {
    return text.slice(0, 7) === selectedMonth;
  }

  const d = toDateOnly(text);
  const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return monthKey === selectedMonth;
};

const statusToKey = (statusRaw: string) => {
  const s = String(statusRaw || '').toLowerCase().trim();
  if (s.includes('hoàn thành') || s.includes('hoan thanh')) return 'completed';
  if (s.includes('chờ phê duyệt') || s.includes('cho phe duyet')) return 'pending';
  if (s.includes('đang thực hiện') || s.includes('dang thuc hien')) return 'in_progress';
  return 'in_progress';
};

const getStartDateRaw = (row: any) => {
  return row.startDate || row.start_date || row.assignedAt || row.assigned_at || row.createdAt || row.created_at || '';
};

const formatDateVi = (value: any) => {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleDateString('vi-VN');
};

const translateAction = (value: string) => {
  const s = String(value || '').toLowerCase().trim();
  if (s === 'completed') return 'Hoàn thành';
  if (s === 'doing') return 'Đang làm';
  if (s === 'pending') return 'Chờ duyệt';
  if (s === 'overdue') return 'Quá hạn';
  return value;
};

const getDepartmentName = (row: any, fallbackDepartment?: string) => {
  return row.department || row.departmentName || row.department_name || fallbackDepartment || '-';
};

const formatDateRangeVi = (startValue: any, endValue: any) => {
  const start = formatDateVi(startValue);
  const end = formatDateVi(endValue);
  if (start === '-' && end === '-') return '-';
  if (start === '-') return `Đến hạn: ${end}`;
  if (end === '-') return `Bắt đầu: ${start}`;
  return `${start} → ${end}`;
};

const formatTaskDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    const weekdays: Record<number, string> = {
      0: 'Chủ nhật',
      1: 'Thứ 2',
      2: 'Thứ 3',
      3: 'Thứ 4',
      4: 'Thứ 5',
      5: 'Thứ 6',
      6: 'Thứ 7',
    };
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const wd = weekdays[d.getDay()] || '';
    return `${wd}, ${dd}/${mm}/${yy}`;
  } catch {
    return dateStr;
  }
};

const formatMonthOnlyVi = (startValue: any, endValue: any) => {
  const start = startValue ? new Date(startValue) : null;
  const end = endValue ? new Date(endValue) : null;
  if (!start || Number.isNaN(start.getTime())) return '-';

  const startMonth = start.getMonth() + 1;
  const startYear = start.getFullYear();

  if (!end || Number.isNaN(end.getTime())) {
    return `Tháng ${startMonth}/${startYear}`;
  }

  const endMonth = end.getMonth() + 1;
  const endYear = end.getFullYear();

  if (startYear === endYear && startMonth === endMonth) {
    return `Tháng ${startMonth}/${startYear}`;
  }

  if (startYear === endYear) {
    return `Tháng ${startMonth}-${endMonth}/${startYear}`;
  }

  return `Tháng ${startMonth}/${startYear} - ${endMonth}/${endYear}`;
};


function Card({ title, value, right }: { title: string; value: string | number; right?: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 12, textAlign: 'center', minWidth: 140, height: 92, boxShadow: '0 8px 20px rgba(2,6,23,0.06)', border: '1px solid #eef2f8', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#0b63b5' }}>{value}</div>
        {right && <div style={{ marginLeft: 8 }}>{right}</div>}
      </div>
    </div>
  );
}

// SmallPie removed — use existing ProgressBar component or other charts instead


export default function UserOverviewDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = (user as any)?.user_id;
  const deptId = (user as any)?.department_id;
  const userDepartment = (user as any)?.department_name || (user as any)?.department || '';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [filterStatus, setFilterStatus] = useState<DashboardStatusFilter>('all');
  const [filterKpiName, setFilterKpiName] = useState('');
  const [selectedKpi, setSelectedKpi] = useState<any | null>(null);
  const [selectedPreviewKpiId, setSelectedPreviewKpiId] = useState<number | null>(null);
  const [previewAssignments, setPreviewAssignments] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get('/api/users/dashboard');
        if (!mounted) return;
        setData(res.data);
      } catch (err: any) {
        setError(err?.response?.data?.message || err.message || 'Lỗi khi tải dữ liệu');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [userId, deptId]);

  // completion rate logic removed per request

  const myKpiRows = useMemo(() => data?.myKpis || [], [data]);

  const recentActivity = useMemo(() => data?.recentActivities || [], [data]);

  const filteredMyKpiRows = useMemo(() => {
    const keyword = filterKpiName.trim().toLowerCase();
    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    return myKpiRows.filter((row: any) => {
      const deadline = row.deadline ? String(row.deadline) : '';
      const lastUpdated = row.lastUpdated ? String(row.lastUpdated) : '';
      const deadlineInMonth = deadline ? inSelectedMonth(deadline, selectedMonth) : false;
      const updatedInMonth = lastUpdated ? inSelectedMonth(lastUpdated, selectedMonth) : false;

      // Keep KPI if either deadline month OR latest update month matches selected month
      if ((deadline || lastUpdated) && !(deadlineInMonth || updatedInMonth)) return false;

      const name = String(row.name || '').toLowerCase();
      if (keyword && !name.includes(keyword)) return false;

      if (filterStatus !== 'all') {
        const key = statusToKey(row.status);
        if (filterStatus === 'overdue') {
          if (!deadline) return false;
          const d = toDateOnly(deadline);
          return d < todayDate && Number(row.progress || 0) < 100;
        }
        if (filterStatus === 'upcoming') {
          if (!deadline) return false;
          const d = toDateOnly(deadline);
          const daysRemaining = Math.ceil((d.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
          return daysRemaining >= 0 && daysRemaining <= 14;
        }
        return key === filterStatus;
      }

      return true;
    });
  }, [myKpiRows, filterKpiName, filterStatus, selectedMonth]);

  const assignedThisMonth = useMemo(() => {
    return myKpiRows.filter((row: any) => {
      const deadline = row.deadline ? String(row.deadline) : '';
      const lastUpdated = row.lastUpdated ? String(row.lastUpdated) : '';
      const deadlineInMonth = deadline ? inSelectedMonth(deadline, selectedMonth) : false;
      const updatedInMonth = lastUpdated ? inSelectedMonth(lastUpdated, selectedMonth) : false;
      return Boolean(deadline || lastUpdated) && (deadlineInMonth || updatedInMonth);
    });
  }, [myKpiRows, selectedMonth]);

  useEffect(() => {
    if (!assignedThisMonth.length) {
      setSelectedPreviewKpiId(null);
      setPreviewAssignments([]);
      return;
    }

    const exists = assignedThisMonth.some((row: any) => Number(row.id) === Number(selectedPreviewKpiId));
    if (!exists) {
      setSelectedPreviewKpiId(Number(assignedThisMonth[0].id));
    }
  }, [assignedThisMonth, selectedPreviewKpiId]);

  useEffect(() => {
    let mounted = true;
    const loadAssignmentsForPreview = async () => {
      if (!selectedPreviewKpiId || !userId) {
        if (mounted) setPreviewAssignments([]);
        return;
      }

      try {
        const res = await axios.get(`/api/kpis/${selectedPreviewKpiId}/assignments`, { params: { assigned_to: userId } });
        const rows = Array.isArray(res.data) ? res.data : (res.data?.rows ?? []);
        const mapped = rows
          .filter((row: any) => !selectedMonth || String(row.date || '').startsWith(selectedMonth))
          .map((row: any) => ({
            kpiId: selectedPreviewKpiId,
            date: row.date,
            assignedKpi: Number(row.assigned_kpi || 0),
            taskId: row.task_id,
            kpiNames: [],
            status: row.status === 'completed'
              ? 'completed'
              : row.status === 'doing'
                ? 'doing'
                : row.status === 'review'
                  ? 'review'
                  : row.status === 'not_completed'
                    ? 'not_completed'
                    : 'pending',
          }));

        if (mounted) setPreviewAssignments(mapped);
      } catch {
        if (mounted) setPreviewAssignments([]);
      }
    };

    loadAssignmentsForPreview();
    return () => {
      mounted = false;
    };
  }, [selectedPreviewKpiId, selectedMonth, userId]);

  const previewKpiCards = useMemo(() => {
    return assignedThisMonth.map((row: any) => ({
      chain_kpi_id: Number(row.id),
      kpi_name: [String(row.name || 'KPI')],
      description: String(row.name || 'KPI'),
      start_date: getStartDateRaw(row) || row.deadline,
      end_date: row.deadline,
      total_kpi: Number(row.totalTasks || 0),
      department_name: getDepartmentName(row, userDepartment),
      monthLabel: formatMonthOnlyVi(getStartDateRaw(row), row.deadline),
      compact: true,
    }));
  }, [assignedThisMonth, userDepartment]);

  const selectedPreviewKpi = useMemo(() => {
    return assignedThisMonth.find((row: any) => Number(row.id) === Number(selectedPreviewKpiId)) || null;
  }, [assignedThisMonth, selectedPreviewKpiId]);

  const filteredSummary = useMemo(() => {
    const total = filteredMyKpiRows.reduce((sum: number, r: any) => sum + Number(r.totalTasks || 0), 0);
    const completed = filteredMyKpiRows.reduce((sum: number, r: any) => sum + Number(r.completedTasks || 0), 0);
    const pending = filteredMyKpiRows.reduce((sum: number, r: any) => sum + Number(r.pendingTasks || 0), 0);
    const inProgress = filteredMyKpiRows.reduce((sum: number, r: any) => sum + Number(r.inProgressTasks || 0), 0);
    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const overdue = filteredMyKpiRows.reduce((sum: number, r: any) => {
      if (typeof r.overdueTasks === 'number') return sum + Number(r.overdueTasks || 0);
      const fallback = r.deadline && toDateOnly(r.deadline) < todayDate && Number(r.progress || 0) < 100 ? 1 : 0;
      return sum + fallback;
    }, 0);
    return { total, completed, pending, inProgress, overdue };
  }, [filteredMyKpiRows]);

  

  const pendingApprovals = useMemo(() => filteredMyKpiRows.filter((r: any) => statusToKey(r.status) === 'pending'), [filteredMyKpiRows]);

  const overdueRows = useMemo(() => {
    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return filteredMyKpiRows.filter((r: any) => r.deadline && toDateOnly(r.deadline) < todayDate && Number(r.progress || 0) < 100);
  }, [filteredMyKpiRows]);

  const filteredRecentActivity = useMemo(() => {
    return recentActivity.filter((it: any) => {
      const t = it.time || it.at;
      if (!t) return false;
      return inSelectedMonth(String(t), selectedMonth);
    });
  }, [recentActivity, selectedMonth]);

  if (loading) return <div style={{ padding: 24 }}>Đang tải...</div>;
  if (error) return <div style={{ padding: 24, color: 'red' }}>{error}</div>;

  return (
    <div style={{ padding: 24, background: '#fff' }}>
      <div style={{ borderRadius: 12, padding: 16, marginBottom: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 18, overflowX: 'auto', flexWrap: 'wrap', alignItems: 'center' }}>
        <Card title="Tổng KPI" value={filteredSummary.total} />
        <Card title="Hoàn thành" value={filteredSummary.completed} />
        <Card title="Đang thực hiện" value={filteredSummary.inProgress} />
        <Card title="Chờ duyệt" value={filteredSummary.pending} />
        <Card title="Quá hạn" value={filteredSummary.overdue} />
        <Card title="KPI tháng này" value={assignedThisMonth.length} right={
          <div style={{ textAlign: 'left', minWidth: 160 }}>
            {assignedThisMonth.slice(0, 3).map((r: any) => (
              <div key={r.id} style={{ fontSize: 12, color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
            ))}
            {assignedThisMonth.length > 3 && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>+{assignedThisMonth.length - 3} thêm</div>}
          </div>
        } />
        <div style={{ flex: '1 1 360px', minWidth: 320 }}>
          <ProgressBar completed={filteredSummary.completed} total={filteredSummary.total} />
        </div>
      </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, marginBottom: 24, boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8, alignItems: 'center' }}>
          <input
            value={filterKpiName}
            onChange={(e) => setFilterKpiName(e.target.value)}
            placeholder="Tìm theo tên KPI"
            style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 8px', fontSize: 12 }}
          />

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as DashboardStatusFilter)}
            style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 8px', fontSize: 12, background: '#fff' }}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="in_progress">Đang làm</option>
            <option value="pending">Chờ duyệt</option>
            <option value="completed">Đã hoàn thành</option>
            <option value="upcoming">Sắp đến hạn</option>
            <option value="overdue">Quá hạn</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setFilterStatus('all');
              setFilterKpiName('');
              const now = new Date();
              setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
            }}
            style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 10px', background: '#fff', color: '#334155', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
          >
            Xóa lọc
          </button>

          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 8px', fontSize: 12, background: '#fff' }}
          />
        </div>
      </div>


      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h3 style={{ marginTop: 0, borderBottom: '1px solid #e5e7eb', paddingBottom: 6 }}>KPI trong tháng này</h3>
          <div style={{ background: '#e0f2fe', borderRadius: 8, padding: 12, border: '1px solid #bae6fd', overflowX: 'auto' }}>
            {assignedThisMonth.length === 0 ? (
              <div style={{ padding: 12 }}>Không có KPI được giao trong tháng này</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#64748b', fontSize: 13 }}>
                    <th style={{ padding: 8, width: '24%' }}>Tên KPI</th>
                    <th style={{ padding: 8, width: '18%' }}>Phòng ban</th>
                    <th style={{ padding: 8, width: '12%' }}>Tiến độ</th>
                    <th style={{ padding: 8, width: '14%' }}>Trạng thái</th>
                    <th style={{ padding: 8, width: '24%' }}>Thời gian</th>
                    <th style={{ padding: 8, width: '8%' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {assignedThisMonth.map((r: any) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</td>
                      <td style={{ padding: 10 }}>{getDepartmentName(r, userDepartment)}</td>
                      <td style={{ padding: 10 }}>{r.progress}%</td>
                      <td style={{ padding: 10 }}>{r.status}</td>
                      <td style={{ padding: 10 }}>{formatDateRangeVi(getStartDateRaw(r), r.deadline)}</td>
                      <td style={{ padding: 10 }}>
                        <button
                          onClick={() => setSelectedKpi(r)}
                          title="Xem chi tiết"
                          aria-label="Xem chi tiết"
                          style={{
                            marginRight: 6,
                            background: '#fff',
                            color: '#334155',
                            borderRadius: 8,
                            padding: '4px 8px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <img src="/image/eye_icon.png" alt="Xem" style={{ width: 16, height: 16 }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ marginTop: 16, borderRadius: 10, border: '1px solid #dbe5ef', background: '#fff', overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #e6edf5', background: 'linear-gradient(90deg, #0e7490, #0284c7)', color: '#fff', fontWeight: 700 }}>
              Xem nhanh nhiệm vụ KPI
            </div>

            <div style={{ padding: 12, borderBottom: '1px solid #eef2f7', maxHeight: 132, overflowX: 'auto', overflowY: 'hidden' }}>
              <div style={{ display: 'flex', gap: 10 }}>
                {previewKpiCards.length === 0 ? (
                  <div style={{ color: '#64748b' }}>Không có KPI để hiển thị.</div>
                ) : (
                  previewKpiCards.map((kpi: any) => (
                    <KpiCard
                      key={kpi.chain_kpi_id}
                      kpi={kpi}
                      isSelected={Number(selectedPreviewKpiId) === Number(kpi.chain_kpi_id)}
                      onClick={() => setSelectedPreviewKpiId(Number(kpi.chain_kpi_id))}
                      formatFullDate={formatDateVi}
                    />
                  ))
                )}
              </div>
            </div>

            <div style={{ padding: 12, height: 420, overflow: 'auto', background: '#f8fafc' }}>
              {selectedPreviewKpi ? (
                <div style={{ border: '1px solid #dbe5ef', borderRadius: 10, overflow: 'hidden', background: '#fff', minWidth: 980 }}>
                  <div style={{ padding: '8px 12px', background: 'linear-gradient(90deg, #0c6ca7, #0e88cb)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.15 }}>{selectedPreviewKpi.name || 'KPI'}</div>
                      <div style={{ fontSize: 11, opacity: 0.95 }}>{formatDateRangeVi(getStartDateRaw(selectedPreviewKpi), selectedPreviewKpi.deadline)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, opacity: 0.95 }}>Tổng KPI phòng</div>
                      <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{Number(selectedPreviewKpi.totalTasks || 0)}</div>
                    </div>
                  </div>

                  <div style={{ padding: 14 }}>
                    <AssignmentsColumns
                      assignments={previewAssignments}
                      formatDate={formatTaskDate}
                      compact
                    />
                  </div>
                </div>
              ) : (
                <div style={{ color: '#64748b' }}>Chọn KPI để xem chi tiết nhiệm vụ.</div>
              )}
            </div>
          </div>
        </div>
        <div>
          <h3 style={{ marginTop: 0, borderBottom: '1px solid #cfe2ff', paddingBottom: 6, fontSize: 16, fontWeight: 600, color: '#1e3a8a' }}>KPI chờ duyệt</h3>
          <div style={{ background: '#ffffff', borderRadius: 8, padding: 12, border: '1px solid #eef2f8', marginBottom: 12 }}>
            {pendingApprovals.length === 0 ? <div style={{ background: '#f9fafb', padding: 12, borderRadius: 8 }}>Không có KPI chờ duyệt</div> : (
              <table style={{ width: '100%', tableLayout: 'fixed' }}>
                <thead><tr style={{ color: '#64748b' }}><th style={{ padding: 8 }}>Tên KPI</th><th>Ngày gửi</th><th>Trạng thái</th></tr></thead>
                <tbody>
                  {pendingApprovals.map((r:any) => (<tr key={r.id}><td style={{ padding: 8 }}>{r.name}</td><td>-</td><td>{r.status}</td></tr>))}
                </tbody>
              </table>
            )}
          </div>

          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#b91c1c', borderBottom: '1px solid #fecaca', paddingBottom: 6 }}>KPI quá hạn</h3>
          <div style={{ background: '#fff5f5', borderRadius: 12, padding: 12, border: '1px solid #fecaca' }}>
            {overdueRows.length === 0 ? <div style={{ background: '#f9fafb', padding: 12, borderRadius: 8 }}>Không có KPI quá hạn</div> : (
              <table style={{ width: '100%', tableLayout: 'fixed' }}>
                <thead><tr style={{ color: '#64748b' }}><th style={{ padding: 8 }}>Tên KPI</th><th>Hạn chót</th><th>Số ngày trễ</th><th>Tiến độ</th></tr></thead>
                <tbody>
                  {overdueRows.map((r:any) => {
                    const daysLate = Math.ceil((new Date().getTime() - new Date(r.deadline).getTime()) / (1000*60*60*24));
                    return (<tr key={r.id} style={{ background: '#fff7f7' }}><td style={{ padding: 8 }}>{r.name}</td><td>{new Date(r.deadline).toLocaleDateString('vi-VN')}</td><td>{daysLate}</td><td>{r.progress}%</td></tr>);
                  })}
                </tbody>
              </table>
            )}
          </div>

          <h3 style={{ marginTop: 20, color: '#064e3b' }}>Hoạt động gần đây</h3>
          <div style={{ background: '#ecfdf5', borderRadius: 12, padding: 12, border: '1px solid #bbf7d0' }}>
            {filteredRecentActivity.length === 0 ? <div>Không có hoạt động</div> : (
              <div style={{ display: 'grid', gap: 8 }}>
                {filteredRecentActivity.map((it:any, idx:number) => (
                  <div key={idx} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{translateAction(it.action)}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{it.kpiName} • {new Date(it.time || it.at).toLocaleString('vi-VN')}</div>
                  </div>
                ))}
                <button style={{ marginTop: 8 }} onClick={() => navigate('/user/tasks')}>Xem tất cả</button>
              </div>
            )}
          </div>

        </div>
      </div>


      {selectedKpi && (
        <div
          onClick={() => setSelectedKpi(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(720px, 100%)',
              background: '#fff',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              boxShadow: '0 20px 45px rgba(2,6,23,0.2)',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Chi tiết KPI</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => navigate(`/user/tasks?kpi=${selectedKpi.id}`)}
                  style={{ border: '1px solid #93c5fd', background: '#eff6ff', color: '#1d4ed8', borderRadius: 8, padding: '6px 10px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Mở trang nhiệm vụ KPI
                </button>
                <button
                  onClick={() => setSelectedKpi(null)}
                  style={{ border: '1px solid #cbd5e1', background: '#fff', color: '#334155', borderRadius: 8, padding: '6px 10px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Đóng
                </button>
              </div>
            </div>

            <div style={{ padding: 14, display: 'grid', gap: 10 }}>
              <div><strong>Tên KPI:</strong> {selectedKpi.name || '-'}</div>
              <div><strong>Phòng ban:</strong> {getDepartmentName(selectedKpi, userDepartment)}</div>
              <div><strong>Tiến độ:</strong> {Number(selectedKpi.progress || 0)}%</div>
              <div><strong>Trạng thái:</strong> {selectedKpi.status || '-'}</div>
              <div><strong>Thời gian:</strong> {formatDateRangeVi(getStartDateRaw(selectedKpi), selectedKpi.deadline)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
