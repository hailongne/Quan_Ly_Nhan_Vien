import { useEffect, useState, useRef } from 'react';
import api from '../../../api/axios';
import { useAuth } from '../../../contexts/AuthContext';

type ChainKpiSummary = {
  chain_kpi_id: number;
  start_date: string | null;
  end_date: string | null;
  description?: string | null;
  kpi_name?: string[] | null;
  total_kpi?: number | null;
  workdays_count?: number | null;
  status?: string | null;
  department_id?: number | null;
  transfer_source_kpi_id?: number | null;
};

export default function LeaderKpiCardList({ transferredOnly = false }: { transferredOnly?: boolean }) {
  const { user } = useAuth();
  const leaderDeptId = (user as any)?.department_id ?? null;

  const [list, setList] = useState<ChainKpiSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deptName, setDeptName] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Lấy KPI theo phòng ban, quyền truy cập được kiểm soát từ backend.
        const res = await api.get('/api/kpis/department');
        const items = Array.isArray(res.data) ? res.data : res.data?.kpis ?? res.data?.items ?? [];
        if (!mounted) return;
        // Chỉ giữ KPI thuộc phòng ban của leader.
        const filtered = items.filter((it: any) => {
          if (!leaderDeptId) return false;
          const did = it.department_id ?? it.departmentId ?? it.department ?? null;
          if (Number(did) !== Number(leaderDeptId)) return false;
          const isTransferred = Number(it.transfer_source_kpi_id ?? 0) > 0;
          return transferredOnly ? isTransferred : !isTransferred;
        });
        setList(filtered);
      } catch (err: any) {
        setError(err?.response?.data?.message || err.message || 'Lỗi khi tải KPI');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [leaderDeptId]);

  useEffect(() => {
    const src = (user as any) ?? {};
    const name = src?.department?.name ?? src?.department_name ?? src?.departmentLabel ?? src?.department ?? null;
    setDeptName(name ? String(name) : null);
  }, [user]);

  // Tự chọn tháng/năm mặc định gần nhất khi dữ liệu đã tải xong.
  useEffect(() => {
    if (selectedMonth || !Array.isArray(list) || !list.length) return;
    try {
      const now = new Date();
      const curr = list.find((it: any) => it.start_date && (() => { const d = new Date(it.start_date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })());
      if (curr) {
        const cd = new Date(curr.start_date as string);
        setSelectedMonth(cd.getMonth() + 1);
        setSelectedYear(cd.getFullYear());
        return;
      }
      const dates = list.map((it: any) => it.start_date ? new Date(it.start_date) : null).filter(Boolean) as Date[];
      if (dates.length) {
        const now2 = new Date();
        const vnNow = new Date(now2.getTime() + (now2.getTimezoneOffset() * 60000) + 7 * 3600 * 1000);
        const monthsDiff = (a: Date, b: Date) => Math.abs((a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth()));
        let best = dates[0];
        let bestDiff = monthsDiff(vnNow, best);
        for (let i = 1; i < dates.length; i++) {
          const d = dates[i];
          const diff = monthsDiff(vnNow, d);
          if (diff < bestDiff) { best = d; bestDiff = diff; }
          else if (diff === bestDiff && d > best) { best = d; }
        }
        setSelectedMonth(best.getMonth() + 1);
        setSelectedYear(best.getFullYear());
      }
    } catch (_) {}
  }, [list, selectedMonth]);

  function AssignButton({ chain_kpi_id, onAssign }: { chain_kpi_id: number; onAssign: (id: number) => void }){
    const [hover, setHover] = useState(false);
    const base: React.CSSProperties = {
      padding: '6px 10px',
      borderRadius: 999,
      border: '1px solid #e6eefc',
      background: hover ? '#2563eb' : '#fff',
      color: hover ? '#fff' : '#2563eb',
      cursor: 'pointer',
      fontWeight: 700,
      fontSize: 13,
      boxShadow: hover ? '0 6px 14px rgba(37,99,235,0.12)' : undefined,
      transition: 'all 140ms ease'
    };
    return (
      <button
        type="button"
        aria-label="Phân công"
        onClick={(e) => { e.stopPropagation(); onAssign(chain_kpi_id); }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={base}
      >
        Phân công
      </button>
    );
  }

  function MonthYearDropdown({ id, type, value, onChange, options }: { id: string; type: 'month' | 'year'; value: number | null; onChange: (v:number|null)=>void; options?: number[] }){
    const [hover, setHover] = useState<number | null>(null);
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(()=>{
      function onDoc(e: MouseEvent){ if(!ref.current) return; if(ref.current.contains(e.target as Node)) return; if(openDropdown === id) setOpenDropdown(null); }
      document.addEventListener('click', onDoc);
      return ()=>document.removeEventListener('click', onDoc);
    },[id, openDropdown]);

    const wrapStyle: React.CSSProperties = { position: 'relative', minWidth: type === 'month' ? 120 : 120 };
    const dropdownButton: React.CSSProperties = { padding: '8px 12px', borderRadius: 10, border: '1px solid #e6e7eb', background: '#fff', cursor: 'pointer', minWidth: 120, textAlign: 'left' };
    const menuStyle: React.CSSProperties = { position: 'absolute', top: 44, left: 0, background: '#fff', border: '1px solid #e6e7eb', borderRadius: 10, boxShadow: '0 8px 24px rgba(2,6,23,0.08)', zIndex: 50, maxHeight: 260, overflowY: 'auto', minWidth: 120 };
    const itemStyle: React.CSSProperties = { display: 'block', width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer' };

    const monthOptions = Array.from({ length: 12 }, (_, i) => i+1);
    const opts = type === 'month' ? monthOptions : (options || []);
    const open = openDropdown === id;

    return (
      <div style={wrapStyle} ref={ref}>
        <button type="button" style={{ ...dropdownButton, boxShadow: open ? '0 8px 24px rgba(2,6,23,0.06)' : undefined }} onClick={(e)=>{ e.stopPropagation(); setOpenDropdown(open ? null : id); }}>
          {type === 'month' ? (value ? `Tháng ${value}` : 'Tháng') : (value ?? 'Năm')} ▾
        </button>
        {open && (
          <div role="menu" style={menuStyle}>
            <button role="menuitem" onMouseEnter={()=>setHover(null)} onMouseLeave={()=>setHover(null)} onClick={()=>{ onChange(null); setOpenDropdown(null); }} style={{ ...itemStyle, background: value === null ? '#eef2ff' : 'transparent', color: value === null ? '#2069d6' : '#0f1723' }}>
              Tất cả
            </button>
            {opts.map((opt)=> (
              <button key={opt} role="menuitem" onMouseEnter={()=>setHover(opt as number)} onMouseLeave={()=>setHover(null)} onClick={()=>{ onChange(opt as number); setOpenDropdown(null); }} style={{ ...itemStyle, background: hover === (opt as number) ? '#f3f6f9' : (opt === value ? '#eef2ff' : 'transparent'), color: opt === value ? '#2069d6' : '#0f1723' }}>
                {type === 'month' ? `Tháng ${opt}` : String(opt)}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
  // dropdown and other non-modal effects remain

  // listen for day updates from details modal and update list optimistically
  useEffect(() => {
    function onKpiDayUpdated(e: any) {
      const detail = e?.detail ?? {};
      const id = detail.chain_kpi_id;
      if (!id) return;
      const completedTotal = Number.isFinite(Number(detail.completedTotal)) ? Number(detail.completedTotal) : null;
      const completedFlag = !!detail.completed;
      setList(prev => prev.map(it => {
        if (Number(it.chain_kpi_id) !== Number(id)) return it;
        if (completedTotal !== null) {
          return { ...it, completed_days: completedTotal } as any;
        }
        const raw = (it as any).completed_days ?? (it as any).done_days ?? (it as any).completed ?? 0;
        const num = Number(raw) || 0;
        const delta = completedFlag ? 1 : -1;
        const next = Math.max(0, num + delta);
        return { ...it, completed_days: next } as any;
      }));
    }
    window.addEventListener('kpiDayUpdated', onKpiDayUpdated as EventListener);
    return () => window.removeEventListener('kpiDayUpdated', onKpiDayUpdated as EventListener);
  }, []);

  if (loading) return <div style={{ padding: 12 }}>Đang tải KPI...</div>;
  if (error) return <div style={{ padding: 12, color: '#b91c1c' }}>Lỗi: {error}</div>;
  if (!list || !list.length) return <div style={{ padding: 12 }}>{transferredOnly ? 'Chưa có KPI điều phối cho phòng ban của bạn.' : 'Không có KPI cho phòng ban của bạn.'}</div>;

  // filtered by selected month/year (if set)
  const filteredList = list.filter((it) => {
    if (!selectedMonth) return true;
    if (!it.start_date) return false;
    const d = new Date(it.start_date as string);
    return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
  });

  return (
    <div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <div style={{ marginBottom: 12, fontWeight: 700, color: '#0b3b66' }}>Phòng ban của bạn: <span style={{ fontWeight: 600, color: '#475569' }}>{deptName ?? '—'}</span></div>
            
            <MonthYearDropdown id="kpi-month" type="month" value={selectedMonth} onChange={(v) => {
            if (!v) { setSelectedMonth(null); setSelectedYear(null); return; }
            const candidates = list.filter(it => it.start_date).map(it => ({ d: new Date(it.start_date as string), item: it }));
            const matched = candidates.filter(c => (c.d.getMonth() + 1) === v);
            if (matched.length) {
                const latest = matched.reduce((a,b) => a.d > b.d ? a : b).d;
                setSelectedMonth(v);
                setSelectedYear(latest.getFullYear());
            } else {
                const now = new Date();
                setSelectedMonth(v);
                setSelectedYear(now.getFullYear());
            }
            }} />
        </div>
      {filteredList.length === 0 ? (
        <div style={{ padding: 12 }}>{transferredOnly ? 'Chưa có KPI điều phối cho phòng ban của bạn.' : 'Không có KPI cho phòng ban của bạn.'}</div>
      ) : (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
      {filteredList.map((k) => {
        const rawCompleted = (k as any).completed_days ?? (k as any).done_days ?? (k as any).completed;
        const completedNum = rawCompleted === null || rawCompleted === undefined || rawCompleted === '' ? 0 : Number(rawCompleted) || 0;
        const cardDeptId = (k as any).department_id ?? (k as any).departmentId ?? (k as any).dept_id ?? (k as any).department ?? null;
        const fallbackDept = (k as any).department_name ?? (k as any).department ?? (k as any).dept ?? (k as any).departmentId ?? null;
        const cardDeptName = typeof cardDeptId === 'number' ? (fallbackDept ?? deptName) : (fallbackDept ?? deptName);
        return (
        <div
          key={k.chain_kpi_id}
          role="button"
          tabIndex={0}
          onClick={() => window.dispatchEvent(new CustomEvent('assignKpi', { detail: { chain_kpi_id: k.chain_kpi_id } }))}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.dispatchEvent(new CustomEvent('assignKpi', { detail: { chain_kpi_id: k.chain_kpi_id } })); } }}
          style={{ cursor: 'pointer', background: '#fff', border: '1px solid #e6eefc', borderRadius: 10, padding: 14 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div style={{ fontWeight: 800, color: '#0b3b66' }}>{Array.isArray(k.kpi_name) && k.kpi_name.length ? k.kpi_name.join(' • ') : (k.description || 'KPI')}</div>
          </div>
          <div style={{ marginTop: 8, color: '#475569' }}>{k.start_date ? new Date(k.start_date).toLocaleDateString('vi-VN') : '—'} — {k.end_date ? new Date(k.end_date).toLocaleDateString('vi-VN') : '—'}</div>

          <div style={{ marginTop: 10, color: '#064e3b', fontSize: 13 }}>
            Hoàn thành: <strong>{completedNum}</strong> ngày / {k.workdays_count ?? 0} ngày làm việc
          </div>

          <div style={{ marginTop: 8, fontSize: 13, color: '#0b3b66' }}>
            Phòng ban phụ trách: <strong>{cardDeptName ?? '—'}</strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <div style={{ fontSize: 13, color: '#0b3b66' }}>Tổng: <strong>{k.total_kpi ?? '—'} KPI</strong></div>
            <div>
              <AssignButton chain_kpi_id={k.chain_kpi_id} onAssign={(id) => window.dispatchEvent(new CustomEvent('assignKpi', { detail: { chain_kpi_id: id } }))} />
            </div>
          </div>
        </div>
      )})}
      </div>
      )}
    </div>
  );
}
