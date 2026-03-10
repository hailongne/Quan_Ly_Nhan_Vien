import { useAuth } from '../../contexts/AuthContext';
import DashboardLayout from '../components/layout/DashboardLayout';
import UserOverviewDashboard from './UserOverviewDashboard';

export default function UserDashboard() {
  const { user, signout } = useAuth();
  const displayName = (user as any)?.name || (user as any)?.username || 'User';

  return (
    <DashboardLayout roleLabel="Tổng quan" userName={displayName} onSignOut={signout} activeMenuKey="dashboard">
      <UserOverviewDashboard />
    </DashboardLayout>
  );
}
  