import type { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function RoleProtectedRoute({ allowedRoles, children }: { allowedRoles: string[]; children: ReactElement }) {
  const { user } = useAuth();
  const role = (user as any)?.role as string | undefined;
  if (!role) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(role)) return <Navigate to="/" replace />;
  return children;
}
