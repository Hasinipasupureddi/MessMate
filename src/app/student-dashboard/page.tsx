'use client';

import { ProtectedRoute } from '@/contexts/useRoleRedirect';
import StudentDashboardClient from './components/StudentDashboard';

export default function StudentDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={['student']}>
      <StudentDashboardClient />
    </ProtectedRoute>
  );
}