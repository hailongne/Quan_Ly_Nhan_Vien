import { HiOutlineCheckCircle as CheckCircle } from 'react-icons/hi';

type Props = {
  startDate: Date;
  endDate: Date;
  workingDays: number;
  dailyKpi: number;
  weeklyKpi: number;
  totalKPI: number;
  totalCalendarWeeks: number;
  showMonthInfo: boolean;
  showDistribution: boolean;
};

export default function KpiPreview({ startDate, endDate, dailyKpi, weeklyKpi, totalKPI, totalCalendarWeeks, showMonthInfo, showDistribution }: Props) {
  const totalDays = startDate && endDate ? Math.floor((+endDate - +startDate) / (1000 * 60 * 60 * 24)) + 1 : 0;

  return (
    <div style={{ background: '#eef6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 12, marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0b5ed7', marginBottom: 6 }}>
        <CheckCircle size={18} color="#2563eb" />
        <span style={{ fontWeight: 600, color: '#0b3b66' }}>Thời hạn KPI:</span>
      </div>

      {showMonthInfo && (
        <div style={{ color: '#0b5ed7', fontSize: 13 }}>
          <div style={{ marginBottom: 6 }}>Từ {new Date(startDate).toLocaleDateString('vi-VN')} đến {new Date(endDate).toLocaleDateString('vi-VN')}</div>
          <div style={{ marginTop: 4, fontSize: 13 }}>({totalDays} ngày)</div>
        </div>
      )}

      {showDistribution && totalKPI > 0 && (
        <div style={{ borderTop: '1px solid #bfdbfe', paddingTop: 10, marginTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0b5ed7', marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>📊</span>
            <span style={{ fontWeight: 600 }}>Phân Bổ KPI:</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
            <div style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: 10 }}>
              <div style={{ color: '#2563eb', fontWeight: 600 }}>Theo Ngày</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0b3b66' }}>{dailyKpi} KPI/ngày</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: 10 }}>
              <div style={{ color: '#2563eb', fontWeight: 600 }}>Theo Tuần</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0b3b66' }}>{weeklyKpi} KPI/tuần</div>
            </div>
          </div>

          <div style={{ fontSize: 12, color: '#0b5ed7', marginTop: 8 }}>
            Tổng KPI: <strong>{totalKPI}</strong> | Thời gian: <strong>{totalCalendarWeeks} tuần</strong>
          </div>
        </div>
      )}
    </div>
  );
}
