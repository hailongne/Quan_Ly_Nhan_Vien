import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { useAuth } from '../../../contexts/AuthContext';
import { LuUser, LuFolder, LuArchive } from 'react-icons/lu';
import KpiCardList from './KpiCardList';
import KpiPublish from './KpiPublish';
import KpiDisabledList from './KpiDisabledList';

export default function KpiPage() {
  const { user, onSignOut } = useAuth() as any;
  const displayName = user?.name ?? user?.username ?? '';
  const [tab, setTab] = useState<'details' | 'publish' | 'tasks' | 'disabled'>(() => {
    try {
      const v = localStorage.getItem('kpi.activeTab');
      if (v === 'details' || v === 'publish' || v === 'tasks' || v === 'disabled') return v as any;
    } catch (e) {}
    return 'details';
  });

  useEffect(() => {
    try { localStorage.setItem('kpi.activeTab', tab); } catch (e) {}
  }, [tab]);

  return (
    <DashboardLayout roleLabel="Ban hành KPI" userName={displayName} onSignOut={onSignOut} activeMenuKey="kpi">
      <div style={{ padding: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ background: '#ffffff', padding: '6px 8px', borderRadius: 8, position: 'sticky', top: 20, zIndex: 40 }}>
            <div role="tablist" aria-label="KPI tabs" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {[
                { key: 'details', icon: <LuUser />, label: 'Chi tiết KPI' },
                { key: 'publish', icon: <LuFolder />, label: 'Ban hành KPI' },
                { key: 'disabled', icon: <LuArchive />, label: 'KPI đã vô hiệu hóa' },
              ].map((t) => {
                const active = tab === (t.key as any);
                return (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(t.key as any)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 14px',
                      borderRadius: 6,
                      background: 'transparent',
                      color: active ? '#1d9dd8' : '#6b7280',
                      border: 'none',
                      fontWeight: 700,
                      outline: 'none',
                      position: 'relative'
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{t.icon}</span>
                    <span>{t.label}</span>
                    {active ? <span style={{ position: 'absolute', left: 8, right: 8, bottom: -6, height: 3, background: '#1d9dd8', borderRadius: 4 }} /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            {tab === 'details' && <KpiCardList />}
            {tab === 'publish' && <KpiPublish />}
            {tab === 'tasks' && <div style={{ padding: 12, borderRadius: 8, background: '#fff', border: '1px solid #eef2ff' }}>Danh sách nhiệm vụ KPI chưa được cài đặt.</div>}
            {tab === 'disabled' && <KpiDisabledList />}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
