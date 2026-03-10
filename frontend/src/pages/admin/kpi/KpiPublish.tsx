import React, { useState, useRef, useEffect, useMemo } from 'react';
import { BsClock } from 'react-icons/bs';
import KpiPreview from './KpiPreview';
import { notify } from '../../../utils/notify';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../api/axios';

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

const currentYear = new Date().getFullYear();
const initialMonth = new Date().getMonth() + 1;

const formatLocalDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const countWorkdays = (start: Date, end: Date) => {
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

export default function KpiPublish() {
  const [selectedMonth, setSelectedMonth] = useState<number>(initialMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [items, setItems] = useState<Array<{ id: number; name: string; target: string }>>([
    { id: 1, name: '', target: '' }
  ]);
  const [description, setDescription] = useState<string>('');
  const [status] = useState<string>('draft');

  const { user } = useAuth();
  const [departments, setDepartments] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);

  const years = useMemo(() => Array.from({ length: 5 }, (_, i) => currentYear - 2 + i), []);

  // update row fields
  const updateRow = (id: number, field: 'name' | 'target', value: string) =>
    setItems(s => s.map(x => (x.id === id ? { ...x, [field]: value } : x)));

  const onPublish = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (items.length !== 1) return notify.error('Mỗi tháng chỉ được phép 1 KPI');

    // 1) Department must be selected
    if (!selectedDepartmentId && !user?.department_id) return notify.error('Vui lòng chọn phòng ban');

    // 2) Month/Year (start/end) validation
    if (!startDate || !endDate) return notify.error('Thời hạn bắt đầu và kết thúc không hợp lệ');
    if (+startDate > +endDate) return notify.error('Thời hạn bắt đầu phải trước hoặc bằng thời hạn kết thúc');

    // 3) Working days check
    if (workingDays <= 0) return notify.error('Thời hạn KPI phải có ít nhất một ngày làm việc');

    // 4) Validate each KPI row: require name and numeric positive target
    for (const it of items) {
      if (!String(it.name || '').trim()) return notify.error('Nội dung KPI không được để trống');
      const nameLen = String(it.name || '').trim().length;
      if (nameLen > 300) return notify.error('Nội dung KPI không được vượt quá 300 ký tự');

      if (!String(it.target || '').trim()) return notify.error('Mục tiêu KPI không được để trống');
      const num = Number(it.target);
      if (Number.isNaN(num) || !Number.isFinite(num) || num <= 0) return notify.error('Mục tiêu KPI phải là số dương');
    }

    // 5) Derived checks
    if (totalKPI <= 0) return notify.error('Tổng KPI phải lớn hơn 0');

    const start_iso = formatLocalDate(startDate);
    const end_iso = formatLocalDate(endDate);
    const workdays_count = workingDays;
    const payload = {
      start_date: start_iso,
      end_date: end_iso,
      description: description || null,
      department_id: selectedDepartmentId || user?.department_id || null,
      total_kpi: totalKPI,
      // include per-item KPI names only (backend stores names in kpi_name)
      kpi_name: items.map(it => String(it.name || '').trim()),
      workdays_count,
      status
    };

    try {
      const resp = await api.post('/api/kpis', payload);
      notify.success('Đã ban hành KPI', `KPI tháng ${selectedMonth}/${selectedYear} đã được lưu.`);
      console.log('chain-kpi created', resp.data);
      // reset form
      setItems([{ id: 1, name: '', target: '' }]);
      setDescription('');
    } catch (err: any) {
      console.error('publish failed', err);
      const msg = err?.response?.data?.message || 'Lỗi khi lưu KPI';
      notify.error('Lỗi', msg);
    }
  };

  // load departments
  React.useEffect(() => {
    let mounted = true;
    const loadDepartments = async () => {
      try {
        const res = await api.get('/api/departments');
        const list = Array.isArray(res.data) ? res.data : [];
        if (!mounted) return;
        setDepartments(list.map((d: any) => ({ id: d.id ?? d.department_id ?? d._id ?? d.id, name: d.name ?? d.department ?? String(d.id) })));
        if (user && user.department_id) setSelectedDepartmentId(user.department_id);
      } catch (e) {
        console.warn('Failed to load departments', e);
      }
    };
    loadDepartments();
    return () => { mounted = false; };
  }, [user]);

  const { startDate, endDate, totalCalendarWeeks, workingDays } = useMemo(() => {
    const start = new Date(selectedYear, selectedMonth - 1, 1);
    const end = new Date(selectedYear, selectedMonth, 0);
    const totalDays = Math.floor((+end - +start) / (1000 * 60 * 60 * 24)) + 1;
    const totalWeeks = Math.ceil(totalDays / 7);
    const workdays = countWorkdays(start, end);
    return { startDate: start, endDate: end, totalCalendarWeeks: totalWeeks, workingDays: workdays };
  }, [selectedMonth, selectedYear]);

  const parsedTarget = items.length > 0 ? Number(items[0].target) : NaN;
  const hasTargetNumber = !isNaN(parsedTarget) && parsedTarget > 0;
  const totalKPI = hasTargetNumber ? Math.floor(parsedTarget) : items.length;
  const dailyKpi = workingDays > 0 ? Math.ceil(totalKPI / workingDays) : 0;
  const weeklyKpi = totalCalendarWeeks > 0 ? Math.ceil(totalKPI / totalCalendarWeeks) : 0;
  const previewHasMonthInfo = !!(startDate && endDate);
  const previewHasDistribution = hasTargetNumber && items.length > 0;
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Dropdown component used for month/year to match FiltersBar style
    function MonthYearDropdown({ id, type, value, onChange, options }: { id: string; type: 'month' | 'year'; value: number; onChange: (v:number)=>void; options?: number[] }){
      const [hover, setHover] = useState<number | null>(null);
      const ref = useRef<HTMLDivElement | null>(null);

      useEffect(()=>{
        function onDoc(e: MouseEvent){ if(!ref.current) return; if(ref.current.contains(e.target as Node)) return; if(openDropdown === id) setOpenDropdown(null); }
        document.addEventListener('click', onDoc);
        return ()=>document.removeEventListener('click', onDoc);
      },[id, openDropdown]);

      const wrapStyle: React.CSSProperties = { position: 'relative', width: '100%' };
      const dropdownButton: React.CSSProperties = { padding: '8px 12px', borderRadius: 10, border: '1px solid #e6e7eb', background: '#fff', cursor: 'pointer', width: '100%', textAlign: 'left' };
      const menuStyle: React.CSSProperties = { position: 'absolute', top: 44, left: 0, background: '#fff', border: '1px solid #e6e7eb', borderRadius: 10, boxShadow: '0 8px 24px rgba(2,6,23,0.08)', zIndex: 50, maxHeight: 260, overflowY: 'auto', minWidth: '100%' };
      const itemStyle: React.CSSProperties = { display: 'block', width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer' };

      const opts = type === 'month' ? MONTH_OPTIONS : (options || []);
      const open = openDropdown === id;

      return (
        <div style={wrapStyle} ref={ref}>
          <button type="button" style={{ ...dropdownButton, boxShadow: open ? '0 8px 24px rgba(2,6,23,0.06)' : undefined }} onClick={(e)=>{ e.stopPropagation(); setOpenDropdown(open ? null : id); }}>
            {type === 'month' ? `Tháng ${value}` : value} ▾
          </button>
          {open && (
            <div role="menu" style={menuStyle}>
              {opts.map((opt)=> (
                <button key={opt} role="menuitem" onMouseEnter={()=>setHover(opt)} onMouseLeave={()=>setHover(null)} onClick={()=>{ onChange(opt); setOpenDropdown(null); }} style={{ ...itemStyle, background: hover === opt ? '#f3f6f9' : (opt === value ? '#eef2ff' : 'transparent'), color: opt === value ? '#2069d6' : '#0f1723' }}>
                  {type === 'month' ? `Tháng ${opt}` : String(opt)}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

  // Department dropdown styled like FiltersBar
  function DepartmentDropdown({ id, departments, value, onChange, placeholder, minWidth }: { id: string; departments: Array<{id:number;name:string}>; value: number | null; onChange: (v:number|null)=>void; placeholder?: string; minWidth?: number }){
    const [hover, setHover] = useState<number | 'none' | null>(null);
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(()=>{
      function onDoc(e: MouseEvent){ if(!ref.current) return; if(ref.current.contains(e.target as Node)) return; if(openDropdown === id) setOpenDropdown(null); }
      document.addEventListener('click', onDoc);
      return ()=>document.removeEventListener('click', onDoc);
    },[id, openDropdown]);

    const wrapStyle: React.CSSProperties = { position: 'relative', minWidth: minWidth || 160 };
    const dropdownButton: React.CSSProperties = { padding: '8px 12px', borderRadius: 10, border: '1px solid #e6e7eb', background: '#fff', cursor: 'pointer', width: '100%', textAlign: 'left' };
    const menuStyle: React.CSSProperties = { position: 'absolute', top: 44, left: 0, background: '#fff', border: '1px solid #e6e7eb', borderRadius: 10, boxShadow: '0 8px 24px rgba(2,6,23,0.08)', zIndex: 60, minWidth: minWidth || 160, maxHeight: 320, overflowY: 'auto' };
    const itemStyle: React.CSSProperties = { display: 'block', width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer' };

    const open = openDropdown === id;
    const label = value ? (departments.find(d=>d.id===value)?.name || String(value)) : (placeholder || 'Chọn');

    return (
      <div style={wrapStyle} ref={ref}>
        <button type="button" style={{ ...dropdownButton, boxShadow: open ? '0 8px 24px rgba(2,6,23,0.06)' : undefined }} onClick={(e)=>{ e.stopPropagation(); setOpenDropdown(open ? null : id); }}>
          {label} ▾
        </button>
        {open && (
          <div role="menu" style={menuStyle}>
            <button role="menuitem" onMouseEnter={()=>setHover('none')} onMouseLeave={()=>setHover(null)} onClick={()=>{ onChange(null); setOpenDropdown(null); }} style={{ ...itemStyle, background: hover === 'none' ? '#f3f6f9' : (value === null ? '#eef2ff' : 'transparent'), color: value === null ? '#2069d6' : '#0f1723' }}>
              {placeholder || '-- Chọn --'}
            </button>
            {departments.map(d => (
              <button key={d.id} role="menuitem" onMouseEnter={()=>setHover(d.id)} onMouseLeave={()=>setHover(null)} onClick={()=>{ onChange(d.id); setOpenDropdown(null); }} style={{ ...itemStyle, background: hover === d.id ? '#f3f6f9' : (value === d.id ? '#eef2ff' : 'transparent'), color: value === d.id ? '#2069d6' : '#0f1723' }}>
                {d.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
      <form onSubmit={onPublish} style={{ padding: 5, background: '#fff' }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #91b5fd', overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(90deg,#e6f2ff,#dbeafe)', padding: '20px 18px' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0b5ed7', display: 'flex', alignItems: 'center', gap: 8 }}><BsClock size={18} color="#2563eb" /> Thời Hạn KPI</h3>
          </div>

          <div style={{ padding: 16, display: 'grid', gap: 12 }}>

            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 1fr', gap: 12, alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Phòng ban <span style={{ color: '#ef4444' }}>*</span></label>
                <DepartmentDropdown
                  id="department"
                  departments={departments}
                  value={selectedDepartmentId}
                  onChange={(v)=>setSelectedDepartmentId(v)}
                  placeholder="-- Chọn phòng ban --"
                  minWidth={320}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Chọn Tháng <span style={{ color: '#ef4444' }}>*</span></label>
                <MonthYearDropdown
                  id="month"
                  type="month"
                  value={selectedMonth}
                  onChange={(v: number) => setSelectedMonth(v)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Chọn Năm <span style={{ color: '#ef4444' }}>*</span></label>
                <MonthYearDropdown
                  id="year"
                  type="year"
                  value={selectedYear}
                  onChange={(v: number) => setSelectedYear(v)}
                  options={years}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Ban hành KPI <span style={{ color: '#ef4444' }}>*</span></label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.slice(0, 1).map(it => (
                  <div key={it.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      placeholder="Nội dung KPI"
                      value={it.name}
                      onChange={e => updateRow(it.id, 'name', e.target.value)}
                      style={{ flex: 2, padding: '10px 12px', borderRadius: 10, border: '1px solid #dbeafe', background: '#fbfdff' }}
                    />
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        placeholder="Số lượng"
                        value={it.target}
                        onChange={e => updateRow(it.id, 'target', e.target.value)}
                        style={{ width: '100%', padding: '10px 12px', paddingRight: 56, borderRadius: 10, border: '1px solid #dbeafe', background: '#fbfdff' }}
                      />
                      <span aria-hidden style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#0b3b66', fontWeight: 700 }}>KPI</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

        <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Mô tả (tùy chọn)</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Mô tả ngắn về mục tiêu KPI" style={{ width: '100%', minHeight: 64, padding: 10, borderRadius: 8, border: '1px solid #dbeafe', background: '#fbfdff' }} />
        </div>
    
        {/* Duration Preview */}
            {/* Unified preview component */}
            <KpiPreview
              startDate={startDate}
              endDate={endDate}
              workingDays={workingDays}
              dailyKpi={dailyKpi}
              weeklyKpi={weeklyKpi}
              totalKPI={totalKPI}
              totalCalendarWeeks={totalCalendarWeeks}
              showMonthInfo={previewHasMonthInfo}
              showDistribution={previewHasDistribution}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="submit" style={{ padding: '10px 14px', borderRadius: 10, background: 'linear-gradient(135deg,#60a5fa,#2563eb)', color: '#fff', border: 'none', fontWeight: 700 }}>Lưu</button>
            </div>

          </div>
        </div>
      </form>
  );
}