import { useAuth } from '../../../contexts/AuthContext';

export default function HeaderBar({ roleLabel, onSignOut } : { roleLabel?: string; userName?: string; onSignOut?: () => void }) {
  const { user } = useAuth();
  const roleCode = String((user as any)?.role ?? (user as any)?.position ?? roleLabel ?? '').toLowerCase();
  const displayRole = roleCode === 'admin' ? 'Quản trị hệ thống' : roleCode === 'leader' ? 'Trưởng phòng ban' : roleCode === 'user' ? 'Nhân viên' : (roleLabel ?? '');

  const handleSignOut = () => {
    try {
      if (typeof onSignOut === 'function') return onSignOut();
    } catch (e) {
    }
    try { localStorage.removeItem('token'); sessionStorage.removeItem('token'); } catch (e) {}
    window.location.href = '/login';
  };

  return (
    <header
      style={{
        height: 80,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 24px',
        background: 'rgba(255,255,255,0.96)',
        position: 'relative',
        pointerEvents: 'auto'
      }}
    >
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontWeight: 700, color: '#0f172a' }}>{(user as any)?.email || displayRole}</div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handleSignOut}
            aria-label="Đăng xuất"
            style={{
              position: 'fixed',
              top: 16,
              right: 20,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px',
              borderRadius: 10,
              border: '1px solid rgba(255,215,0,0.18)',
              background: 'linear-gradient(180deg, #0b1220 0%, #111827 100%)',
              color: '#ffd974',
              fontWeight: 600,
              fontSize: 14,
              letterSpacing: '0.2px',
              cursor: 'pointer',
              boxShadow: '0 6px 18px rgba(2,6,23,0.45)',
              transition: 'transform .14s ease, box-shadow .14s ease, opacity .12s ease',
              WebkitFontSmoothing: 'antialiased',
              overflow: 'visible',
              zIndex: 20001
            }}
          >
            <span aria-hidden style={{ position: 'absolute', left: '8%', right: '8%', top: '8%', height: '36%', borderRadius: 8, background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.01))', pointerEvents: 'none' }} />
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0, color: 'rgba(255,215,0,0.95)' }}>
              <path d="M16 17l5-5-5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21 12H9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13 19H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ color: '#ffd974' }}>Đăng xuất</span>
          </button>
        </div>
      </div>
    </header>
  );
}
