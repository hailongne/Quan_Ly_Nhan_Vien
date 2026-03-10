import React, { useEffect, useRef, useState } from 'react'

export interface KpiEditActionsProps {
  totalKpiFromDb?: number;
  onSaveNewTotalKpi: (value: string) => void;
  currentUiTotal: number;
  onDistributeEvenly: () => void;
  weeksLength: number;
  loading: boolean;
  onClose: () => void;
}

export function KpiEditActions({
  totalKpiFromDb,
  onSaveNewTotalKpi,
  currentUiTotal,
  onDistributeEvenly,
  weeksLength
}: KpiEditActionsProps) {
  const displayedTotal = (typeof totalKpiFromDb === 'number' ? totalKpiFromDb : 0)
  const diff = Number(currentUiTotal || 0) - Number(displayedTotal || 0)
  const differenceColor = diff === 0 ? '#16a34a' : diff < 0 ? '#f59e0b' : '#ef4444'
  const differenceLabel = diff === 0 ? 'Đủ KPI' : diff < 0 ? 'Thiếu KPI' : 'Vượt KPI'
  const distributeDisabled = !weeksLength || typeof totalKpiFromDb !== 'number'
  const distributeOpacity = distributeDisabled ? 0.5 : 1

  // Local string state to avoid IME/composition interruptions.
  const [localValue, setLocalValue] = useState<string>(() => (typeof totalKpiFromDb === 'number' ? String(totalKpiFromDb) : ''))
  const composingRef = useRef(false)

  useEffect(() => {
    // Update local input when external totalKpi/currentTotalKpi changes (e.g., when modal loads)
    const next = typeof totalKpiFromDb === 'number' ? String(totalKpiFromDb) : ''
    setLocalValue(next)
  }, [totalKpiFromDb])

  const handleCompositionStart = () => { composingRef.current = true }
  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    composingRef.current = false
    const v = (e.target as HTMLInputElement).value
    setLocalValue(v)
    // keep local state only; save occurs on button click
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value)
    // keep local state only; save occurs on button click
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const v = e.target.value
    setLocalValue(v)
  }

  const handleSaveClick = () => {
    onSaveNewTotalKpi(localValue)
  }

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <div style={{ background: 'linear-gradient(180deg,#fff,#f0f9ff)', borderRadius: 12, padding: 12, border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, background: '#0ea5e9', borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
          <svg style={{ width: 18, height: 18 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#0369a1', marginBottom: 6 }}>KPI tổng</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={localValue}
              onChange={handleChange}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              onBlur={handleBlur}
              title="Chỉnh sửa KPI tổng"
              style={{ width: 88, borderRadius: 8, border: '2px solid #bae6fd', padding: '6px 8px', textAlign: 'center', fontWeight: 700, background: '#fff', color: '#075985' }}
            />
            <button
              type="button"
              onClick={handleSaveClick}
              title="Lưu KPI tổng"
              style={{ padding: '6px 10px', background: 'linear-gradient(90deg, #59a1c7, #0369a1)', color: '#fff', borderRadius: 8, border: 'none', fontWeight: 700 }}
            >
              Lưu
            </button>
          </div>
        </div>
      </div>

      <div style={{ background: 'linear-gradient(180deg,#fff,#f0f9ff)', borderRadius: 12, padding: 12, border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, background: '#38bdf8', borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
          <svg style={{ width: 18, height: 18 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#0369a1' }}>KPI Hiện Tại</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: differenceColor }}>{currentUiTotal}/{displayedTotal}</div>
          <div style={{ fontSize: 12, color: differenceColor }}>{differenceLabel} KPI</div>
        </div>
      </div>

      <div style={{ background: 'linear-gradient(180deg,#fff,#f0f9ff)', borderRadius: 12, padding: 12, border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, background: '#0ea5e9', borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
          <svg style={{ width: 18, height: 18 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#0369a1' }}>Phân bổ tự động</div>
          <div style={{ marginTop: 6 }}>
            <button
              type="button"
              onClick={onDistributeEvenly}
              disabled={distributeDisabled}
              title="Tự động phân bổ KPI cho các ngày đi làm chưa hoàn thành, giữ nguyên KPI của ngày đã hoàn thành"
              style={{ padding: '8px 12px', background: '#0ea5e9', color: '#fff', borderRadius: 8, border: 'none', fontWeight: 700, opacity: distributeOpacity, cursor: distributeDisabled ? 'not-allowed' : 'pointer' }}
            >
              Phân bổ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default KpiEditActions
