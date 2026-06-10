'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSplash } from '@/contexts/SplashContext';
import SplashScreen from './SplashScreen';

export default function AppWrapper({ children }: { children: React.ReactNode }) {
  const { isSplashVisible, setIsSplashVisible, hasShownInitialSplash, setHasShownInitialSplash } = useSplash();
  const router = useRouter();
  const pathname = usePathname();

  // Handle initial splash screen
  useEffect(() => {
    if (!hasShownInitialSplash) {
      const timer = setTimeout(() => {
        setIsSplashVisible(false);
        setHasShownInitialSplash(true);
        if (pathname === '/') {
          router.replace('/sign-up-login-screen');
        }
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [hasShownInitialSplash, setIsSplashVisible, setHasShownInitialSplash, pathname, router]);

  if (isSplashVisible) {
    return <SplashScreen />;
  }

  return <>{children}</>;
}
