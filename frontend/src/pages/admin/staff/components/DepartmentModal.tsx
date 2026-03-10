import React, { useEffect, useMemo, useState } from 'react';
import { confirm } from '../../../../utils/confirm';
import { showToast } from '../../../../utils/toast';

export interface DepartmentRoleRow { title: string; quantity: string; }
export interface DepartmentModalValues { name: string; roles: DepartmentRoleRow[]; }
export interface DepartmentOption {
  department_id?: number;
  name: string;
  description?: string | null;
  employee_count?: number;
}
export interface DepartmentSubmitPayload { name: string; roles: DepartmentRoleRow[]; }

export const MANAGER_ROLE_TITLE = 'Trưởng phòng';
export const MANAGER_ROLE_QUANTITY = '1';
export const MANAGER_ROLE_KEY = 'truong-phong';

const emptyRoleRow: DepartmentRoleRow = { title: '', quantity: '' };

const cloneValues = (values: DepartmentModalValues): DepartmentModalValues => ({
  name: values.name,
  roles: values.roles.map(role => ({ ...role }))
});

const stripDiacritics = (value: string) => value
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase()
  .trim();

export function normalizeDepartmentKey(value: string) {
  const cleaned = stripDiacritics(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return cleaned || 'role';
}

export function ensureMinRoleRows(roles: DepartmentRoleRow[]): DepartmentRoleRow[] {
  const safe = roles.filter(Boolean).map(role => ({ ...role }));
  const managerIdx = safe.findIndex(role => normalizeDepartmentKey(role.title) === MANAGER_ROLE_KEY);
  const managerRow: DepartmentRoleRow = { title: MANAGER_ROLE_TITLE, quantity: MANAGER_ROLE_QUANTITY };
  if (managerIdx >= 0) {
    safe.splice(managerIdx, 1);
  }
  safe.unshift(managerRow);
  if (!safe.slice(1).length) safe.push({ ...emptyRoleRow });
  return safe;
}

export function parseDepartmentDescription(desc?: string | null): DepartmentRoleRow[] {
  if (!desc) return [];
  try {
    const parsed = JSON.parse(desc);
    if (Array.isArray(parsed)) {
      return parsed
        .map(item => ({ title: String(item.title ?? item.name ?? ''), quantity: String(item.quantity ?? item.count ?? '') }))
        .filter(role => role.title || role.quantity);
    }
  } catch (err) {
    // Nếu không khớp định dạng chính thì thử các định dạng cũ bên dưới.
  }
  // Hỗ trợ các định dạng chuỗi chức vụ cũ như "Title:1", "Title - 1", "Title · 1".
  const chunks = String(desc).split(/[,;\n]+/).map(part => part.trim()).filter(Boolean);
  return chunks.map(chunk => {
    // split by common separators: colon, dash, hyphen, en/em dashes, middle dot, bullet, or pipe
    const parts = chunk.split(/[:|\-–—\u00B7\u2022·]/).map(part => part.trim()).filter(Boolean);
    const title = parts[0] ?? chunk;
    const quantity = parts[1] ?? '';
    return { title, quantity };
  });
}

export function createEmptyDepartmentValues(): DepartmentModalValues {
  return { name: '', roles: ensureMinRoleRows([ { title: MANAGER_ROLE_TITLE, quantity: MANAGER_ROLE_QUANTITY }, { ...emptyRoleRow } ]) };
}

interface DepartmentModalProps {
  open: boolean;
  submitting: boolean;
  initialValues: DepartmentModalValues;
  onSubmit: (payload: DepartmentSubmitPayload, departmentId?: number) => Promise<void> | void;
  onClose: () => void;
  departments: DepartmentOption[];
  loadingDepartments: boolean;
  onReloadDepartments: () => Promise<void> | void;
  onDeleteDepartment?: (departmentId: number) => Promise<void> | void;
}

export default function DepartmentModal({
  open,
  submitting,
  initialValues,
  onSubmit,
  onClose,
  departments,
  loadingDepartments,
  onReloadDepartments,
  onDeleteDepartment
}: DepartmentModalProps) {
  const [values, setValues] = useState<DepartmentModalValues>(() => cloneValues(initialValues));
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentOption | null>(null);

  // generate stable keys for role rows to avoid React remounting inputs
  const genKey = () => `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  const attachKeys = (roles: DepartmentRoleRow[]) => roles.map(r => ({ ...(r as any), _key: (r as any)._key || genKey() } as any));
  const wrapValuesWithKeys = (vals: DepartmentModalValues) => ({ name: vals.name, roles: attachKeys(vals.roles) } as unknown as DepartmentModalValues);

  useEffect(() => {
    if (!open) return;
    setValues(wrapValuesWithKeys(cloneValues(initialValues)) as unknown as DepartmentModalValues);
    setSelectedDepartment(null);
  }, [initialValues, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, submitting, onClose]);

  const canDeleteSelected = useMemo(() => {
    if (!selectedDepartment) return false;
    if (!onDeleteDepartment) return false;
    return (selectedDepartment.employee_count ?? 0) === 0 && Boolean(selectedDepartment.department_id);
  }, [selectedDepartment, onDeleteDepartment]);

  const handleRoleChange = (index: number, field: keyof DepartmentRoleRow) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (index === 0) return;
    const next = values.roles.map((role, idx) => (idx === index ? { ...role, [field]: event.target.value } : role));
    const cleaned = ensureMinRoleRows(next as any);
    setValues(prev => ({ ...prev, roles: attachKeys(cleaned) } as any));
  };

  const handleAddRole = () => {
    setValues(prev => {
      const next = ensureMinRoleRows([...(prev.roles as any), { ...emptyRoleRow }]);
      return { ...prev, roles: attachKeys(next) } as any;
    });
  };

  const handleRemoveRole = (index: number) => () => {
    if (index === 0) return;
    const next = ensureMinRoleRows(values.roles.filter((_, idx) => idx !== index) as any);
    setValues(prev => ({ ...prev, roles: attachKeys(next) } as any));
  };

  const handleSelectDepartment = (dept: DepartmentOption) => {
    const parsed = parseDepartmentDescription(dept.description);
    setSelectedDepartment(dept);
    const plain = parsed.length ? parsed : (values.roles as any);
    setValues({ name: dept.name, roles: attachKeys(ensureMinRoleRows(plain as any)) } as any);
  };

  const handleDeleteSelected = async () => {
    if (!selectedDepartment?.department_id || !onDeleteDepartment || !canDeleteSelected) return;
    const confirmed = await confirm({ title: 'Xóa phòng ban', message: `Bạn chắc chắn muốn xóa phòng ban "${selectedDepartment.name}"?` });
    if (!confirmed) return;
    try {
      await onDeleteDepartment(selectedDepartment.department_id);
      showToast('Đã xóa phòng ban', 'success');
      setSelectedDepartment(null);
    } catch (err) {
      showToast((err as any)?.message || 'Xóa phòng ban thất bại', 'error');
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = values.name.trim();
    if (!trimmedName) {
      showToast('Vui lòng nhập tên phòng ban', 'error');
      return;
    }

    // sanitize and validate roles
    const sanitized = values.roles.map(r => ({ title: String(r.title || '').trim(), quantity: String(r.quantity || '').trim() }));
    const providedRoles = sanitized.filter(r => r.title || r.quantity);

    // Ensure manager role present (will be prepended if missing)
    const hasManager = providedRoles.some(role => normalizeDepartmentKey(role.title) === MANAGER_ROLE_KEY);

    // Validate each role: title required, quantity must be a positive integer
    for (let i = 0; i < providedRoles.length; i++) {
      const role = providedRoles[i];
      if (!role.title) { showToast('Mỗi chức vụ phải có tên', 'error'); return; }
      if (!role.quantity) { showToast(`Chức vụ "${role.title}" cần nhập số lượng`, 'error'); return; }
      const q = Number(role.quantity);
      if (!Number.isFinite(q) || q <= 0 || !Number.isInteger(q)) { showToast(`Số lượng cho chức vụ "${role.title}" phải là số nguyên dương`, 'error'); return; }
    }

    // remove duplicate role titles (by normalized key)
    const dedup: Record<string, boolean> = {};
    const uniqueRoles = providedRoles.filter(r => {
      const k = normalizeDepartmentKey(r.title);
      if (dedup[k]) return false; dedup[k] = true; return true;
    });

    const rolesToSubmit = hasManager ? uniqueRoles : [{ title: MANAGER_ROLE_TITLE, quantity: MANAGER_ROLE_QUANTITY }, ...uniqueRoles];

    try {
      await onSubmit({ name: trimmedName, roles: rolesToSubmit }, selectedDepartment?.department_id);
      showToast('Đã lưu phòng ban', 'success');
    } catch (err) {
      showToast((err as any)?.message || 'Lưu phòng ban thất bại', 'error');
      throw err;
    }
  };

  if (!open) return null;

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
  };

  const cardStyle: React.CSSProperties = {
    width: 'min(960px, 95vw)', maxHeight: '90vh', background: '#fff', borderRadius: 16,
    boxShadow: '0 30px 80px rgba(15,23,42,0.12)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid rgba(29,78,216,0.06)',
  };

  const headerStyle: React.CSSProperties = {
    padding: '14px 18px', background: 'linear-gradient(90deg, rgba(29,78,216,0.06), rgba(59,130,246,0.03))', borderBottom: '1px solid rgba(29,78,216,0.06)',
  };

  const bodyStyle: React.CSSProperties = { padding: '18px', overflowY: 'auto', flex: 1 };

  const subtleButton: React.CSSProperties = {
    padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(59,130,246,0.18)', background: '#fff', color: '#1d4ed8', cursor: 'pointer', fontWeight: 600,
  };

  const sectionStyle: React.CSSProperties = { border: '1px solid #f3f4f6', borderRadius: 12, padding: 12, background: '#fff' };

  return (
    <div style={overlayStyle} onClick={(event) => { if (event.target === event.currentTarget && !submitting) onClose(); }}>
      <div style={cardStyle}>
        <header style={headerStyle}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1d4ed8' }}>Quản lý phòng ban</h2>
          <p style={{ margin: '6px 0 0 0', fontSize: 12, color: '#6b7280' }}>Thêm phòng ban và gợi ý chức vụ dùng khi tạo nhân sự.</p>
        </header>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={bodyStyle}>
            {selectedDepartment ? (
              <div style={{ ...sectionStyle, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'rgba(59,130,246,0.06)', borderColor: 'rgba(29,78,216,0.12)', color: '#1d4ed8', fontSize: 12 }}>
                <span>Đang chỉnh sửa: <strong>{values.name || selectedDepartment.name}</strong></span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={handleDeleteSelected} disabled={!canDeleteSelected || submitting} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,200,200,0.9)', background: '#fff', color: '#dc2626', cursor: canDeleteSelected ? 'pointer' : 'not-allowed', opacity: canDeleteSelected ? 1 : 0.6 }}>Xóa phòng ban</button>
                  <button type="button" onClick={()=>{ setSelectedDepartment(null); setValues(cloneValues(initialValues)); }} disabled={submitting} style={{ ...subtleButton, border: '1px solid rgba(59,130,246,0.18)', background: '#fff', color: '#1d4ed8' }}>Tạo phòng ban mới</button>
                </div>
              </div>
            ) : null}

            <div style={{ marginTop: 16 }}>
              <label style={{ marginBottom: 6, margin: 0, fontSize: 14, fontWeight: 700, color: '#374151' }}>Tên phòng ban <span style={{ color: '#dc2626' }}>*</span></label>
              <input
                value={values.name}
                onChange={(event)=>setValues(prev => ({ ...prev, name: event.target.value }))}
                placeholder="Ví dụ: Phòng Nhân sự"
                disabled={submitting}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14 }}
              />
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#374151' }}>Chức vụ & số lượng</p>
                <button type="button" onClick={handleAddRole} disabled={submitting} style={{ ...subtleButton, fontWeight: 700 }}>Thêm chức vụ</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {values.roles.map((role, index) => {
                  const isManagerRow = index === 0;
                  return (
                    <div key={(role as any)._key ?? `role-${index}`} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 10, alignItems: 'center' }}>
                      {isManagerRow ? (
                        <input
                          value={role.title}
                          placeholder="Tên chức vụ"
                          disabled
                          style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#f8fafc' }}
                        />
                      ) : (
                        <select
                          value={role.title}
                          onChange={handleRoleChange(index, 'title')}
                          disabled={submitting}
                          style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', fontSize: 14 }}
                        >
                          <option value="">Chọn chức vụ</option>
                          <option value="Nhân viên">Nhân viên</option>
                          <option value="Học việc">Học việc</option>
                          <option value="Thực tập">Thực tập</option>
                        </select>
                      )}
                      <input
                        value={role.quantity}
                        onChange={handleRoleChange(index, 'quantity')}
                        placeholder="Số lượng"
                        disabled={submitting || isManagerRow}
                        style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', background: isManagerRow ? '#f8fafc' : '#fff' }}
                      />
                      <button type="button" onClick={handleRemoveRole(index)} disabled={submitting || isManagerRow} style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: isManagerRow ? 'not-allowed' : 'pointer', opacity: isManagerRow ? 0.5 : 1 }}>Xóa</button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: 24, borderTop: '1px solid #f3f4f6', paddingTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Phòng ban hiện có</p>
                <button type="button" onClick={onReloadDepartments} disabled={loadingDepartments || submitting} style={{ ...subtleButton, fontSize: 12 }}>{loadingDepartments ? 'Đang tải...' : 'Tải lại'}</button>
              </div>
              <div style={{ ...sectionStyle, maxHeight: 200, overflowY: 'auto', fontSize: 12, background: '#f9fafb' }}>
                {loadingDepartments ? (
                  <p style={{ margin: 0, color: '#9ca3af' }}>Đang tải danh sách phòng ban...</p>
                ) : departments.length === 0 ? (
                  <p style={{ margin: 0, color: '#9ca3af' }}>Chưa có phòng ban nào.</p>
                ) : (
                  departments.map((dept) => {
                    const roles = parseDepartmentDescription(dept.description);
                    const isSelected = selectedDepartment?.department_id === dept.department_id;
                    return (
                      <button
                        key={dept.department_id ?? dept.name}
                        type="button"
                        onClick={()=>handleSelectDepartment(dept)}
                        disabled={submitting}
                        style={{
                          width: '100%', textAlign: 'left', border: '1px solid', borderRadius: 10, padding: '8px 10px', marginBottom: 10,
                          borderColor: isSelected ? 'rgba(29,78,216,0.16)' : '#f3f4f6', background: isSelected ? '#eff6ff' : '#fff', color: isSelected ? '#1d4ed8' : '#111827'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700 }}>{dept.name}</span>
                          {typeof dept.employee_count === 'number' ? (
                            <span style={{ fontSize: 11, color: '#6b7280' }}>({dept.employee_count} nhân viên)</span>
                          ) : null}
                        </div>
                        {roles.length ? (
                          <p style={{ margin: '4px 0 0 0', fontSize: 11, color: isSelected ? '#1d4ed8' : '#6b7280', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            {roles.map((role, idx) => (
                              <span key={`${dept.department_id}-${idx}`}>{role.title}{role.quantity ? ` ${role.quantity}` : ''}</span>
                            ))}
                          </p>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <footer style={{ padding: '14px 20px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={onClose} disabled={submitting} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 700 }}>Hủy</button>
            <button type="submit" disabled={submitting} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(29,78,216,0.18)', background: 'linear-gradient(90deg, rgb(29,78,216), rgb(59,130,246))', color: '#fff', fontWeight: 700, boxShadow: '0 12px 32px rgba(29,78,216,0.18)' }}>{submitting ? 'Đang lưu...' : 'Lưu phòng ban'}</button>
          </footer>
        </form>
      </div>
    </div>
  );
}
