import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import axios from '../../api/axios';
import { notify } from '../../utils/notify';


// STATUS_LABELS removed — history UI has been removed.

const FIELD_LABELS: Record<string, string> = {
  name: 'Họ tên',
  email: 'Email',
  username: 'Tên đăng nhập',
  phone: 'Số điện thoại',
  address: 'Địa chỉ',
  department: 'Phòng ban',
  department_position: 'Chức vụ phòng ban',
  date_joined: 'Ngày vào làm',
  employment_status: 'Trạng thái làm việc',
  annual_leave_quota: 'Phép năm',
  remaining_leave_days: 'Ngày phép còn lại',
  work_shift_start: 'Giờ vào ca',
  work_shift_end: 'Giờ tan ca',
  note: 'Ghi chú',
  official_confirmed_at: 'Ngày bắt đầu'
};

const EMPLOYMENT_STATUS_LABELS: Record<string, string> = {
  apprentice: 'Học việc',
  probation: 'Thử việc',
  intern: 'Thực tập',
  part_time: 'Bán thời gian',
  contract: 'Hợp đồng',
  official: 'Chính thức',
  resigned: 'Đã nghỉ'
};

// formatChangeValue removed with history UI.

const formatProfileValue = (field: string, raw: unknown) => {
  if (raw === null || raw === undefined || raw === '') return 'Chưa cập nhật';
  if (field === 'employment_status' && typeof raw === 'string') return EMPLOYMENT_STATUS_LABELS[raw] ?? raw;
  if ((field === 'official_confirmed_at' || field === 'date_joined') && typeof raw === 'string') {
    const date = new Date(raw as string);
    return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString('vi-VN');
  }
  if ((field === 'work_shift_start' || field === 'work_shift_end') && typeof raw === 'string') return (raw as string).slice(0, 5);
  if ((field === 'annual_leave_quota' || field === 'remaining_leave_days') && raw !== null && raw !== undefined) {
    const numeric = Number(raw);
    if (!Number.isNaN(numeric)) return `${numeric.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} ngày`;
  }
  return String(raw);
};

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const displayName = (user as any)?.name || (user as any)?.username || '';

  // Form for submitting profile-update requests removed.

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const cvInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarPendingFile, setAvatarPendingFile] = useState<File | null>(null);
  const [avatarUploading, setAvatarUploading] = useState<boolean>(false);
  const [cvPendingFile, setCvPendingFile] = useState<File | null>(null);

  const resolveAssetUrl = (u?: string | null): string | null => { if (!u) return null; const s = String(u); return s.startsWith('/') ? `${window.location.origin}${s}` : s; };

  const resolvedAvatarUrl = resolveAssetUrl((user as { avatar_url?: string })?.avatar_url ?? null);
  const resolvedCvUrl = resolveAssetUrl((user as { cv_url?: string })?.cv_url ?? null);

  const [showAvatarModal, setShowAvatarModal] = useState(false);

  useEffect(() => {
    if (!showAvatarModal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowAvatarModal(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showAvatarModal]);

  const getUserId = () => (user as any)?.user_id ?? (user as any)?.id;

  function handleAvatarFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const preview = URL.createObjectURL(file);
    setAvatarPreviewUrl(preview);
    setAvatarPendingFile(file);
    e.currentTarget.value = '';
  }

  async function handleCvFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setCvPendingFile(file);
    e.currentTarget.value = '';
  }

  const uploadAvatar = async (userId: number | string, file: File) => {
    const form = new FormData(); form.append('file', file);
    const res = await axios.post(`/api/users/${userId}/avatar`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
    return res.data;
  };

  const uploadCv = async (userId: number | string, file: File) => {
    const form = new FormData(); form.append('file', file);
    const res = await axios.post(`/api/users/${userId}/cv`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
    return res.data;
  };

  

  if (!user) {
    return (
      <DashboardLayout roleLabel="Người dùng" userName={displayName} activeMenuKey="profile">
        <div >
          <div style={{ borderRadius: 12, border: '1px solid #ca5f5f', background: '#fff7f7', padding: 12, color: '#9f1239' }}>Bạn cần đăng nhập để xem trang này.</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout roleLabel="Người dùng" userName={displayName} activeMenuKey="profile">
      <div >

        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 32, alignItems: 'start'}}>
          <div style={{ paddingRight: 16 }}>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                style={{
                  width: '100%',
                  aspectRatio: '3 / 4',
                  borderRadius: 14,
                  overflow: 'hidden',
                  background: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative'
                }}
              >
                {avatarPreviewUrl ? (
                  <img
                    src={avatarPreviewUrl}
                    alt="avatar-preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                    onClick={() => setShowAvatarModal(true)}
                    title="Xem ảnh"
                  />
                ) : resolvedAvatarUrl ? (
                  <img
                    src={resolvedAvatarUrl}
                    alt="avatar"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                    onClick={() => setShowAvatarModal(true)}
                    title="Xem ảnh"
                  />
                ) : (
                  <span style={{ fontSize: 72, color: '#475569' }}>👤</span>
                )}

                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  title="Tải ảnh lên"
                  style={{ position: 'absolute', top: 10, right: 10, width: 36, height: 36, borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'}}
                >
                  <img src="/image/upload_icon.png" alt="Tải ảnh" style={{ width: 50, height: 40 }} />
                </button>

                {avatarPendingFile ? (
                  <div style={{ position: 'absolute', bottom: 10, right: 10, display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!avatarPendingFile || !user) return;
                        setAvatarUploading(true);
                        try {
                          await uploadAvatar(getUserId(), avatarPendingFile);
                          await refresh?.();
                        } catch (err) {
                          console.error(err);
                          notify.error('Tải ảnh thất bại');
                        } finally {
                          setAvatarUploading(false);
                          if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
                          setAvatarPreviewUrl(null);
                          setAvatarPendingFile(null);
                        }
                      }}
                      title="Lưu ảnh"
                      disabled={avatarUploading}
                      aria-busy={avatarUploading}
                      style={{ width: 38, height: 45, fontSize: 34, borderRadius: 12, color: 'rgb(0, 248, 91)', fontWeight: 800, cursor: avatarUploading ? 'default' : 'pointer', opacity: avatarUploading ? 0.7 : 1 }}
                    >
                      {avatarUploading ? '...' : '✓'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
                        setAvatarPreviewUrl(null);
                        setAvatarPendingFile(null);
                      }}
                      title="Hủy"
                      style={{ width: 38, height: 45, fontSize: 34, borderRadius: 12, color: 'rgb(239, 68, 68)', fontWeight: 800, cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </div>
                ) : null}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ width: '100%', display: 'flex', gap: 8, marginTop: 6 }}>
                  {resolvedCvUrl ? (
                      <>
                        <button
                            type="button"
                            onClick={() => window.open(resolvedCvUrl as string, '_blank')}
                            style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: 'rgba(11,61,145,0.08)', color: '#0b3d91', border: '1px solid rgba(75,108,183,0.22)', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Xem CV / Hồ sơ
                          </button>
                        <button
                          type="button"
                          onClick={() => cvInputRef.current?.click()}
                          title="Tải CV mới"
                          style={{ width: 44, borderRadius: 12 }}
                        >
                          <img src="/image/upload_icon.png" alt="Tải CV" style={{ width: 50, height: 50 }} />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => cvInputRef.current?.click()}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 12, background: 'linear-gradient(135deg, #0b3d91, #4b6cb7)', color: '#0b1224', border: '1px solid rgba(75,108,183,0.18)', fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 20px rgba(43,98,168,0.18)' }}
                      >
                        Tải CV lên
                      </button>
                    )}
                </div>
              </div>
            </div>

            <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarFileChange} />

            <input
              ref={cvInputRef}
              type="file"
              accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              style={{ display: 'none' }}
              onChange={handleCvFileChange}
            />

            {cvPendingFile ? (
              <div style={{ width: '100%', display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={async () => {
                    if (!cvPendingFile || !user) return;
                    try {
                      await uploadCv(getUserId(), cvPendingFile);
                      await refresh?.();
                    } catch (err) {
                      console.error(err);
                      notify.error('Tải CV thất bại');
                    } finally {
                      setCvPendingFile(null);
                    }
                  }}
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: 'linear-gradient(135deg, #24acfb, #4f3cfb)', color: '#0b1224', fontWeight: 800, cursor: 'pointer' }}
                >
                  Cập nhật CV
                </button>
                <button onClick={() => setCvPendingFile(null)} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(229,231,235,1)' }}>Hủy</button>
              </div>
            ) : null}
          </div>

          <div style={{ paddingLeft: 0 }}>
            <section style={{ background: '#fff', border: '1px solid #aacefe',boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', borderRadius: 16, padding: 16 }}>
              <header style={{ marginBottom: 12 }}>
                <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: '#374151' }}>Thông tin hiện tại</h2>
                <p style={{ fontSize: 12, color: '#6b7280' }}>Dữ liệu đã được quản trị phê duyệt gần nhất.</p>
              </header>
              <div style={{ display: 'grid', gap: 12 }}>
                {/* Row 1: 4 columns */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                  <div style={{ borderRadius: 12, border: '1px solid #aaf8fe', background: 'rgba(237, 250, 255, 0.6)', padding: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#279eee' }}>{FIELD_LABELS.name}</p>
                    <p style={{ marginTop: 8, color: user?.name ? '#111827' : '#9ca3af' }}>{formatProfileValue('name', user?.name)}</p>
                  </div>
                  <div style={{ borderRadius: 12, border: '1px solid #aaf8fe', background: 'rgba(237, 250, 255, 0.6)', padding: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#279eee' }}>{FIELD_LABELS.username}</p>
                    <p style={{ marginTop: 8, color: (user as any)?.username ? '#111827' : '#9ca3af' }}>{formatProfileValue('username', (user as any)?.username)}</p>
                  </div>
                  <div style={{ borderRadius: 12, border: '1px solid #aaf8fe', background: 'rgba(237, 250, 255, 0.6)', padding: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#279eee' }}>{FIELD_LABELS.email}</p>
                    <p style={{ marginTop: 8, color: (user as any)?.email ? '#111827' : '#9ca3af' }}>{formatProfileValue('email', (user as any)?.email)}</p>
                  </div>
                  <div style={{ borderRadius: 12, border: '1px solid #aaf8fe', background: 'rgba(237, 250, 255, 0.6)', padding: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#279eee' }}>{FIELD_LABELS.phone}</p>
                    <p style={{ marginTop: 8, color: (user as any)?.phone ? '#111827' : '#9ca3af' }}>{formatProfileValue('phone', (user as any)?.phone)}</p>
                  </div>
                </div>

                {/* Row 2: address (span 2), date_joined, official_confirmed_at */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                  <div style={{ borderRadius: 12, border: '1px solid #aaf8fe', background: 'rgba(237, 250, 255, 0.6)', padding: 12, gridColumn: 'span 2' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#279eee' }}>{FIELD_LABELS.address}</p>
                    <p style={{ marginTop: 8, color: (user as any)?.address ? '#111827' : '#9ca3af', whiteSpace: 'pre-line' }}>{formatProfileValue('address', (user as any)?.address)}</p>
                  </div>
                  <div style={{ borderRadius: 12, border: '1px solid #aaf8fe', background: 'rgba(237, 250, 255, 0.6)', padding: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#279eee' }}>{FIELD_LABELS.date_joined}</p>
                    <p style={{ marginTop: 8, color: (user as any)?.date_joined ? '#111827' : '#9ca3af' }}>{formatProfileValue('date_joined', (user as any)?.date_joined)}</p>
                  </div>
                  <div style={{ borderRadius: 12, border: '1px solid #aaf8fe', background: 'rgba(237, 250, 255, 0.6)', padding: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#279eee' }}>{FIELD_LABELS.official_confirmed_at}</p>
                    <p style={{ marginTop: 8, color: (user as any)?.official_confirmed_at ? '#111827' : '#9ca3af' }}>{formatProfileValue('official_confirmed_at', (user as any)?.official_confirmed_at)}</p>
                  </div>
                </div>

                {/* Row 3: department, department_position, employment_status, work_shift_start, work_shift_end */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
                  <div style={{ borderRadius: 12, border: '1px solid #aaf8fe', background: 'rgba(237, 250, 255, 0.6)', padding: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#279eee' }}>{FIELD_LABELS.department}</p>
                    <p style={{ marginTop: 8, color: (user as any)?.department ? '#111827' : '#9ca3af' }}>{formatProfileValue('department', (user as any)?.department)}</p>
                  </div>
                  <div style={{ borderRadius: 12, border: '1px solid #aaf8fe', background: 'rgba(237, 250, 255, 0.6)', padding: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#279eee' }}>{FIELD_LABELS.department_position}</p>
                    <p style={{ marginTop: 8, color: (user as any)?.department_position ? '#111827' : '#9ca3af' }}>{formatProfileValue('department_position', (user as any)?.department_position)}</p>
                  </div>
                  <div style={{ borderRadius: 12, border: '1px solid #aaf8fe', background: 'rgba(237, 250, 255, 0.6)', padding: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#279eee' }}>{FIELD_LABELS.employment_status}</p>
                    <p style={{ marginTop: 8, color: (user as any)?.employment_status ? '#111827' : '#9ca3af' }}>{formatProfileValue('employment_status', (user as any)?.employment_status)}</p>
                  </div>
                  <div style={{ borderRadius: 12, border: '1px solid #aaf8fe', background: 'rgba(237, 250, 255, 0.6)', padding: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#279eee' }}>{FIELD_LABELS.work_shift_start}</p>
                    <p style={{ marginTop: 8, color: (user as any)?.work_shift_start ? '#111827' : '#9ca3af' }}>{formatProfileValue('work_shift_start', (user as any)?.work_shift_start)}</p>
                  </div>
                  <div style={{ borderRadius: 12, border: '1px solid #aaf8fe', background: 'rgba(237, 250, 255, 0.6)', padding: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#279eee' }}>{FIELD_LABELS.work_shift_end}</p>
                    <p style={{ marginTop: 8, color: (user as any)?.work_shift_end ? '#111827' : '#9ca3af' }}>{formatProfileValue('work_shift_end', (user as any)?.work_shift_end)}</p>
                  </div>
                </div>

                {/* Row 4: note full width */}
                <div>
                  <div style={{ borderRadius: 12, border: '1px solid #aaf8fe', background: 'rgba(237, 250, 255, 0.6)', padding: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#279eee' }}>{FIELD_LABELS.note}</p>
                    <p style={{ marginTop: 8, color: (user as any)?.note ? '#111827' : '#9ca3af', whiteSpace: 'pre-line' }}>{formatProfileValue('note', (user as any)?.note)}</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
        
        {showAvatarModal ? (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', padding: 16 }} onClick={() => setShowAvatarModal(false)}>
            <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setShowAvatarModal(false)} style={{ position: 'absolute', right: 8, top: 8, zIndex: 10, borderRadius: 9999, background: 'transparent', color: '#fff' }}>✕</button>
              <img src={avatarPreviewUrl ?? resolvedAvatarUrl ?? undefined} alt="avatar-large" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }} />
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
