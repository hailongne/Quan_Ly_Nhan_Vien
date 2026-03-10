import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import DashboardLayout from '../components/layout/DashboardLayout';
import api from '../../api/axios';
import { notify } from '../../utils/notify';
import { confirm } from '../../utils/confirm';
import ProgressBar from '../user/kpi/ProgressBar';
import KpiDetails from '../admin/kpi/KpiDetails';
import UploadModal from '../user/kpi/UploadModal';

type KpiRow = {
  chain_kpi_id: number;
  department_id?: number | null;
  start_date: string;
  end_date: string;
  description?: string | null;
  kpi_name?: string[] | null;
  transfer_source_kpi_id?: number | null;
  total_kpi?: number | null;
};

type UserRow = {
  user_id: number;
  department_id?: number | null;
  name?: string | null;
  full_name?: string | null;
  username?: string | null;
  role?: string | null;
  department_position?: string | null;
  position?: string | null;
};

type AssignmentRow = {
  task_id: number;
  chain_kpi_id: number;
  assignee_user_id: number;
  date: string;
  assigned_kpi: number;
  status: string;
};

type ApprovalRow = {
  approval_id: number;
  task_id?: number;
  chain_kpi_id: number;
  assignee_user_id?: number;
  date: string;
  assigned_kpi: number;
  status: string;
  submitted_at?: string | null;
  kpi_name?: string[] | null;
  description?: string | null;
  kpi_display_name?: string;
};

type EmployeeSummary = {
  userId: number;
  name: string;
  position: string;
  role: string;
  totalKpi: number;
  completedKpi: number;
};

type TodayKpiTask = {
  taskId: number;
  chainKpiId: number;
  assignedKpi: number;
  statusLabel: string;
  kpiName: string;
};

type TodayEmployeeKpiSummary = {
  userId: number;
  name: string;
  position: string;
  totalKpi: number;
  doneKpi: number;
  inProgressKpi: number;
  pendingApprovalKpi: number;
  tasks: TodayKpiTask[];
};

type SummaryMetrics = {
  totalKpi: number;
  completionPercent: number;
  inProgressKpi: number;
  overdueKpi: number;
  pendingApprovalKpi: number;
};

type WeeklyTrendItem = {
  label: string;
  completed: number;
  inProgress: number;
  pending: number;
  total: number;
};

type UpcomingDeadlineItem = {
  taskId: number;
  userName: string;
  kpiName: string;
  deadline: string;
  daysLeft: number;
};

type ActivityItem = {
  id: string;
  type: 'approval_submitted' | 'task_progress';
  actorName: string;
  message: string;
  at: string;
};

type DashboardStatusFilter = 'all' | 'in_progress' | 'completed' | 'pending' | 'overdue' | 'upcoming';

const normalizeText = (value: string) => String(value || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

const isDepartmentHead = (position: string, role: string) => {
  const roleNorm = normalizeText(role);
  if (roleNorm === 'leader' || roleNorm === 'head' || roleNorm === 'manager') return true;
  const posNorm = normalizeText(position || '');
  return posNorm.includes('truong phong') || posNorm.includes('head') || posNorm.includes('manager');
};

const toDateOnly = (value: string | Date) => {
  const dt = typeof value === 'string' ? new Date(value.includes('T') ? value : `${value}T00:00:00`) : new Date(value);
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
};

const overlapMonth = (startRaw: string, endRaw: string, monthStart: Date, monthEnd: Date) => {
  const start = toDateOnly(startRaw);
  const end = toDateOnly(endRaw);
  return start <= monthEnd && end >= monthStart;
};

const inMonth = (dateRaw: string, monthStart: Date, monthEnd: Date) => {
  const d = toDateOnly(dateRaw);
  return d >= monthStart && d <= monthEnd;
};

const isSameDay = (dateRaw: string, targetDay: Date) => {
  const d = toDateOnly(dateRaw);
  return d.getTime() === targetDay.getTime();
};

const getTaskStatusLabel = (statusRaw: string, pendingApproval: boolean) => {
  if (pendingApproval) return 'Chờ phê duyệt';
  const status = String(statusRaw || '').toLowerCase();
  if (status === 'completed' || status === 'approved') return 'Đã hoàn thành';
  return 'Đang làm';
};

const getTaskStatusKey = (statusLabel: string): 'in_progress' | 'completed' | 'pending' => {
  if (statusLabel === 'Chờ phê duyệt') return 'pending';
  if (statusLabel === 'Đã hoàn thành') return 'completed';
  return 'in_progress';
};

const getKpiLabel = (kpi: KpiRow) => {
  if (Array.isArray(kpi.kpi_name) && kpi.kpi_name.length > 0) return kpi.kpi_name.join(' • ');
  if (kpi.description && String(kpi.description).trim()) return String(kpi.description);
  return `KPI #${kpi.chain_kpi_id}`;
};

export default function LeaderDashboard() {
  const { user, signout } = useAuth();
  const displayName = (user as any)?.name || (user as any)?.username || 'Leader';
  const departmentId = Number((user as any)?.department_id || (user as any)?.department || 0) || null;

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [departmentKpis, setDepartmentKpis] = useState<KpiRow[]>([]);
  const [transferredKpis, setTransferredKpis] = useState<KpiRow[]>([]);
  const [employeeSummaries, setEmployeeSummaries] = useState<EmployeeSummary[]>([]);
  const [todayEmployeeKpis, setTodayEmployeeKpis] = useState<TodayEmployeeKpiSummary[]>([]);
  const [todayApprovals, setTodayApprovals] = useState<ApprovalRow[]>([]);
  const [approvalAssigneeNames, setApprovalAssigneeNames] = useState<Record<number, string>>({});
  const [summaryMetrics, setSummaryMetrics] = useState<SummaryMetrics>({ totalKpi: 0, completionPercent: 0, inProgressKpi: 0, overdueKpi: 0, pendingApprovalKpi: 0 });
  const [weeklyTrend, setWeeklyTrend] = useState<WeeklyTrendItem[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<UpcomingDeadlineItem[]>([]);
  const [reloadTick, setReloadTick] = useState(0);

  const [percentSort, setPercentSort] = useState<'desc' | 'asc'>('desc');
  const [filterStatus, setFilterStatus] = useState<DashboardStatusFilter>('all');
  const [filterKpiName, setFilterKpiName] = useState('');
  const [filterEmployeeName, setFilterEmployeeName] = useState('');

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailKpiId, setDetailKpiId] = useState<number | null>(null);
  const [approvalResultOpen, setApprovalResultOpen] = useState(false);
  const [approvalResultData, setApprovalResultData] = useState<any | null>(null);
  const [approvalResultTask, setApprovalResultTask] = useState<{ taskId: number; chainKpiId: number; assignedKpi: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!departmentId) {
          setError('Không xác định phòng ban của bạn');
          setLoading(false);
          return;
        }

        const [yearText, monthText] = String(selectedMonth).split('-');
        const year = Number(yearText);
        const month = Number(monthText);
        const now = Number.isFinite(year) && Number.isFinite(month) ? new Date(year, month - 1, 1) : new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const today = new Date();
        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        const [kpiRes, usersRes, approvalsRes] = await Promise.all([
          api.get('/api/kpis/department', { params: { department_id: departmentId } }).catch(() => api.get('/api/kpis')),
          api.get(`/api/users/department/${departmentId}`).catch(() => api.get('/api/users')),
          api.get('/api/kpis/approvals', { params: { status: 'pending' } }).catch(() => ({ data: [] }))
        ]);

        if (cancelled) return;

        const allKpis: KpiRow[] = Array.isArray(kpiRes.data) ? kpiRes.data : (Array.isArray(kpiRes.data?.kpis) ? kpiRes.data.kpis : []);
        const allUsers: UserRow[] = Array.isArray(usersRes.data) ? usersRes.data : [];
        const approvals: ApprovalRow[] = Array.isArray(approvalsRes.data) ? approvalsRes.data : [];

        const users = allUsers.filter((u) => Number(u.department_id || 0) === Number(departmentId));
        const usersMap: Record<number, string> = {};
        const positionMap: Record<number, string> = {};
        const roleMap: Record<number, string> = {};
        users.forEach((u) => {
          const uid = Number(u.user_id || 0);
          if (!uid) return;
          usersMap[uid] = u.full_name || u.name || u.username || `User ${uid}`;
          positionMap[uid] = String(u.department_position || u.position || '').trim();
          roleMap[uid] = String(u.role || '');
        });
        setApprovalAssigneeNames(usersMap);

        const kpis = allKpis
          .filter((k) => Number(k.department_id || 0) === Number(departmentId))
          .filter((k) => k.start_date && k.end_date && overlapMonth(k.start_date, k.end_date, monthStart, monthEnd));

        const kpiById: Record<number, KpiRow> = {};
        kpis.forEach((k) => {
          const id = Number(k.chain_kpi_id || 0);
          if (id) kpiById[id] = k;
        });

        const pendingAll = approvals
          .filter((a) => Number(kpiById[Number(a.chain_kpi_id || 0)]?.department_id || 0) === Number(departmentId))
          .filter((a) => a.date && inMonth(a.date, monthStart, monthEnd))
          .map((a) => {
            const kpi = kpiById[Number(a.chain_kpi_id || 0)] || null;
            const kpiName = Array.isArray(a.kpi_name) && a.kpi_name.length > 0
              ? a.kpi_name.join(' • ')
              : (Array.isArray(kpi?.kpi_name) && kpi!.kpi_name!.length > 0
                ? kpi!.kpi_name!.join(' • ')
                : (a.description || kpi?.description || `KPI #${a.chain_kpi_id}`));
            return { ...a, kpi_display_name: kpiName };
          })
          .sort((a, b) => new Date(String(b.submitted_at || b.date || 0)).getTime() - new Date(String(a.submitted_at || a.date || 0)).getTime());

        const pendingApprovalTaskIds = new Set(
          pendingAll.map((a) => Number(a.task_id || 0)).filter((id) => id > 0)
        );

        const assignmentsByKpi = await Promise.all(
          kpis.map(async (k) => {
            try {
              const res = await api.get(`/api/kpis/${k.chain_kpi_id}/assignments`);
              const rows = Array.isArray(res.data) ? (res.data as AssignmentRow[]) : [];
              return { chainKpiId: k.chain_kpi_id, rows };
            } catch {
              return { chainKpiId: k.chain_kpi_id, rows: [] as AssignmentRow[] };
            }
          })
        );

        if (cancelled) return;

        const employeeMap = new Map<number, EmployeeSummary>();
        const todayEmployeeMap = new Map<number, TodayEmployeeKpiSummary>();

        let monthTotalAssigned = 0;
        let monthDoneAssigned = 0;
        let monthInProgressAssigned = 0;
        let monthOverdueAssigned = 0;
        let monthPendingAssigned = 0;
        const upcomingDeadlineMap = new Map<number, UpcomingDeadlineItem>();
        const weeklyTrendMap = new Map<number, { completed: number; inProgress: number; pending: number }>();
        for (let week = 0; week < 5; week += 1) weeklyTrendMap.set(week, { completed: 0, inProgress: 0, pending: 0 });

        assignmentsByKpi.forEach(({ rows }) => {
          rows.forEach((row) => {
            if (!inMonth(row.date, monthStart, monthEnd)) return;

            const userId = Number(row.assignee_user_id || 0);
            if (!userId || !usersMap[userId]) return;

            const assignedKpi = Number(row.assigned_kpi || 0);
            const status = String(row.status || '').toLowerCase();
            const taskId = Number(row.task_id || 0);
            const pendingApproval = taskId > 0 && pendingApprovalTaskIds.has(taskId);
            const doneLike = status === 'completed' || status === 'approved';
            const kpiMeta = kpiById[Number(row.chain_kpi_id || 0)] || null;

            monthTotalAssigned += assignedKpi;
            if (pendingApproval) monthPendingAssigned += assignedKpi;
            else if (doneLike) monthDoneAssigned += assignedKpi;
            else monthInProgressAssigned += assignedKpi;

            const taskDate = toDateOnly(row.date);
            const weekIndex = Math.min(4, Math.floor((taskDate.getDate() - 1) / 7));
            const weeklyCurrent = weeklyTrendMap.get(weekIndex) || { completed: 0, inProgress: 0, pending: 0 };
            if (pendingApproval) weeklyCurrent.pending += assignedKpi;
            else if (doneLike) weeklyCurrent.completed += assignedKpi;
            else weeklyCurrent.inProgress += assignedKpi;
            weeklyTrendMap.set(weekIndex, weeklyCurrent);

            if (!doneLike && !pendingApproval && kpiMeta?.end_date) {
              const deadlineDate = toDateOnly(kpiMeta.end_date);
              if (deadlineDate.getTime() < todayDate.getTime()) {
                monthOverdueAssigned += assignedKpi;
              } else {
                const daysLeft = Math.ceil((deadlineDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
                if (daysLeft >= 0 && daysLeft <= 7 && taskId > 0 && !upcomingDeadlineMap.has(taskId)) {
                  upcomingDeadlineMap.set(taskId, {
                    taskId,
                    userName: usersMap[userId] || `User ${userId}`,
                    kpiName: kpiMeta ? getKpiLabel(kpiMeta) : `KPI #${Number(row.chain_kpi_id || 0)}`,
                    deadline: kpiMeta.end_date,
                    daysLeft
                  });
                }
              }
            }

            const existing = employeeMap.get(userId) || {
              userId,
              name: usersMap[userId] || `User ${userId}`,
              position: positionMap[userId] || '',
              role: roleMap[userId] || '',
              totalKpi: 0,
              completedKpi: 0
            };

            existing.totalKpi += assignedKpi;
            if (doneLike) existing.completedKpi += assignedKpi;
            employeeMap.set(userId, existing);

            if (isSameDay(row.date, todayDate)) {
              const statusLabel = getTaskStatusLabel(status, pendingApproval);
              const todayExisting = todayEmployeeMap.get(userId) || {
                userId,
                name: usersMap[userId] || `User ${userId}`,
                position: positionMap[userId] || '',
                totalKpi: 0,
                doneKpi: 0,
                inProgressKpi: 0,
                pendingApprovalKpi: 0,
                tasks: []
              };

              todayExisting.totalKpi += assignedKpi;
              if (statusLabel === 'Chờ phê duyệt') todayExisting.pendingApprovalKpi += assignedKpi;
              else if (statusLabel === 'Đã hoàn thành') todayExisting.doneKpi += assignedKpi;
              else todayExisting.inProgressKpi += assignedKpi;

              todayExisting.tasks.push({
                taskId,
                chainKpiId: Number(row.chain_kpi_id || 0),
                assignedKpi,
                statusLabel,
                kpiName: kpiMeta ? getKpiLabel(kpiMeta) : `KPI #${Number(row.chain_kpi_id || 0)}`
              });

              todayEmployeeMap.set(userId, todayExisting);
            }
          });
        });

        const completionPercent = monthTotalAssigned > 0 ? Math.round((monthDoneAssigned / monthTotalAssigned) * 100) : 0;
        const weeklyTrendList: WeeklyTrendItem[] = Array.from(weeklyTrendMap.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([index, row]) => ({
            label: `Tuần ${index + 1}`,
            completed: row.completed,
            inProgress: row.inProgress,
            pending: row.pending,
            total: row.completed + row.inProgress + row.pending
          }));

        const deptKpis = kpis.filter((k) => Number(k.transfer_source_kpi_id || 0) <= 0);
        const transKpis = kpis.filter((k) => Number(k.transfer_source_kpi_id || 0) > 0);

        setDepartmentKpis(deptKpis);
        setTransferredKpis(transKpis);
        setEmployeeSummaries(Array.from(employeeMap.values()));
        setTodayEmployeeKpis(Array.from(todayEmployeeMap.values()).filter((emp) => emp.totalKpi > 0));
        setTodayApprovals(pendingAll);
        setSummaryMetrics({
          totalKpi: monthTotalAssigned,
          completionPercent,
          inProgressKpi: monthInProgressAssigned,
          overdueKpi: monthOverdueAssigned,
          pendingApprovalKpi: monthPendingAssigned
        });
        setWeeklyTrend(weeklyTrendList);
        setUpcomingDeadlines(
          Array.from(upcomingDeadlineMap.values())
            .sort((a, b) => a.daysLeft - b.daysLeft)
            .slice(0, 20)
        );
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.message || e?.message || 'Không tải được dữ liệu leader.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [departmentId, selectedMonth, reloadTick]);

  const displayEmployeeSummaries = useMemo(() => {
    const heads = employeeSummaries
      .filter((e) => isDepartmentHead(e.position, e.role))
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'vi'));

    const others = employeeSummaries
      .filter((e) => !isDepartmentHead(e.position, e.role))
      .sort((a, b) => {
        const aPercent = a.totalKpi > 0 ? (a.completedKpi / a.totalKpi) : 0;
        const bPercent = b.totalKpi > 0 ? (b.completedKpi / b.totalKpi) : 0;
        if (aPercent !== bPercent) {
          return percentSort === 'desc' ? (bPercent - aPercent) : (aPercent - bPercent);
        }
        return String(a.name).localeCompare(String(b.name), 'vi');
      });

    return [...heads, ...others];
  }, [employeeSummaries, percentSort]);

  const performerRanking = useMemo(() => {
    const ranked = employeeSummaries
      .filter((emp) => Number(emp.totalKpi || 0) > 0)
      .map((emp) => {
        const completionPercent = emp.totalKpi > 0 ? Math.round((emp.completedKpi / emp.totalKpi) * 100) : 0;
        return {
          userId: emp.userId,
          name: emp.name,
          position: emp.position,
          completionPercent,
          completedKpi: emp.completedKpi,
          totalKpi: emp.totalKpi
        };
      })
      .sort((a, b) => {
        if (b.completedKpi !== a.completedKpi) return b.completedKpi - a.completedKpi;
        if (b.completionPercent !== a.completionPercent) return b.completionPercent - a.completionPercent;
        return a.name.localeCompare(b.name, 'vi');
      });

    const topPerformers = ranked.slice(0, 5);
    const lowPerformers = [...ranked]
      .sort((a, b) => {
        if (a.completedKpi !== b.completedKpi) return a.completedKpi - b.completedKpi;
        if (a.completionPercent !== b.completionPercent) return a.completionPercent - b.completionPercent;
        return a.name.localeCompare(b.name, 'vi');
      })
      .slice(0, 5);

    return { topPerformers, lowPerformers };
  }, [employeeSummaries]);

  const filteredApprovals = useMemo(() => {
    const kpiKeyword = normalizeText(filterKpiName);
    const employeeKeyword = normalizeText(filterEmployeeName);
    return todayApprovals.filter((a) => {
      if (filterStatus !== 'all' && filterStatus !== 'pending') return false;
      const kpiName = String(a.kpi_display_name || a.description || '');
      if (kpiKeyword && !normalizeText(kpiName).includes(kpiKeyword)) return false;
      const assigneeName = approvalAssigneeNames[Number(a.assignee_user_id || 0)] || '';
      if (employeeKeyword && !normalizeText(assigneeName).includes(employeeKeyword)) return false;
      return true;
    });
  }, [todayApprovals, approvalAssigneeNames, filterStatus, filterKpiName, filterEmployeeName]);

  const filteredTodayEmployeeKpis = useMemo(() => {
    const kpiKeyword = normalizeText(filterKpiName);
    const employeeKeyword = normalizeText(filterEmployeeName);

    if (filterStatus === 'overdue' || filterStatus === 'upcoming') return [];

    return todayEmployeeKpis
      .filter((emp) => !employeeKeyword || normalizeText(emp.name).includes(employeeKeyword))
      .map((emp) => {
        const tasks = emp.tasks.filter((task) => {
          if (kpiKeyword && !normalizeText(task.kpiName).includes(kpiKeyword)) return false;
          if (filterStatus !== 'all') {
            const key = getTaskStatusKey(task.statusLabel);
            if (key !== filterStatus) return false;
          }
          return true;
        });

        const doneKpi = tasks.reduce((sum, t) => sum + (getTaskStatusKey(t.statusLabel) === 'completed' ? t.assignedKpi : 0), 0);
        const pendingApprovalKpi = tasks.reduce((sum, t) => sum + (getTaskStatusKey(t.statusLabel) === 'pending' ? t.assignedKpi : 0), 0);
        const inProgressKpi = tasks.reduce((sum, t) => sum + (getTaskStatusKey(t.statusLabel) === 'in_progress' ? t.assignedKpi : 0), 0);
        return { ...emp, tasks, doneKpi, pendingApprovalKpi, inProgressKpi, totalKpi: doneKpi + pendingApprovalKpi + inProgressKpi };
      })
      .filter((emp) => emp.totalKpi > 0);
  }, [todayEmployeeKpis, filterStatus, filterKpiName, filterEmployeeName]);

  const filteredUpcomingDeadlines = useMemo(() => {
    const kpiKeyword = normalizeText(filterKpiName);
    const employeeKeyword = normalizeText(filterEmployeeName);

    return upcomingDeadlines.filter((item) => {
      if (filterStatus === 'pending' || filterStatus === 'completed' || filterStatus === 'in_progress') return false;
      if (filterStatus === 'overdue') return item.daysLeft < 0;
      if (filterStatus === 'upcoming' || filterStatus === 'all') {
        if (item.daysLeft < 0) return false;
      }

      if (kpiKeyword && !normalizeText(item.kpiName).includes(kpiKeyword)) return false;
      if (employeeKeyword && !normalizeText(item.userName).includes(employeeKeyword)) return false;
      return true;
    });
  }, [upcomingDeadlines, filterStatus, filterKpiName, filterEmployeeName]);

  const recentActivities = useMemo(() => {
    const items: ActivityItem[] = [];

    filteredApprovals.forEach((approval) => {
      const actorName = approvalAssigneeNames[Number(approval.assignee_user_id || 0)] || `User ${approval.assignee_user_id || '-'}`;
      const kpiName = approval.kpi_display_name || approval.description || `KPI #${approval.chain_kpi_id}`;
      items.push({
        id: `approval-${approval.approval_id}`,
        type: 'approval_submitted',
        actorName,
        message: `gửi yêu cầu duyệt: ${kpiName}`,
        at: String(approval.submitted_at || approval.date || '')
      });
    });

    filteredTodayEmployeeKpis.forEach((emp) => {
      emp.tasks.forEach((task) => {
        if (task.statusLabel === 'Chờ phê duyệt') return;
        items.push({
          id: `task-${emp.userId}-${task.taskId}-${task.chainKpiId}`,
          type: 'task_progress',
          actorName: emp.name,
          message: `cập nhật tiến độ ${task.statusLabel.toLowerCase()}: ${task.kpiName}`,
          at: new Date().toISOString()
        });
      });
    });

    return items
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 40);
  }, [filteredApprovals, filteredTodayEmployeeKpis, approvalAssigneeNames]);

  const openApprovalResult = async (approval: ApprovalRow) => {
    try {
      const chainKpiId = Number(approval.chain_kpi_id || 0);
      const taskId = Number(approval.task_id || 0);
      if (!chainKpiId || !taskId) {
        notify.error('Thiếu thông tin task để xem kết quả');
        return;
      }
      const res = await api.get(`/api/kpis/${chainKpiId}/tasks/${taskId}/outputs`);
      const payload = res?.data || null;
      const albums = Array.isArray(payload?.albums) ? payload.albums : [];
      if (albums.length === 0) {
        notify.info('Nhân viên chưa upload kết quả cho nhiệm vụ này');
        return;
      }
      setApprovalResultTask({ taskId, chainKpiId, assignedKpi: Number(approval.assigned_kpi || payload?.assigned_kpi || 0) });
      setApprovalResultData(payload);
      setApprovalResultOpen(true);
    } catch (e: any) {
      notify.error('Không tải được kết quả', e?.response?.data?.message || 'Vui lòng thử lại');
    }
  };

  const approveApproval = async (approval: ApprovalRow) => {
    const ok = await confirm({
      title: 'Xác nhận phê duyệt',
      message: 'Bạn có chắc muốn phê duyệt KPI này?',
      confirmText: 'Phê duyệt',
      cancelText: 'Hủy'
    });
    if (!ok) return;
    try {
      await api.post(`/api/kpis/approvals/${approval.approval_id}/status`, { status: 'approved' });
      notify.success('Đã phê duyệt KPI');
      setReloadTick((v) => v + 1);
    } catch (e: any) {
      notify.error('Phê duyệt thất bại', e?.response?.data?.message || 'Vui lòng thử lại');
    }
  };

  const rejectApproval = async (approval: ApprovalRow) => {
    const ok = await confirm({
      title: 'Xác nhận từ chối',
      message: 'Bạn có chắc muốn từ chối phê duyệt KPI này?',
      confirmText: 'Từ chối',
      cancelText: 'Hủy'
    });
    if (!ok) return;
    const reason = window.prompt('Nhập lý do từ chối (có thể để trống):', '') || '';
    try {
      await api.post(`/api/kpis/approvals/${approval.approval_id}/status`, { status: 'rejected', reason });
      notify.success('Đã từ chối phê duyệt');
      setReloadTick((v) => v + 1);
    } catch (e: any) {
      notify.error('Từ chối thất bại', e?.response?.data?.message || 'Vui lòng thử lại');
    }
  };

  const wrapStyle: React.CSSProperties = { background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: 14 };

  return (
    <DashboardLayout roleLabel="Leader Dashboard" userName={displayName} onSignOut={signout} activeMenuKey="dashboard">
      <div style={{ display: 'grid', gap: 14 }}>
        {loading ? <div style={wrapStyle}>Đang tải tổng quan...</div> : null}
        {error ? <div style={{ ...wrapStyle, borderColor: '#fecaca', background: '#fff1f2', color: '#b91c1c', fontWeight: 700 }}>Lỗi: {error}</div> : null}

        {!loading && !error ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              <div style={{ ...wrapStyle, padding: 12 }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>Tổng KPI</div>
                <div style={{ marginTop: 4, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{summaryMetrics.totalKpi}</div>
              </div>
              <div style={{ ...wrapStyle, padding: 12 }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>Hoàn thành</div>
                <div style={{ marginTop: 4, fontSize: 24, fontWeight: 800, color: '#166534' }}>{summaryMetrics.completionPercent}%</div>
              </div>
              <div style={{ ...wrapStyle, padding: 12 }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>Đang làm</div>
                <div style={{ marginTop: 4, fontSize: 24, fontWeight: 800, color: '#075985' }}>{summaryMetrics.inProgressKpi}</div>
              </div>
              <div style={{ ...wrapStyle, padding: 12 }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>Quá hạn</div>
                <div style={{ marginTop: 4, fontSize: 24, fontWeight: 800, color: '#b91c1c' }}>{summaryMetrics.overdueKpi}</div>
              </div>
              <div style={{ ...wrapStyle, padding: 12 }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>Chờ duyệt</div>
                <div style={{ marginTop: 4, fontSize: 24, fontWeight: 800, color: '#92400e' }}>{summaryMetrics.pendingApprovalKpi}</div>
              </div>
            </div>

            <div style={{ ...wrapStyle, padding: 12, display: 'grid', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8, alignItems: 'center' }}>
                <input
                  value={filterKpiName}
                  onChange={(e) => setFilterKpiName(e.target.value)}
                  placeholder="Tìm theo tên KPI"
                  style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 8px', fontSize: 12 }}
                />

                <input
                  value={filterEmployeeName}
                  onChange={(e) => setFilterEmployeeName(e.target.value)}
                  placeholder="Tìm theo nhân viên"
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
                    setFilterEmployeeName('');
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

            <div style={{ ...wrapStyle, padding: 12, display: 'grid', gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0b3b66' }}>KPI trong tháng của phòng ban</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 12 }}>
                <div style={{ border: '1px solid #dbeafe', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ background: '#eff6ff', color: '#1e3a8a', fontWeight: 800, padding: '8px 10px' }}>KPI phòng ban ({departmentKpis.length})</div>
                  <div style={{ maxHeight: 260, overflowY: 'auto', padding: 10, display: 'grid', gap: 8 }}>
                    {departmentKpis.length === 0 ? <div style={{ color: '#64748b', fontSize: 13 }}>Không có KPI phòng ban trong tháng này.</div> : departmentKpis.map((kpi) => (
                      <button key={kpi.chain_kpi_id} type="button" onClick={() => { setDetailKpiId(Number(kpi.chain_kpi_id)); setDetailOpen(true); }} style={{ textAlign: 'left', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'grid', gap: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{getKpiLabel(kpi)}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: '#334155' }}>Mã KPI: <strong>#{kpi.chain_kpi_id}</strong></div>
                            <div style={{ fontSize: 12, color: '#334155' }}>Loại: <strong>KPI phòng ban</strong></div>
                            <div style={{ fontSize: 12, color: '#334155' }}>KPI mục tiêu: <strong>{Number(kpi.total_kpi || 0)}</strong></div>
                          </div>
                          <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: '#334155' }}>Từ ngày: <strong>{new Date(kpi.start_date).toLocaleDateString('vi-VN')}</strong></div>
                            <div style={{ fontSize: 12, color: '#334155' }}>Đến ngày: <strong>{new Date(kpi.end_date).toLocaleDateString('vi-VN')}</strong></div>
                            <div style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Mô tả: {kpi.description ? String(kpi.description) : 'Không có'}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ border: '1px solid #fbcfe8', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ background: '#fdf2f8', color: '#9f1239', fontWeight: 800, padding: '8px 10px' }}>KPI điều phối ({transferredKpis.length})</div>
                  <div style={{ maxHeight: 260, overflowY: 'auto', padding: 10, display: 'grid', gap: 8 }}>
                    {transferredKpis.length === 0 ? <div style={{ color: '#9f1239', fontSize: 13 }}>Không có KPI điều phối trong tháng này.</div> : transferredKpis.map((kpi) => (
                      <button key={kpi.chain_kpi_id} type="button" onClick={() => { setDetailKpiId(Number(kpi.chain_kpi_id)); setDetailOpen(true); }} style={{ textAlign: 'left', padding: 10, borderRadius: 8, border: '1px solid #fce7f3', background: '#fff', cursor: 'pointer', display: 'grid', gap: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#831843' }}>{getKpiLabel(kpi)}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: '#9f1239' }}>Mã KPI: <strong>#{kpi.chain_kpi_id}</strong></div>
                            <div style={{ fontSize: 12, color: '#9f1239' }}>Loại: <strong>Điều phối</strong></div>
                            <div style={{ fontSize: 12, color: '#9f1239' }}>KPI mục tiêu: <strong>{Number(kpi.total_kpi || 0)}</strong></div>
                          </div>
                          <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: '#9f1239' }}>Từ ngày: <strong>{new Date(kpi.start_date).toLocaleDateString('vi-VN')}</strong></div>
                            <div style={{ fontSize: 12, color: '#9f1239' }}>Đến ngày: <strong>{new Date(kpi.end_date).toLocaleDateString('vi-VN')}</strong></div>
                            <div style={{ fontSize: 12, color: '#a21caf', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Mô tả: {kpi.description ? String(kpi.description) : 'Không có'}</div>
                          </div>
                        </div>
                        {Number(kpi.transfer_source_kpi_id || 0) > 0 ? (
                          <div style={{ fontSize: 12, color: '#9f1239' }}>Nguồn điều phối: <strong>KPI #{Number(kpi.transfer_source_kpi_id)}</strong></div>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              <div style={{ ...wrapStyle, display: 'grid', gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0b3b66' }}>KPI hôm nay của nhân viên ({filteredTodayEmployeeKpis.length})</div>
                <div style={{ maxHeight: 420, overflowY: 'auto', display: 'grid', gap: 8 }}>
                  {filteredTodayEmployeeKpis.length === 0 ? (
                    <div style={{ color: '#64748b' }}>Hôm nay chưa có KPI được giao trong phòng ban.</div>
                  ) : filteredTodayEmployeeKpis.map((emp) => (
                    <div key={emp.userId} style={{ borderBottom: '1px solid #eef2f7', padding: '8px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: 13, fontWeight: 800 }}>{emp.name}{emp.position ? ` (${emp.position})` : ''}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#1e3a8a' }}>{emp.totalKpi} KPI</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                        <div style={{ fontSize: 11, color: '#166534', background: '#ecfdf5', borderRadius: 6, padding: '4px 6px', fontWeight: 700 }}>Hoàn thành: {emp.doneKpi}</div>
                        <div style={{ fontSize: 11, color: '#075985', background: '#eef8ff', borderRadius: 6, padding: '4px 6px', fontWeight: 700 }}>Đang: {emp.inProgressKpi}</div>
                        <div style={{ fontSize: 11, color: '#92400e', background: '#fffbeb', borderRadius: 6, padding: '4px 6px', fontWeight: 700 }}>Chờ: {emp.pendingApprovalKpi}</div>
                      </div>
                      <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                        {emp.tasks.slice(0, 3).map((task) => (
                          <div key={`${emp.userId}-${task.taskId}-${task.chainKpiId}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                            <div style={{ fontSize: 13, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.kpiName}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 11, fontWeight: 800, borderRadius: 999, padding: '2px 8px', background: task.statusLabel === 'Đã hoàn thành' ? '#dcfce7' : (task.statusLabel === 'Chờ phê duyệt' ? '#fef3c7' : '#e0f2fe'), border: '1px solid #d1d5db', color: '#0f172a' }}>{task.statusLabel}</span>
                              <span style={{ fontSize: 12, color: '#475569', fontWeight: 700 }}>{task.assignedKpi} KPI</span>
                            </div>
                          </div>
                        ))}
                        {emp.tasks.length > 3 ? <div style={{ fontSize: 12, color: '#64748b' }}>+{emp.tasks.length - 3} mục khác</div> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ ...wrapStyle, display: 'grid', gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0b3b66' }}>Hiệu suất thực hiện công việc</div>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ maxHeight: 420, overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 480 }}>
                      <colgroup>
                        <col style={{ width: 240 }} />
                        <col style={{ width: 'auto' }} />
                      </colgroup>
                      <thead>
                        <tr style={{ background: '#f8fafc', color: '#334155' }}>
                          <th style={{ textAlign: 'center', padding: 10, fontSize: 12, position: 'sticky', top: 0, zIndex: 2, background: '#f8fafc', width: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Nhân viên</th>
                          <th style={{ textAlign: 'center', padding: 10, fontSize: 12, position: 'sticky', top: 0, zIndex: 2, background: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <button
                              type="button"
                              onClick={() => setPercentSort((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                              title={percentSort === 'desc' ? 'Đang sắp xếp: cao đến thấp' : 'Đang sắp xếp: thấp đến cao'}
                              style={{ border: '1px solid #cbd5e1', background: '#fff', borderRadius: 6, padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#0f172a', fontSize: 12, fontWeight: 700 }}
                            >
                              <span>% hoàn thành KPI</span>
                              <span>{percentSort === 'desc' ? '↓' : '↑'}</span>
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody style={{ textAlign: 'center' }}>
                        {displayEmployeeSummaries.length === 0 ? (
                          <tr><td colSpan={2} style={{ padding: 12, fontSize: 13, color: '#64748b' }}>Không có dữ liệu nhân viên.</td></tr>
                        ) : displayEmployeeSummaries.map((emp) => (
                          <tr key={emp.userId} style={{ borderTop: '1px solid #e2e8f0' }}>
                            <td style={{ padding: 10, fontSize: 13, color: '#0f172a', fontWeight: 700, width: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <span style={{ display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.name}</span>
                              {emp.position ? <span style={{ fontSize: 11, fontWeight: 500, color: '#64748b', marginLeft: 6 }}>({emp.position})</span> : null}
                            </td>
                            <td style={{ padding: 10 }}><ProgressBar completed={emp.completedKpi} total={emp.totalKpi} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 10 }}>
              <div style={{ ...wrapStyle, display: 'grid', gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0b3b66' }}>Top 5 nhân viên hoàn thành nhiều KPI nhất</div>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                  {performerRanking.topPerformers.length === 0 ? (
                    <div style={{ padding: 12, fontSize: 13, color: '#64748b' }}>Chưa có dữ liệu xếp hạng.</div>
                  ) : performerRanking.topPerformers.map((item, index) => (
                    <div key={`top-${item.userId}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '10px 12px', borderTop: index === 0 ? 'none' : '1px solid #e2e8f0', background: '#fff' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{index + 1}. {item.name}</div>
                        {item.position ? <div style={{ marginTop: 2, fontSize: 12, color: '#64748b' }}>{item.position}</div> : null}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#166534', background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap' }}>
                        {item.completedKpi}/{item.totalKpi} KPI
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ ...wrapStyle, display: 'grid', gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0b3b66' }}>Top 5 nhân viên cần cải thiện</div>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                  {performerRanking.lowPerformers.length === 0 ? (
                    <div style={{ padding: 12, fontSize: 13, color: '#64748b' }}>Chưa có dữ liệu xếp hạng.</div>
                  ) : performerRanking.lowPerformers.map((item, index) => (
                    <div key={`low-${item.userId}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '10px 12px', borderTop: index === 0 ? 'none' : '1px solid #e2e8f0', background: '#fff' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{index + 1}. {item.name}</div>
                        {item.position ? <div style={{ marginTop: 2, fontSize: 12, color: '#64748b' }}>{item.position}</div> : null}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#991b1b', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap' }}>
                        {item.completedKpi}/{item.totalKpi} KPI
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(320px, 1fr))', gap: 10 }}>
              <div style={{ ...wrapStyle, display: 'grid', gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0b3b66' }}>Danh sách yêu cầu phê duyệt ({filteredApprovals.length})</div>
                <div style={{ maxHeight: 320, overflowY: 'auto', display: 'grid', gap: 8 }}>
                  {filteredApprovals.length === 0 ? (
                    <div style={{ color: '#64748b' }}>Không có yêu cầu phê duyệt.</div>
                  ) : filteredApprovals.map((a) => (
                    <div key={a.approval_id} style={{ border: '1px solid #dbeafe', borderRadius: 10, padding: 10, background: '#fff' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{a.kpi_display_name || a.description || `KPI #${a.chain_kpi_id}`}</div>
                      <div style={{ marginTop: 8, fontSize: 13, color: '#334155' }}>Nhân viên: <strong>{approvalAssigneeNames[Number(a.assignee_user_id || 0)] || `User ${a.assignee_user_id || '-'}`}</strong></div>
                      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <button type="button" onClick={() => openApprovalResult(a)} style={{ border: '1px solid #e2e8f0', borderRadius: 999, background: '#fff', padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                          Xem kết quả
                        </button>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="button" onClick={() => rejectApproval(a)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }} aria-label="Từ chối"><img src="/image/rejected_icon.png" alt="reject" style={{ width: 36 }} /></button>
                          <button type="button" onClick={() => approveApproval(a)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }} aria-label="Phê duyệt"><img src="/image/approve_icon.png" alt="approve" style={{ width: 32 }} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ ...wrapStyle, display: 'grid', gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0b3b66' }}>Xu hướng KPI theo tuần trong tháng</div>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, display: 'grid', gap: 10 }}>
                  {weeklyTrend.length === 0 ? (
                    <div style={{ fontSize: 13, color: '#64748b' }}>Chưa có dữ liệu xu hướng theo tuần.</div>
                  ) : weeklyTrend.map((week) => {
                    const maxWeekTotal = Math.max(...weeklyTrend.map((w) => w.total), 1);
                    const widthTotal = Math.round((week.total / maxWeekTotal) * 100);
                    const completedPct = week.total > 0 ? (week.completed / week.total) * 100 : 0;
                    const inProgressPct = week.total > 0 ? (week.inProgress / week.total) * 100 : 0;
                    const pendingPct = week.total > 0 ? (week.pending / week.total) * 100 : 0;

                    return (
                      <div key={week.label} style={{ display: 'grid', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>{week.label}</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>{week.total} KPI</div>
                        </div>
                        <div style={{ height: 10, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden', width: `${Math.max(8, widthTotal)}%` }}>
                          <div style={{ display: 'flex', width: '100%', height: '100%' }}>
                            <div style={{ width: `${completedPct}%`, background: '#16a34a' }} />
                            <div style={{ width: `${inProgressPct}%`, background: '#0284c7' }} />
                            <div style={{ width: `${pendingPct}%`, background: '#d97706' }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ ...wrapStyle, display: 'grid', gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0b3b66' }}>KPI sắp đến hạn ({filteredUpcomingDeadlines.length})</div>
                <div style={{ maxHeight: 320, overflowY: 'auto', display: 'grid', gap: 8 }}>
                  {filteredUpcomingDeadlines.length === 0 ? (
                    <div style={{ color: '#64748b', fontSize: 13 }}>Không có KPI sắp đến hạn trong 7 ngày tới.</div>
                  ) : filteredUpcomingDeadlines.map((item) => (
                    <div key={item.taskId} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, background: '#fff' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{item.kpiName}</div>
                      <div style={{ marginTop: 4, fontSize: 12, color: '#334155' }}>Nhân viên: <strong>{item.userName}</strong></div>
                      <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontSize: 12, color: '#475569' }}>Deadline: <strong>{new Date(item.deadline).toLocaleDateString('vi-VN')}</strong></div>
                        <span style={{ fontSize: 11, fontWeight: 800, borderRadius: 999, padding: '2px 8px', border: '1px solid #fde68a', background: '#fef3c7', color: '#92400e' }}>
                          Còn {item.daysLeft} ngày
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ ...wrapStyle, display: 'grid', gap: 10, marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0b3b66' }}>Hoạt động gần đây ({recentActivities.length})</div>
              <div style={{ maxHeight: 360, overflowY: 'auto', display: 'grid', gap: 8 }}>
                {recentActivities.length === 0 ? (
                  <div style={{ color: '#64748b', fontSize: 13 }}>Chưa có hoạt động gần đây.</div>
                ) : recentActivities.map((activity) => {
                  const typeStyle = activity.type === 'approval_submitted'
                    ? { background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', label: 'Duyệt' }
                    : { background: '#e0f2fe', border: '1px solid #bae6fd', color: '#075985', label: 'Tiến độ' };

                  return (
                    <div key={activity.id} style={{ borderBottom: '1px solid #eef2f7', padding: '8px 10px', background: '#fff', display: 'grid', gap: 5 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 13, color: '#0f172a' }}>
                          <strong>{activity.actorName}</strong> {activity.message}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 800, borderRadius: 999, padding: '2px 8px', background: typeStyle.background, border: typeStyle.border, color: typeStyle.color }}>
                          {typeStyle.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{new Date(activity.at).toLocaleString('vi-VN')}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {detailOpen && detailKpiId !== null ? (
              <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100 }} onClick={() => { setDetailOpen(false); setDetailKpiId(null); }}>
                <div style={{ width: '90%', maxWidth: 1100, maxHeight: '96vh', overflow: 'hidden', padding: 16 }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ background: '#f8fafc', borderRadius: 8, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <KpiDetails initialId={detailKpiId} isFullScreen={false} onToggleFullScreen={() => {}} />
                  </div>
                </div>
              </div>
            ) : null}

            {approvalResultOpen && approvalResultTask && approvalResultData ? (
              <UploadModal
                onClose={() => {
                  setApprovalResultOpen(false);
                  setApprovalResultTask(null);
                  setApprovalResultData(null);
                }}
                maxResults={Number(approvalResultTask.assignedKpi || 0)}
                taskId={approvalResultTask.taskId}
                chainKpiId={approvalResultTask.chainKpiId}
                mode="view"
                existing={approvalResultData}
                disableActions
              />
            ) : null}
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
