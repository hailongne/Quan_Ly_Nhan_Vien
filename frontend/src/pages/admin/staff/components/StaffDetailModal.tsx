import React, { useEffect, useRef, useState } from 'react';
import EditStaffModal from './EditStaffModal';
import type { CSSProperties } from 'react';
import '../../../../styles/modal.css';
import type { ApiUser } from '../types';

const LAYOUT: Record<string, CSSProperties> = {
  modalCard: { maxWidth: 1200, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', color: '#0f172a', background: '#0b1224', padding: 0, overflow: 'hidden' },
  headerBar: { padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(90deg, #0ea5e9, #2563eb)' },
  headerTitle: { color: '#013355', fontWeight: 700, fontSize: 22, letterSpacing: 0.3 },
  contentWrap: { minWidth: 'min(1200px, 95vw)', margin: '0 auto', overflowY: 'auto', padding: '18px', flex: 1 },
  grid: { display: 'grid', gridTemplateColumns: '280px 1fr', gap: 18, alignItems: 'stretch', height: '100%' },
  sidebar: { background: 'rgba(255,255,255,0.04)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', padding: 14, boxShadow: '0 8px 30px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, height: 'auto' },
  avatarBox: { width: '100%', aspectRatio: '3 / 4', borderRadius: 14, overflow: 'hidden', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  mainColumn: { display: 'flex', flexDirection: 'column', gap: 16, color: '#e2e8f0', height: 'auto' },
  infoGrid: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 },
  card: { background: 'rgba(255,255,255,0.04)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', padding: 16, boxShadow: '0 8px 30px rgba(0,0,0,0.35)' },
  footer: { padding: '10px 18px 14px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#0b132d' },
};

const OVERLAY_STYLE: CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(2,6,23,0.6)',
  zIndex: 1000,
  padding: 20,
};

interface StaffDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: ApiUser | null;
  onUploadAvatar?: (file: File, user: ApiUser) => void | Promise<void>;
  onUploadCv?: (file: File, user: ApiUser) => void | Promise<void>;
}

export default function StaffDetailModal({ isOpen, onClose, user, onUploadAvatar, onUploadCv }: StaffDetailModalProps) {
  const [mounted, setMounted] = useState(isOpen);
  const [closing, setClosing] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const cvInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarPendingFile, setAvatarPendingFile] = useState<File | null>(null);
  const [editOpen, setEditOpen] = useState<boolean>(false);

  // lock body scroll when modal is mounted
  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev || '';
    };
  }, [mounted]);

  const layout: Record<string, CSSProperties> = {
    modalCard: { maxWidth: 1200, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', color: '#0f172a', background: '#0b1224', padding: 0, overflow: 'hidden' },
    headerBar: { padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(90deg, #0ea5e9, #2563eb)' },
    headerTitle: { color: '#013355', fontWeight: 700, fontSize: 22, letterSpacing: 0.3 },
    contentWrap: { minWidth: 'min(1200px, 95vw)', margin: '0 auto', overflowY: 'auto', padding: '18px', flex: 1 },
    grid: { display: 'grid', gridTemplateColumns: '280px 1fr', gap: 18, alignItems: 'stretch', height: '100%' },
    sidebar: { background: 'rgba(255,255,255,0.04)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', padding: 14, boxShadow: '0 8px 30px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, height: 'auto' },
    avatarBox: { width: '100%', aspectRatio: '3 / 4', borderRadius: 14, overflow: 'hidden', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' },
    mainColumn: { display: 'flex', flexDirection: 'column', gap: 16, color: '#e2e8f0', height: 'auto' },
    infoGrid: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 },
    card: { background: 'rgba(255,255,255,0.04)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', padding: 16, boxShadow: '0 8px 30px rgba(0,0,0,0.35)' },
    footer: { padding: '10px 18px 14px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#0b132d' },
  };

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      const t = setTimeout(() => setMounted(false), 240);
      return () => clearTimeout(t);
    }
  }, [isOpen, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const node = overlayRef.current;
    const focusables = Array.from(node?.querySelectorAll(focusableSelector) || []) as HTMLElement[];
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    first?.focus();
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

  function requestClose() {
    setClosing(true);
    setTimeout(() => { setMounted(false); onClose(); setClosing(false); }, 240);
  }

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

  function triggerAvatarUpload() {
    avatarInputRef.current?.click();
  }

  function triggerCvUpload() {
    cvInputRef.current?.click();
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const preview = URL.createObjectURL(file);
    setAvatarPreviewUrl(preview);
    setAvatarPendingFile(file);
    e.target.value = '';
  }

  async function handleCvChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      if (onUploadCv) {
        await onUploadCv(file, user);
      }
    } finally {
      e.target.value = '';
    }
  }

  const show = (v: any) => (v === null || v === undefined || v === '' ? '—' : String(v));
  const formatDateTime = (d?: any) => {
    if (!d) return undefined;
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
  };

  const renderStatusBadge = (status?: string) => {
    const s = status?.toLowerCase();
    const map: Record<string, { label: string; color: string; bg: string }> = {
      contract: { label: 'Hợp đồng', color: '#0369a1', bg: '#e0f2fe' },
      official: { label: 'Chính thức', color: '#0f172a', bg: '#e2e8f0' },
      probation: { label: 'Thử việc', color: '#ea580c', bg: '#ffedd5' },
      intern: { label: 'Thực tập', color: '#0ea5e9', bg: '#e0f2fe' },
    };
    const entry = map[s || ''] || { label: status || '—', color: '#475569', bg: '#e2e8f0' };
    return (
      <span style={{ background: entry.bg, color: entry.color, padding: '6px 10px', borderRadius: 999, fontWeight: 700, fontSize: 13 }}>
        {entry.label}
      </span>
    );
  };

  if (!mounted || !user) return null;

  const modalStyle: CSSProperties = {
    ...LAYOUT.modalCard,
    transition: 'transform 200ms ease, opacity 200ms ease',
    transform: closing ? 'scale(0.98)' : 'scale(1)',
    opacity: closing ? 0 : 1,
  };

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="staff-detail-title"
      style={OVERLAY_STYLE}
      onMouseDown={(e) => { if (e.target === overlayRef.current) requestClose(); }}
    >
      <div style={modalStyle}>
        <div style={LAYOUT.headerBar}>
          <div id="staff-detail-title" style={LAYOUT.headerTitle}>Thông tin nhân sự</div>
        </div>

        <div style={layout.contentWrap}>
          <header style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: '#e2e8f0', letterSpacing: 0.4, lineHeight: 1.2 }}>
                {show(user.name || user.username || 'Không tên')}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, paddingLeft: 12 }}>
                  {renderStatusBadge(user.employment_status)}
                </span>
              </h1>
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                <span style={{ background: '#0ea5e9', color: '#e0f2fe', padding: '6px 10px', borderRadius: 999, fontWeight: 700 }}>
                  {user.department ?? '-'}
                </span>
                <span style={{ background: '#1d4ed8', color: '#e2e8f0', padding: '6px 10px', borderRadius: 999, fontWeight: 700 }}>
                  {user.department_position ?? '-'}
                </span>
              </div>
            </div>
          </header>

          <div style={layout.grid}>
            <aside>
              <div style={layout.avatarBox}>
                {avatarPreviewUrl ? (
                  <img src={avatarPreviewUrl} alt="avatar-preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : user.avatar_url ? (
                  <img src={user.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 96, color: '#475569' }}>👤</span>
                )}

                <button
                  type="button"
                  onClick={triggerAvatarUpload}
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
                        if (!avatarPendingFile || !onUploadAvatar || !user) return;
                        await onUploadAvatar(avatarPendingFile, user);
                        if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
                        setAvatarPreviewUrl(null);
                        setAvatarPendingFile(null);
                      }}
                      title="Lưu ảnh"
                      style={{ width: 38, height: 45, fontSize: 34, borderRadius: 12, color: 'rgb(0, 248, 91)', fontWeight: 800, cursor: 'pointer'}}
                    >
                      ✓
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
              <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />

              {user.cv_url ? (
                <div style={{ width: '100%', display: 'flex', gap: 8, margin:'10px 0' }}>
                  <button
                    type="button"
                    onClick={() => window.open(user.cv_url as string, '_blank')}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: 'rgba(22, 177, 249, 0.12)', color: '#3c9ffb', border: '1px solid rgba(22, 64, 249, 0.35)', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Xem CV / Hồ sơ
                  </button>
                  <button
                    type="button"
                    onClick={triggerCvUpload}
                    title="Tải CV mới"
                    style={{ width: 44, borderRadius: 12 }}
                  >
                    <img src="/image/upload_icon.png" alt="Tải CV" style={{ width: 50, height: 50 }} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={triggerCvUpload}
                  style={{ width: '100%', padding: '10px 12px', margin:'10px 0', borderRadius: 12, background: 'linear-gradient(135deg, #24acfb, #4f3cfb)', color: '#0b1224', border: '1px solid rgba(22, 249, 230, 0.4)', fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 20px rgba(22, 166, 249, 0.3)' }}
                >
                  Tải CV lên
                </button>
              )}
              <input
                ref={cvInputRef}
                type="file"
                accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                style={{ display: 'none' }}
                onChange={handleCvChange}
              />
            </aside>

            <div style={layout.mainColumn}>
              <div style={layout.infoGrid}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
                  <InfoCard title="Công việc" cardStyle={layout.card}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                      <InfoRow label="Mã nhân sự" value={show(user.user_id ?? (user as any).id)} />
                      <InfoRow label="Phòng ban" value={show(user.department)} />
                      <InfoRow label="Chức vụ" value={show(user.department_position)} />
                      <InfoRow
                      label="Ngày vào làm"
                      value={
                        user.date_joined
                        ? ((): string => {
                          const d = new Date(user.date_joined);
                          return Number.isNaN(d.getTime())
                            ? '—'
                            : d.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
                          })()
                        : '—'
                      }
                      />
                      <InfoRow label="Ca làm việc" value={`${user.work_shift_start ?? '--'} → ${user.work_shift_end ?? '--'}`} />
                      <InfoRow label="Xác nhận chính thức" value={formatDateTime((user as any).official_confirmed_at) || '—'} />
                      <InfoRow label="Ngày tạo" value={formatDateTime((user as any).created_at) || '—'} />
                      <InfoRow label="Cập nhật" value={formatDateTime((user as any).updated_at) || '—'} />
                    </div>
                  </InfoCard>
                </div>

                <div style={{ display: 'grid', gap: 16 }}>
                  <InfoCard title="Liên hệ" cardStyle={layout.card}>
                    <div style={{ display: 'grid', gap: 10, fontSize: 13 }}>
                      <InfoRow label="Số điện thoại" value={<span style={{ fontFamily: 'monospace' }}>{user.phone ?? '—'}</span>} />
                      <InfoRow
                        label="Email"
                        value={<span style={{ display: 'inline-block', maxWidth: '100%', wordBreak: 'break-word' }}>{user.email ?? '—'}</span>}
                      />
                      <InfoRow label="Địa chỉ" value={<span style={{ wordBreak: 'break-word', whiteSpace: 'normal' }}>{user.address ?? '--'}</span>} />
                    </div>
                  </InfoCard>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <InfoCard title="Ghi chú" cardStyle={layout.card}>
                    <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.5 }}>
                      {user.note ? user.note : <span style={{ color: '#94a3b8' }}>Không có</span>}
                    </div>
                  </InfoCard>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={layout.footer}>
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            style={{ marginRight: 8, padding: '8px 16px', borderRadius: 8, background: 'linear-gradient(135deg, #24acfb, #4f3cfb)', color: '#0b1224', fontWeight: 800, border: 'none', cursor: 'pointer' }}
          >Điều chỉnh</button>

          <button
            type="button"
            
            onClick={requestClose}
            style={{ background: '#e2e8f0', color: '#0f172a', padding: '8px 16px', borderRadius: 8 }}
          >Đóng</button>
        </div>
      </div>

      <EditStaffModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        user={user}
        onSaved={async () => {
          setEditOpen(false);
        }}
      />
    </div>
  );
}

function InfoCard({ title, children, cardStyle }: { title: string; children: React.ReactNode; cardStyle?: React.CSSProperties }) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, letterSpacing: 0.3, color: '#cbd5e1', textTransform: 'uppercase' }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 4px', borderBottom: '1px dashed rgba(148,163,184,0.25)' }}>
      <span style={{ fontSize: 12, color: '#94a3b8', letterSpacing: 0.2 }}>{label}</span>
      <span style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 600 }}>{value ?? '—'}</span>
    </div>
  );
}
