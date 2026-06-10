'use client';

import { ProtectedRoute } from '@/contexts/useRoleRedirect';
import WardenAnalyticsClient from './components/WardenAnalytics';

export default function WardenAnalyticsPage() {
  return (
    <ProtectedRoute allowedRoles={['warden']}>
      <WardenAnalyticsClient />
    </ProtectedRoute>
  );
}
