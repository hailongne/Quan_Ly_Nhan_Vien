import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import DashboardLayout from '../components/layout/DashboardLayout';
import api from '../../api/axios';
import ProgressBar from '../user/kpi/ProgressBar';
import KpiDetails from './kpi/KpiDetails';
import UploadModal from '../user/kpi/UploadModal';
import { notify } from '../../utils/notify';
import { confirm } from '../../utils/confirm';

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
  department_name?: string;
  department_leader_name?: string;
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
  status: string;
  statusLabel: string;
  kpiName: string;
  departmentName: string;
  departmentLeaderName: string;
  isTransferred?: boolean;
  departmentId?: number;
};

type TodayEmployeeKpiSummary = {
  userId: number;
  name: string;
  position: string;
  role: string;
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

type UpcomingDeadlineItem = {
  taskId: number;
  userName: string;
  kpiName: string;
  departmentName: string;
  deadline: string;
  daysLeft: number;
};

type DistributionItem = {
  label: string;
  value: number;
  color: string;
};

type WeeklyTrendItem = {
  label: string;
  completed: number;
  inProgress: number;
  pending: number;
  total: number;
};

type PendingQueueItem = {
  key: string;
  queueType: 'review' | 'upload';
  taskId: number;
  chainKpiId: number;
  approvalId?: number;
  userName: string;
  kpiName: string;
  departmentName: string;
  assignedKpi: number;
  queueDate: string;
  deadline?: string;
  daysLeft?: number;
  statusLabel: string;
};

type ActivityItem = {
  id: string;
  type: 'approval_submitted' | 'task_progress' | 'pending_upload';
  actorName: string;
  message: string;
  departmentName: string;
  at: string;
};

type DashboardStatusFilter = 'all' | 'in_progress' | 'completed' | 'pending' | 'overdue' | 'upcoming';

const normalizeText = (value: string) => String(value || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

const isDepartmentHead = (position: string, role: string) => {
  const roleNorm = normalizeText(role);
  if (roleNorm === 'leader' || roleNorm === 'head' || roleNorm === 'manager') return true;
  const posNorm = normalizeText(position);
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
  if (status === 'completed') return 'Đã hoàn thành';
  if (status === 'approved') return 'Đã duyệt';
  if (status === 'rejected') return 'Bị từ chối';
  if (status === 'in_progress' || status === 'inprogress' || status === 'processing' || status === 'doing' || status === 'working') return 'Đang làm';
  if (status === 'pending') return 'Đang làm';
  return 'Đang làm';
};

const getStatusChipStyle = (statusLabel: string): React.CSSProperties => {
  if (statusLabel === 'Đã hoàn thành' || statusLabel === 'Đã duyệt') {
    return { background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' };
  }
  if (statusLabel === 'Chờ phê duyệt') {
    return { background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' };
  }
  if (statusLabel === 'Bị từ chối') {
    return { background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' };
  }
  return { background: '#e0f2fe', color: '#075985', border: '1px solid #bae6fd' };
};

const getKpiLabel = (kpi: KpiRow) => {
  if (Array.isArray(kpi.kpi_name) && kpi.kpi_name.length > 0) return kpi.kpi_name.join(' • ');
  if (kpi.description && String(kpi.description).trim()) return String(kpi.description);
  return `KPI #${kpi.chain_kpi_id}`;
};

const getTaskStatusKey = (statusLabel: string): 'in_progress' | 'completed' | 'pending' => {
  if (statusLabel === 'Chờ phê duyệt') return 'pending';
  if (statusLabel === 'Đã hoàn thành' || statusLabel === 'Đã duyệt') return 'completed';
  return 'in_progress';
};

// CSV export helpers removed (exports were disabled)

export default function AdminDashboard() {
  const { user, signout } = useAuth();
  const displayName = (user as any)?.name || (user as any)?.username || 'Admin';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [departmentKpis, setDepartmentKpis] = useState<KpiRow[]>([]);
  const [transferredKpis, setTransferredKpis] = useState<KpiRow[]>([]);
  const [employeeSummaries, setEmployeeSummaries] = useState<EmployeeSummary[]>([]);
  const [todayApprovals, setTodayApprovals] = useState<ApprovalRow[]>([]);
  const [approvalAssigneeNames, setApprovalAssigneeNames] = useState<Record<number, string>>({});
  const [todayEmployeeKpis, setTodayEmployeeKpis] = useState<TodayEmployeeKpiSummary[]>([]);
  const [summaryMetrics, setSummaryMetrics] = useState<SummaryMetrics>({ totalKpi: 0, completionPercent: 0, inProgressKpi: 0, overdueKpi: 0, pendingApprovalKpi: 0 });
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<UpcomingDeadlineItem[]>([]);
  const [departmentDistribution, setDepartmentDistribution] = useState<DistributionItem[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<DistributionItem[]>([]);
  const [weeklyTrend, setWeeklyTrend] = useState<WeeklyTrendItem[]>([]);
  const [pendingQueue, setPendingQueue] = useState<PendingQueueItem[]>([]);
  
  const [percentSort, setPercentSort] = useState<'desc' | 'asc'>('desc');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailKpiId, setDetailKpiId] = useState<number | null>(null);
  const [detailFullScreen, setDetailFullScreen] = useState(false);
  const [approvalResultOpen, setApprovalResultOpen] = useState(false);
  const [approvalResultData, setApprovalResultData] = useState<any | null>(null);
  const [approvalResultTask, setApprovalResultTask] = useState<{ taskId: number; chainKpiId: number; assignedKpi: number } | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterStatus, setFilterStatus] = useState<DashboardStatusFilter>('all');
  const [filterKpiName, setFilterKpiName] = useState('');
  const [filterEmployeeName, setFilterEmployeeName] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [yearText, monthText] = String(selectedMonth || '').split('-');
        const year = Number(yearText);
        const month = Number(monthText);
        const valid = Number.isFinite(year) && Number.isFinite(month) && month >= 1 && month <= 12;
        const now = valid ? new Date(year, month - 1, 1) : new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const today = new Date();
        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        const [kpiRes, usersRes, approvalsRes, departmentRes] = await Promise.all([
          api.get('/api/kpis'),
          api.get('/api/users'),
          api.get('/api/kpis/approvals', { params: { status: 'pending' } }).catch(() => ({ data: [] })),
          api.get('/api/departments').catch(() => ({ data: [] }))
        ]);

        if (cancelled) return;

        const kpis: KpiRow[] = Array.isArray(kpiRes.data) ? kpiRes.data : [];
        const users: UserRow[] = Array.isArray(usersRes.data) ? usersRes.data : [];
        const approvals: ApprovalRow[] = Array.isArray(approvalsRes.data) ? approvalsRes.data : [];
        const departments: any[] = Array.isArray(departmentRes.data) ? departmentRes.data : [];

        const kpiById: Record<number, KpiRow> = {};
        kpis.forEach((k) => {
          const id = Number(k.chain_kpi_id || 0);
          if (id) kpiById[id] = k;
        });

        const departmentById: Record<number, { name: string; leaderName: string }> = {};
        departments.forEach((d) => {
          const id = Number(d?.department_id || 0);
          if (!id) return;
          departmentById[id] = {
            name: String(d?.name || '').trim() || `Phòng ban #${id}`,
            leaderName: String(d?.manager?.name || '').trim()
          };
        });

        const usersMap: Record<number, string> = {};
        const positionMap: Record<number, string> = {};
        const leaderByDept: Record<number, string> = {};
        users.forEach((u) => {
          const uid = Number(u.user_id || 0);
          if (!uid) return;
          usersMap[uid] = u.full_name || u.name || u.username || `User ${uid}`;
          const pos = String(u.department_position || u.position || '').trim();
          positionMap[uid] = pos;

          const deptId = Number(u.department_id || 0);
          if (!deptId) return;
          const roleNorm = normalizeText(String(u.role || ''));
          const posNorm = normalizeText(pos);
          const isLeaderLike = roleNorm === 'leader' || roleNorm === 'manager' || roleNorm === 'head' || posNorm.includes('truong phong') || posNorm.includes('manager') || posNorm.includes('head');
          if (isLeaderLike && !leaderByDept[deptId]) {
            leaderByDept[deptId] = usersMap[uid];
          }
        });

        Object.keys(departmentById).forEach((key) => {
          const deptId = Number(key);
          if (!deptId) return;
          if (!departmentById[deptId].leaderName) {
            departmentById[deptId].leaderName = leaderByDept[deptId] || '';
          }
        });
        setApprovalAssigneeNames(usersMap);

        const filteredKpis = kpis.filter((k) => {
          if (!k.start_date || !k.end_date) return false;
          return overlapMonth(k.start_date, k.end_date, monthStart, monthEnd);
        });

        const kpisForAssignments = kpis.filter((k) => {
          if (!k.start_date || !k.end_date) return false;
          return overlapMonth(k.start_date, k.end_date, monthStart, monthEnd) || overlapMonth(k.start_date, k.end_date, todayDate, todayDate);
        });

        const dept = filteredKpis.filter((k) => Number(k.transfer_source_kpi_id || 0) <= 0);
        const trans = filteredKpis.filter((k) => Number(k.transfer_source_kpi_id || 0) > 0);

        const pendingAll = approvals
          .filter((a) => {
            if (!a.date) return false;
            return inMonth(a.date, monthStart, monthEnd);
          })
          .map((a) => {
            const kpi = kpiById[Number(a.chain_kpi_id || 0)] || null;
            const kpiName = Array.isArray(a.kpi_name) && a.kpi_name.length > 0
              ? a.kpi_name.join(' • ')
              : (Array.isArray(kpi?.kpi_name) && kpi!.kpi_name!.length > 0
                ? kpi!.kpi_name!.join(' • ')
                : (a.description || kpi?.description || `KPI #${a.chain_kpi_id}`));
            const deptMeta = departmentById[Number(kpi?.department_id || 0)] || null;
            return {
              ...a,
              kpi_display_name: kpiName,
              department_name: deptMeta?.name || 'Chưa xác định phòng ban',
              department_leader_name: deptMeta?.leaderName || 'Không xác định'
            } as ApprovalRow;
          })
          .sort((a, b) => new Date(String(b.submitted_at || b.date || 0)).getTime() - new Date(String(a.submitted_at || a.date || 0)).getTime());

        const pendingApprovalTaskIds = new Set(
          pendingAll
            .map((a) => Number(a.task_id || 0))
            .filter((id) => id > 0)
        );

        const assignmentsByKpi = await Promise.all(
          kpisForAssignments.map(async (k) => {
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
        users.forEach((u) => {
          const uid = Number(u.user_id || 0);
          const role = String(u.role || '').toLowerCase();
          if (!uid || role === 'admin') return;
          employeeMap.set(uid, {
            userId: uid,
            name: usersMap[uid] || `User ${uid}`,
            position: positionMap[uid] || '',
            role: String(u.role || ''),
            totalKpi: 0,
            completedKpi: 0
          });

          todayEmployeeMap.set(uid, {
            userId: uid,
            name: usersMap[uid] || `User ${uid}`,
            position: positionMap[uid] || '',
            role: String(u.role || ''),
            totalKpi: 0,
            doneKpi: 0,
            inProgressKpi: 0,
            pendingApprovalKpi: 0,
            tasks: []
          });
        });

        let monthTotalAssigned = 0;
        let monthDoneAssigned = 0;
        let monthInProgressAssigned = 0;
        let monthOverdueAssigned = 0;
        let monthPendingAssigned = 0;
        const upcomingDeadlineMap = new Map<number, UpcomingDeadlineItem>();
        const departmentDistributionMap = new Map<string, number>();
        const weeklyTrendMap = new Map<number, { completed: number; inProgress: number; pending: number }>();
        const pendingUploadMap = new Map<number, PendingQueueItem>();
        for (let week = 0; week < 5; week += 1) {
          weeklyTrendMap.set(week, { completed: 0, inProgress: 0, pending: 0 });
        }

        assignmentsByKpi.forEach(({ rows }) => {
          rows.forEach((row) => {
            if (!inMonth(row.date, monthStart, monthEnd)) return;

            const userId = Number(row.assignee_user_id || 0);
            if (!userId) return;
            const assignedKpi = Number(row.assigned_kpi || 0);
            const status = String(row.status || '').toLowerCase();
            const taskId = Number(row.task_id || 0);
            const pendingApproval = taskId > 0 && pendingApprovalTaskIds.has(taskId);
            const doneLike = status === 'completed' || status === 'approved';
            const kpiMeta = kpiById[Number(row.chain_kpi_id || 0)] || null;
            const deptMeta = departmentById[Number(kpiMeta?.department_id || 0)] || null;

            monthTotalAssigned += assignedKpi;
            if (pendingApproval) monthPendingAssigned += assignedKpi;
            else if (doneLike) monthDoneAssigned += assignedKpi;
            else monthInProgressAssigned += assignedKpi;

            const deptNameForChart = deptMeta?.name || 'Chưa xác định phòng ban';
            departmentDistributionMap.set(deptNameForChart, (departmentDistributionMap.get(deptNameForChart) || 0) + assignedKpi);

            const taskDate = toDateOnly(row.date);
            const weekIndex = Math.min(4, Math.floor((taskDate.getDate() - 1) / 7));
            const weeklyCurrent = weeklyTrendMap.get(weekIndex) || { completed: 0, inProgress: 0, pending: 0 };
            if (pendingApproval) weeklyCurrent.pending += assignedKpi;
            else if (doneLike) weeklyCurrent.completed += assignedKpi;
            else weeklyCurrent.inProgress += assignedKpi;
            weeklyTrendMap.set(weekIndex, weeklyCurrent);

            if (!doneLike && !pendingApproval && taskId > 0) {
              const queueDateObj = toDateOnly(row.date);
              if (queueDateObj.getTime() <= todayDate.getTime() && !pendingUploadMap.has(taskId)) {
                const deadlineRaw = kpiMeta?.end_date ? String(kpiMeta.end_date) : '';
                const hasDeadline = Boolean(deadlineRaw);
                const daysLeft = hasDeadline ? Math.ceil((toDateOnly(deadlineRaw).getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)) : undefined;
                pendingUploadMap.set(taskId, {
                  key: `upload-${taskId}-${row.chain_kpi_id}`,
                  queueType: 'upload',
                  taskId,
                  chainKpiId: Number(row.chain_kpi_id || 0),
                  userName: usersMap[userId] || `User ${userId}`,
                  kpiName: kpiMeta ? getKpiLabel(kpiMeta) : `KPI #${Number(row.chain_kpi_id || 0)}`,
                  departmentName: deptMeta?.name || 'Chưa xác định phòng ban',
                  assignedKpi,
                  queueDate: row.date,
                  deadline: deadlineRaw || undefined,
                  daysLeft,
                  statusLabel: 'Chưa nộp kết quả'
                });
              }
            }

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
                    departmentName: deptMeta?.name || 'Chưa xác định phòng ban',
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
              role: '',
              totalKpi: 0,
              completedKpi: 0
            };

            existing.totalKpi += assignedKpi;
            if (status === 'completed') existing.completedKpi += assignedKpi;

            employeeMap.set(userId, existing);

            if (isSameDay(row.date, todayDate)) {
              const pendingApprovalToday = pendingApprovalTaskIds.has(taskId);
              const statusLabel = getTaskStatusLabel(status, pendingApprovalToday);

              const todayExisting = todayEmployeeMap.get(userId) || {
                userId,
                name: usersMap[userId] || `User ${userId}`,
                position: positionMap[userId] || '',
                role: '',
                totalKpi: 0,
                doneKpi: 0,
                inProgressKpi: 0,
                pendingApprovalKpi: 0,
                tasks: []
              };

              todayExisting.totalKpi += assignedKpi;
              if (statusLabel === 'Chờ phê duyệt') todayExisting.pendingApprovalKpi += assignedKpi;
              else if (statusLabel === 'Đã hoàn thành' || statusLabel === 'Đã duyệt') todayExisting.doneKpi += assignedKpi;
              else todayExisting.inProgressKpi += assignedKpi;

              todayExisting.tasks.push({
                taskId: Number(row.task_id || 0),
                chainKpiId: Number(row.chain_kpi_id || 0),
                assignedKpi,
                status,
                statusLabel,
                kpiName: kpiMeta ? getKpiLabel(kpiMeta) : `KPI #${Number(row.chain_kpi_id || 0)}`,
                departmentName: deptMeta?.name || 'Chưa xác định phòng ban',
                departmentLeaderName: deptMeta?.leaderName || 'Không xác định',
                isTransferred: Number(kpiMeta?.transfer_source_kpi_id || 0) > 0
              });

              todayEmployeeMap.set(userId, todayExisting);
            }
          });
        });

        const todayList = Array.from(todayEmployeeMap.values())
          .filter((emp) => emp.totalKpi > 0)
          .map((emp) => ({
            ...emp,
            tasks: [...emp.tasks].sort((a, b) => {
              const doneA = a.statusLabel === 'Đã hoàn thành' || a.statusLabel === 'Đã duyệt' ? 1 : 0;
              const doneB = b.statusLabel === 'Đã hoàn thành' || b.statusLabel === 'Đã duyệt' ? 1 : 0;
              if (doneA !== doneB) return doneA - doneB;
              return a.kpiName.localeCompare(b.kpiName, 'vi');
            })
          }))
          .sort((a, b) => {
            if (b.totalKpi !== a.totalKpi) return b.totalKpi - a.totalKpi;
            return a.name.localeCompare(b.name, 'vi');
          });

        const completionPercent = monthTotalAssigned > 0 ? Math.round((monthDoneAssigned / monthTotalAssigned) * 100) : 0;
        const upcomingList = Array.from(upcomingDeadlineMap.values())
          .sort((a, b) => {
            if (a.daysLeft !== b.daysLeft) return a.daysLeft - b.daysLeft;
            return a.userName.localeCompare(b.userName, 'vi');
          })
          .slice(0, 20);

        const deptDistributionList = Array.from(departmentDistributionMap.entries())
          .map(([label, value]) => ({ label, value, color: '#1d4ed8' }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 8);

        const statusDistributionList: DistributionItem[] = [
          { label: 'Đã hoàn thành', value: monthDoneAssigned, color: '#16a34a' },
          { label: 'Đang làm', value: monthInProgressAssigned, color: '#0284c7' },
          { label: 'Chờ duyệt', value: monthPendingAssigned, color: '#d97706' }
        ];

        const weeklyTrendList: WeeklyTrendItem[] = Array.from(weeklyTrendMap.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([index, row]) => {
            const total = row.completed + row.inProgress + row.pending;
            return {
              label: `Tuần ${index + 1}`,
              completed: row.completed,
              inProgress: row.inProgress,
              pending: row.pending,
              total
            };
          });

        const pendingReviewList: PendingQueueItem[] = pendingAll.map((approval) => {
          const taskId = Number(approval.task_id || 0);
          const chainKpiId = Number(approval.chain_kpi_id || 0);
          const assigneeId = Number(approval.assignee_user_id || 0);
          const kpiMeta = kpiById[chainKpiId] || null;
          const deadlineRaw = kpiMeta?.end_date ? String(kpiMeta.end_date) : '';
          const daysLeft = deadlineRaw ? Math.ceil((toDateOnly(deadlineRaw).getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)) : undefined;
          return {
            key: `review-${approval.approval_id}`,
            queueType: 'review',
            taskId,
            chainKpiId,
            approvalId: Number(approval.approval_id || 0),
            userName: usersMap[assigneeId] || `User ${assigneeId || '-'}`,
            kpiName: approval.kpi_display_name || (approval.description || `KPI #${chainKpiId}`),
            departmentName: approval.department_name || 'Chưa xác định phòng ban',
            assignedKpi: Number(approval.assigned_kpi || 0),
            queueDate: String(approval.submitted_at || approval.date || ''),
            deadline: deadlineRaw || undefined,
            daysLeft,
            statusLabel: 'Chờ phê duyệt'
          };
        });

        const pendingQueueList = [...pendingReviewList, ...Array.from(pendingUploadMap.values())]
          .sort((a, b) => {
            if (a.queueType !== b.queueType) return a.queueType === 'review' ? -1 : 1;
            const aDays = typeof a.daysLeft === 'number' ? a.daysLeft : Number.POSITIVE_INFINITY;
            const bDays = typeof b.daysLeft === 'number' ? b.daysLeft : Number.POSITIVE_INFINITY;
            if (aDays !== bDays) return aDays - bDays;
            return new Date(b.queueDate).getTime() - new Date(a.queueDate).getTime();
          })
          .slice(0, 40);

        setDepartmentKpis(dept);
        setTransferredKpis(trans);
        setEmployeeSummaries(Array.from(employeeMap.values()));
        setTodayApprovals(pendingAll);
        setTodayEmployeeKpis(todayList);
        setSummaryMetrics({
          totalKpi: monthTotalAssigned,
          completionPercent,
          inProgressKpi: monthInProgressAssigned,
          overdueKpi: monthOverdueAssigned,
          pendingApprovalKpi: monthPendingAssigned
        });
        setUpcomingDeadlines(upcomingList);
        setDepartmentDistribution(deptDistributionList);
        setStatusDistribution(statusDistributionList);
        setWeeklyTrend(weeklyTrendList);
        setPendingQueue(pendingQueueList);
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.message || e?.message || 'Không tải được tổng quan admin.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [selectedMonth, reloadTick]);

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
      setApprovalResultTask({
        taskId,
        chainKpiId,
        assignedKpi: Number(approval.assigned_kpi || payload?.assigned_kpi || 0)
      });
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

  const departmentFilterOptions = useMemo(() => {
    const names = new Set<string>();
    todayApprovals.forEach((a) => {
      const name = String(a.department_name || '').trim();
      if (name) names.add(name);
    });
    upcomingDeadlines.forEach((d) => {
      const name = String(d.departmentName || '').trim();
      if (name) names.add(name);
    });
    todayEmployeeKpis.forEach((emp) => {
      emp.tasks.forEach((t) => {
        const name = String(t.departmentName || '').trim();
        if (name) names.add(name);
      });
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [todayApprovals, upcomingDeadlines, todayEmployeeKpis]);

  const inSelectedDateRange = (dateRaw: string) => {
    if (!dateRaw) return true;
    const value = toDateOnly(dateRaw);
    if (filterDateFrom) {
      const from = toDateOnly(filterDateFrom);
      if (value.getTime() < from.getTime()) return false;
    }
    if (filterDateTo) {
      const to = toDateOnly(filterDateTo);
      if (value.getTime() > to.getTime()) return false;
    }
    return true;
  };

  const filteredApprovals = useMemo(() => {
    const kpiKeyword = normalizeText(filterKpiName);
    const employeeKeyword = normalizeText(filterEmployeeName);
    const deptKeyword = normalizeText(filterDepartment);

    return todayApprovals.filter((a) => {
      if (filterStatus !== 'all' && filterStatus !== 'pending') return false;

      const departmentName = String(a.department_name || '');
      if (filterDepartment !== 'all' && normalizeText(departmentName) !== deptKeyword) return false;

      const kpiName = a.kpi_display_name || (Array.isArray(a.kpi_name) ? a.kpi_name.join(' • ') : '') || a.description || '';
      if (kpiKeyword && !normalizeText(kpiName).includes(kpiKeyword)) return false;

      const assigneeName = approvalAssigneeNames[Number(a.assignee_user_id || 0)] || '';
      if (employeeKeyword && !normalizeText(assigneeName).includes(employeeKeyword)) return false;

      const dateRef = String(a.submitted_at || a.date || '');
      if (!inSelectedDateRange(dateRef)) return false;

      return true;
    });
  }, [todayApprovals, approvalAssigneeNames, filterStatus, filterDepartment, filterKpiName, filterEmployeeName, filterDateFrom, filterDateTo]);

  // approvalsByDepartment removed — UI no longer shows per-department summary

  const filteredPendingQueue = useMemo(() => {
    const kpiKeyword = normalizeText(filterKpiName);
    const employeeKeyword = normalizeText(filterEmployeeName);
    const deptKeyword = normalizeText(filterDepartment);

    return pendingQueue.filter((item) => {
      if (filterDepartment !== 'all' && normalizeText(item.departmentName) !== deptKeyword) return false;
      if (kpiKeyword && !normalizeText(item.kpiName).includes(kpiKeyword)) return false;
      if (employeeKeyword && !normalizeText(item.userName).includes(employeeKeyword)) return false;
      if (!inSelectedDateRange(item.queueDate)) return false;

      if (filterStatus === 'pending' && item.queueType !== 'review') return false;
      if (filterStatus === 'in_progress' && item.queueType !== 'upload') return false;
      if (filterStatus === 'completed') return false;
      if (filterStatus === 'upcoming') {
        if (typeof item.daysLeft !== 'number') return false;
        if (item.daysLeft < 0 || item.daysLeft > 7) return false;
      }
      if (filterStatus === 'overdue') {
        if (typeof item.daysLeft !== 'number') return false;
        if (item.daysLeft >= 0) return false;
      }

      return true;
    });
  }, [pendingQueue, filterDepartment, filterStatus, filterKpiName, filterEmployeeName, filterDateFrom, filterDateTo]);

  const filteredUpcomingDeadlines = useMemo(() => {
    const kpiKeyword = normalizeText(filterKpiName);
    const employeeKeyword = normalizeText(filterEmployeeName);
    const deptKeyword = normalizeText(filterDepartment);

    return upcomingDeadlines.filter((item) => {
      if (filterStatus === 'pending' || filterStatus === 'completed' || filterStatus === 'in_progress') return false;
      if (filterStatus === 'overdue') return item.daysLeft < 0;
      if (filterStatus === 'upcoming' || filterStatus === 'all') {
        if (item.daysLeft < 0) return false;
      }

      if (filterDepartment !== 'all' && normalizeText(item.departmentName) !== deptKeyword) return false;
      if (kpiKeyword && !normalizeText(item.kpiName).includes(kpiKeyword)) return false;
      if (employeeKeyword && !normalizeText(item.userName).includes(employeeKeyword)) return false;
      if (!inSelectedDateRange(item.deadline)) return false;
      return true;
    });
  }, [upcomingDeadlines, filterStatus, filterDepartment, filterKpiName, filterEmployeeName, filterDateFrom, filterDateTo]);

  const filteredTodayEmployeeKpis = useMemo(() => {
    const kpiKeyword = normalizeText(filterKpiName);
    const employeeKeyword = normalizeText(filterEmployeeName);
    const deptKeyword = normalizeText(filterDepartment);

    if (filterStatus === 'overdue' || filterStatus === 'upcoming') return [];

    return todayEmployeeKpis
      .filter((emp) => {
        if (!employeeKeyword) return true;
        return normalizeText(emp.name).includes(employeeKeyword);
      })
      .map((emp) => {
        const tasks = emp.tasks.filter((task) => {
          if (filterDepartment !== 'all' && normalizeText(task.departmentName) !== deptKeyword) return false;
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
        const totalKpi = doneKpi + pendingApprovalKpi + inProgressKpi;

        return {
          ...emp,
          tasks,
          doneKpi,
          pendingApprovalKpi,
          inProgressKpi,
          totalKpi
        };
      })
      .filter((emp) => emp.totalKpi > 0);
  }, [todayEmployeeKpis, filterDepartment, filterStatus, filterKpiName, filterEmployeeName]);

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
        departmentName: approval.department_name || 'Chưa xác định phòng ban',
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
          departmentName: task.departmentName,
          at: new Date().toISOString()
        });
      });
    });

    filteredPendingQueue
      .filter((q) => q.queueType === 'upload')
      .forEach((q) => {
        items.push({
          id: `upload-${q.taskId}-${q.chainKpiId}`,
          type: 'pending_upload',
          actorName: q.userName,
          message: `đang chờ nộp kết quả: ${q.kpiName}`,
          departmentName: q.departmentName,
          at: q.queueDate
        });
      });

    return items
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 40);
  }, [filteredApprovals, filteredTodayEmployeeKpis, filteredPendingQueue, approvalAssigneeNames]);

  const wrapStyle: React.CSSProperties = { background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: 14 };
  const sectionTitleStyle: React.CSSProperties = { margin: 0, fontSize: 16, fontWeight: 800, color: '#0b3b66', lineHeight: 1.2 };
  const sectionHeaderBarStyle: React.CSSProperties = { background: '#eff6ff', padding: '12px 14px', display: 'flex', alignItems: 'center', maxHeight: 50 };

  // Quick-export helpers removed per request

  return (
    <DashboardLayout roleLabel="Quản trị hệ thống" userName={displayName} onSignOut={signout} activeMenuKey="dashboard">
      <div style={{ display: 'grid', gap: 14, width: '100%', maxWidth: 1600, margin: '0 auto' }}>
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
                <select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 8px', fontSize: 12, color: '#0f172a', background: '#fff' }}
                >
                  <option value="all">Tất cả phòng ban</option>
                  {departmentFilterOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as DashboardStatusFilter)}
                  style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 8px', fontSize: 12, color: '#0f172a', background: '#fff' }}
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="in_progress">Đang làm</option>
                  <option value="pending">Chờ duyệt</option>
                  <option value="completed">Đã hoàn thành</option>
                  <option value="upcoming">Sắp đến hạn</option>
                  <option value="overdue">Quá hạn</option>
                </select>

                <input
                  value={filterKpiName}
                  onChange={(e) => setFilterKpiName(e.target.value)}
                  placeholder="Tìm theo tên KPI"
                  style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 8px', fontSize: 12, color: '#0f172a', background: '#fff' }}
                />

                <input
                  value={filterEmployeeName}
                  onChange={(e) => setFilterEmployeeName(e.target.value)}
                  placeholder="Tìm theo nhân viên"
                  style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 8px', fontSize: 12, color: '#0f172a', background: '#fff' }}
                />

                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 8px', fontSize: 12, color: '#0f172a', background: '#fff' }}
                />

                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 8px', fontSize: 12, color: '#0f172a', background: '#fff' }}
                />

                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 8px', fontSize: 12, color: '#0f172a', background: '#fff' }}
                />

                <button
                  type="button"
                  onClick={() => {
                    setFilterDepartment('all');
                    setFilterStatus('all');
                    setFilterKpiName('');
                    setFilterEmployeeName('');
                    setFilterDateFrom('');
                    setFilterDateTo('');
                  }}
                  style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 10px', background: '#fff', color: '#334155', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                >
                  Xóa lọc
                </button>
              </div>
            </div>

            {/* Quick-export removed */}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 14 }}>
              <div style={{ ...wrapStyle, display: 'grid', gap: 10 }}>
                <div style={{ ...sectionHeaderBarStyle, margin: '-14px -14px 0 -14px' }}>
                  <h3 style={sectionTitleStyle}>KPI đang có trong tháng</h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ border: '1px solid #dbeafe', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ background: '#eff6ff', color: '#1e3a8a', fontWeight: 800, padding: '8px 10px' }}>KPI phòng ban ({departmentKpis.length})</div>
                    <div style={{ maxHeight: 150, overflowY: 'auto', padding: 10, display: 'grid', gap: 8 }}>
                      {departmentKpis.length === 0 ? <div style={{ color: '#64748b', fontSize: 13 }}>Không có KPI phòng ban trong tháng này.</div> : departmentKpis.map((kpi) => (
                        <button
                          key={kpi.chain_kpi_id}
                          type="button"
                          onClick={() => { setDetailKpiId(Number(kpi.chain_kpi_id)); setDetailOpen(true); }}
                          style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 8, background: '#fff', textAlign: 'left', cursor: 'pointer' }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{getKpiLabel(kpi)}</div>
                          <div style={{ marginTop: 4, fontSize: 12, color: '#475569' }}>{new Date(kpi.start_date).toLocaleDateString('vi-VN')} - {new Date(kpi.end_date).toLocaleDateString('vi-VN')}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ border: '1px solid #fbcfe8', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ background: '#f3eaef', color: '#9f1239', fontWeight: 800, padding: '8px 10px' }}>KPI điều phối ({transferredKpis.length})</div>
                    <div style={{ maxHeight: 150, overflowY: 'auto', padding: 10, display: 'grid', gap: 8 }}>
                      {transferredKpis.length === 0 ? <div style={{ color: '#9f1239', fontSize: 13 }}>Không có KPI điều phối trong tháng này.</div> : transferredKpis.map((kpi) => (
                        <button
                          key={kpi.chain_kpi_id}
                          type="button"
                          onClick={() => { setDetailKpiId(Number(kpi.chain_kpi_id)); setDetailOpen(true); }}
                          style={{ border: '1px solid #fce7f3', borderRadius: 8, padding: 8, background: '#fff', textAlign: 'left', cursor: 'pointer' }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#831843' }}>{getKpiLabel(kpi)}</div>
                          <div style={{ marginTop: 4, fontSize: 12, color: '#9f1239' }}>{new Date(kpi.start_date).toLocaleDateString('vi-VN')} - {new Date(kpi.end_date).toLocaleDateString('vi-VN')}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ border: '1px solid #dbeafe', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={sectionHeaderBarStyle}>
                    <h3 style={sectionTitleStyle}>Danh sách yêu cầu phê duyệt ({filteredApprovals.length})</h3>
                  </div>
                  <div style={{ maxHeight: 220, overflowY: 'auto', padding: 10, display: 'grid', gap: 8 }}>
                    {filteredApprovals.length === 0 ? <div style={{ color: '#64748b', fontSize: 13 }}>Không có yêu cầu.</div> : filteredApprovals.map((a) => (
                      <div key={a.approval_id} style={{ border: '1px solid #dbeafe', borderRadius: 10, padding: 10, paddingRight: 126, background: '#fff', position: 'relative' }}>
                                    <div style={{ minWidth: 0 }}>
                                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, paddingRight: 8, flexWrap: 'wrap' }}>
                                        <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', lineHeight: 1.3 }}>{a.kpi_display_name || (Array.isArray(a.kpi_name) && a.kpi_name.length ? a.kpi_name.join(' • ') : (a.description || `KPI #${a.chain_kpi_id}`))}</div>
                                      </div>

                                      <div style={{ marginTop: 10, display: 'grid', rowGap: 6 }}>
                                        <div style={{ fontSize: 14, color: '#334155' }}>Nhân viên: <strong>{approvalAssigneeNames[Number(a.assignee_user_id || 0)] || `User ${a.assignee_user_id || '-'}`}</strong></div>
                                        <div style={{ fontSize: 12, color: '#334155' }}>Phòng ban KPI: <strong>{a.department_name || 'Chưa xác định phòng ban'}</strong> - Leader: <strong>{a.department_leader_name || 'Không xác định'}</strong></div>
                                      </div>
                        </div>

                        <div style={{ position: 'absolute', right: 10, top: 10, bottom: 10, width: 150, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => { setDetailKpiId(Number(a.chain_kpi_id)); setDetailOpen(true); }}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#334155', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 999, padding: '4px 10px', whiteSpace: 'nowrap' }}
                            >
                                <span>Ngày KPI: <strong>{new Date(a.date).toLocaleDateString('vi-VN')}</strong></span>
                                <span style={{ color: '#94a3b8' }}>•</span>
                                <span><strong>{Number(a.assigned_kpi || 0)} </strong>KPI</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => openApprovalResult(a)}
                              aria-label="Xem kết quả"
                              style={{ border: 'none', background: 'transparent', borderRadius: 8, width: 46, height: 30, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <img src="/image/eye_icon.png" alt="view" style={{ width: 25, height: 'auto', objectFit: 'contain', display: 'block' }} />
                            </button>
                          </div>

                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <button type="button" onClick={() => rejectApproval(a)} aria-label="Từ chối phê duyệt" style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}>
                              <img src="/image/rejected_icon.png" alt="reject" style={{ width: 38, height: 38 }} />
                            </button>
                            <button type="button" onClick={() => approveApproval(a)} aria-label="Phê duyệt" style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}>
                              <img src="/image/approve_icon.png" alt="approve" style={{ width: 35, height: 35 }} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 'Tổng hợp chờ duyệt theo phòng ban' card removed */}

                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={sectionHeaderBarStyle}>
                    <h3 style={sectionTitleStyle}>KPI sắp đến hạn ({filteredUpcomingDeadlines.length})</h3>
                  </div>
                  <div style={{ maxHeight: 220, overflowY: 'auto', padding: 10, display: 'grid', gap: 8 }}>
                    {filteredUpcomingDeadlines.length === 0 ? (
                      <div style={{ color: '#64748b', fontSize: 13 }}>Không có KPI sắp đến hạn trong 7 ngày tới.</div>
                    ) : filteredUpcomingDeadlines.map((item) => (
                      <div key={item.taskId} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, background: '#fff' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{item.kpiName}</div>
                        <div style={{ marginTop: 4, fontSize: 12, color: '#334155' }}>Nhân viên: <strong>{item.userName}</strong> • {item.departmentName}</div>
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
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 10 }}>
              <div style={{ ...wrapStyle, display: 'grid', gap: 10 }}>
                <div style={{ ...sectionHeaderBarStyle, margin: '-14px -14px 0 -14px' }}>
                  <h3 style={sectionTitleStyle}>Hiệu suất thực hiện công việc</h3>
                </div>
                <div style={{ maxHeight: 380, overflow: 'auto', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
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
                    <tbody style={{textAlign: 'center'}}>
                      {displayEmployeeSummaries.length === 0 ? (
                        <tr><td colSpan={2} style={{ padding: 12, fontSize: 13, color: '#64748b' }}>Không có dữ liệu nhân viên.</td></tr>
                      ) : displayEmployeeSummaries.map((emp) => (
                        <tr key={emp.userId} style={{ borderTop: '1px solid #e2e8f0' }}>
                          <td style={{ padding: 10, fontSize: 13, color: '#0f172a', fontWeight: 700, width: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span style={{ display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.name}</span>
                            {emp.position ? <span style={{ fontSize: 11, fontWeight: 500, color: '#64748b', marginLeft: 6 }}>({emp.position})</span> : null}
                          </td>
                          <td style={{ padding: 10 }}>
                            <ProgressBar completed={emp.completedKpi} total={emp.totalKpi} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 10 }}>
              <div style={{ ...wrapStyle, display: 'grid', gap: 10 }}>
                <div style={{ ...sectionHeaderBarStyle, margin: '-14px -14px 0 -14px' }}>
                  <h3 style={sectionTitleStyle}>KPI hôm nay của nhân viên ({filteredTodayEmployeeKpis.length})</h3>
                </div>
                <div style={{ maxHeight: 350, overflowY: 'auto', borderRadius: 8, display: 'grid', gap: 10 }}>
                  {filteredTodayEmployeeKpis.length === 0 ? (
                    <div style={{ color: '#64748b', fontSize: 13 }}>Hôm nay chưa có KPI nào được giao cho nhân viên.</div>
                  ) : filteredTodayEmployeeKpis.map((emp) => (
                    <div key={emp.userId} style={{ border: 'none', borderBottom: '1px solid #eef2f7', padding: '8px 10px', display: 'grid', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', minWidth: 0, overflow: 'hidden' }}>
                          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.name}{emp.position ? ` (${emp.position})` : ''}</div>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#1e3a8a', background: '#f1f5f9', borderRadius: 999, padding: '4px 8px' }}>
                          {emp.totalKpi} KPI
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 11, color: '#166534', background: '#ecfdf5', borderRadius: 6, padding: '4px 6px', fontWeight: 700 }}>Hoàn thành: {emp.doneKpi}</div>
                        <div style={{ fontSize: 11, color: '#075985', background: '#eef8ff', borderRadius: 6, padding: '4px 6px', fontWeight: 700 }}>Đang: {emp.inProgressKpi}</div>
                        <div style={{ fontSize: 11, color: '#92400e', background: '#fffbeb', borderRadius: 6, padding: '4px 6px', fontWeight: 700 }}>Chờ: {emp.pendingApprovalKpi}</div>
                      </div>

                      <div style={{ display: 'grid', gap: 6 }}>
                        {emp.tasks.slice(0, 3).map((task) => (
                          <div key={`${emp.userId}-${task.taskId}-${task.chainKpiId}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                            <div style={{ fontSize: 13, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.kpiName}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ ...getStatusChipStyle(task.statusLabel), fontSize: 11, fontWeight: 800, borderRadius: 999, padding: '2px 8px' }}>{task.statusLabel}</span>
                              <span style={{ fontSize: 12, color: '#475569', fontWeight: 700 }}>{task.assignedKpi} KPI</span>
                            </div>
                          </div>
                        ))}
                        {emp.tasks.length > 3 ? (
                          <div style={{ fontSize: 12, color: '#64748b' }}>+{emp.tasks.length - 3} mục khác</div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ ...wrapStyle, display: 'grid', gap: 10 }}>
                <div style={{ ...sectionHeaderBarStyle, margin: '-14px -14px 0 -14px' }}>
                  <h3 style={sectionTitleStyle}>Phân bố KPI theo phòng ban</h3>
                </div>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, display: 'grid', gap: 8 }}>
                  {departmentDistribution.length === 0 ? (
                    <div style={{ fontSize: 13, color: '#64748b' }}>Chưa có dữ liệu phân bố phòng ban.</div>
                  ) : departmentDistribution.map((item) => {
                    const maxValue = departmentDistribution[0]?.value || 1;
                    const widthPercent = Math.max(6, Math.round((item.value / maxValue) * 100));
                    return (
                      <div key={item.label} style={{ display: 'grid', gap: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: '#334155' }}>
                          <span style={{ fontWeight: 700 }}>{item.label}</span>
                          <span style={{ fontWeight: 800 }}>{item.value} KPI</span>
                        </div>
                        <div style={{ height: 8, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
                          <div style={{ width: `${widthPercent}%`, height: '100%', background: item.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>Phân bố KPI theo trạng thái</div>
                  {statusDistribution.map((item) => {
                    const sum = statusDistribution.reduce((acc, row) => acc + row.value, 0);
                    const widthPercent = sum > 0 ? Math.round((item.value / sum) * 100) : 0;
                    return (
                      <div key={item.label} style={{ display: 'grid', gap: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: '#334155' }}>
                          <span style={{ fontWeight: 700 }}>{item.label}</span>
                          <span style={{ fontWeight: 800 }}>{item.value} KPI ({widthPercent}%)</span>
                        </div>
                        <div style={{ height: 8, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.max(4, widthPercent)}%`, height: '100%', background: item.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ ...wrapStyle, display: 'grid', gap: 10 }}>
                <div style={{ ...sectionHeaderBarStyle, margin: '-14px -14px 0 -14px' }}>
                  <h3 style={sectionTitleStyle}>Xu hướng KPI theo tuần trong tháng</h3>
                </div>
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
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 11 }}>
                          <span style={{ color: '#166534', background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: 999, padding: '1px 7px', fontWeight: 700 }}>Hoàn thành: {week.completed}</span>
                          <span style={{ color: '#075985', background: '#e0f2fe', border: '1px solid #bae6fd', borderRadius: 999, padding: '1px 7px', fontWeight: 700 }}>Đang làm: {week.inProgress}</span>
                          <span style={{ color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 999, padding: '1px 7px', fontWeight: 700 }}>Chờ duyệt: {week.pending}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 10 }}>
              <div style={{ ...wrapStyle, display: 'grid', gap: 10 }}>
                <div style={{ ...sectionHeaderBarStyle, margin: '-14px -14px 0 -14px' }}>
                  <h3 style={sectionTitleStyle}>Top 5 nhân viên hoàn thành nhiều KPI nhất</h3>
                </div>
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
                        {item.completionPercent}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ ...wrapStyle, display: 'grid', gap: 10 }}>
                <div style={{ ...sectionHeaderBarStyle, margin: '-14px -14px 0 -14px' }}>
                  <h3 style={sectionTitleStyle}>Top 5 nhân viên cần cải thiện</h3>
                </div>
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
                        {item.completionPercent}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr)', gap: 10, marginBottom: 20 }}>
              <div style={{ ...wrapStyle, display: 'grid', gap: 10 }}>
                <div style={{ ...sectionHeaderBarStyle, margin: '-14px -14px 0 -14px' }}>
                  <h3 style={sectionTitleStyle}>Hoạt động gần đây ({recentActivities.length})</h3>
                </div>
                <div style={{ maxHeight: 360, overflowY: 'auto', border: 'none', borderRadius: 8, padding: 10, display: 'grid', gap: 8 }}>
                  {recentActivities.length === 0 ? (
                    <div style={{ color: '#64748b', fontSize: 13 }}>Chưa có hoạt động gần đây.</div>
                  ) : recentActivities.map((activity) => {
                    const typeStyle = activity.type === 'approval_submitted'
                      ? { background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', label: 'Duyệt' }
                      : activity.type === 'pending_upload'
                        ? { background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', label: 'Chưa nộp' }
                        : { background: '#e0f2fe', border: '1px solid #bae6fd', color: '#075985', label: 'Tiến độ' };

                    return (
                      <div key={activity.id} style={{ border: 'none', borderBottom: '1px solid #eef2f7', padding: '8px 10px', background: '#fff', display: 'grid', gap: 5 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ fontSize: 13, color: '#0f172a' }}>
                            <strong>{activity.actorName}</strong> {activity.message}
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 800, borderRadius: 999, padding: '2px 8px', background: typeStyle.background, border: typeStyle.border, color: typeStyle.color }}>
                            {typeStyle.label}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>
                          {activity.departmentName} • {new Date(activity.at).toLocaleString('vi-VN')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        ) : null}

        {detailOpen && detailKpiId !== null ? (
          <div
            role="dialog"
            aria-modal="true"
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100 }}
            onClick={() => { setDetailOpen(false); setDetailKpiId(null); setDetailFullScreen(false); }}
          >
            <div
              style={{
                width: detailFullScreen ? '100%' : '90%',
                maxWidth: detailFullScreen ? '100%' : 1200,
                height: detailFullScreen ? '100vh' : 'min(920px, 96vh)',
                maxHeight: '96vh',
                overflow: 'hidden',
                padding: detailFullScreen ? 0 : 16,
                display: 'flex',
                flexDirection: 'column'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ background: '#f8fafc', borderRadius: 8, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <KpiDetails
                  initialId={detailKpiId}
                  isFullScreen={detailFullScreen}
                  onToggleFullScreen={() => setDetailFullScreen((prev) => !prev)}
                />
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
      </div>
    </DashboardLayout>
  );
}
