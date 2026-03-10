
import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from '../../../api/axios';
import UploadModal from '../../user/kpi/UploadModal';
import { getUsersCached } from '../../../utils/usersCache';

type ChainKpi = {
  chain_kpi_id: number;
  created_by: string | number | null;
  created_at: string | null;
  updated_at: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  kpi_name?: string[] | null;
  department_id: number | null;
  transfer_source_kpi_id?: number | null;
  total_kpi: number | null;
  workdays_count: number | null;
  status: string | null;
};

type Props = { initialId?: string | number | null; isFullScreen?: boolean; onToggleFullScreen?: () => void; };

const KpiDetails: React.FC<Props> = ({ initialId = null, isFullScreen = false, onToggleFullScreen }) => {
  const params = useParams();
  const routeId = (params as any)?.id ?? null;
  const idToLoad = initialId ?? routeId;
  const [kpi, setKpi] = useState<ChainKpi | null>(null);
  const [weeks, setWeeks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [usersMap, setUsersMap] = useState<Record<number, string>>({});
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [dayResultMessage, setDayResultMessage] = useState<string | null>(null);
  const [outputViewerOpen, setOutputViewerOpen] = useState(false);
  const [outputViewerLoading, setOutputViewerLoading] = useState(false);
  const [outputViewerTask, setOutputViewerTask] = useState<any | null>(null);
  const [outputViewerData, setOutputViewerData] = useState<any | null>(null);
  const [sourceAssignmentsByDate, setSourceAssignmentsByDate] = useState<Record<string, any[]>>({});
  const [sourceDaysByDate, setSourceDaysByDate] = useState<Record<string, any>>({});
  const [sourceAssignmentsLoading, setSourceAssignmentsLoading] = useState(false);
  const [sourceAssignmentsError, setSourceAssignmentsError] = useState<string | null>(null);
  

  const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—');
  const formatDayDetail = (d: string) => {
    try {
      const dt = new Date(d);
      return dt.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
    } catch (_) { return d; }
  };
  const toDateKey = (d: any) => {
    try {
      const dt = new Date(String(d).includes('T') ? d : `${d}T00:00:00`);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    } catch (_) {
      return String(d || '');
    }
  };

  const assignmentsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    (Array.isArray(assignments) ? assignments : []).forEach((row: any) => {
      const key = toDateKey(row?.date);
      if (!key) return;
      if (!map[key]) map[key] = [];
      map[key].push(row);
    });
    return map;
  }, [assignments]);

  const selectedDayAssignments = useMemo(() => {
    if (!selectedDayKey) return [];
    return assignmentsByDate[selectedDayKey] || [];
  }, [selectedDayKey, assignmentsByDate]);

  const dayDataByDate = useMemo(() => {
    const map: Record<string, any> = {};
    (Array.isArray(weeks) ? weeks : []).forEach((w: any) => {
      (Array.isArray(w?.days) ? w.days : []).forEach((d: any) => {
        const key = toDateKey(d?.date);
        if (!key) return;
        map[key] = d;
      });
    });
    return map;
  }, [weeks]);

  const selectedDayData = useMemo(() => {
    if (!selectedDayKey) return null;
    return dayDataByDate[selectedDayKey] || null;
  }, [selectedDayKey, dayDataByDate]);

  const selectedSourceAssignments = useMemo(() => {
    if (!selectedDayKey) return [];
    return sourceAssignmentsByDate[selectedDayKey] || [];
  }, [selectedDayKey, sourceAssignmentsByDate]);

  const selectedSourceDayData = useMemo(() => {
    if (!selectedDayKey) return null;
    return sourceDaysByDate[selectedDayKey] || null;
  }, [selectedDayKey, sourceDaysByDate]);

  const sourceKpiId = Number(kpi?.transfer_source_kpi_id || 0);
  const isTransferredKpi = sourceKpiId > 0;

  useEffect(() => {
    let mounted = true;
    const loadById = async (kid: string | number) => {
      const [res, assignRes, users] = await Promise.all([
        axios.get(`/api/kpis/${kid}`),
        axios.get(`/api/kpis/${kid}/assignments`).catch(() => ({ data: [] })),
        getUsersCached().catch(() => [])
      ]);
      if (!mounted) return;
      const data = res.data?.kpi ?? res.data;
      setKpi(data || null);
      setWeeks(res.data?.weeks || []);
      setAssignments(Array.isArray(assignRes?.data) ? assignRes.data : []);
      const userNameMap: Record<number, string> = {};
      (Array.isArray(users) ? users : []).forEach((u: any) => {
        const uid = Number(u?.user_id ?? u?.id ?? 0);
        if (!uid) return;
        userNameMap[uid] = u?.full_name || u?.name || u?.email || `${uid}`;
      });
      setUsersMap(userNameMap);
      setSelectedDayKey(null);
      setDayResultMessage(null);
      setSourceAssignmentsByDate({});
      setSourceDaysByDate({});
      setSourceAssignmentsError(null);
    };

    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (idToLoad) {
          await loadById(idToLoad as string | number);
        } else {
          const res = await axios.get('/api/kpis');
          const list = Array.isArray(res.data) ? res.data : res.data?.kpis ?? res.data?.items ?? [];
          if (list && list.length) {
            await loadById(list[0].chain_kpi_id);
          } else {
            setKpi(null);
            setWeeks([]);
          }
        }
      } catch (err: any) {
        setError(err?.response?.data?.message || err.message || 'Lỗi khi tải dữ liệu');
      } finally {
        setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [idToLoad]);

  useEffect(() => {
    let mounted = true;
    if (!isTransferredKpi || !sourceKpiId) {
      setSourceAssignmentsByDate({});
      setSourceDaysByDate({});
      setSourceAssignmentsError(null);
      setSourceAssignmentsLoading(false);
      return () => { mounted = false; };
    }

    (async () => {
      setSourceAssignmentsLoading(true);
      setSourceAssignmentsError(null);
      try {
        const [assignRes, detailRes] = await Promise.all([
          axios.get(`/api/kpis/${sourceKpiId}/assignments`),
          axios.get(`/api/kpis/${sourceKpiId}`).catch(() => ({ data: { weeks: [] } }))
        ]);
        if (!mounted) return;
        const rows = Array.isArray(assignRes?.data) ? assignRes.data : [];
        const map: Record<string, any[]> = {};
        rows.forEach((row: any) => {
          const key = toDateKey(row?.date);
          if (!key) return;
          if (!map[key]) map[key] = [];
          map[key].push(row);
        });
        setSourceAssignmentsByDate(map);

        const dayMap: Record<string, any> = {};
        const sourceWeeks = Array.isArray(detailRes?.data?.weeks) ? detailRes.data.weeks : [];
        sourceWeeks.forEach((w: any) => {
          (Array.isArray(w?.days) ? w.days : []).forEach((d: any) => {
            const key = toDateKey(d?.date);
            if (!key) return;
            dayMap[key] = d;
          });
        });
        setSourceDaysByDate(dayMap);
      } catch (err: any) {
        if (!mounted) return;
        setSourceAssignmentsByDate({});
        setSourceDaysByDate({});
        setSourceAssignmentsError(err?.response?.data?.message || 'Không tải được dữ liệu KPI nguồn.');
      } finally {
        if (mounted) setSourceAssignmentsLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [isTransferredKpi, sourceKpiId]);

  if (loading) return <div className="kpi-details">Đang tải...</div>;
  if (error) return <div className="kpi-details">Lỗi: {error}</div>;
  if (!kpi) return (
    <div style={{ padding: 20, background: '#fff', borderRadius: 10, marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 10, background: '#f8fbff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #dbeafe' }}>
          <span style={{ fontSize: 26 }}>🔎</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0b3b66' }}>Không tìm thấy KPI</div>
          <div style={{ marginTop: 6, color: '#4b5563' }}>Không có KPI nào khớp với lựa chọn hiện tại. Thử chọn phòng ban khác hoặc tạo KPI mới.</div>
        </div>
      </div>
    </div>
  );

  const metaStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 };
  const metaLeftStyle: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' };
  const metaItemStyle: React.CSSProperties = { padding: '6px 8px', borderRadius: 6, fontSize: 12, color: '#0369A1' };
  const tagStyle: React.CSSProperties = { ...metaItemStyle, background: '#E0F2FE', border: '1px solid #BAE6FD', color: '#0369A1' };


  const weekBoxBase: React.CSSProperties = { borderRadius: 6, padding: 10, marginBottom: 10, position: 'relative', background: '#ffffff', border: '1px solid #E0F2FE', paddingLeft: 20 };
  const leftBarStyle: React.CSSProperties = { position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, background: 'linear-gradient(to right,#BAE6FD,transparent)', pointerEvents: 'none' };
  const hrTopStyle: React.CSSProperties = { position: 'absolute', left: 0, right: 0, top: 0, height: 1, background: 'linear-gradient(to right,#BAE6FD,transparent)', opacity: 0.9, pointerEvents: 'none' };
  const hrBottomStyle: React.CSSProperties = { position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, background: 'linear-gradient(to right,#BAE6FD,transparent)', opacity: 0.9, pointerEvents: 'none' };
  const weekHeaderRow: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6, flexWrap: 'wrap' };
  const weekLabelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#075985' };
  const weekRangeStyle: React.CSSProperties = { fontSize: 12, color: '#0284C7' };
  const weekMetaStyle: React.CSSProperties = { display: 'flex', fontSize: 12, alignItems: 'center', justifyContent: 'space-between', gap: 8, color: '#0369A1', marginBottom: 6 };
  const daysGridStyle: React.CSSProperties = { display: 'grid', fontSize: 12, gridTemplateColumns: 'repeat(7,1fr)', gap: 5 };
  const dayBaseStyle: React.CSSProperties = { textAlign: 'center', padding: 6, borderRadius: 6, minHeight: 48, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer' };

  const getDayStyle = (completed: boolean, noTarget: boolean): React.CSSProperties => {
    if (completed) return { ...dayBaseStyle, background: '#d1fae5', color: '#065f46', border: '1px solid #bbf7d0' };
    if (noTarget) return { ...dayBaseStyle, background: '#f0f9ff', color: '#60a5fa', border: '1px solid #bfdbfe' };
    return { ...dayBaseStyle, background: '#eff6ff', color: '#075985', border: '1px solid #bae6fd' };
  };

  const placeholderDayStyle: React.CSSProperties = { ...dayBaseStyle, background: '#f8fafc', color: '#94a3b8', border: '1px dashed #e2e8f0', cursor: 'default' };
  const dayResultOverlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 1900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 };
  const dayResultPanelStyle: React.CSSProperties = { position: 'relative', width: 'min(820px,96vw)', maxHeight: '86vh', overflow: 'auto', borderRadius: 12, border: '1px solid #dbeafe', background: '#fff', boxShadow: '0 20px 50px rgba(2,6,23,0.3)' };

  const getStatusLabel = (status: string) => {
    const st = String(status || '').toLowerCase();
    if (st === 'completed') return 'Hoàn thành';
    if (st === 'review' || st === 'approving' || st === 'in_review') return 'Đang phê duyệt';
    if (st === 'doing' || st === 'in_progress') return 'Đang làm';
    return 'Chưa hoàn thành';
  };

  const openDayResults = (dayKey: string) => {
    setSelectedDayKey(dayKey);
    setDayResultMessage(null);
  };

  const openTaskOutputs = async (task: any, chainKpiOverride?: number) => {
    const chainKpiId = Number(chainKpiOverride || kpi?.chain_kpi_id || idToLoad || 0);
    const taskId = Number(task?.task_id || 0);
    if (!chainKpiId || !taskId) return;
    setOutputViewerLoading(true);
    setDayResultMessage(null);
    try {
      const res = await axios.get(`/api/kpis/${chainKpiId}/tasks/${taskId}/outputs`);
      const payload = res?.data || null;
      const albums = Array.isArray(payload?.albums) ? payload.albums : [];
      if (albums.length === 0) {
        setDayResultMessage('Nhân sự này chưa upload sản phẩm KPI.');
        return;
      }
      setOutputViewerTask(task);
      setOutputViewerData(payload);
      setOutputViewerOpen(true);
    } catch (e: any) {
      setDayResultMessage(e?.response?.data?.message || 'Không tải được sản phẩm KPI.');
    } finally {
      setOutputViewerLoading(false);
    }
  };

  // Helpers for week grouping (weeks start on Monday, end on Sunday)
  const toDateOnly = (d: string | Date) => {
    const dt = typeof d === 'string' ? new Date(d.includes('T') ? d : `${d}T00:00:00`) : new Date(d);
    return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  };
  const ymd = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const addDays = (dt: Date, n: number) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + n);

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

  // Xác định ngày bắt đầu/kết thúc toàn cục từ KPI hoặc từ dữ liệu ngày thực tế.
  let globalStart: Date | null = null;
  let globalEnd: Date | null = null;
  try {
    if (kpi?.start_date) globalStart = toDateOnly(kpi.start_date);
    if (kpi?.end_date) globalEnd = toDateOnly(kpi.end_date);
  } catch (_) { /* ignore */ }
  // Nếu thiếu mốc thời gian, dùng các ngày thực tế trong dữ liệu.
  const dayKeys = Object.keys(daysMap).sort();
  if (!globalStart && dayKeys.length) globalStart = toDateOnly(dayKeys[0]);
  if (!globalEnd && dayKeys.length) globalEnd = toDateOnly(dayKeys[dayKeys.length - 1]);

  const weekItems: Array<any> = [];
  if (globalStart && globalEnd && globalStart <= globalEnd) {
    let cursor = globalStart;
    let weekIndex = 0;

    while (cursor <= globalEnd) {
      // For the first block: from globalStart to nearest Sunday (inclusive)
      const dayOfWeek = cursor.getDay(); // 0 Sun .. 1 Mon .. 6 Sat
      let blockStart = cursor;
      let blockEnd: Date;

      if (weekIndex === 0) {
        // first week: start at globalStart, end at the upcoming Sunday
        const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
        blockEnd = addDays(blockStart, daysToSunday);
      } else {
        // subsequent weeks should start on Monday
        // ensure blockStart is Monday
        const startDOW = blockStart.getDay();
        if (startDOW !== 1) {
          // move forward to next Monday
          const offset = (8 - startDOW) % 7;
          blockStart = addDays(blockStart, offset);
        }
        blockEnd = addDays(blockStart, 6); // Monday + 6 = Sunday
      }

      if (blockEnd > globalEnd) blockEnd = globalEnd;

      // build a 7-slot week (Mon -> Sun). slots outside global range or without data are null placeholders
      // determine the Monday of the week that contains blockStart
      const bDayOfWeek = blockStart.getDay(); // 0..6
      const daysSinceMonday = bDayOfWeek === 0 ? 6 : bDayOfWeek - 1;
      const monday = addDays(blockStart, -daysSinceMonday);

      const days: Array<any | null> = [];
      for (let i = 0; i < 7; i += 1) {
        const d = addDays(monday, i);
        const key = ymd(d);
        // If date is outside overall data range, leave null (empty slot)
        if (!globalStart || !globalEnd || d < globalStart || d > globalEnd) {
          days.push(null);
          continue;
        }
        const src = daysMap[key];
        if (!src) {
          // within date range but no source data -> empty slot
          days.push(null);
          continue;
        }
        const target = Number(src.target_value || 0);
        const dayIsCompleted = Number(src.kpi_current || 0) >= target;
        const hasNoTarget = target === 0;
        days.push({
          key,
          target,
          dayIsCompleted,
          hasNoTarget,
          dayLabel: formatDayDetail(key),
          title: dayIsCompleted ? 'Đã hoàn thành' : hasNoTarget ? 'Chưa có KPI được phân bổ' : 'Chưa hoàn thành'
        });
      }

      weekItems.push({
        weekIndex,
        start_date: ymd(blockStart),
        end_date: ymd(blockEnd),
        weekTarget: Number((Array.isArray(days) ? days.reduce((s, di: any) => s + ((di && di.target) || 0), 0) : 0)) || 0,
        days
      });

      // advance cursor to the day after blockEnd
      cursor = addDays(blockEnd, 1);
      weekIndex += 1;
    }
  }

  return (
    <div style={{ borderRadius: 8, overflow: 'hidden', background: '#fff', boxShadow: '0 8px 30px rgba(2,6,23,0.06)', width: '100%', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 840 }}>
      <div style={{ padding: '16px', background: 'linear-gradient(90deg,#eef6ff,#e0f2ff)', borderBottom: '1px solid #e6eefc', position: 'relative' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#083344' }}>{Array.isArray(kpi.kpi_name) && kpi.kpi_name.length ? kpi.kpi_name.join(' • ') : (kpi.description ? kpi.description : '—')}</h2>
        {onToggleFullScreen ? (
          <button onClick={(e) => { e.stopPropagation(); onToggleFullScreen(); }} aria-label={isFullScreen ? 'Thu nhỏ' : 'Phóng to'} style={{ position: 'absolute', right: 12, top: 12, width: 36, height: 36, border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}}>
            <img src={isFullScreen ? '/image/minimizescreen_icon.png' : '/image/fullscreen_icon.png'} alt={isFullScreen ? 'Thu nhỏ' : 'Phóng to'} style={{ width: 50, height: 38 }} />
          </button>
        ) : null}
      </div>

      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <section style={metaStyle}>
          <div style={metaLeftStyle}>
            <div style={tagStyle}>Ngày bắt đầu: {formatDate(kpi.start_date)}</div>
            <div style={tagStyle}>Ngày kết thúc: {formatDate(kpi.end_date)}</div>
            <div style={tagStyle}>Tổng KPI: {kpi.total_kpi ?? '—'}</div>
            <div style={tagStyle}>Số ngày làm việc: {kpi.workdays_count ?? '—'}</div>
          </div>
        </section>

        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingRight: 8, paddingBottom: 12, display: 'block', minHeight: 0 }}>
          {weekItems.map(({ weekIndex, start_date, end_date, weekTarget, days }) => (
            <div key={weekIndex} style={weekBoxBase}>
              <div style={leftBarStyle} aria-hidden />
              <div style={hrTopStyle} aria-hidden />
              <div style={hrBottomStyle} aria-hidden />
              <div style={weekHeaderRow}>
                <div>
                  <span style={weekLabelStyle}>Tuần {weekIndex + 1}</span>
                  <div style={weekRangeStyle}>{formatDate(start_date)} - {formatDate(end_date)}</div>
                </div>
                <div style={weekMetaStyle}>
                  <span>Tổng KPI theo tuần: <strong style={{ fontWeight: 700 }}>{weekTarget} KPI</strong></span>
                </div>
              </div>
              <div style={daysGridStyle}>
                {days.map((day: any | null, idx: number) => (
                  day ? (
                    <div
                      key={day.key}
                      style={getDayStyle(day.dayIsCompleted, day.hasNoTarget)}
                      title={day.title}
                      onClick={() => openDayResults(day.key)}
                    >
                      <div style={{ fontWeight: 500, textAlign: 'center', lineHeight: '1.1' }}>{day.dayLabel}</div>
                      <div style={{ marginTop: 8, fontWeight: 700, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                        {day.dayIsCompleted && <span style={{ color: '#16a34a' }}>✓</span>}
                        {day.hasNoTarget ? <span style={{ color: '#dc2626' }}>⚠</span> : null}
                        <span>{day.target} KPI</span>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 10, fontWeight: 700, color: '#0369a1' }}>
                        {(assignmentsByDate[day.key]?.length || 0) > 0 ? `Sản phẩm: ${assignmentsByDate[day.key].length}` : 'Chưa có sản phẩm'}
                      </div>
                    </div>
                  ) : (
                    <div key={`empty-${idx}`} style={placeholderDayStyle} aria-hidden />
                  )
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedDayKey ? (
        <div style={dayResultOverlayStyle}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(2,6,23,0.55)' }} onClick={() => setSelectedDayKey(null)} />
          <div style={dayResultPanelStyle}>
            <div style={{ padding: 16, borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#0b3b66' }}>Kết quả KPI ngày {formatDate(selectedDayKey)}</div>
                <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>Admin xem sản phẩm KPI theo từng nhân sự đã được phân công.</div>
              </div>
              <button onClick={() => setSelectedDayKey(null)} style={{ border: '1px solid #bfdbfe', background: '#eff6ff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#0c4a6e', fontWeight: 700 }}>Đóng</button>
            </div>

            <div style={{ padding: 14, display: 'grid', gap: 10 }}>
              {!isTransferredKpi ? (
                selectedDayAssignments.length === 0 ? (
                  <div style={{ border: '1px dashed #cbd5e1', borderRadius: 10, padding: 14, color: '#64748b', fontSize: 13 }}>
                    Chưa có phân công KPI cho ngày này.
                  </div>
                ) : selectedDayAssignments.map((task: any) => {
                  const uid = Number(task?.assignee_user_id || 0);
                  const assigneeName = usersMap[uid] || `User ${uid}`;
                  return (
                    <div key={task.task_id} style={{ border: '1px solid #dbeafe', borderRadius: 10, background: '#f8fbff', padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0b3b66' }}>{assigneeName}</div>
                        <div style={{ marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: '#475569' }}>
                          <span>KPI phân công: <strong style={{ color: '#0f172a' }}>{Number(task?.assigned_kpi || 0)}</strong></span>
                          <span>Trạng thái: <strong style={{ color: '#0f172a' }}>{getStatusLabel(task?.status)}</strong></span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openTaskOutputs(task)}
                        disabled={outputViewerLoading}
                        style={{ border: '1px solid #60a5fa', background: '#dbeafe', color: '#1d4ed8', borderRadius: 8, padding: '8px 12px', fontWeight: 700, cursor: outputViewerLoading ? 'not-allowed' : 'pointer', opacity: outputViewerLoading ? 0.6 : 1 }}
                      >
                        {outputViewerLoading ? 'Đang tải...' : 'Xem sản phẩm'}
                      </button>
                    </div>
                  );
                })
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
                  <div style={{ border: '1px solid #fbcfe8', borderRadius: 10, background: '#fff1f7', padding: 12, display: 'grid', gap: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#9f1239' }}>Kết quả từ phòng ban cũ</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, color: '#7f1d1d' }}>
                      <span>KPI mục tiêu: <strong style={{ color: '#4c0519' }}>{Number(selectedSourceDayData?.target_value || selectedDayData?.target_value || 0)}</strong></span>
                      <span>KPI đã đạt: <strong style={{ color: '#4c0519' }}>{Number(selectedSourceDayData?.kpi_current || 0)}</strong></span>
                      <span>Trạng thái: <strong style={{ color: '#4c0519' }}>{Number(selectedSourceDayData?.target_value || selectedDayData?.target_value || 0) > 0 && Number(selectedSourceDayData?.kpi_current || 0) >= Number(selectedSourceDayData?.target_value || selectedDayData?.target_value || 0) ? 'Đã hoàn thành' : 'Chưa hoàn thành'}</strong></span>
                    </div>

                    {sourceAssignmentsLoading ? (
                      <div style={{ border: '1px dashed #f9a8d4', borderRadius: 8, padding: 10, color: '#9f1239', fontSize: 12 }}>
                        Đang tải chi tiết sản phẩm KPI nguồn...
                      </div>
                    ) : sourceAssignmentsError ? (
                      <div style={{ border: '1px dashed #fca5a5', borderRadius: 8, padding: 10, color: '#b91c1c', fontSize: 12 }}>
                        {sourceAssignmentsError}
                      </div>
                    ) : selectedSourceAssignments.length === 0 ? (
                      <div style={{ border: '1px dashed #f9a8d4', borderRadius: 8, padding: 10, color: '#9f1239', fontSize: 12 }}>
                        Chưa có bản ghi sản phẩm chi tiết từ phòng ban cũ cho ngày này.
                      </div>
                    ) : selectedSourceAssignments.map((task: any) => {
                      const uid = Number(task?.assignee_user_id || 0);
                      const assigneeName = usersMap[uid] || `User ${uid}`;
                      return (
                        <div key={`src-${task.task_id}`} style={{ border: '1px solid #f9a8d4', borderRadius: 8, background: '#fff', padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#831843' }}>{assigneeName}</div>
                            <div style={{ marginTop: 3, fontSize: 12, color: '#9f1239' }}>
                              KPI phân công: <strong style={{ color: '#4c0519' }}>{Number(task?.assigned_kpi || 0)}</strong> • Trạng thái: <strong style={{ color: '#4c0519' }}>{getStatusLabel(task?.status)}</strong>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => openTaskOutputs(task, sourceKpiId)}
                            disabled={outputViewerLoading}
                            style={{ border: '1px solid #f472b6', background: '#fce7f3', color: '#9f1239', borderRadius: 8, padding: '7px 10px', fontWeight: 700, cursor: outputViewerLoading ? 'not-allowed' : 'pointer', opacity: outputViewerLoading ? 0.6 : 1 }}
                          >
                            {outputViewerLoading ? 'Đang tải...' : 'Xem sản phẩm'}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ border: '1px solid #bfdbfe', borderRadius: 10, background: '#f0f9ff', padding: 12, display: 'grid', gap: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#075985' }}>KPI phòng ban mới (đang chờ thực hiện)</div>
                    {selectedDayAssignments.length === 0 ? (
                      <div style={{ border: '1px dashed #93c5fd', borderRadius: 8, padding: 10, color: '#0369a1', fontSize: 12 }}>
                        Chưa có nhân sự phòng ban mới upload sản phẩm cho ngày này.
                      </div>
                    ) : selectedDayAssignments.map((task: any) => {
                      const uid = Number(task?.assignee_user_id || 0);
                      const assigneeName = usersMap[uid] || `User ${uid}`;
                      return (
                        <div key={`dst-${task.task_id}`} style={{ border: '1px solid #93c5fd', borderRadius: 8, background: '#fff', padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#0b3b66' }}>{assigneeName}</div>
                            <div style={{ marginTop: 3, fontSize: 12, color: '#0369a1' }}>
                              KPI phân công: <strong style={{ color: '#0f172a' }}>{Number(task?.assigned_kpi || 0)}</strong> • Trạng thái: <strong style={{ color: '#0f172a' }}>{getStatusLabel(task?.status)}</strong>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => openTaskOutputs(task)}
                            disabled={outputViewerLoading}
                            style={{ border: '1px solid #60a5fa', background: '#dbeafe', color: '#1d4ed8', borderRadius: 8, padding: '7px 10px', fontWeight: 700, cursor: outputViewerLoading ? 'not-allowed' : 'pointer', opacity: outputViewerLoading ? 0.6 : 1 }}
                          >
                            {outputViewerLoading ? 'Đang tải...' : 'Xem sản phẩm'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {dayResultMessage ? (
                <div style={{ borderRadius: 8, padding: '8px 10px', border: '1px solid #fcd34d', background: '#fef9c3', color: '#92400e', fontSize: 12, fontWeight: 600 }}>
                  {dayResultMessage}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {outputViewerOpen && outputViewerTask && outputViewerData ? (
        <UploadModal
          onClose={() => {
            setOutputViewerOpen(false);
            setOutputViewerTask(null);
            setOutputViewerData(null);
          }}
          maxResults={Number(outputViewerTask?.assigned_kpi || 0)}
          taskId={Number(outputViewerTask?.task_id || 0) || undefined}
          chainKpiId={Number(kpi?.chain_kpi_id || idToLoad || 0) || undefined}
          mode="view"
          existing={outputViewerData}
          disableActions
        />
      ) : null}
    </div>
  );
};

export default KpiDetails;
