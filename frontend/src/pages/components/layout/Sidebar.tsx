import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { AiOutlineHome, AiOutlineBarChart, AiOutlineLineChart, AiOutlineNodeIndex, AiOutlineSwap, AiOutlineUnorderedList } from 'react-icons/ai';
import { FaUsers } from 'react-icons/fa';
import { FiLock } from 'react-icons/fi';
import { BiUser } from 'react-icons/bi';
import type { IconType } from 'react-icons';
import { useAuth } from '../../../contexts/AuthContext';

export default function Sidebar({ activeKey }: { activeKey?: string }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const { user } = useAuth();
  const role = String((user as any)?.role ?? (user as any)?.position ?? '').toLowerCase();

  const items: { key: string; label: string; to: string; icon: IconType }[] = [
    { key: 'dashboard', label: 'Tổng quan', to: role === 'admin' ? '/admin' : '/user', icon: AiOutlineHome },
    { key: 'profile', label: 'Hồ sơ', to: '/profile', icon: BiUser},
    { key: 'kpi', label: 'Ban hành KPI', to: '/kpi', icon: AiOutlineLineChart },
    { key: 'kpi_manage', label: 'KPI phòng ban', to: '/kpi/manage', icon: AiOutlineBarChart },
    { key: 'kpi_transferred', label: 'KPI điều phối', to: '/kpi/transferred', icon: AiOutlineNodeIndex },
    { key: 'kpi_handover', label: 'Chuyển giao KPI', to: '/kpi/handover', icon: AiOutlineSwap },
    { key: 'kpi_task', label: 'Nhiệm vụ KPI', to: '/user/tasks', icon: AiOutlineUnorderedList },
    { key: 'staff', label: 'Nhân viên', to: '/staff', icon: FaUsers },
    { key: 'password', label: 'Mật khẩu', to: '/reset-password', icon: FiLock },
  ];

  let visibleItems = items;
  if (role === 'leader') {
    visibleItems = items.filter(i => i.key !== 'staff' && i.key !== 'kpi');
  } else if (role === 'user') {
    visibleItems = items.filter(i => i.key !== 'staff' && i.key !== 'kpi' && i.key !== 'kpi_manage' && i.key !== 'kpi_transferred' && i.key !== 'kpi_handover');
  } else if (role === 'admin') {
    visibleItems = items.filter(i => i.key !== 'profile' && i.key !== 'kpi_manage' && i.key !== 'kpi_task' && i.key !== 'kpi_transferred' && i.key !== 'kpi_handover');
  } else {
    visibleItems = items.filter(i => i.key !== 'profile' && i.key !== 'staff' && i.key !== 'kpi' && i.key !== 'kpi_manage' && i.key !== 'kpi_task' && i.key !== 'kpi_transferred' && i.key !== 'kpi_handover');
  }

  return (
    <aside style={{ width: 240, background: 'linear-gradient(180deg,#1f7ef6,#2366d9)', color: '#fff', padding: 18, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 18, overflow: 'visible' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 6 }}>
        <img src="/image/logofreetrip.png" alt="logo" style={{ width: 42, height: 42, objectFit: 'contain' }} />
        <div style={{ fontWeight: 800, fontSize: 46 }}>
            <span style={{ color: '#ffffff' }}>Free</span>
            <span style={{ color: '#ff7a00' }}>trip</span>
        </div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
        {visibleItems.map((it) => {
          const Icon = it.icon;
          return (
            <NavLink
              key={it.key}
              to={it.to}
              end={['/user', '/admin', '/profile'].includes(it.to)}
              onMouseEnter={() => setHovered(it.key)}
              onMouseLeave={() => setHovered(null)}
              style={({ isActive }) => {
                const hot = isActive || hovered === it.key || activeKey === it.key;
                return {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 18px',
                  borderRadius: 28,
                  color: hot ? '#1d4ed8' : '#fff',
                  background: hot ? '#fff' : 'transparent',
                  textDecoration: 'none',
                  transform: hot ? 'translateX(12px)' : 'translateX(0)',
                  width: hot ? 'calc(100% + 36px)' : '100%',
                  boxShadow: 'none',
                  transition: 'all 180ms cubic-bezier(.2,.9,.2,1)',
                  overflow: 'visible',
                  position: 'relative'
                };
              }}
            >
              {({ isActive }) => {
                const hot = isActive || hovered === it.key;
                return (
                  <>
                    <div style={{ width: 36, height: 36, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: hot ? '#fff' : 'transparent', color: hot ? '#1d4ed8' : '#fff', fontSize: 16, boxShadow: 'none', border: hot ? '2px solid #1d4ed8' : 'none' }}>
                      <Icon size={18} />
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{it.label}</div>
                  </>
                );
              }}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}

