import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from '../../../api/axios';

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
  total_kpi: number | null;
  workdays_count: number | null;
  status: string | null;
};

type Props = { initialId?: string | number | null; isFullScreen?: boolean; onToggleFullScreen?: () => void };

const LeaderKpiDetails: React.FC<Props> = ({ initialId = null, isFullScreen = false, onToggleFullScreen }) => {
  const params = useParams();
  const routeId = (params as any)?.id ?? null;
  const idToLoad = initialId ?? routeId;
  const [kpi, setKpi] = useState<ChainKpi | null>(null);
  const [weeks, setWeeks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—');
  const formatDayDetail = (d: string) => {
    try {
      const dt = new Date(d);
      return dt.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
    } catch (_) { return d; }
  };

  useEffect(() => {
    let mounted = true;
    const loadById = async (kid: string | number) => {
      const res = await axios.get(`/api/kpis/${kid}`);
      if (!mounted) return;
      const data = res.data?.kpi ?? res.data;
      setKpi(data || null);
      setWeeks(res.data?.weeks || []);
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
  const dayKeys = Object.keys(daysMap).sort();
  if (!globalStart && dayKeys.length) globalStart = toDateOnly(dayKeys[0]);
  if (!globalEnd && dayKeys.length) globalEnd = toDateOnly(dayKeys[dayKeys.length - 1]);

  const weekItems: Array<any> = [];
  if (globalStart && globalEnd && globalStart <= globalEnd) {
    let cursor = globalStart;
    let weekIndex = 0;

    while (cursor <= globalEnd) {
      const dayOfWeek = cursor.getDay(); // 0 Sun .. 1 Mon .. 6 Sat
      let blockStart = cursor;
      let blockEnd: Date;

      if (weekIndex === 0) {
        const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
        blockEnd = addDays(blockStart, daysToSunday);
      } else {
        const startDOW = blockStart.getDay();
        if (startDOW !== 1) {
          const offset = (8 - startDOW) % 7;
          blockStart = addDays(blockStart, offset);
        }
        blockEnd = addDays(blockStart, 6);
      }

      if (blockEnd > globalEnd) blockEnd = globalEnd;

      // build a 7-slot week (Mon -> Sun). slots outside global range or without data are null placeholders
      const bDayOfWeek = blockStart.getDay();
      const daysSinceMonday = bDayOfWeek === 0 ? 6 : bDayOfWeek - 1;
      const monday = addDays(blockStart, -daysSinceMonday);

      const days: Array<any | null> = [];
      for (let i = 0; i < 7; i += 1) {
        const d = addDays(monday, i);
        const key = ymd(d);
        if (!globalStart || !globalEnd || d < globalStart || d > globalEnd) {
          days.push(null);
          continue;
        }
        const src = daysMap[key];
        if (!src) { days.push(null); continue; }
        const target = Number(src.target_value || 0);
        const dayIsCompleted = Number(src.kpi_current || 0) >= target;
        const hasNoTarget = target === 0;
        days.push({ key, target, dayIsCompleted, hasNoTarget, dayLabel: formatDayDetail(key), title: dayIsCompleted ? 'Đã hoàn thành' : hasNoTarget ? 'Chưa có KPI được phân bổ' : 'Chưa hoàn thành' });
      }

      weekItems.push({ weekIndex, start_date: ymd(blockStart), end_date: ymd(blockEnd), weekTarget: Number((Array.isArray(days) ? days.reduce((s, di: any) => s + ((di && di.target) || 0), 0) : 0)) || 0, days });

      cursor = addDays(blockEnd, 1);
      weekIndex += 1;
    }
  }


  return (
    <div style={{ borderRadius: 8, overflow: 'hidden', background: '#fff', boxShadow: '0 8px 30px rgba(2,6,23,0.06)', width: '100%', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px', background: 'linear-gradient(90deg,#eef6ff,#e0f2ff)', borderBottom: '1px solid #e6eefc', position: 'relative' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#083344' }}>{Array.isArray(kpi.kpi_name) && kpi.kpi_name.length ? kpi.kpi_name.join(' • ') : (kpi.description ? kpi.description : '—')}</h2>
        {onToggleFullScreen ? (
          <button onClick={(e) => { e.stopPropagation(); onToggleFullScreen(); }} aria-label={isFullScreen ? 'Thu nhỏ' : 'Phóng to'} style={{ position: 'absolute', right: 12, top: 12, width: 36, height: 36, border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}}>
            <img src={isFullScreen ? '/image/minimizescreen_icon.png' : '/image/fullscreen_icon.png'} alt={isFullScreen ? 'Thu nhỏ' : 'Phóng to'} style={{ width: 50, height: 38 }} />
          </button>
        ) : null}
      </div>

      <div style={{ padding: 12 }}>
        <section style={metaStyle}>
          <div style={metaLeftStyle}>
            <div style={tagStyle}>Ngày bắt đầu: {formatDate(kpi.start_date)}</div>
            <div style={tagStyle}>Ngày kết thúc: {formatDate(kpi.end_date)}</div>
            <div style={tagStyle}>Tổng KPI: {kpi.total_kpi ?? '—'}</div>
            <div style={tagStyle}>Số ngày làm việc: {kpi.workdays_count ?? '—'}</div>
          </div>
        </section>

        <div style={{ flex: 1, overflow: 'hidden', paddingRight: 8, display: 'block' }}>
          {weekItems.map(({ weekIndex, start_date, end_date, weekTarget, days }) => {
            return (
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
                        style={{ ...getDayStyle(day.dayIsCompleted, day.hasNoTarget) }}
                        title={day.dayIsCompleted ? 'Đã hoàn thành' : day.hasNoTarget ? 'Chưa có KPI được phân bổ' : 'Chưa hoàn thành'}
                      >
                        <div style={{ fontWeight: 500, textAlign: 'center', lineHeight: '1.1' }}>{day.dayLabel}</div>
                        <div style={{ marginTop: 8, fontWeight: 700, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                          {day.dayIsCompleted && <span style={{ color: '#16a34a' }}>✓</span>}
                          {day.hasNoTarget ? <span style={{ color: '#dc2626' }}>⚠</span> : null}
                          <span>{day.target} KPI</span>
                        </div>
                      </div>
                    ) : (
                      <div key={`empty-${weekIndex}-${idx}`} style={placeholderDayStyle} aria-hidden />
                    )
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LeaderKpiDetails;
