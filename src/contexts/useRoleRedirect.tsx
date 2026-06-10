'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Hook to redirect user based on role after login
export const useRoleBasedRedirect = () => {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      const routes: Record<string, string> = {
        student: '/student-dashboard',
        staff: '/mess-staff-dashboard',
        warden: '/warden-analytics',
      };

      const route = routes[user.role] || '/';
      router.replace(route);
    }
  }, [user, loading, router]);
};

// Protected route component that checks auth
export const ProtectedRoute = ({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: ('student' | 'staff' | 'warden')[];
}) => {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/sign-up-login-screen');
      } else if (allowedRoles && !allowedRoles.includes(user.role)) {
        const routes: Record<string, string> = {
          student: '/student-dashboard',
          staff: '/mess-staff-dashboard',
          warden: '/warden-analytics',
        };
        router.replace(routes[user.role] || '/');
      }
    }
  }, [user, loading, router, allowedRoles]);

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!user || (allowedRoles && !allowedRoles.includes(user.role))) {
    return null;
  }

  return <>{children}</>;
};