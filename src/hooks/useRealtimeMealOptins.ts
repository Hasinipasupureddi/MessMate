import { useEffect } from 'react';
import { SOCKET_EVENTS, subscribeSocketEvent } from '@/lib/socket/client';

type Options = {
  mealIds: string[];
  onChange: () => void;
};

export function useRealtimeMealOptins(_options: Options): void {
  const { onChange } = _options;

  useEffect(() => {
    const cleanupMealOptins = subscribeSocketEvent(SOCKET_EVENTS.mealOptinsUpdated, () => {
      onChange();
    });

    const cleanupDashboardRefresh = subscribeSocketEvent(SOCKET_EVENTS.dashboardRefresh, () => {
      onChange();
    });

    return () => {
      cleanupMealOptins();
      cleanupDashboardRefresh();
    };
  }, [onChange]);
}
