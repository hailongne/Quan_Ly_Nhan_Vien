import React, { useEffect, useRef, useState } from 'react';
import api from '../../../../api/axios';
import { parseDepartmentDescription } from './DepartmentModal';
import { getUsersCached } from '../../../../utils/usersCache';
import { computeRemainingForPositions } from '../../../../utils/positions';
import { showToast } from '../../../../utils/toast';
import '../../../../styles/modal.css';
import '../../../../styles/toast.css';
import type { ApiUser } from '../types';

interface EditStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: ApiUser | null;
  onSaved?: (u: Partial<ApiUser>) => void | Promise<void>;
}

export default function EditStaffModal({ isOpen, onClose, user, onSaved }: EditStaffModalProps) {
  const [form, setForm] = useState<Partial<ApiUser>>({});
  const [departments, setDepartments] = useState<Array<{ id: number; name: string; description?: string | null }>>([]);
  const [positions, setPositions] = useState<Array<any>>([]);
  const [positionsLoading, setPositionsLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(isOpen);
  const [closing, setClosing] = useState<boolean>(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      const t = setTimeout(() => setMounted(false), 260);
      return () => clearTimeout(t);
    }
  }, [isOpen, mounted]);

  useEffect(() => {
    if (isOpen && user) {
      setForm({
        ...user,
        id: user.user_id ?? user.id,
      });
      if (user.department_id) loadPositionsForDept(user.department_id as number, user.department_position as string | undefined);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user]);

  useEffect(() => {
    if (!mounted) return;
    const node = overlayRef.current;
    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusables = Array.from(node?.querySelectorAll(focusableSelector) || []) as HTMLElement[];
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (first) first.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); requestClose(); }
      if (e.key === 'Tab') {
        if (focusables.length === 0) { e.preventDefault(); return; }
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    (async function loadDepartments() {
      try {
        const res = await api.get('/api/departments');
        const list = Array.isArray(res.data) ? res.data : [];
        setDepartments(list.map((d: any) => ({ id: d.id ?? d.department_id ?? d._id ?? d.id, name: (d.name ?? d.title ?? d.department) || String(d.id), description: d.description ?? null })));
      } catch (err) {
        console.warn('Failed to load departments', err);
        setDepartments([]);
      }
    })();
  }, [mounted]);

  if (!mounted) return null;

  function requestClose() {
    setClosing(true);
    setTimeout(() => { setMounted(false); onClose(); setClosing(false); }, 260);
  }

  function change<K extends keyof Partial<ApiUser>>(k: K, v: any) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  const computeRemaining = (p: any) => {
    const toNum = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    const capacity = toNum(p.capacity ?? p.limit ?? p.max_capacity ?? p.max);
    const rawCount = toNum(p.count ?? p.current_count ?? p.occupied ?? p.used);
    const adjustedCount = rawCount !== undefined ? Math.max(0, rawCount + 1) : undefined;
    const providedRemaining = toNum(p.remaining);

    if (providedRemaining !== undefined) return Math.max(0, providedRemaining);
    if (capacity !== undefined && adjustedCount !== undefined) return Math.max(0, capacity - adjustedCount);
    if (capacity !== undefined && adjustedCount === undefined) return Math.max(0, capacity);
    if (adjustedCount !== undefined && capacity === undefined) return 0;
    return 0;
  };

  async function loadPositionsForDept(deptId?: number, currentPosition?: string) {
    setPositions([]);
    if (!deptId) return;
    setPositionsLoading(true);
    try {
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

      let data: any[] = [];
      if (dept?.description) {
        const parsed = parseDepartmentDescription(dept.description);
        data = parsed.map((r: any, i: number) => ({ id: `parsed-${i}`, name: r.title, capacity: Number(r.quantity || 0) }));
      }

      // fetch current users to compute remaining counts per role
      const users = await getUsersCached();

      let normalized = computeRemainingForPositions(data, users as any[], deptId);

      // If no suggestions but we have a current position, include it so the UI doesn't show a warning
      const curPos = currentPosition || (form && form.department_position) || undefined;
      if ((!normalized || normalized.length === 0) && curPos) {
        normalized = [{ id: curPos, name: curPos, capacity: undefined, remaining: 1, count: 0 }];
      }

      setPositions(normalized);
    } catch (err) {
      console.warn('Failed to load positions for dept', deptId, err);
      setPositions([]);
    } finally {
      setPositionsLoading(false);
    }
  }

  const activeRoleOptions = (form.department ? positions.map((p: any) => {
    const title = p.name;
    const remaining = computeRemaining(p);

    const isCurrentSelection = !!(form.department_position && form.department_position === title);
    const disabled = remaining <= 0 && !isCurrentSelection;
    return { title, remaining, disabled, isCurrentSelection };
  }) : []);

  const normalizeDepartmentKey = (s: string) => String(s || '').replace(/\s+/g, '-').toLowerCase();
  const handleSelectRole = (title: string) => () => {
    if (!title) return;
    const opt = activeRoleOptions.find(o => o.title === title);
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

  function validateForm() {
    if (submitting) return false;
    if (!form.name || !String(form.name).trim()) { showToast('Vui lòng nhập họ và tên', 'error'); return false; }
    if (!form.username || !String(form.username).trim()) { showToast('Vui lòng nhập tài khoản (tên đăng nhập)', 'error'); return false; }
    if (!form.email || !String(form.email).trim()) { showToast('Vui lòng nhập email', 'error'); return false; }
    const email = String(form.email).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Email không hợp lệ', 'error'); return false; }
    if (form.password && !String(form.password).trim()) { showToast('Mật khẩu không hợp lệ', 'error'); return false; }
    if (!form.phone || !/^0\d{9}$/.test(String(form.phone))) { showToast('Vui lòng nhập số điện thoại (10 số và bắt đầu bằng 0)', 'error'); return false; }
    if (!form.department_id) { showToast('Vui lòng chọn phòng ban', 'error'); return false; }
    if (!form.department_position || !String(form.department_position).trim()) { showToast('Vui lòng chọn chức vụ phòng ban', 'error'); return false; }
    if (!form.work_shift_start || !form.work_shift_end) { showToast('Vui lòng nhập giờ bắt đầu và kết thúc ca', 'error'); return false; }
    if (!form.employment_status || !String(form.employment_status).trim()) { showToast('Vui lòng chọn trạng thái nhân viên', 'error'); return false; }
    if (!form.address || !String(form.address).trim()) { showToast('Vui lòng nhập địa chỉ', 'error'); return false; }
    if (!form.date_joined || !String(form.date_joined).trim()) { showToast('Vui lòng nhập ngày vào làm', 'error'); return false; }
    return true;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateForm()) return;
    const targetId = form.user_id ?? form.id;
    if (!targetId) { showToast('Thiếu thông tin nhân viên cần chỉnh sửa', 'error'); return; }
    try {
      setSubmitting(true);
      const res = await api.put(`/api/users/${targetId}`, form);
      showToast('Cập nhật nhân viên thành công', 'success');
      if (onSaved) {
        const maybe = onSaved(res.data as any);
        if ((maybe as any)?.then) await (maybe as Promise<any>);
      }
      setSubmitting(false);
      onClose();
    } catch (err) {
      console.warn('Failed to update user', err);
      setSubmitting(false);
      showToast((err as any)?.response?.data?.message || 'Cập nhật nhân viên thất bại', 'error');
    }
  }

  return (
    <div className={`modal-overlay ${closing ? 'modal-hide' : 'modal-show'}`} ref={overlayRef} onMouseDown={(e)=>{ if (e.target === overlayRef.current) requestClose(); }}>
      <div className={`modal-card ${closing ? 'card-exit' : 'card-enter'}`}>
        <div className="modal-header">
            <h3 className="modal-title">Điều chỉnh nhân viên</h3>
        </div>
        <div className="modal-body">
          <form ref={formRef} onSubmit={submit}>
            <div className="modal-form-grid">
              <div className="row-3">
                <div className="field">
                  <label className="field-label">Họ và tên</label>
                  <input placeholder="Họ và tên" value={form.name||''} onChange={e=>change('name', e.target.value)} />
                </div>
                <div className="field">
                  <label className="field-label">Tài khoản (tên đăng nhập)</label>
                  <input placeholder="Tài khoản (tên đăng nhập)" value={form.username||''} onChange={e=>change('username', e.target.value)} />
                </div>
                <div className="field">
                  <label className="field-label">Email</label>
                  <input placeholder="Email" type="email" value={form.email||''} onChange={e=>change('email', e.target.value)} />
                </div>
              </div>

              <div className="row-1">
                <div className="field">
                  <label className="field-label">Mật khẩu (để trống nếu giữ nguyên)</label>
                  <input placeholder="Mật khẩu (để trống nếu giữ nguyên)" type="text" value={form.password||''} onChange={e=>change('password', e.target.value)} />
                </div>
              </div>

              <div className="row-3">
                <div className="field">
                  <label className="field-label">Số điện thoại</label>
                  <input placeholder="Số điện thoại" value={form.phone||''} onChange={e=>change('phone', e.target.value)} />
                </div>
                <div className="field">
                  <label className="field-label">Địa chỉ</label>
                  <input placeholder="Địa chỉ" value={form.address||''} onChange={e=>change('address', e.target.value)} />
                </div>
                <div className="field">
                  <label className="field-label">Ngày vào làm</label>
                  <input type="date" value={form.date_joined ? (form.date_joined as string).split('T')[0] : ''} onChange={e=>change('date_joined', e.target.value)} />
                </div>
              </div>
                <div className="row-2">
                  <div className="field">
                    <label className="field-label">Giờ bắt đầu ca</label>
                    <input type="time" step={60} value={form.work_shift_start||''} onChange={e=>change('work_shift_start', e.target.value)} />
                  </div>
                  <div className="field">
                    <label className="field-label">Giờ kết thúc ca</label>
                    <input type="time" step={60} value={form.work_shift_end||''} onChange={e=>change('work_shift_end', e.target.value)} />
                  </div>
                </div>

              <div className="row-3">
                <div className="field">
                  <label className="field-label">Trạng thái nhân viên</label>
                  <select value={form.employment_status || ''} onChange={e=>change('employment_status', e.target.value)}>
                    <option value="">Chọn trạng thái</option>
                    <option value="contract">Hợp đồng</option>
                    <option value="official">Chính thức</option>
                    <option value="probation">Thử việc</option>
                    <option value="intern">Thực tập</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Phòng ban</label>
                  <select
                    value={form.department_id ?? ''}
                    onChange={e=>{
                      const v = e.target.value ? Number(e.target.value) : undefined;
                      change('department_id', v);
                      const deptName = departments.find(d=>d.id === v)?.name;
                      change('department', deptName);
                      change('department_position', undefined);
                      // Reset role when changing department unless current role is admin
                      if ((form && form.role) !== 'admin') change('role', 'user');
                      if (v) loadPositionsForDept(v);
                      else setPositions([]);
                    }}
                  >
                    <option value="">Chọn phòng ban</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Chức vụ phòng ban</label>
                  {form.department ? (
                    positionsLoading ? (
                      <p className="muted" style={{ marginTop: 6 }}>Đang tải...</p>
                    ) : activeRoleOptions.length ? (
                      <div className="positions-grid" style={{ marginTop: 8 }}>
                        {activeRoleOptions.map(option => (
                          <button
                            key={`department-role-${normalizeDepartmentKey(option.title)}`}
                            type="button"
                            onClick={handleSelectRole(option.title)}
                            disabled={option.disabled}
                            title={option.remaining > 0 ? `Còn ${option.remaining}` : option.isCurrentSelection ? 'Bạn đang giữ vị trí này' : 'Đã đủ số lượng'}
                            className={`position-option ${option.isCurrentSelection ? 'selected' : ''} ${option.disabled ? 'full' : ''}`}
                            style={{ fontSize: 12 }}
                          >
                            <span className="pos-name">{option.title}</span>
                            <span className="pos-count" style={{ fontSize: 10 }}>{`(còn ${option.remaining})`}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="muted" style={{ marginTop: 6 }}>Phòng ban chưa có chức vụ gợi ý. Hãy thêm trong phần Phòng ban.</p>
                    )
                  ) : (
                    <p className="muted" style={{ marginTop: 6 }}>Chọn phòng ban để hiển thị chức vụ gợi ý.</p>
                  )}

                  {form.department && form.department_position && !activeRoleOptions.some(o=>o.isCurrentSelection) ? (
                    <p className="muted" style={{ marginTop: 8, color: '#374151' }}>
                      Chức vụ hiện tại không còn trong danh sách gợi ý. Hãy chọn lại chức vụ phù hợp.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="row-1">
                <div className="field">
                  <label className="field-label">Ghi chú</label>
                  <textarea placeholder="Ghi chú" value={form.note||''} onChange={e=>change('note', e.target.value)} />
                </div>
              </div>

            </div>
          </form>
        </div>
        <div className="modal-footer">
          <button type="button" className="staff-btn" onClick={requestClose}>Hủy</button>
          <button
            type="button"
            className="table-add"
            disabled={submitting}
            onClick={() => { if (formRef.current && !submitting) { if (formRef.current.requestSubmit) formRef.current.requestSubmit(); else formRef.current.submit(); } }}
          >{submitting ? 'Đang lưu...' : 'Lưu'}</button>
        </div>
      </div>
    </div>
  );
}
