import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import axios from '../../../api/axios';
import { useAuth } from '../../../contexts/AuthContext';
import { notify } from '../../../utils/notify';
import { clearUsersCache } from '../../../utils/usersCache';
import FiltersBar from './components/FiltersBar';
import StaffList from './components/StaffList';
import EditStaffModal from './components/EditStaffModal';
import type { ApiUser } from './types';
import StaffDetailModal from './components/StaffDetailModal';
import DepartmentModal, { createEmptyDepartmentValues, type DepartmentOption, type DepartmentSubmitPayload } from './components/DepartmentModal';
import { confirm } from '../../../utils/confirm';

export default function StaffPageMain(){
	const { user, signout } = useAuth();
	const displayName = (user as any)?.name || (user as any)?.username || 'Admin';

	const [users, setUsers] = useState<ApiUser[]>([]);
	const [admins, setAdmins] = useState<ApiUser[]>([]);
	const [loading, setLoading] = useState(false);
	const [editingUser, setEditingUser] = useState<ApiUser | null>(null);
	const [showEdit, setShowEdit] = useState(false);
	const [viewingUser, setViewingUser] = useState<ApiUser | null>(null);
	const [showView, setShowView] = useState(false);

	const [query, setQuery] = useState('');
	const [status, setStatus] = useState('all');
	const [roleFilter, setRoleFilter] = useState('all');
	const [showDepartmentModal, setShowDepartmentModal] = useState(false);
	const [deptSubmitting, setDeptSubmitting] = useState(false);
	const [deptLoading, setDeptLoading] = useState(false);
	const [deptHover, setDeptHover] = useState(false);
	const [departments, setDepartments] = useState<DepartmentOption[]>([]);
	const departmentInitialValues = useMemo(() => createEmptyDepartmentValues(), []);

	useEffect(()=>{
		async function load(){
			setLoading(true);
			try{
				const [uRes,aRes] = await Promise.all([axios.get('/api/users'), axios.get('/api/admins')]);
				// try to normalize
				const udata: ApiUser[] = (uRes.data || []).map((x: any) => ({
					...x,
					role: x.role ?? 'user',
					status: x.employment_status ?? x.status ?? 'active'
				}));
				const adata: ApiUser[] = (aRes.data || []).map((x: any) => ({ ...x, role: 'admin', status: x.status ?? 'active' }));
				const sortedUsers = [...udata].sort((a, b) => {
					const toTime = (v: any) => {
						const t = v ? new Date(v).getTime() : NaN;
						return Number.isNaN(t) ? 0 : t;
					};
					const aTime = toTime((a as any).created_at ?? (a as any).createdAt ?? (a as any).date_joined);
					const bTime = toTime((b as any).created_at ?? (b as any).createdAt ?? (b as any).date_joined);
					return bTime - aTime;
				});
				setUsers(sortedUsers);
				setAdmins(adata);
			}catch(err){
				console.error(err);
			}finally{ setLoading(false); }
		}
		load();
	},[]);

	useEffect(()=>{
		if (showDepartmentModal) loadDepartments();
	// eslint-disable-next-line react-hooks/exhaustive-deps
	},[showDepartmentModal]);

	const combined = useMemo(()=>[...admins, ...users], [admins, users]);

	const counts = useMemo(()=>{
		const c: Record<string, number> = { all: combined.length, contract:0, official:0, probation:0, intern:0 };
		combined.forEach((u)=>{
			const s = (u.employment_status || u.status || 'contract');
			c[s] = (c[s] || 0) + 1;
		});
		return c;
	},[combined]);

	const filtered = useMemo(()=>{
		const q = query.trim().toLowerCase();
		return combined.filter((u)=>{
			if(roleFilter !== 'all' && u.role !== roleFilter) return false;
			const employment = (u.employment_status || u.status || 'active');
			if(status !== 'all' && employment !== status) return false;
			if(!q) return true;
			const hay = `${u.name||''} ${u.username||''} ${u.email||''} ${u.phone||''} ${u.department||''} ${u.department_position||''}`.toLowerCase();
			return hay.includes(q);
		});
	},[combined, query, status, roleFilter]);

	// Build users/admins lists from their original sources to avoid duplicates
	const usersOnly = filtered.filter(u=>u.role !== 'admin'); // hide admins from main staff table

	 function handleView(user: ApiUser){
		setViewingUser(user);
		setShowView(true);
	 }
	 function handleEdit(user: ApiUser){
		setEditingUser(user);
		setShowEdit(true);
	 }
    async function handleDelete(id:number){
    const ok = await confirm({ title: 'Xóa nhân viên', message: 'Hành động này sẽ xóa vĩnh viễn nhân viên khỏi hệ thống. Bạn có chắc muốn tiếp tục?' });
		if(!ok) return;
			try{
								const res = await axios.post(`/api/users/${id}/disable`);
								const deletedId = res?.data?.deletedId;
								if (deletedId) {
									setUsers(s => s.filter(x => {
										const xid = (x as any).id ?? (x as any).user_id;
										return String(xid) !== String(deletedId);
									}));
								}
						notify.success('Đã xóa', 'Nhân viên đã bị xóa khỏi hệ thống');
			}catch(e){
				notify.error('Xóa thất bại', 'Không thể xóa nhân viên');
			}
	 }
	 function handleAdd(u?: Partial<ApiUser>){
		if(!u) return;
		const newId = (u as any).id ?? (u as any).user_id;
		setUsers(prev => {
			const filtered = newId ? prev.filter(x => (x as any).id !== newId && (x as any).user_id !== newId) : prev;
			return [u as ApiUser, ...filtered];
		});
	 }

	async function loadDepartments(){
		setDeptLoading(true);
		try{
			const res = await axios.get('/api/departments');
			const list = Array.isArray(res.data) ? res.data : [];
			setDepartments(list.map((dept: any) => ({
				department_id: dept.department_id ?? dept.id,
				name: dept.name ?? '',
				description: dept.description ?? null,
				employee_count: typeof dept.employee_count === 'number' ? dept.employee_count : undefined
			})));
		}catch(err){
			console.error('load departments failed', err);
			notify.error('Không tải được danh sách phòng ban');
		}finally{
			setDeptLoading(false);
		}
	}

	async function handleDepartmentSubmit(payload: DepartmentSubmitPayload, departmentId?: number){
		setDeptSubmitting(true);
		const body = { name: payload.name, description: JSON.stringify(payload.roles) };
		try{
			if (departmentId) await axios.put(`/api/departments/${departmentId}`, body);
			else await axios.post('/api/departments', body);
			notify.success('Đã lưu phòng ban');
			await loadDepartments();
			// Invalidate users cache so remaining counts refresh
			clearUsersCache();
		}catch(err){
			console.error('save department failed', err);
			const message = (err as any)?.response?.data?.message || 'Lưu phòng ban thất bại';
			notify.error(message);
			// Invalidate users cache so remaining counts refresh
			clearUsersCache();
		}finally{
			setDeptSubmitting(false);
		}
	}

	async function handleDeleteDepartment(departmentId: number){
		if(!departmentId) return;
		setDeptSubmitting(true);
		try{
			await axios.delete(`/api/departments/${departmentId}`);
			notify.success('Đã xóa phòng ban');
			await loadDepartments();
			// Invalidate users cache to keep counts fresh
			clearUsersCache();
		}catch(err){
			console.error('delete department failed', err);
			const message = (err as any)?.response?.data?.message || 'Xóa phòng ban thất bại';
			notify.error(message);
			// Invalidate users cache to keep counts fresh
			clearUsersCache();
		}finally{
			setDeptSubmitting(false);
		}
	}

	function syncUserLists(updated: ApiUser){
		const updatedId = (updated as any).id ?? (updated as any).user_id;
		setUsers(prev => prev.map(u => ((u as any).id ?? (u as any).user_id) === updatedId ? ({ ...u, ...updated } as ApiUser) : u));
		setAdmins(prev => prev.map(u => ((u as any).id ?? (u as any).user_id) === updatedId ? ({ ...u, ...updated } as ApiUser) : u));
		setViewingUser(prev => {
			if (!prev) return prev;
			const pid = (prev as any).id ?? (prev as any).user_id;
			return pid === updatedId ? ({ ...prev, ...updated } as ApiUser) : prev;
		});
	}

	async function handleUploadAvatar(file: File, target: ApiUser){
		const id = (target as any).id ?? target.user_id;
		if (!id) return;
		const form = new FormData();
		form.append('file', file);
		try{
			const res = await axios.post(`/api/users/${id}/avatar`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
			syncUserLists(res.data as ApiUser);
			notify.success('Đã cập nhật ảnh đại diện');
		}catch(err){
			console.error('upload avatar failed', err);
			notify.error('Tải ảnh thất bại', 'Vui lòng thử lại');
		}
	}

	async function handleUploadCv(file: File, target: ApiUser){
		const id = (target as any).id ?? target.user_id;
		if (!id) return;
		const form = new FormData();
		form.append('file', file);
		try{
			const res = await axios.post(`/api/users/${id}/cv`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
			syncUserLists(res.data as ApiUser);
			notify.success('Đã cập nhật CV');
		}catch(err){
			console.error('upload cv failed', err);
			notify.error('Tải CV thất bại', 'Vui lòng thử lại');
		}
	}

	 function handleSaved(updated?: Partial<ApiUser>){
		if(!updated){ setShowEdit(false); setEditingUser(null); return; }
		const updatedId = (updated as any).id ?? (updated as any).user_id ?? (editingUser as any)?.id ?? (editingUser as any)?.user_id;
		setUsers(prev => prev.map(u => {
			const uid = (u as any).id ?? (u as any).user_id;
			return uid === updatedId ? ({ ...u, ...updated } as ApiUser) : u;
		}));
		setShowEdit(false);
		setEditingUser(null);
	 }

	return (
		<DashboardLayout roleLabel="Quản trị hệ thống" userName={displayName} onSignOut={signout} activeMenuKey="staff">
			<div>
				<div style={{ background: '#fff', padding: 18, borderRadius: 10, marginBottom: 18 }}>
					<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
						<h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>Quản lý nhân viên</h2>
						<button
							type="button"
							onClick={()=>{ setShowDepartmentModal(true); loadDepartments(); }}
							onMouseEnter={()=>setDeptHover(true)}
							onMouseLeave={()=>setDeptHover(false)}
							style={{ padding: '10px 16px', borderRadius: 12, background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)', boxShadow: 'none', border: '1px solid #cbd5f5', color: '#ffffff', fontWeight: 700, cursor: 'pointer', transition: 'transform 160ms ease', transform: deptHover ? 'translateY(-3px) scale(1.02)' : 'translateY(0)' }}
						>
							Quản lý phòng ban
						</button>
					</div>
					<FiltersBar query={query} setQuery={setQuery} status={status} setStatus={setStatus} role={roleFilter} setRole={setRoleFilter} counts={counts} />
					{loading ? <div>Đang tải...</div> : <StaffList users={usersOnly} onView={handleView} onEdit={handleEdit} onDelete={handleDelete} onAdd={handleAdd} />}
				</div>

				<EditStaffModal
					isOpen={showEdit}
					onClose={()=>{ setShowEdit(false); setEditingUser(null); }}
					user={editingUser}
					onSaved={handleSaved}
				/>

				<StaffDetailModal
					isOpen={showView}
					onClose={()=>{ setShowView(false); setViewingUser(null); }}
					user={viewingUser}
					onUploadAvatar={handleUploadAvatar}
					onUploadCv={handleUploadCv}
				/>

				<DepartmentModal
					open={showDepartmentModal}
					submitting={deptSubmitting}
					initialValues={departmentInitialValues}
					onSubmit={handleDepartmentSubmit}
					onClose={()=>setShowDepartmentModal(false)}
					departments={departments}
					loadingDepartments={deptLoading}
					onReloadDepartments={loadDepartments}
					onDeleteDepartment={handleDeleteDepartment}
				/>
			</div>
		</DashboardLayout>
	);
}

