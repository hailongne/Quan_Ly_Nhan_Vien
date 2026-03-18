import { Navigate } from 'react-router-dom';
import DashboardLayout from '../../pages/components/layout/DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import DailyTaskManagementPage from './DailyTaskManagementPage';

export default function DailyRouter() {
  const { user, signout } = useAuth();
  const role = String((user as any)?.role ?? '').toLowerCase();
  const displayName = (user as any)?.name || (user as any)?.username || '';

  if (!role) return <Navigate to="/login" replace />;

  if (role === 'user' || role === 'leader' || role === 'admin') {
    return (
      <DashboardLayout roleLabel="Hằng ngày" userName={displayName} onSignOut={signout} activeMenuKey="daily">
        <DailyTaskManagementPage role={role} />
      </DashboardLayout>
    );
  }

  return <Navigate to="/login" replace />;
}
