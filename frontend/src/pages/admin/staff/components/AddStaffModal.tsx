import React, { useState, useRef, useEffect } from 'react';
import api from '../../../../api/axios';
import { showToast } from '../../../../utils/toast';
import '../../../../styles/modal.css';
import '../../../../styles/toast.css';
import type { ApiUser } from "../types";
import { parseDepartmentDescription } from './DepartmentModal';

const initialFormState: Partial<ApiUser> = { role: 'user', employment_status: 'official', remaining_leave_days: 12, work_shift_start: '08:30', work_shift_end: '17:30' }

export default function AddStaffModal({ isOpen, onClose, onSubmit } : { isOpen: boolean; onClose: ()=>void; onSubmit?: (u: Partial<ApiUser>)=>Promise<any> | void }) {
  const [form, setForm] = useState<Partial<ApiUser>>(initialFormState);
  const [departments, setDepartments] = useState<Array<{ id: number; name: string; description?: string | null }>>([]);
  const [positions, setPositions] = useState<Array<any>>([]);
  const [positionsLoading, setPositionsLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const formRef = useRef<HTMLFormElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState<boolean>(isOpen);
  const [closing, setClosing] = useState<boolean>(false);

  const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(10,15,25,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 1200 };
  const modalStyle: React.CSSProperties = { width: 1200, maxWidth: '100%', background: '#ffffff', borderRadius: 12, boxSizing: 'border-box', boxShadow: '0 18px 40px rgba(2,6,23,0.06)', transform: closing ? 'translateY(8px) scale(0.995)' : 'translateY(0)', opacity: closing ? 0 : 1, transition: 'transform 220ms ease, opacity 220ms ease' };
  const headerStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '20px 16px', borderRadius: '10px 10px 0 0', background: 'linear-gradient(90deg, #e6f0ff 0%, #dbeafe 100%)' };
  const titleStyle: React.CSSProperties = { margin: 0, fontSize: 18, fontWeight: 700, color: '#0b3b66' };
  const labelStyle: React.CSSProperties = { display: 'block', marginBottom: 6, fontSize: 12, color: '#374151', fontWeight: 500, textAlign: 'left' };
  const inputBorder = '#60a5fa';
  const inputFocusBorder = '#2563eb';
  const inputBackground = '#fbfdff';
  const inputTransition = 'box-shadow .18s ease, border-color .12s ease';

  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${inputBorder}`, background: inputBackground, outline: 'none', fontSize: 14, transition: inputTransition };
  const smallInputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: `1px solid ${inputBorder}`, background: inputBackground, outline: 'none', fontSize: 14, transition: inputTransition };
  const textareaStyle: React.CSSProperties = { width: '100%', minHeight: 88, padding: '10px 12px', borderRadius: 8, border: `1px solid ${inputBorder}`, background: inputBackground, outline: 'none', fontSize: 14, transition: inputTransition };
  const buttonRowStyle: React.CSSProperties = { display: 'flex', gap: 8, justifyContent: 'flex-end', margin: 12 };
  const cancelBtn: React.CSSProperties = { padding: '8px 12px', borderRadius: 10, border: '1px solid #d1d5db', background: '#fff', color: '#0f172a', cursor: 'pointer' };
  const saveBtn: React.CSSProperties = { padding: '8px 14px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#4f46e5,#2563eb)', color: '#ffffff', cursor: 'pointer', fontWeight: 600 };
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const focusStyle: React.CSSProperties = { border: `1px solid ${inputFocusBorder}`, borderColor: inputFocusBorder, boxShadow: '0 6px 18px rgba(37,99,235,0.12)' };

  // sync mount state with external isOpen, allowing animation on close
  function requestClose(){
    // start closing animation; after it ends, notify parent
    setClosing(true);
    setTimeout(()=> { setMounted(false); setForm(initialFormState); onClose(); setClosing(false); }, 260);
  }

  useEffect(()=>{
    if(isOpen){ setMounted(true); setClosing(false); }
    else if(mounted){ setClosing(true); const t = setTimeout(()=> setMounted(false), 260); return ()=>clearTimeout(t); }
  },[isOpen, mounted]);

  useEffect(()=>{
    if(!mounted) return;
    const node = overlayRef.current;
    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusables = Array.from(node?.querySelectorAll(focusableSelector) || []) as HTMLElement[];
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if(first) first.focus();

    function onKey(e: KeyboardEvent){
      if(e.key === 'Escape') { e.preventDefault(); requestClose(); }
      if(e.key === 'Tab'){
        if(focusables.length === 0) { e.preventDefault(); return; }
        if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last?.focus(); }
        else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first?.focus(); }
      }
    }
    document.addEventListener('keydown', onKey);
    return ()=> document.removeEventListener('keydown', onKey);
  },[mounted]);

  useEffect(()=>{
    if(!mounted) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return ()=> { document.body.style.overflow = previous || ''; };
  },[mounted]);

  useEffect(()=>{
    if(!mounted) return;
    // fetch departments when modal opens
    (async function loadDepartments(){
      try{
        const res = await api.get('/api/departments');
        const list = Array.isArray(res.data) ? res.data : [];
        setDepartments(list.map((d: any) => ({ id: d.id ?? d.department_id ?? d._id ?? d.id, name: (d.name ?? d.title ?? d.department) || String(d.id), description: d.description ?? null })));
      }catch(err){
        console.warn('Failed to load departments', err);
        setDepartments([]);
      }
    })();
  },[mounted]);

  if(!mounted) return null;

  function change<K extends keyof Partial<ApiUser>>(k: K, v: any){
    setForm(prev=>({ ...prev, [k]: v }));
  }

  // fetch positions for a department id
  async function loadPositionsForDept(deptId?: number){
    setPositions([]);
    if (!deptId) return;
    setPositionsLoading(true);
    try{
      let dept = departments.find(d => d.id === deptId);
      if (!dept) {
        try {
          const dres = await api.get('/api/departments');
          const list = Array.isArray(dres.data) ? dres.data : [];
          setDepartments(list.map((d: any) => ({ id: d.id ?? d.department_id ?? d._id ?? d.id, name: (d.name ?? d.title ?? d.department) || String(d.id), description: d.description ?? null })));
          dept = list.find((x: any) => (x.id ?? x.department_id ?? x._id) === deptId || (x.department_id ?? x.id) === deptId);
        } catch (err) {
          // ignore
        }
      }

      let normalized: any[] = [];
      if (dept?.description) {
        const parsed = parseDepartmentDescription(dept.description);
        normalized = parsed.map((r: any) => ({ id: r.title, name: r.title, capacity: Number(r.quantity) || undefined }));
      }

      // If we have no explicit remaining/count info, compute remaining from capacity minus current staff count
      let deptUsers: any[] = [];
      try {
        const ures = await api.get('/api/users');
        const allUsers = Array.isArray(ures.data) ? ures.data : [];
        const deptName = dept?.name ?? undefined;
        deptUsers = allUsers.filter((u: any) => {
          if (typeof u.department_id !== 'undefined' && u.department_id !== null) return Number(u.department_id) === Number(deptId);
          if (typeof u.department !== 'undefined' && deptName) return String(u.department) === String(deptName);
          return false;
        });
      } catch (e) {
        // ignore user fetch errors, fall back to whatever data we have
        deptUsers = [];
      }

      // compute remaining for each position using capacity and current count
      normalized = normalized.map((p: any) => {
        const title = String(p.name || p.id || '');
        const capacity = Number(p.capacity ?? p.limit ?? p.max_capacity ?? p.max ?? p.quantity);
        const currentCount = deptUsers.filter(u => String((u.department_position || u.position || u.title) || '').trim() === title.trim()).length;
        const remaining = Number.isFinite(capacity) ? Math.max(0, capacity - currentCount) : (typeof p.remaining === 'number' ? p.remaining : undefined);
        return { ...p, remaining, capacity };
      });

      // If no suggestions but we have a current position (in form), include it so users don't see transient warning
      if ((!normalized || normalized.length === 0) && form.department_position) {
        normalized = [{ id: form.department_position, name: form.department_position, capacity: undefined, remaining: 1, count: 0 }];
      }

      setPositions(normalized);
    }catch(err){
      console.warn('Failed to load positions for dept', deptId, err);
      setPositions([]);
    }finally{
      setPositionsLoading(false);
    }
  }

  // normalize and prepare role options for UI
  const computeRemaining = (p:any) => {
    const toNum = (v:any) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    const capacity = toNum(p.capacity ?? p.limit ?? p.max_capacity ?? p.max);
    const rawCount = toNum(p.count ?? p.current_count ?? p.occupied ?? p.used);
    const adjustedCount = rawCount !== undefined ? Math.max(0, rawCount + 1) : undefined; // backend đếm từ 0 -> chuyển về số người thực
    const providedRemaining = toNum(p.remaining);

    if (providedRemaining !== undefined) return Math.max(0, providedRemaining);
    if (capacity !== undefined && adjustedCount !== undefined) return Math.max(0, capacity - adjustedCount);
    if (capacity !== undefined && adjustedCount === undefined) return Math.max(0, capacity);
    if (adjustedCount !== undefined && capacity === undefined) return 0; // no capacity info, avoid over-reporting
    return 0; // safest default
  };

  const activeRoleOptions = (form.department ? positions.map((p:any) => {
    const title = p.name;
    const remaining = computeRemaining(p);

    const isCurrentSelection = !!(form.department_position && form.department_position === title);
    const disabled = remaining <= 0 && !isCurrentSelection;
    return { title, remaining, disabled, isCurrentSelection };
  }) : []);

  const normalizeDepartmentKey = (s: string) => String(s || '').replace(/\s+/g, '-').toLowerCase();
  const handleSelectRole = (title: string) => () => {
    if (!title) return;
    const opt = activeRoleOptions.find(o=>o.title===title);
    if (opt?.disabled) return;
    change('department_position', title);
    const key = normalizeDepartmentKey(title);
    // map common department position titles to roles
    if (key === 'truong-phong' || /truong|trưởng/i.test(title)) {
      change('role', 'leader');
    } else if (key === 'admin' || /qu?n tr[iị]nh|quản trị/i.test(title)) {
      change('role', 'admin');
    } else {
      change('role', 'user');
    }
  };

  function validateForm(){
    if (submitting) return false;
    if (!form.name || !String(form.name).trim()) { showToast('Vui lòng nhập họ và tên', 'error'); return false; }
    if (!form.username || !String(form.username).trim()) { showToast('Vui lòng nhập tài khoản (tên đăng nhập)', 'error'); return false; }
    if (!form.email || !String(form.email).trim()) { showToast('Vui lòng nhập email', 'error'); return false; }
    const email = String(form.email).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Email không hợp lệ', 'error'); return false; }
    if (!form.password || !String(form.password).trim()) { showToast('Vui lòng nhập mật khẩu', 'error'); return false; }
    if (!form.phone || !/^0\d{9}$/.test(String(form.phone))) { showToast('Vui lòng nhập số điện thoại (10 số và bắt đầu bằng 0)', 'error'); return false; }
    if (!form.department_id) { showToast('Vui lòng chọn phòng ban', 'error'); return false; }
    if (!form.department_position || !String(form.department_position).trim()) { showToast('Vui lòng chọn chức vụ phòng ban', 'error'); return false; }
    if (!form.work_shift_start || !form.work_shift_end) { showToast('Vui lòng nhập giờ bắt đầu và kết thúc ca', 'error'); return false; }
    if (!form.employment_status || !String(form.employment_status).trim()) { showToast('Vui lòng chọn trạng thái nhân viên', 'error'); return false; }
    if (!form.address || !String(form.address).trim()) { showToast('Vui lòng nhập địa chỉ', 'error'); return false; }
    if (!form.date_joined || !String(form.date_joined).trim()) { showToast('Vui lòng nhập ngày vào làm', 'error'); return false; }
    return true;
  }

  async function submit(e: React.FormEvent){
    e.preventDefault();
    if (!validateForm()) return;
    try{
      setSubmitting(true);
      const res = await api.post('/api/users', form);
      console.log('User created', res.data);
      showToast('Tạo nhân viên thành công', 'success');
      if (onSubmit) { const maybe = onSubmit(res.data as any); if ((maybe as any)?.then) await (maybe as Promise<any>); }
      setSubmitting(false);
      setForm(initialFormState);
      onClose();
    }catch(err){
      console.warn('Failed to create user', err);
      setSubmitting(false);
      showToast((err as any)?.response?.data?.message || 'Tạo nhân viên thất bại', 'error');
    }
  }


  return (
    <div ref={overlayRef} onMouseDown={(e) => { if (e.target === overlayRef.current) requestClose(); }} style={overlayStyle}>
      <div style={modalStyle} role="dialog" aria-modal="true">
        <div style={headerStyle}>
          <h3 style={titleStyle}>Thêm nhân viên mới</h3>
        </div>

        <div>
          <form ref={formRef} onSubmit={submit} style= {{ padding: '0 25px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Họ và tên</label>
                <input placeholder="Họ và tên" value={form.name||''} onChange={e=>change('name', e.target.value)} onFocus={()=>setFocusedField('name')} onBlur={()=>setFocusedField(null)} style={{ ...inputStyle, ...(focusedField === 'name' ? focusStyle : {}) }} />
              </div>
              <div>
                <label style={labelStyle}>Tài khoản (tên đăng nhập)</label>
                <input placeholder="Tài khoản (tên đăng nhập)" value={form.username||''} onChange={e=>change('username', e.target.value)} onFocus={()=>setFocusedField('username')} onBlur={()=>setFocusedField(null)} style={{ ...inputStyle, ...(focusedField === 'username' ? focusStyle : {}) }} />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input placeholder="Email" type="email" value={form.email||''} onChange={e=>change('email', e.target.value)} onFocus={()=>setFocusedField('email')} onBlur={()=>setFocusedField(null)} style={{ ...inputStyle, ...(focusedField === 'email' ? focusStyle : {}) }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginTop: 12 }}>
              <div>
                <label style={labelStyle}>Mật khẩu</label>
                <input placeholder="Mật khẩu" type="text" value={form.password||''} onChange={e=>change('password', e.target.value)} onFocus={()=>setFocusedField('password')} onBlur={()=>setFocusedField(null)} style={{ ...inputStyle, ...(focusedField === 'password' ? focusStyle : {}) }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
              <div>
                <label style={labelStyle}>Số điện thoại</label>
                <input placeholder="Số điện thoại" value={form.phone||''} onChange={e=>change('phone', e.target.value)} onFocus={()=>setFocusedField('phone')} onBlur={()=>setFocusedField(null)} style={{ ...inputStyle, ...(focusedField === 'phone' ? focusStyle : {}) }} />
              </div>
              <div>
                <label style={labelStyle}>Địa chỉ</label>
                <input placeholder="Địa chỉ" value={form.address||''} onChange={e=>change('address', e.target.value)} onFocus={()=>setFocusedField('address')} onBlur={()=>setFocusedField(null)} style={{ ...inputStyle, ...(focusedField === 'address' ? focusStyle : {}) }} />
              </div>
              <div>
                <label style={labelStyle}>Ngày vào làm</label>
                <input type="date" value={form.date_joined ? (form.date_joined as string).split('T')[0] : ''} onChange={e=>change('date_joined', e.target.value)} onFocus={()=>setFocusedField('date_joined')} onBlur={()=>setFocusedField(null)} style={{ ...smallInputStyle, ...(focusedField === 'date_joined' ? focusStyle : {}) }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              <div>
                <label style={labelStyle}>Giờ bắt đầu ca</label>
                <input type="time" step={60} value={form.work_shift_start||''} onChange={e=>change('work_shift_start', e.target.value)} onFocus={()=>setFocusedField('work_shift_start')} onBlur={()=>setFocusedField(null)} style={{ ...smallInputStyle, ...(focusedField === 'work_shift_start' ? focusStyle : {}) }} />
              </div>
              <div>
                <label style={labelStyle}>Giờ kết thúc ca</label>
                <input type="time" step={60} value={form.work_shift_end||''} onChange={e=>change('work_shift_end', e.target.value)} onFocus={()=>setFocusedField('work_shift_end')} onBlur={()=>setFocusedField(null)} style={{ ...smallInputStyle, ...(focusedField === 'work_shift_end' ? focusStyle : {}) }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
              <div>
                <label style={labelStyle}>Trạng thái nhân viên</label>
                <select value={form.employment_status} onChange={e=>change('employment_status', e.target.value)} onFocus={()=>setFocusedField('employment_status')} onBlur={()=>setFocusedField(null)} style={{ ...smallInputStyle, ...(focusedField === 'employment_status' ? focusStyle : {}) }}>
                  <option value="contract">Hợp đồng</option>
                  <option value="official">Chính thức</option>
                  <option value="probation">Thử việc</option>
                  <option value="intern">Thực tập</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Phòng ban</label>
                <select
                  value={form.department_id ?? ''}
                  onChange={e=>{
                    const v = e.target.value ? Number(e.target.value) : undefined;
                    change('department_id', v);
                    const deptName = departments.find(d=>d.id === v)?.name;
                    change('department', deptName);
                    change('department_position', undefined);
                    // Reset role when changing department
                    change('role', 'user');
                    if (v) loadPositionsForDept(v);
                    else setPositions([]);
                  }}
                  onFocus={()=>setFocusedField('department_id')}
                  onBlur={()=>setFocusedField(null)}
                  style={{ ...smallInputStyle, ...(focusedField === 'department_id' ? focusStyle : {}) }}
                >
                  <option value="">Chọn phòng ban</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Chức vụ phòng ban</label>
                {form.department ? (
                  positionsLoading ? (
                    <p style={{ marginTop: 6 }}>Đang tải...</p>
                  ) : activeRoleOptions.length ? (
                    <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {activeRoleOptions.map(option => (
                        <button
                          key={`department-role-${normalizeDepartmentKey(option.title)}`}
                          type="button"
                          onClick={handleSelectRole(option.title)}
                          disabled={option.disabled}
                          title={option.remaining > 0 ? `Còn lại ${option.remaining}` : option.isCurrentSelection ? 'Bạn đang giữ vị trí này' : 'Đã đủ số lượng'}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 999,
                            cursor: option.disabled ? 'not-allowed' : 'pointer',
                            ...(option.disabled ? { border: '1px solid #e6e7eb', background: '#f8fafc', color: '#94a3b8' } : { border: '1px solid #c7d2fe', background: '#eef2ff', color: '#0f172a' }),
                            ...(option.isCurrentSelection ? { border: `1px solid ${inputFocusBorder}`, boxShadow: focusStyle.boxShadow as any, background: '#eef6ff', color: '#07103a' } : {})
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{option.title}</span>
                          <span style={{ fontSize: 11, marginLeft: 8, color: '#6b7280' }}>{`(còn lại ${option.remaining})`}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p style={{ marginTop: 6 }}>Phòng ban chưa có chức vụ gợi ý. Hãy thêm trong phần Phòng ban.</p>
                  )
                ) : (
                  <p style={{ marginTop: 6 }}>Chọn phòng ban để hiển thị chức vụ gợi ý.</p>
                )}

                {form.department && form.department_position && !activeRoleOptions.some(o=>o.isCurrentSelection) ? (
                  <p style={{ marginTop: 8, color: '#374151' }}>
                    Chức vụ hiện tại không còn trong danh sách gợi ý. Hãy chọn lại chức vụ phù hợp.
                  </p>
                ) : null}
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
                <label style={labelStyle}>Ghi chú</label>
              <textarea placeholder="Ghi chú" value={form.note||''} onChange={e=>change('note', e.target.value)} onFocus={()=>setFocusedField('note')} onBlur={()=>setFocusedField(null)} style={{ ...textareaStyle, ...(focusedField === 'note' ? focusStyle : {}) }} />
            </div>

            <div style={buttonRowStyle}>
              <button type="button" onClick={requestClose} style={cancelBtn}>Hủy</button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => { if (formRef.current && !submitting) { if (formRef.current.requestSubmit) formRef.current.requestSubmit(); else formRef.current.submit(); } }}
                style={saveBtn}
              >{submitting ? 'Đang lưu...' : 'Lưu'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
