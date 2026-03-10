import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../../api/axios';
import KpiDetails from './KpiDetails';
import KpiEditModal from './edit/KpiEditModal';
import { confirm } from '../../../utils/confirm';
import { notify } from '../../../utils/notify';

type KpiCardView = {
	id: number;
	title: string;
	startLabel: string;
	endLabel: string;
	completedNum: number;
	workdays: number;
	deptName: string;
	totalKpi: number | string | null;
};

const CARD_BASE_STYLE: React.CSSProperties = {
	background: 'linear-gradient(180deg,#ffffff,#fbfdff)',
	border: '1px solid #e6eefc',
	borderRadius: 12,
	padding: 16,
	minHeight: 110,
	transition: 'transform 150ms ease, box-shadow 150ms ease',
	boxShadow: '0 6px 18px rgba(2,6,23,0.06)'
};

const CARD_TITLE_STYLE: React.CSSProperties = {
	fontWeight: 800,
	color: '#0b3b66',
	marginBottom: 8,
	overflow: 'hidden',
	textOverflow: 'ellipsis',
	whiteSpace: 'nowrap'
};

const CARD_DATE_STYLE: React.CSSProperties = { fontSize: 13, color: '#475569', marginBottom: 8 };
const CARD_COMPLETED_STYLE: React.CSSProperties = { fontSize: 13, color: '#064e3b', marginBottom: 6 };
const CARD_DEPT_STYLE: React.CSSProperties = { fontSize: 13, color: '#0b3b66', marginBottom: 8 };
const CARD_BOTTOM_ROW_STYLE: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 'auto' };
const CARD_TOTAL_STYLE: React.CSSProperties = { fontSize: 13, color: '#0b3b66' };
const CARD_ACTIONS_STYLE: React.CSSProperties = { position: 'absolute', top: 12, right: 12, display: 'flex', alignItems: 'center', gap: 8 };
const EDIT_BUTTON_STYLE: React.CSSProperties = { width: 35, height: 35, border: 'none', background: 'transparent', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const EDIT_IMG_BASE_STYLE: React.CSSProperties = { width: 25, height: 25, transition: 'transform 160ms cubic-bezier(.2,.9,.2,1), filter 160ms ease' };
const DELETE_IMG_BASE_STYLE: React.CSSProperties = { width: 25, height: 25, transition: 'transform 160ms cubic-bezier(.2,.9,.2,1), filter 160ms ease' };


const buildCardStyle = (hovered: boolean): React.CSSProperties => ({
	...CARD_BASE_STYLE,
	cursor: 'pointer',
	position: 'relative',
	transform: hovered ? 'translateY(-6px)' : 'none',
	boxShadow: hovered ? '0 12px 30px rgba(2,6,23,0.12)' : CARD_BASE_STYLE.boxShadow,
	border: '1px solid #3583f8'
});

const buildEditImgStyle = (hovered: boolean): React.CSSProperties => ({
	...EDIT_IMG_BASE_STYLE,
	transform: hovered ? 'scale(1.12) rotate(8deg)' : 'scale(1)',
	filter: hovered ? 'drop-shadow( 10px 10px 0 rgba(59,130,246,0.18))' : 'none'
});

const buildDeleteImgStyle = (hovered: boolean): React.CSSProperties => ({
	...DELETE_IMG_BASE_STYLE,
	transform: hovered ? 'scale(1.08)' : 'scale(1)',
	filter: hovered ? 'drop-shadow( 6px 6px 0 rgba(239,68,68,0.18))' : 'none'
});


const formatDateLabel = (value: string | null) => (value ? new Date(value).toLocaleDateString('vi-VN') : '—');

type ChainKpiSummary = {
	chain_kpi_id: number;
	start_date: string | null;
	end_date: string | null;
	description?: string | null;
	kpi_name?: string[] | null;
	transfer_source_kpi_id?: number | null;
	total_kpi?: number | null;
	workdays_count?: number | null;
	status?: string | null;
};

export default function KpiCardList() {
	const [list, setList] = useState<ChainKpiSummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [modalOpen, setModalOpen] = useState(false);
	const [isFullScreen, setIsFullScreen] = useState(false);

	const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
	const [selectedYear, setSelectedYear] = useState<number | null>(null);
	const [kpiTypeFilter, setKpiTypeFilter] = useState<'department' | 'transferred'>('department');
	const [openDropdown, setOpenDropdown] = useState<string | null>(null);
	const [hoveredId, setHoveredId] = useState<number | null>(null);
	const [hoveredEditId, setHoveredEditId] = useState<number | null>(null);
	const [hoveredDeleteId, setHoveredDeleteId] = useState<number | null>(null);
	const [editPopupOpen, setEditPopupOpen] = useState(false);
	const [editPopupId, setEditPopupId] = useState<number | null>(null);
	const [columns, setColumns] = useState<number>(2);
	const [departmentsMap, setDepartmentsMap] = useState<Record<number, string>>({});
	const [disablingId, setDisablingId] = useState<number | null>(null);

	const gridStyle = useMemo(() => ({ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 18, width: '100%' }), [columns]);

	useEffect(() => {
		function updateCols() {
			const w = window.innerWidth;
			// small screens: 1 column, otherwise 2 columns
			setColumns(w < 820 ? 1 : 2);
		}
		updateCols();
		window.addEventListener('resize', updateCols);
		return () => window.removeEventListener('resize', updateCols);
	}, []);

	const handleMonthChange = useCallback((v: number | null) => {
		if (!v) { setSelectedMonth(null); setSelectedYear(null); return; }
		const candidates = list.filter(it => it.start_date).map(it => ({ d: new Date(it.start_date as string), item: it }));
		const matched = candidates.filter(c => (c.d.getMonth() + 1) === v);
		if (matched.length) {
			const latest = matched.reduce((a, b) => (a.d > b.d ? a : b)).d;
			setSelectedMonth(v);
			setSelectedYear(latest.getFullYear());
			return;
		}
		const now = new Date();
		setSelectedMonth(v);
		setSelectedYear(now.getFullYear());
	}, [list]);

	function MonthYearDropdown({ id, type, value, onChange, options }: { id: string; type: 'month' | 'year'; value: number | null; onChange: (v:number|null)=>void; options?: number[] }){
		const [hover, setHover] = useState<number | null>(null);
		const ref = React.useRef<HTMLDivElement | null>(null);

		useEffect(()=>{
			function onDoc(e: MouseEvent){ if(!ref.current) return; if(ref.current.contains(e.target as Node)) return; if(openDropdown === id) setOpenDropdown(null); }
			document.addEventListener('click', onDoc);
			return ()=>document.removeEventListener('click', onDoc);
		},[id, openDropdown]);

		const wrapStyle: React.CSSProperties = { position: 'relative', minWidth: type === 'month' ? 120 : 120 };
		const dropdownButton: React.CSSProperties = { padding: '8px 12px', borderRadius: 10, border: '1px solid #e6e7eb', background: '#fff', cursor: 'pointer', minWidth: 120, textAlign: 'left' };
		const menuStyle: React.CSSProperties = { position: 'absolute', top: 44, left: 0, background: '#fff', border: '1px solid #e6e7eb', borderRadius: 10, boxShadow: '0 8px 24px rgba(2,6,23,0.08)', zIndex: 50, maxHeight: 260, overflowY: 'auto', minWidth: 120 };
		const itemStyle: React.CSSProperties = { display: 'block', width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer' };

		const monthOptions = Array.from({ length: 12 }, (_, i) => i+1);
		const opts = type === 'month' ? monthOptions : (options || []);
		const open = openDropdown === id;

		return (
			<div style={wrapStyle} ref={ref}>
				<button type="button" style={{ ...dropdownButton, boxShadow: open ? '0 8px 24px rgba(2,6,23,0.06)' : undefined }} onClick={(e)=>{ e.stopPropagation(); setOpenDropdown(open ? null : id); }}>
					{type === 'month' ? (value ? `Tháng ${value}` : 'Tháng') : (value ?? 'Năm')} ▾
				</button>
				{open && (
					<div role="menu" style={menuStyle}>
						<button role="menuitem" onMouseEnter={()=>setHover(null)} onMouseLeave={()=>setHover(null)} onClick={()=>{ onChange(null); setOpenDropdown(null); }} style={{ ...itemStyle, background: value === null ? '#eef2ff' : 'transparent', color: value === null ? '#2069d6' : '#0f1723' }}>
							Tất cả
						</button>
						{opts.map((opt)=> (
							<button key={opt} role="menuitem" onMouseEnter={()=>setHover(opt as number)} onMouseLeave={()=>setHover(null)} onClick={()=>{ onChange(opt as number); setOpenDropdown(null); }} style={{ ...itemStyle, background: hover === (opt as number) ? '#f3f6f9' : (opt === value ? '#eef2ff' : 'transparent'), color: opt === value ? '#2069d6' : '#0f1723' }}>
								{type === 'month' ? `Tháng ${opt}` : String(opt)}
							</button>
						))}
					</div>
				)}
			</div>
		);
	}

	// prevent background scroll when modal (especially fullscreen) is open
	useEffect(() => {
		if (modalOpen && isFullScreen) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}
		return () => { document.body.style.overflow = ''; };
	}, [modalOpen, isFullScreen]);

// allow closing modal with Escape key
useEffect(() => {
	function onKey(e: KeyboardEvent) {
 		if (e.key === 'Escape' || e.key === 'Esc') {
 			setModalOpen(false);
 			setIsFullScreen(false);
 		}
 	}
 	if (modalOpen) {
 		document.addEventListener('keydown', onKey);
 		return () => document.removeEventListener('keydown', onKey);
 	}
}, [modalOpen]);

	useEffect(() => {
		let mounted = true;
		(async () => {
			setLoading(true);
			setError(null);
			try {
				const res = await api.get('/api/kpis');
				const items = Array.isArray(res.data) ? res.data : res.data?.kpis ?? res.data?.items ?? [];
				if (!mounted) return;
				setList(items);
				try {
					const dres = await api.get('/api/departments');
					const dlist = Array.isArray(dres.data) ? dres.data : dres.data?.departments ?? dres.data?.items ?? [];
					const map: Record<number,string> = {};
					for (const d of dlist) {
						const id = d.department_id ?? d.id ?? d.department_id ?? d.departmentId ?? null;
						if (id !== null && typeof id !== 'undefined') map[Number(id)] = d.name ?? d.department ?? String(id);
					}
					setDepartmentsMap(map);
				} catch (__) {
					// Nếu tải phòng ban lỗi thì dùng dữ liệu sẵn có để hiển thị.
				}
				if (!selectedMonth && Array.isArray(items) && items.length) {
					try {
						const now = new Date();
						const curr = items.find((it: any) => {
							if (!it.start_date) return false;
							const d = new Date(it.start_date);
							return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
						});
						if (curr) {
							const cd = new Date(curr.start_date);
							setSelectedMonth(cd.getMonth() + 1);
							setSelectedYear(cd.getFullYear());
						} else {
							const dates = items.map((it: any) => it.start_date ? new Date(it.start_date) : null).filter(Boolean) as Date[];
							if (dates.length) {
								const now = new Date();
								const vnNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + 7 * 3600 * 1000);
								const monthsDiff = (a: Date, b: Date) => Math.abs((a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth()));
								let best = dates[0];
								let bestDiff = monthsDiff(vnNow, best);
								for (let i = 1; i < dates.length; i++) {
									const d = dates[i];
									const diff = monthsDiff(vnNow, d);
									if (diff < bestDiff) { best = d; bestDiff = diff; }
									else if (diff === bestDiff && d > best) { best = d; }
								}
								setSelectedMonth(best.getMonth() + 1);
								setSelectedYear(best.getFullYear());
							}
						}
					} catch (_) {}
				}
			} catch (err: any) {
				setError(err?.response?.data?.message || err.message || 'Lỗi khi tải KPI');
			} finally {
				if (mounted) setLoading(false);
			}
		})();
		return () => { mounted = false; };
	}, []);

	// derived values
	const filteredList = useMemo(() => {
		return list.filter((it) => {
			const isTransferred = Number((it as any)?.transfer_source_kpi_id ?? 0) > 0;
			if (kpiTypeFilter === 'department' && isTransferred) return false;
			if (kpiTypeFilter === 'transferred' && !isTransferred) return false;
			if (!selectedMonth) return true;
			if (!it.start_date) return false;
			const d = new Date(it.start_date);
			return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
		});
	}, [list, kpiTypeFilter, selectedMonth, selectedYear]);

	const getCompletedNum = (k: any) => {
		const rawCompleted = k?.completed_days ?? k?.done_days ?? k?.completed;
		if (rawCompleted === null || rawCompleted === undefined || rawCompleted === '') return 0;
		return Number(rawCompleted) || 0;
	};

	const resolveDeptName = useCallback((k: any) => {
		const deptId = k?.department_id ?? k?.departmentId ?? k?.dept_id ?? k?.department ?? null;
		const fallbackDept = k?.department_name ?? k?.department ?? k?.dept ?? k?.departmentId ?? '—';
		if (typeof deptId === 'number' && departmentsMap[deptId]) return departmentsMap[deptId];
		return fallbackDept;
	}, [departmentsMap]);

	const cardItems = useMemo<KpiCardView[]>(() => {
		return filteredList.map((k) => {
			const idNum = Number(k.chain_kpi_id);
			return {
				id: idNum,
				title: Array.isArray(k.kpi_name) && k.kpi_name.length ? k.kpi_name.join(' • ') : (k.description || 'KPI'),
				startLabel: formatDateLabel(k.start_date),
				endLabel: formatDateLabel(k.end_date),
				completedNum: getCompletedNum(k),
				workdays: k.workdays_count ?? 0,
				deptName: resolveDeptName(k),
				totalKpi: k.total_kpi ?? '—'
			};
		});
	}, [filteredList, resolveDeptName]);

	const disableKpi = useCallback(async (id: number) => {
		if (disablingId !== null) return;
		const confirmed = await confirm({
			title: 'Vô hiệu hóa KPI',
			message: 'Bạn có chắc muốn vô hiệu hóa KPI này? Thao tác sẽ đặt trạng thái lưu trữ và khóa các ngày.',
			confirmText: 'Vô hiệu hóa',
			cancelText: 'Hủy'
		});
		if (!confirmed) return;
		setDisablingId(id);
		try {
			await api.post(`/api/kpis/${id}/disable`);
			setList(prev => prev.map(it => Number(it.chain_kpi_id) === id ? { ...it, status: 'archived' } : it));
		} catch (err: any) {
			console.error('Disable KPI failed', err);
			notify.error(err?.response?.data?.message || 'Không thể vô hiệu hóa KPI');
		} finally {
			setDisablingId(null);
		}
	}, [disablingId]);

	const cardHandlers = useMemo(() => {
		const map: Record<number, {
			onEnter: () => void;
			onLeave: () => void;
			onClick: () => void;
			onEditEnter: () => void;
			onEditLeave: () => void;
			onEditClick: (e: React.MouseEvent) => void;
			onDisableEnter: () => void;
			onDisableLeave: () => void;
			onDisableClick: (e: React.MouseEvent) => void;
		}> = {};

		cardItems.forEach((item) => {
			map[item.id] = {
				onEnter: () => setHoveredId(item.id),
				onLeave: () => setHoveredId(null),
				onClick: () => { setSelectedId(item.id); setModalOpen(true); },
				onEditEnter: () => setHoveredEditId(item.id),
				onEditLeave: () => setHoveredEditId(null),
				onEditClick: (e: React.MouseEvent) => { e.stopPropagation(); setEditPopupId(item.id); setEditPopupOpen(true); },
				onDisableEnter: () => setHoveredDeleteId(item.id),
				onDisableLeave: () => setHoveredDeleteId(null),
				onDisableClick: (e: React.MouseEvent) => { e.stopPropagation(); disableKpi(item.id); }
			};
		});

		return map;
	}, [cardItems, disableKpi]);

	const editKpi = useMemo(() => {
		const found = list.find(it => Number(it.chain_kpi_id) === Number(editPopupId));
		if (!found) return undefined;
		return {
			id: found.chain_kpi_id,
			title: Array.isArray(found.kpi_name) && found.kpi_name.length ? found.kpi_name.join(' • ') : (found.description || 'KPI'),
			weeks: (found as any).weeks ?? []
		};
	}, [editPopupId, list]);

	if (loading) return <div style={{ padding: 12 }}>Đang tải KPI...</div>;
	if (error) return <div style={{ padding: 12, color: '#b91c1c' }}>Lỗi: {error}</div>;
	if (!list || !list.length) return <div style={{ padding: 12 }}>Không có KPI để hiển thị.</div>;

	return (
		<div>
			<div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
				<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
					<button
						type="button"
						onClick={() => setKpiTypeFilter('department')}
						style={{
							padding: '8px 12px',
							borderRadius: 10,
							border: kpiTypeFilter === 'department' ? '1px solid #1d9dd8' : '1px solid #e6e7eb',
							background: kpiTypeFilter === 'department' ? '#e0f2ff' : '#fff',
							color: kpiTypeFilter === 'department' ? '#0b69c7' : '#334155',
							fontWeight: 700,
							cursor: 'pointer'
						}}
					>
						KPI phòng ban
					</button>
					<button
						type="button"
						onClick={() => setKpiTypeFilter('transferred')}
						style={{
							padding: '8px 12px',
							borderRadius: 10,
							border: kpiTypeFilter === 'transferred' ? '1px solid #1d9dd8' : '1px solid #e6e7eb',
							background: kpiTypeFilter === 'transferred' ? '#e0f2ff' : '#fff',
							color: kpiTypeFilter === 'transferred' ? '#0b69c7' : '#334155',
							fontWeight: 700,
							cursor: 'pointer'
						}}
					>
						KPI điều phối
					</button>
				</div>
				<MonthYearDropdown id="kpi-month" type="month" value={selectedMonth} onChange={handleMonthChange} />
			</div>

			<div style={gridStyle}>
			{cardItems.map((kpi) => {
				const handlers = cardHandlers[kpi.id];
				const isHovered = hoveredId === kpi.id;
				const isEditHovered = hoveredEditId === kpi.id;
				const isDeleteHovered = hoveredDeleteId === kpi.id;
				const deleting = disablingId === kpi.id;
				return (
					<div
						key={kpi.id}
						style={buildCardStyle(isHovered)}
						onMouseEnter={handlers?.onEnter}
						onMouseLeave={handlers?.onLeave}
						onClick={handlers?.onClick}
					>
						<div style={CARD_ACTIONS_STYLE}>
							<button
								type="button"
								onClick={handlers?.onEditClick}
								onMouseEnter={handlers?.onEditEnter}
								onMouseLeave={handlers?.onEditLeave}
								aria-label="Chỉnh sửa KPI"
								style={EDIT_BUTTON_STYLE}
							>
								<img
									src="/image/edit_icon.png"
									alt="Chỉnh sửa"
									style={buildEditImgStyle(isEditHovered)}
								/>
							</button>
							<button
								type="button"
								onClick={handlers?.onDisableClick}
								onMouseEnter={handlers?.onDisableEnter}
								onMouseLeave={handlers?.onDisableLeave}
								disabled={deleting}
								aria-label="Vô hiệu hóa KPI"
								style={{ ...EDIT_BUTTON_STYLE, opacity: deleting ? 0.6 : 1 }}
							>
								<img
									src="/image/delete_icon.png"
									alt="Vô hiệu hóa"
									style={buildDeleteImgStyle(isDeleteHovered)}
								/>
							</button>
						</div>
						<div style={CARD_TITLE_STYLE}>
							{kpi.title}
						</div>
						<div style={CARD_DATE_STYLE}>
							{kpi.startLabel} — {kpi.endLabel}
						</div>
						<div style={CARD_COMPLETED_STYLE}>
							Hoàn thành: <strong>{kpi.completedNum}</strong> ngày / {kpi.workdays} ngày làm việc
						</div>
						<div style={CARD_DEPT_STYLE}>
							Phòng ban phụ trách: <strong>{kpi.deptName}</strong>
						</div>
						<div style={CARD_BOTTOM_ROW_STYLE}>
							<div style={CARD_TOTAL_STYLE}>Tổng: <strong>{kpi.totalKpi} KPI</strong></div>
						</div>
					</div>
				);
			})}
			</div>

			{modalOpen && selectedId !== null && (
				<div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => { setModalOpen(false); setIsFullScreen(false); }}>
					<div
						style={{
							width: isFullScreen ? '100%' : '90%',
							maxWidth: isFullScreen ? '100%' :1200,
							height: isFullScreen ? '100vh' : 'min(920px, 96vh)',
							maxHeight: '96vh',
							overflow: 'hidden',
							padding: isFullScreen ? 0 : 16,
							display: 'flex',
							flexDirection: 'column'
						}}
						onClick={(e) => e.stopPropagation()}
					>
						<div style={{ background: '#f8fafc', padding: 0, borderRadius: 8, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
							<KpiDetails initialId={selectedId} isFullScreen={isFullScreen} onToggleFullScreen={() => setIsFullScreen(prev => !prev)} />
						</div>
					</div>
				</div>
			)}

			{editPopupOpen && editPopupId !== null && (
				<KpiEditModal
					open={editPopupOpen}
					onClose={() => setEditPopupOpen(false)}
					kpi={editKpi}
					onSave={async (payload) => {
						const idNum = Number(payload.id);
						try {
							await api.post(`/api/kpis/${idNum}/weeks`, { weeks: payload.weeks });
							setList(prev => prev.map(it => Number(it.chain_kpi_id) === idNum ? { ...it, weeks: payload.weeks } : it));
							setEditPopupOpen(false);
						} catch (err) {
							// Nếu cập nhật từ server lỗi thì vẫn cập nhật cục bộ và đóng popup.
							setList(prev => prev.map(it => Number(it.chain_kpi_id) === idNum ? { ...it, weeks: payload.weeks } : it));
							setEditPopupOpen(false);
						}
					}}
				/>
			)}
		</div>
	);
}
