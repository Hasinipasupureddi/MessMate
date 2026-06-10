'use client';

import React from 'react';
import { Home, UtensilsCrossed, Vote, Clock } from 'lucide-react';

type Tab = 'home' | 'menu' | 'vote' | 'history';

interface Props {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

const NAV_ITEMS: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
  { id: 'home', label: 'Home', icon: <Home size={20} /> },
  { id: 'menu', label: 'Menu', icon: <UtensilsCrossed size={20} /> },
  { id: 'vote', label: 'Vote', icon: <Vote size={20} />, badge: 1 },
  { id: 'history', label: 'History', icon: <Clock size={20} /> },
];

export default function StudentBottomNav({ activeTab, setActiveTab }: Props) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 sm:px-5 lg:px-8 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      <div className="mx-auto max-w-md sm:max-w-lg lg:max-w-xl xl:max-w-2xl">
        <div className="student-bottom-nav grid grid-cols-4 gap-1 px-2 sm:px-3 py-2.5">
          {NAV_ITEMS.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={`nav-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`relative flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 sm:px-3 sm:py-2.5 transition-all active:scale-95 ${
                  isActive
                    ? 'bg-indigo-500/22 dark:bg-indigo-500/22 text-indigo-300 dark:text-indigo-300 shadow-[0_10px_20px_rgba(99,102,241,0.32)]' 
                    :'text-white/55 dark:text-white/55 hover:text-white/85 dark:hover:text-white/85'
                }`}
                style={{ 
                  color: isActive 
                    ? 'var(--student-text)' 
                    : 'var(--student-muted)' 
                }}
              >
                <span className="scale-95 sm:scale-100">{item.icon}</span>
                <span className="text-[10px] sm:text-[11px] font-semibold tracking-wide leading-none">{item.label}</span>
                {item.badge && !isActive && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-indigo-500 text-white text-xs font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

