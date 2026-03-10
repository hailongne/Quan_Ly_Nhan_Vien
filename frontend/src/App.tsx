import type { ReactElement } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/login/Login';
import ForgotPassword from './pages/login/ForgotPassword';
import ResetPassword from './pages/login/ResetPassword';
import AdminDashboard from './pages/admin/AdminDashboard';
import LeaderDashboard from './pages/leader/LeaderDashboard';
import UserDashboard from './pages/user/UserDashboard';
import DashboardLayout from './pages/components/layout/DashboardLayout';
import UserKpiDashboard from './pages/user/kpi/UserKpiDashboard';
import StaffPage from './pages/admin/staff/StaffPage';
import RoleProtectedRoute from './pages/components/RoleProtectedRoute';
import ProfilePage from './pages/profile/ProfilePage';
import KpiPage from './pages/admin/kpi/KpiPage';
import KpiDetails from './pages/admin/kpi/KpiDetails';
import KpiPublish from './pages/admin/kpi/KpiPublish';
import ManageKpiPage from './pages/leader/kpi/ManageKpiPage';
import TransferredManageKpiPage from './pages/leader/kpi/transferred/TransferredManageKpiPage';
import HandoverKpiPage from './pages/leader/kpi/handover/HandoverKpiPage';
import HandoverTransferPreviewPage from './pages/leader/kpi/handover/HandoverTransferPreviewPage';
import { useAuth } from './contexts/AuthContext';

function RedirectIfAuthed({ children }: { children: ReactElement }) {
	const token = typeof window !== 'undefined' ? (localStorage.getItem('token') || sessionStorage.getItem('token')) : null;
	if (token) return <Navigate to="/" replace />;
	return children;
}

function RoleHome() {
	const { user } = useAuth();
	const role = (user as any)?.role as string | undefined;
	if (role === 'admin') return <Navigate to="/admin" replace />;
	if (role === 'leader') return <Navigate to="/leader" replace />;
	if (role === 'user') return <Navigate to="/user" replace />;
	return <Navigate to="/login" replace />;
}

export default function App() {
	const { user, signout } = useAuth();
	const displayName = (user as any)?.name || (user as any)?.username || 'User';
	return (
		<>
			<Routes>
			<Route path="/login" element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
			<Route path="/forgot-password" element={<ForgotPassword />} />
			<Route path="/reset-password" element={<ResetPassword />} />

			<Route
				path="/admin"
				element={(
					<RoleProtectedRoute allowedRoles={[ 'admin' ]}>
						<AdminDashboard />
					</RoleProtectedRoute>
				)}
			/>

			<Route
				path="/kpi"
				element={(
					<RoleProtectedRoute allowedRoles={[ 'admin' ]}>
						<KpiPage />
					</RoleProtectedRoute>
				)}
			>
				<Route index element={<KpiDetails />} />
				<Route path="details" element={<KpiDetails />} />
				<Route path="publish" element={<KpiPublish />} />
			</Route>

			<Route
				path="/approvals"
				element={(
					<RoleProtectedRoute allowedRoles={[ 'admin' ]}>
						<div style={{ padding: 24, background: '#fff', borderRadius: 8 }}>Chức năng phê duyệt đã bị tắt.</div>
					</RoleProtectedRoute>
				)}
			/>

				<Route
					path="/kpi/manage"
					element={(
						<RoleProtectedRoute allowedRoles={[ 'leader' ]}>
							<ManageKpiPage />
						</RoleProtectedRoute>
					)}
				/>

				<Route
					path="/kpi/transferred"
					element={(
						<RoleProtectedRoute allowedRoles={[ 'leader' ]}>
							<TransferredManageKpiPage />
						</RoleProtectedRoute>
					)}
				/>

				<Route
					path="/kpi/handover"
					element={(
						<RoleProtectedRoute allowedRoles={[ 'leader' ]}>
							<HandoverKpiPage />
						</RoleProtectedRoute>
					)}
				/>

				<Route
					path="/kpi/handover/transfer-preview"
					element={(
						<RoleProtectedRoute allowedRoles={[ 'leader' ]}>
							<HandoverTransferPreviewPage />
						</RoleProtectedRoute>
					)}
				/>

			<Route
				path="/staff"
				element={(
					<RoleProtectedRoute allowedRoles={[ 'admin' ]}>
						<StaffPage />
					</RoleProtectedRoute>
				)}
			/>

			<Route
				path="/leader"
				element={(
					<RoleProtectedRoute allowedRoles={[ 'leader' ]}>
						<LeaderDashboard />
					</RoleProtectedRoute>
				)}
			/>

			<Route
				path="/user"
				element={(
					<RoleProtectedRoute allowedRoles={[ 'leader', 'user' ]}>
						<UserDashboard />
					</RoleProtectedRoute>
				)}
			/>

				<Route
					path="/user/tasks"
					element={(
						<RoleProtectedRoute allowedRoles={[ 'leader', 'user' ]}>
							<DashboardLayout roleLabel="Nhiệm vụ KPI" userName={displayName} onSignOut={signout} activeMenuKey="kpi_task">
								<UserKpiDashboard />
							</DashboardLayout>
						</RoleProtectedRoute>
					)}
				/>

			<Route
				path="/profile"
				element={(
					<RoleProtectedRoute allowedRoles={[ 'leader', 'user' ]}>
						<ProfilePage />
					</RoleProtectedRoute>
				)}
			/>

			<Route path="/" element={<RoleHome />} />
			<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</>
	);
}
