import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import LeaderKpiCardList from './LeaderKpiCardList';
import { LuUser, LuFolder } from 'react-icons/lu';
import ManageStaffKpi from './ManageStaffKpi';
import { useAuth } from '../../../contexts/AuthContext';
import LeaderPublishPanel from './LeaderPublishPanel';

export default function ManageKpiPage() {
  const { user, signout } = useAuth();
  const displayName = (user as any)?.name || (user as any)?.email || '';
  const onSignOut = () => { signout(); };
  const [tab, setTab] = useState<'details' | 'publish' | 'staff'>(() => {
    try {
      const saved = localStorage.getItem('manageKpiTab');
      if (saved === 'details' || saved === 'publish' || saved === 'staff') return saved as any;
    } catch (e) {}
    return 'details';
  });

  const setTabAndPersist = (newTab: 'details' | 'publish' | 'staff') => {
    setTab(newTab);
    try {
      localStorage.setItem('manageKpiTab', newTab);
    } catch (e) {}
  };

  const [assigningId, setAssigningId] = useState<number | null>(null);

  useEffect(() => {
    function onAssign(e: any) {
      const id = e?.detail?.chain_kpi_id ?? null;
      if (id) setAssigningId(Number(id));
      setTabAndPersist('publish');
    }
    window.addEventListener('assignKpi', onAssign as EventListener);
    return () => window.removeEventListener('assignKpi', onAssign as EventListener);
  }, []);

  return (
    <DashboardLayout roleLabel="Quản lý KPI" userName={displayName} activeMenuKey="kpi_manage" onSignOut={onSignOut}>
      <div style={{ padding: 20 }}>
        <div style={{ background: '#ffffff', padding: '6px 8px', borderRadius: 8, position: 'sticky', top: 0, zIndex: 50, borderBottom: '1px solid #e2e8f0' }}>
          <div role="tablist" aria-label="KPI tabs" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {[
              { key: 'details', icon: <LuUser />, label: 'KPI phòng ban' },
              { key: 'publish', icon: <LuFolder />, label: 'Giao KPI' },
              { key: 'staff', icon: <LuUser />, label: 'KPI nhân viên' },
            ].map((t) => {
              const active = tab === (t.key as any);
              return (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTabAndPersist(t.key as any)}
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

        <div style={{ marginTop: 16, paddingBottom: 12 }}>
          {tab === 'details' && <LeaderKpiCardList />}

          {tab === 'publish' && (
            <div style={{ padding: 12 }}>
              <LeaderPublishPanel initialId={assigningId} />
            </div>
          )}

          {tab === 'staff' && (
            <div style={{ padding: 12 }}>
              <ManageStaffKpi />
            </div>
          )}

        </div>
      </div>
    </DashboardLayout>
  );
}
