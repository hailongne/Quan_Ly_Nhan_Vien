import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import { useAuth } from '../../../../contexts/AuthContext';

type HandoverConfirmState = {
  kpiId?: number;
  departmentId?: number;
  kpiName?: string;
  departmentName?: string;
};

export default function HandoverConfirmPage() {
  const { user, signout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const displayName = (user as any)?.name || (user as any)?.email || '';
  const onSignOut = () => { signout(); };

  const payload = useMemo(() => (location.state || {}) as HandoverConfirmState, [location.state]);
  const hasData = Number(payload.kpiId) > 0 && Number(payload.departmentId) > 0;

  return (
    <DashboardLayout roleLabel="Chuyển giao KPI" userName={displayName} activeMenuKey="kpi_handover" onSignOut={onSignOut}>
      <div style={{ padding: 16 }}>
        <div style={{ maxWidth: 860, margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#334155' }}>Bước xác nhận chuyển giao KPI</div>

          {!hasData && (
            <div style={{ marginTop: 14 }}>
              <div style={{ color: '#64748b', fontSize: 14 }}>Không có dữ liệu chọn KPI/phòng ban. Vui lòng quay lại bước chọn.</div>
              <button
                type="button"
                onClick={() => navigate('/kpi/handover')}
                style={{ marginTop: 12, padding: '8px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', cursor: 'pointer' }}
              >
                Quay lại chọn
              </button>
            </div>
          )}

          {hasData && (
            <>
              <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                <div style={{ padding: 12, borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>KPI được chọn</div>
                  <div style={{ marginTop: 4, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{payload.kpiName || `KPI #${payload.kpiId}`}</div>
                </div>

                <div style={{ padding: 12, borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Phòng ban nhận KPI</div>
                  <div style={{ marginTop: 4, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{payload.departmentName || `Phòng ban #${payload.departmentId}`}</div>
                </div>
              </div>

              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => navigate('/kpi/handover')}
                  style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', cursor: 'pointer' }}
                >
                  Quay lại
                </button>

                <button
                  type="button"
                  onClick={() => {
                    navigate('/kpi/handover/transfer-preview', { state: payload });
                  }}
                  style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  Xác nhận chuyển giao
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
