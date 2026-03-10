import { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import TransferredKpiCardList from './TransferredKpiCardList';
import { LuUser, LuFolder } from 'react-icons/lu';
import TransferredPublishPanel from './TransferredPublishPanel';
import TransferredManageStaffKpi from './TransferredManageStaffKpi';
import { useAuth } from '../../../../contexts/AuthContext';

export default function TransferredManageKpiPage() {
  const { user, signout } = useAuth();
  const displayName = (user as any)?.name || (user as any)?.email || '';
  const onSignOut = () => { signout(); };
  const [tab, setTab] = useState<'details' | 'publish' | 'staff'>(() => {
    try {
      const saved = localStorage.getItem('transferredManageKpiTab');
      if (saved === 'details' || saved === 'publish' || saved === 'staff') return saved as any;
    } catch (e) {}
    return 'details';
  });

  const setTabAndPersist = (newTab: 'details' | 'publish' | 'staff') => {
    setTab(newTab);
    try {
      localStorage.setItem('transferredManageKpiTab', newTab);
    } catch (e) {}
  };

  const [assigningId, setAssigningId] = useState<number | null>(null);

  useEffect(() => {
    function onAssign(e: any) {
      const id = e?.detail?.chain_kpi_id ?? null;
      if (id) setAssigningId(Number(id));
      setTabAndPersist('publish');
    }
    window.addEventListener('assignTransferredKpi', onAssign as EventListener);
    return () => window.removeEventListener('assignTransferredKpi', onAssign as EventListener);
  }, []);

  return (
    <DashboardLayout roleLabel="KPI điều phối" userName={displayName} activeMenuKey="kpi_transferred" onSignOut={onSignOut}>
      <div style={{ padding: 20 }}>
        <div style={{ background: '#ffffff', padding: '6px 8px', borderRadius: 8, position: 'sticky', top: 20, zIndex: 40 }}>
          <div role="tablist" aria-label="KPI tabs" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {[
              { key: 'details', icon: <LuUser />, label: 'KPI điều phối' },
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
                    color: active ? '#db2777' : '#6b7280',
                    border: 'none',
                    fontWeight: 700,
                    outline: 'none',
                    position: 'relative'
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{t.icon}</span>
                  <span>{t.label}</span>
                  {active ? <span style={{ position: 'absolute', left: 8, right: 8, bottom: -6, height: 3, background: '#ec4899', borderRadius: 4 }} /> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          {tab === 'details' && <TransferredKpiCardList transferredOnly />}

          {tab === 'publish' && (
            <div style={{ padding: 12 }}>
              <TransferredPublishPanel initialId={assigningId} />
            </div>
          )}

          {tab === 'staff' && (
            <div style={{ padding: 12 }}>
              <TransferredManageStaffKpi />
            </div>
          )}

        </div>
      </div>
    </DashboardLayout>
  );
}
