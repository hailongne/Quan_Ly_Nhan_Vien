import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../components/layout/DashboardLayout';
import { useAuth } from '../../../../contexts/AuthContext';
import axios from '../../../../api/axios';
import { confirm } from '../../../../utils/confirm';

type HandoverKpiItem = {
  chain_kpi_id: number;
  kpi_name?: string[] | null;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  total_kpi?: number | null;
  workdays_count?: number | null;
  department_id?: number | null;
  transfer_source_kpi_id?: number | null;
};

type DepartmentItem = {
  department_id?: number;
  id?: number;
  departmentId?: number;
  name?: string;
  department_name?: string;
  departmentName?: string;
  leader_count?: number;
  leaders_count?: number;
  manager_count?: number;
  user_count?: number;
  users_count?: number;
  staff_count?: number;
};

type TransferHistoryItem = {
  target_kpi_id: number;
  source_kpi_id: number;
  target_department_id?: number | null;
  target_department_name?: string | null;
  source_kpi_name?: string[] | null;
  source_description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  total_kpi?: number | null;
};

export default function HandoverKpiPage() {
  const { user, signout } = useAuth();
  const navigate = useNavigate();
  const leaderDeptId = (user as any)?.department_id ?? null;
  const displayName = (user as any)?.name || (user as any)?.email || '';
  const onSignOut = () => { signout(); };

  const [kpis, setKpis] = useState<HandoverKpiItem[]>([]);
  const [loadingKpis, setLoadingKpis] = useState<boolean>(true);
  const [loadingDepartments, setLoadingDepartments] = useState<boolean>(true);
  const [kpiError, setKpiError] = useState<string | null>(null);
  const [departmentError, setDepartmentError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [transferHistory, setTransferHistory] = useState<TransferHistoryItem[]>([]);
  const [selectedKpiId, setSelectedKpiId] = useState<number | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
  const [isNextHovered, setIsNextHovered] = useState<boolean>(false);
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingKpis(true);
      setKpiError(null);
      try {
        const [kpiRes, historyRes] = await Promise.all([
          axios.get('/api/kpis/department'),
          axios.get('/api/kpis/transfer-history')
        ]);

        const items = Array.isArray(kpiRes.data) ? kpiRes.data : kpiRes.data?.kpis ?? kpiRes.data?.items ?? [];
        const normalized = Array.isArray(items) ? items : [];
        const filtered = normalized.filter((it: any) => {
          const did = it.department_id ?? it.departmentId ?? it.department ?? null;
          const isTransferred = Number(it.transfer_source_kpi_id ?? 0) > 0;
          return Number(did) === Number(leaderDeptId) && !isTransferred;
        });

        const historyItemsRaw = Array.isArray(historyRes.data)
          ? historyRes.data
          : (historyRes.data?.items ?? historyRes.data?.history ?? []);

        const historyItems = (Array.isArray(historyItemsRaw) ? historyItemsRaw : [])
          .sort((a: any, b: any) => {
            const aDate = new Date(a?.end_date || a?.start_date || 0).getTime();
            const bDate = new Date(b?.end_date || b?.start_date || 0).getTime();
            return bDate - aDate;
          });
        if (!mounted) return;
        setKpis(filtered);
        setTransferHistory(historyItems);
      } catch (err: any) {
        if (!mounted) return;
        setKpiError(err?.response?.data?.message || err?.message || 'Không tải được danh sách KPI');
        setTransferHistory([]);
      } finally {
        if (mounted) setLoadingKpis(false);
      }
    })();
    return () => { mounted = false; };
  }, [leaderDeptId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingDepartments(true);
      setDepartmentError(null);
      try {
        const res = await axios.get('/api/departments');
        const items = Array.isArray(res.data) ? res.data : res.data?.departments ?? res.data?.items ?? [];
        const filtered = (Array.isArray(items) ? items : []).filter((d: any) => {
          const did = d.department_id ?? d.id ?? d.departmentId ?? null;
          return Number(did) > 0 && Number(did) !== Number(leaderDeptId);
        });
        if (!mounted) return;
        setDepartments(filtered);
      } catch (err: any) {
        if (!mounted) return;
        setDepartmentError(err?.response?.data?.message || err?.message || 'Không tải được danh sách phòng ban');
      } finally {
        if (mounted) setLoadingDepartments(false);
      }
    })();
    return () => { mounted = false; };
  }, [leaderDeptId]);

  const selectedKpi = kpis.find((k) => Number(k.chain_kpi_id) === Number(selectedKpiId)) ?? null;
  const selectedDepartment = departments.find((d) => Number(d.department_id ?? d.id ?? d.departmentId ?? 0) === Number(selectedDepartmentId)) ?? null;
  const canProceed = Number(selectedKpiId) > 0 && Number(selectedDepartmentId) > 0;

  

  return (
    <DashboardLayout roleLabel="Chuyển giao KPI" userName={displayName} activeMenuKey="kpi_handover" onSignOut={onSignOut}>
      <div style={{ padding: 14 }}>
        <div style={{ background: 'transparent', borderRadius: 0, border: 'none', padding: 0 }}>
          <div style={{ marginTop: 4, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'start' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#334155' }}>Bước 1: Chọn 1 KPI để thực hiện chuyển giao.</div>
              <div style={{ marginTop: 8, borderTop: '1px solid #e2e8f0' }} />
              <div
                style={{
                  marginTop: 10,
                  maxHeight: '44vh',
                  minHeight: 160,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  overscrollBehavior: 'contain',
                  paddingRight: 4
                }}
              >
                {loadingKpis && <div style={{ color: '#475569' }}>Đang tải danh sách KPI...</div>}
                {!loadingKpis && kpiError && <div style={{ color: '#b91c1c' }}>Lỗi: {kpiError}</div>}
                {!loadingKpis && !kpiError && kpis.length === 0 && (
                  <div style={{ color: '#475569' }}>Không có KPI phù hợp để chuyển giao.</div>
                )}

                {!loadingKpis && !kpiError && kpis.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(220px, 1fr))', gap: 10 }}>
                    {kpis.map((k) => {
                      const active = Number(selectedKpiId) === Number(k.chain_kpi_id);
                      const title = Array.isArray(k.kpi_name) && k.kpi_name.length ? k.kpi_name.join(' • ') : (k.description || 'KPI');
                      return (
                        <button
                          key={k.chain_kpi_id}
                          type="button"
                          onClick={() => setSelectedKpiId(Number(k.chain_kpi_id))}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            textAlign: 'center',
                            padding: 10,
                            minHeight: 100,
                            borderRadius: 8,
                            border: active ? '2px solid #2563eb' : '1px solid #cbd5e1',
                            background: active ? '#eff6ff' : '#fff',
                            cursor: 'pointer'
                          }}
                        >
                              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{title}</div>
                              <div style={{ marginTop: 6, fontSize: 13, color: '#334155' }}>
                                {k.start_date ? new Date(k.start_date).toLocaleDateString('vi-VN') : '—'} — {k.end_date ? new Date(k.end_date).toLocaleDateString('vi-VN') : '—'}
                              </div>
                              <div style={{ marginTop: 8, fontSize: 13, color: '#1e3a8a' }}>
                                Tổng: <strong>{k.total_kpi ?? 0} KPI</strong>
                              </div>
                              <div style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>
                                Số ngày làm việc {k.workdays_count ?? 0}
                              </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#334155' }}>Bước 2: Chọn phòng ban để thực hiện</div>
              <div style={{ marginTop: 8, borderTop: '1px solid #e2e8f0' }} />
              <div
                style={{
                  marginTop: 8,
                  maxHeight: '44vh',
                  minHeight: 160,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  overscrollBehavior: 'contain',
                  paddingRight: 4,
                  display: 'grid',
                  gap: 8,
                  alignContent: 'start'
                }}
              >
                {loadingDepartments && <div style={{ color: '#475569' }}>Đang tải phòng ban...</div>}
                {!loadingDepartments && departmentError && <div style={{ color: '#b91c1c' }}>Lỗi: {departmentError}</div>}
                {!loadingDepartments && !departmentError && departments.length === 0 && (
                  <div style={{ color: '#475569' }}>Không có phòng ban để lựa chọn.</div>
                )}

                {!loadingDepartments && !departmentError && departments.map((d) => {
                  const depId = Number(d.department_id ?? d.id ?? d.departmentId ?? 0);
                  const active = Number(selectedDepartmentId) === depId;
                  const depName = d.name || d.department_name || d.departmentName || `Phòng ban #${depId}`;

                  return (
                    <button
                      key={String(depId)}
                      type="button"
                      onClick={() => setSelectedDepartmentId(depId)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        textAlign: 'center',
                        padding: 10,
                        minHeight: 80,
                        borderRadius: 8,
                        border: active ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        background: active ? '#eff6ff' : '#fff',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{depName}</div>
                    </button>
                  );
                })}
              </div>
            </div>

          {selectedKpi && (
            <div style={{ gridColumn: '1 / -1', marginTop: 6, padding: 12, border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, color: '#64748b' }}>KPI đã chọn để chuyển giao:</div>
                <div style={{ marginTop: 4, fontWeight: 700, color: '#0f172a' }}>
                  {Array.isArray(selectedKpi.kpi_name) && selectedKpi.kpi_name.length ? selectedKpi.kpi_name.join(' • ') : (selectedKpi.description || `KPI #${selectedKpi.chain_kpi_id}`)}
                </div>
              </div>
              <button
                type="button"
                disabled={!canProceed || isSubmittingTransfer}
                onClick={async () => {
                  if (!canProceed || isSubmittingTransfer) return;
                  const departmentName = selectedDepartment?.name || selectedDepartment?.department_name || selectedDepartment?.departmentName || `Phòng ban #${selectedDepartmentId}`;
                  const kpiName = Array.isArray(selectedKpi?.kpi_name) && selectedKpi.kpi_name.length
                    ? selectedKpi.kpi_name.join(' • ')
                    : (selectedKpi?.description || `KPI #${selectedKpiId}`);

                  const accepted = await confirm({
                    title: 'Bước xác nhận chuyển giao KPI',
                    message: `Xác nhận chuyển KPI "${kpiName}" đến phòng ban "${departmentName}"?`,
                    confirmText: 'Xác nhận chuyển giao',
                    cancelText: 'Quay lại'
                  });

                  if (!accepted) return;

                  try {
                    setIsSubmittingTransfer(true);
                    const res = await axios.post(`/api/kpis/${selectedKpiId}/transfer`, {
                      targetDepartmentId: selectedDepartmentId,
                      forceCreate: true
                    });
                    const targetKpiId = Number(res?.data?.transfer?.targetKpiId ?? 0);
                    if (!Number.isFinite(targetKpiId) || targetKpiId <= 0) {
                      throw new Error('Không tạo được KPI chuyển giao');
                    }

                    navigate('/kpi/handover/transfer-preview', {
                      state: {
                        kpiId: selectedKpiId,
                        departmentId: selectedDepartmentId,
                        kpiName,
                        departmentName,
                        targetKpiId
                      }
                    });
                  } catch (err: any) {
                    const message = err?.response?.data?.message || err?.message || 'Không thể khởi tạo KPI chuyển giao';
                    window.alert(message);
                  } finally {
                    setIsSubmittingTransfer(false);
                  }
                }}
                onMouseEnter={() => setIsNextHovered(true)}
                onMouseLeave={() => setIsNextHovered(false)}
                style={{
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: (!canProceed || isSubmittingTransfer) ? '1px solid #cbd5e1' : (isNextHovered ? 'none' : '1px solid rgba(37,99,235,0.12)'),
                  background: (!canProceed || isSubmittingTransfer) ? '#f1f5f9' : (isNextHovered ? 'linear-gradient(90deg,#2563eb,#1e40af)' : 'linear-gradient(180deg,#ffffff,#f8fafc)'),
                  color: (!canProceed || isSubmittingTransfer) ? '#94a3b8' : (isNextHovered ? '#fff' : '#1e40af'),
                  fontWeight: 700,
                  cursor: (canProceed && !isSubmittingTransfer) ? 'pointer' : 'not-allowed',
                  boxShadow: (!canProceed || isSubmittingTransfer) ? 'none' : (isNextHovered ? '0 10px 30px rgba(37,99,235,0.18)' : '0 1px 0 rgba(16,24,40,0.02)'),
                  transform: (!canProceed || isSubmittingTransfer) ? 'translateY(0)' : (isNextHovered ? 'translateY(-2px) scale(1.02)' : 'translateY(0)'),
                  transition: 'all 220ms cubic-bezier(.2,.9,.3,1)'
                }}
                aria-label="Tiếp theo"
              >
                {isSubmittingTransfer ? 'Đang khởi tạo...' : 'Tiếp theo'}
              </button>
            </div>
          )}
          </div>

          <div style={{ marginTop: 16, borderTop: '1px dashed #cbd5e1', paddingTop: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#334155' }}>Lịch sử chuyển giao KPI</div>
            <div style={{ marginTop: 8 }}>
              {loadingKpis && <div style={{ color: '#475569' }}>Đang tải lịch sử chuyển giao...</div>}
              {!loadingKpis && kpiError && <div style={{ color: '#b91c1c' }}>Không tải được lịch sử chuyển giao.</div>}
              {!loadingKpis && !kpiError && transferHistory.length === 0 && (
                <div style={{ color: '#64748b', fontSize: 13 }}>Chưa có lịch sử chuyển giao KPI.</div>
              )}

              {!loadingKpis && !kpiError && transferHistory.length > 0 && (
                <div style={{ display: 'grid', gap: 8 }}>
                  {transferHistory.map((item) => {
                    const title = Array.isArray(item.source_kpi_name) && item.source_kpi_name.length
                      ? item.source_kpi_name.join(' • ')
                      : (item.source_description || `KPI #${item.source_kpi_id}`);
                    const targetDepartmentId = Number(item.target_department_id ?? 0);
                    const targetKpiId = Number(item.target_kpi_id ?? 0);
                    const canOpen = targetDepartmentId > 0 && targetKpiId > 0 && Number(item.source_kpi_id) > 0;
                    return (
                      <button
                        type="button"
                        key={`${item.target_kpi_id}-${item.source_kpi_id}`}
                        disabled={!canOpen}
                        onClick={() => {
                          if (!canOpen) return;
                          navigate('/kpi/handover/transfer-preview', {
                            state: {
                              kpiId: Number(item.source_kpi_id),
                              departmentId: targetDepartmentId,
                              kpiName: title,
                              departmentName: item.target_department_name || `Phòng ban #${targetDepartmentId}`,
                              targetKpiId
                            }
                          });
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: 10,
                          borderRadius: 8,
                          border: '1px solid #e2e8f0',
                          background: '#fff',
                          cursor: canOpen ? 'pointer' : 'default'
                        }}
                      >
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{title}</div>
                        <div style={{ marginTop: 4, color: '#475569', fontSize: 12 }}>
                          {item.start_date ? new Date(item.start_date).toLocaleDateString('vi-VN') : '—'} — {item.end_date ? new Date(item.end_date).toLocaleDateString('vi-VN') : '—'}
                        </div>
                        <div style={{ marginTop: 4, color: '#64748b', fontSize: 12 }}>
                          Đích: {item.target_department_name || `Phòng ban #${targetDepartmentId || 0}`} • Tổng: {item.total_kpi ?? 0} KPI
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
