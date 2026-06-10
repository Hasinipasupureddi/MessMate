'use client';

import React from 'react';

export default function SplashScreen() {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background:
          'linear-gradient(135deg, hsl(222 47% 6%) 0%, hsl(222 47% 10%) 100%)',
      }}
    >
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full opacity-20 animate-pulse"
          style={{ background: 'radial-gradient(circle, #22d3ee 0%, transparent 70%)' }}
        />
        <div className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full opacity-20 animate-pulse"
          style={{ background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)' }}
        />
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* Splash Content */}
      <div className="relative z-10 flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-700">
        {/* Icon */}
        <div className="relative">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center shadow-[0_0_40px_rgba(34,211,238,0.4)]">
            <span className="text-5xl">🍽️</span>
          </div>
          {/* Ripple effect */}
          <div className="absolute -inset-4 rounded-3xl border-2 border-cyan-400/30 animate-ping" />
        </div>

        {/* Text */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-white tracking-tight">
            MessMate
          </h1>
          <p className="text-cyan-300 text-sm uppercase tracking-[0.2em]">
            AI-Powered Mess Management
          </p>
        </div>
      </div>
    </div>
  );
}
