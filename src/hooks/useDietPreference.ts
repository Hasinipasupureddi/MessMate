'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeDietPreference, type DietPreference } from '@/lib/menu/masterMenu';

const DIET_EVENT = 'messmate-diet-change';

export function useDietPreference(): DietPreference {
  const { user } = useAuth();
  const [dietPreference, setDietPreference] = useState<DietPreference>(() => 
    normalizeDietPreference(user?.foodPreference)
  );

  useEffect(() => {
    const loadPreference = () => {
      // Priority 1: Auth user preference
      if (user?.foodPreference) {
        setDietPreference(normalizeDietPreference(user.foodPreference));
        return;
      }

      // Priority 2: Local storage (fallback for anonymous/loading)
      try {
        const stored = window.localStorage.getItem('messmate_diet');
        if (stored) {
          setDietPreference(normalizeDietPreference(stored));
        } else {
          setDietPreference('veg');
        }
      } catch {
        setDietPreference('veg');
      }
    };

    loadPreference();

    const syncFromStorage = () => {
      loadPreference();
    };

    window.addEventListener('storage', syncFromStorage);
    window.addEventListener(DIET_EVENT, syncFromStorage);

    return () => {
      window.removeEventListener('storage', syncFromStorage);
      window.removeEventListener(DIET_EVENT, syncFromStorage);
    };
  }, [user, user?.foodPreference]);

  return dietPreference;
}
