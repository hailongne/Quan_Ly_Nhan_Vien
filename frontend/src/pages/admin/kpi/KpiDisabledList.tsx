import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../api/axios';

const GRID_STYLE: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 };
const CARD_STYLE: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, boxShadow: '0 10px 30px rgba(15,23,42,0.08)', display: 'flex', flexDirection: 'column', gap: 8 };
const TITLE_STYLE: React.CSSProperties = { fontWeight: 800, color: '#0b3b66', fontSize: 15, lineHeight: 1.3 };
const META_STYLE: React.CSSProperties = { fontSize: 12, color: '#475569' };
const BADGE_BASE: React.CSSProperties = { padding: '6px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, width: 'fit-content' };

const STATUS_BADGES: Record<string, { label: string; style: React.CSSProperties }> = {
  archived: { label: 'Đã vô hiệu hóa', style: { ...BADGE_BASE, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' } },
  closed: { label: 'Đã đóng', style: { ...BADGE_BASE, background: '#f8fafc', color: '#334155', border: '1px solid #e2e8f0' } },
  cancelled: { label: 'Đã hủy', style: { ...BADGE_BASE, background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecdd3' } },
  disabled: { label: 'Đã vô hiệu hóa', style: { ...BADGE_BASE, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' } },
};

const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—');

export default function KpiDisabledList() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get('/api/kpis');
        if (!mounted) return;
        const items = Array.isArray(res.data) ? res.data : res.data?.kpis ?? res.data?.items ?? [];
        setList(items);
      } catch (err: any) {
        if (mounted) setError(err?.response?.data?.message || 'Lỗi khi tải KPI');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const disabledItems = useMemo(() => {
    const disabledStatuses = new Set(['archived', 'closed', 'cancelled', 'disabled']);
    return list.filter((it) => disabledStatuses.has(String(it.status || '').toLowerCase()));
  }, [list]);

  if (loading) return <div style={{ padding: 12 }}>Đang tải KPI đã vô hiệu hóa...</div>;
  if (error) return <div style={{ padding: 12, color: '#b91c1c' }}>Lỗi: {error}</div>;
  if (!disabledItems.length) return <div style={{ padding: 12 }}>Không có KPI đã vô hiệu hóa.</div>;

  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: 14, border: '1px solid #e5e7eb' }}>
      <div style={{ marginBottom: 12, fontWeight: 700, color: '#0b3b66' }}>KPI đã vô hiệu hóa</div>
      <div style={GRID_STYLE}>
        {disabledItems.map((item) => {
          const badge = STATUS_BADGES[String(item.status || '').toLowerCase()] ?? { label: item.status || 'Đã vô hiệu hóa', style: { ...BADGE_BASE, background: '#eef2ff', color: '#1d4ed8', border: '1px solid #dbeafe' } };
          return (
            <div key={item.chain_kpi_id} style={CARD_STYLE}>
              <div style={TITLE_STYLE}>{Array.isArray(item.kpi_name) && item.kpi_name.length ? item.kpi_name.join(' • ') : (item.description || 'KPI')}</div>
              <div style={META_STYLE}>Ngày: {formatDate(item.start_date)} - {formatDate(item.end_date)}</div>
              <div style={META_STYLE}>Tổng KPI: {item.total_kpi ?? '—'} | Ngày làm việc: {item.workdays_count ?? '—'}</div>
              <div style={META_STYLE}>Phòng ban: {item.department_name ?? item.department ?? item.department_id ?? '—'}</div>
              <div style={badge.style}>{badge.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
