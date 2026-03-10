import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import { useAuth } from '../../../../contexts/AuthContext';
import axios from '../../../../api/axios';
import { notify } from '../../../../utils/notify';
import './HandoverTransferPreviewPage.css';

type ConfirmPayload = {
  kpiId?: number;
  departmentId?: number;
  kpiName?: string;
  departmentName?: string;
  targetKpiId?: number;
};

type KpiDay = {
  kpi_day_id?: number;
  date?: string;
  target_value?: number;
  kpi_current?: number;
};

type KpiWeek = {
  week_index?: number;
  start_date?: string;
  end_date?: string;
  days?: KpiDay[];
};

type DragDayPayload = {
  sourceKey: string;
  sourceWeekNum: number;
  sourceDate?: string;
  value: number;
};

const dayNames = ['CN', 'Th 2', 'Th 3', 'Th 4', 'Th 5', 'Th 6', 'Th 7'];

const toDate = (value?: string) => {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
};

const formatDate = (value?: string) => {
  const dt = toDate(value);
  if (!dt) return '—';
  return dt.toLocaleDateString('vi-VN');
};

const formatDayChip = (value?: string) => {
  const dt = toDate(value);
  if (!dt) return '—';
  const dayLabel = dayNames[dt.getDay()] || '';
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  return `${dayLabel}, ${dd}/${mm}`;
};

const toDateKey = (value?: string) => {
  if (!value) return '';
  if (value.length >= 10) return value.slice(0, 10);
  const dt = toDate(value);
  if (!dt) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function HandoverTransferPreviewPage() {
  const { user, signout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const displayName = (user as any)?.name || (user as any)?.email || '';
  const onSignOut = () => { signout(); };
  const sourceDepartmentName = (user as any)?.department_name || 'Phòng ban hiện tại';

  const payload = useMemo(() => (location.state || {}) as ConfirmPayload, [location.state]);
  const hasPayload = Number(payload.kpiId) > 0 && Number(payload.departmentId) > 0;
  const initialTargetKpiId = Number(payload.targetKpiId ?? 0);

  const [sourceWeeks, setSourceWeeks] = useState<KpiWeek[]>([]);
  const [destinationWeeks, setDestinationWeeks] = useState<KpiWeek[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [targetKpiId, setTargetKpiId] = useState<number>(initialTargetKpiId > 0 ? initialTargetKpiId : 0);
  const [savingDrop, setSavingDrop] = useState<boolean>(false);
  const [draggingSourceKey, setDraggingSourceKey] = useState<string | null>(null);
  const [draggingSourceWeekNum, setDraggingSourceWeekNum] = useState<number | null>(null);
  const [activeDropWeekKey, setActiveDropWeekKey] = useState<string | null>(null);
  const [disabledSourceDays, setDisabledSourceDays] = useState<Record<string, true>>({});

  const getDayKey = (weekNum: number, day: KpiDay, fallbackIndex: number) => `${weekNum}-${day.kpi_day_id ?? fallbackIndex}`;

  const onSourceDragStart = (ev: DragEvent<HTMLDivElement>, sourceKey: string, sourceWeekNum: number, day: KpiDay) => {
    const value = Number(day.target_value ?? day.kpi_current ?? 0);
    const payload: DragDayPayload = {
      sourceKey,
      sourceWeekNum,
      sourceDate: day.date,
      value
    };
    ev.dataTransfer.effectAllowed = 'copy';
    ev.dataTransfer.setData('text/plain', JSON.stringify(payload));
    setDraggingSourceKey(sourceKey);
    setDraggingSourceWeekNum(sourceWeekNum);
  };

  const onSourceDragEnd = () => {
    setDraggingSourceKey(null);
    setDraggingSourceWeekNum(null);
    setActiveDropWeekKey(null);
  };

  const onDestinationDragOver = (ev: DragEvent<HTMLDivElement>, destinationWeekKey: string, destinationWeekNum: number) => {
    if (draggingSourceWeekNum !== destinationWeekNum) {
      if (activeDropWeekKey === destinationWeekKey) setActiveDropWeekKey(null);
      return;
    }
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'copy';
    setActiveDropWeekKey(destinationWeekKey);
  };

  const onDestinationDragLeave = (destinationWeekKey: string) => {
    if (activeDropWeekKey === destinationWeekKey) setActiveDropWeekKey(null);
  };

  const buildDisabledSourceFromDestination = (srcWeeks: KpiWeek[], dstWeeks: KpiWeek[]) => {
    const transferredDateSet = new Set<string>();
    for (const week of dstWeeks) {
      const days = Array.isArray(week.days) ? week.days : [];
      for (const day of days) {
        const dateKey = toDateKey(day.date);
        if (!dateKey) continue;
        if (Number(day.target_value ?? 0) > 0) transferredDateSet.add(dateKey);
      }
    }

    const nextDisabled: Record<string, true> = {};
    srcWeeks.forEach((week, wi) => {
      const rawWeekIndex = Number(week.week_index);
      const weekNum = Number.isFinite(rawWeekIndex) ? (rawWeekIndex + 1) : (wi + 1);
      const days = Array.isArray(week.days) ? week.days : [];
      days.forEach((day, di) => {
        const sourceKey = getDayKey(weekNum, day, di);
        const dateKey = toDateKey(day.date);
        if (dateKey && transferredDateSet.has(dateKey)) {
          nextDisabled[sourceKey] = true;
        }
      });
    });
    return nextDisabled;
  };

  const onDestinationDrop = async (ev: DragEvent<HTMLDivElement>, destinationWeekNum: number) => {
    ev.preventDefault();
    if (savingDrop) return;
    const raw = ev.dataTransfer.getData('text/plain');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as DragDayPayload;
      if (!Number.isFinite(parsed.value) || parsed.value <= 0) return;
      if (parsed.sourceWeekNum !== destinationWeekNum) return;
      const dateKey = toDateKey(parsed.sourceDate);
      if (!dateKey) return;
      if (!Number.isFinite(targetKpiId) || targetKpiId <= 0) return;

      let foundDestinationKey: string | null = null;
      let destinationAlreadyFilled = false;
      for (let wi = 0; wi < destinationWeeks.length; wi += 1) {
        const week = destinationWeeks[wi];
        const rawWeekIndex = Number(week.week_index);
        const weekNum = Number.isFinite(rawWeekIndex) ? (rawWeekIndex + 1) : (wi + 1);
        if (weekNum !== destinationWeekNum) continue;
        const days = Array.isArray(week.days) ? week.days : [];
        for (let di = 0; di < days.length; di += 1) {
          const day = days[di];
          if (toDateKey(day.date) === dateKey) {
            foundDestinationKey = `dst-day-${getDayKey(weekNum, day, di)}`;
            if (Number(day.target_value ?? day.kpi_current ?? 0) > 0) {
              destinationAlreadyFilled = true;
            }
            break;
          }
        }
        if (foundDestinationKey) break;
      }

      if (!foundDestinationKey) return;
      if (destinationAlreadyFilled) return;
      setSavingDrop(true);

      await axios.post(`/api/kpis/${payload.kpiId}/transfer`, {
        targetDepartmentId: payload.departmentId,
        targetKpiId,
        dates: [dateKey]
      });

      const destinationRes = await axios.get(`/api/kpis/${targetKpiId}`);
      const latestDestinationWeeks = Array.isArray(destinationRes.data?.weeks) ? destinationRes.data.weeks : [];
      setDestinationWeeks(latestDestinationWeeks);
      setDisabledSourceDays(buildDisabledSourceFromDestination(sourceWeeks, latestDestinationWeeks));
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Chuyển giao KPI thất bại';
      notify.error('Không thể chuyển giao', message);
    } finally {
      setSavingDrop(false);
      setActiveDropWeekKey(null);
      setDraggingSourceKey(null);
      setDraggingSourceWeekNum(null);
    }
  };

  useEffect(() => {
    if (!hasPayload) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        let targetId = Number(payload.targetKpiId ?? 0);
        if (!Number.isFinite(targetId) || targetId <= 0) {
          const createRes = await axios.post(`/api/kpis/${payload.kpiId}/transfer`, {
            targetDepartmentId: payload.departmentId,
            forceCreate: true
          });
          targetId = Number(createRes?.data?.transfer?.targetKpiId ?? 0);
        }

        if (!Number.isFinite(targetId) || targetId <= 0) {
          throw new Error('Không tạo được KPI chuyển giao');
        }

        const [sourceRes, destinationRes] = await Promise.all([
          axios.get(`/api/kpis/${payload.kpiId}`),
          axios.get(`/api/kpis/${targetId}`)
        ]);
        if (!mounted) return;
        const srcWeeks = Array.isArray(sourceRes.data?.weeks) ? sourceRes.data.weeks : [];
        const dstWeeks = Array.isArray(destinationRes.data?.weeks) ? destinationRes.data.weeks : [];
        setTargetKpiId(targetId);
        setSourceWeeks(srcWeeks);
        setDestinationWeeks(dstWeeks);
        setDisabledSourceDays(buildDisabledSourceFromDestination(srcWeeks, dstWeeks));
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.response?.data?.message || err?.message || 'Không tải được dữ liệu KPI');
        setSourceWeeks([]);
        setDestinationWeeks([]);
        setDisabledSourceDays({});
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [hasPayload, payload.departmentId, payload.kpiId, payload.targetKpiId]);

  if (!hasPayload) {
    return (
      <DashboardLayout roleLabel="Chuyển giao KPI" userName={displayName} activeMenuKey="kpi_handover" onSignOut={onSignOut}>
        <div style={{ padding: 16 }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <div style={{ color: '#64748b' }}>Không có dữ liệu chuyển giao. Vui lòng quay lại bước chọn.</div>
            <button
              type="button"
              onClick={() => navigate('/kpi/handover')}
              style={{ marginTop: 12, padding: '8px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', cursor: 'pointer' }}
            >
              Quay lại chọn
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout roleLabel="Chuyển giao KPI" userName={displayName} activeMenuKey="kpi_handover" onSignOut={onSignOut}>
      <div style={{ padding: 10 }}>
        <div className="handover-preview-header">
          <h1 className="handover-preview-title">Chuyển giao KPI "{payload.kpiName || `KPI #${payload.kpiId}`}" đến phòng ban "{payload.departmentName || `Phòng ban #${payload.departmentId}`}"</h1>
          <p className="handover-preview-subtitle">Kéo các ngày KPI cần chuyển giao sang cột tương ứng của phòng ban đích.</p>
        </div>

        <div style={{ marginTop: 10, background: '#fff', borderRadius: 8 }}>
          {loading && <div style={{ color: '#475569' }}>Đang tải dữ liệu tuần/ngày...</div>}
          {!loading && error && <div style={{ color: '#b91c1c' }}>Lỗi: {error}</div>}

          {!loading && !error && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', gap: 12, alignItems: 'start' }}>
              <div>
                <div style={{ textAlign: 'center', fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 10 }}>{sourceDepartmentName}</div>

                <div style={{ display: 'grid', gap: 8 }}>
                  {sourceWeeks.map((week, idx) => {
                    const rawWeekIndex = Number(week.week_index);
                    const weekNum = Number.isFinite(rawWeekIndex) ? (rawWeekIndex + 1) : (idx + 1);
                    const days = Array.isArray(week.days) ? week.days : [];
                    return (
                      <div key={`src-week-${weekNum}-${idx}`} style={{ display: 'grid', gap: 8, alignItems: 'start' }}>
                        <div>
                          <div style={{ display: 'inline-block', border: '1px solid #cbd5e1', borderRadius: 999, padding: '2px 8px', color: '#0b5ea8', fontWeight: 700, fontSize: 12 }}>Tuần {weekNum}</div>
                          <div style={{ marginTop: 5, color: '#0b69c7', fontSize: 10, lineHeight: 1.35 }}>{formatDate(week.start_date)} - {formatDate(week.end_date)}</div>
                        </div>

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(7, minmax(88px, 1fr))',
                            gap: 4,
                            overflow: 'hidden',
                            paddingBottom: 2
                          }}
                        >
                          {days.map((d, di) => {
                            const sourceKey = getDayKey(weekNum, d, di);
                            const isDragging = draggingSourceKey === sourceKey;
                            const targetValue = Number(d.target_value ?? 0);
                            const currentValue = Number(d.kpi_current ?? 0);
                            const isCompleted = targetValue > 0 && currentValue >= targetValue;
                            const isDisabled = !!disabledSourceDays[sourceKey] || !isCompleted;
                            return (
                              <div
                                key={`src-day-${sourceKey}`}
                                draggable={!isDisabled}
                                onDragStart={(ev) => onSourceDragStart(ev, sourceKey, weekNum, d)}
                                onDragEnd={onSourceDragEnd}
                                style={{
                                  width: '100%',
                                  background: !!disabledSourceDays[sourceKey] ? '#e2e8f0' : (isCompleted ? '#b8e4ce' : '#fee2e2'),
                                  border: !!disabledSourceDays[sourceKey] ? '1px solid #cbd5e1' : (isCompleted ? '1px solid #8dd8b2' : '1px solid #fecaca'),
                                  borderRadius: 4,
                                  textAlign: 'center',
                                  padding: '3px 6px',
                                  color: !!disabledSourceDays[sourceKey] ? '#64748b' : (isCompleted ? '#065f46' : '#991b1b'),
                                  height: 52,
                                  cursor: isDisabled ? 'not-allowed' : 'grab',
                                  opacity: isDisabled ? 0.55 : (isDragging ? 0.55 : 1)
                                }}
                              >
                                <div style={{ fontSize: 9 }}>{formatDayChip(d.date)}</div>
                                <div style={{ marginTop: 4, fontSize: 10, fontWeight: 700 }}>
                                  {!!disabledSourceDays[sourceKey]
                                    ? 'Đã chuyển giao'
                                    : (isCompleted ? `✓ ${targetValue} KPI` : `Chưa hoàn thành (${currentValue}/${targetValue})`)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ background: '#9ca3af', width: 1, minHeight: 520 }} />

              <div>
                <div style={{ textAlign: 'center', fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 10 }}>{payload.departmentName || `Phòng ban #${payload.departmentId}`}</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {destinationWeeks.map((week, idx) => {
                    const rawWeekIndex = Number(week.week_index);
                    const weekNum = Number.isFinite(rawWeekIndex) ? (rawWeekIndex + 1) : (idx + 1);
                    const days = Array.isArray(week.days) ? week.days : [];
                    return (
                      <div key={`dst-week-${weekNum}-${idx}`} style={{ display: 'grid', gap: 8, alignItems: 'start' }}>
                        <div>
                          <div style={{ display: 'inline-block', border: '1px solid #cbd5e1', borderRadius: 999, padding: '2px 8px', color: '#0b5ea8', fontWeight: 700, fontSize: 12 }}>Tuần {weekNum}</div>
                          <div style={{ marginTop: 4, color: '#0b69c7', fontSize: 10, lineHeight: 1.35 }}>{formatDate(week.start_date)} - {formatDate(week.end_date)}</div>
                        </div>

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(7, minmax(88px, 1fr))',
                            gap: 4,
                            overflow: 'hidden',
                            paddingBottom: 2,
                            border: `1px dashed ${activeDropWeekKey === `dst-week-drop-${weekNum}-${idx}` ? '#0b69c7' : 'transparent'}`,
                            borderRadius: 6
                          }}
                          onDragOver={(ev) => onDestinationDragOver(ev, `dst-week-drop-${weekNum}-${idx}`, weekNum)}
                          onDragLeave={() => onDestinationDragLeave(`dst-week-drop-${weekNum}-${idx}`)}
                          onDrop={(ev) => onDestinationDrop(ev, weekNum)}
                        >
                          {days.map((d, di) => {
                            const key = `dst-day-${getDayKey(weekNum, d, di)}`;
                            const val = Number(d.target_value ?? d.kpi_current ?? 0);
                            return (
                              <div
                                key={key}
                                style={{
                                  width: '100%',
                                  background: val > 0 ? '#b8e4ce' : 'transparent',
                                  border: val > 0 ? '1px solid #8dd8b2' : '1px dashed #cbd5e1',
                                  borderRadius: 4,
                                  textAlign: 'center',
                                  padding: '3px 6px',
                                  height: 52,
                                  color: val > 0 ? '#065f46' : '#334155'
                                }}
                              >
                                <div style={{ fontSize: 9 }}>{formatDayChip(d.date)}</div>
                                {val > 0 ? (
                                  <div style={{ marginTop: 4, fontSize: 10, fontWeight: 700 }}>✓ {val} KPI</div>
                                ) : (
                                  <div style={{ marginTop: 6, height: 28 }} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
