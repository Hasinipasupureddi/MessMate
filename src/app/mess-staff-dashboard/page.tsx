'use client';

import { ProtectedRoute } from '@/contexts/useRoleRedirect';
import MessStaffDashboardClient from './components/MessStaffDashboard';

export default function MessStaffDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={['staff']}>
      <MessStaffDashboardClient />
    </ProtectedRoute>
  );
}
