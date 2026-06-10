'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface SplashContextType {
  showSplash: () => void;
  isSplashVisible: boolean;
  setIsSplashVisible: (visible: boolean) => void;
  hasShownInitialSplash: boolean;
  setHasShownInitialSplash: (shown: boolean) => void;
}

const SplashContext = createContext<SplashContextType | undefined>(undefined);

export const SplashProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSplashVisible, setIsSplashVisible] = useState(true); // Show on initial load
  const [hasShownInitialSplash, setHasShownInitialSplash] = useState(false);

  const showSplash = useCallback(() => {
    setIsSplashVisible(true);
  }, []);

  return (
    <SplashContext.Provider
      value={{
        showSplash,
        isSplashVisible,
        setIsSplashVisible,
        hasShownInitialSplash,
        setHasShownInitialSplash,
      }}
    >
      {children}
    </SplashContext.Provider>
  );
};

export const useSplash = () => {
  const context = useContext(SplashContext);
  if (!context) {
    throw new Error('useSplash must be used within SplashProvider');
  }
  return context;
};
