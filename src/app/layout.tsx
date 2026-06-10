import React from 'react';
import type { Metadata, Viewport } from 'next';
import '../styles/tailwind.css';
import { AuthProvider } from '@/contexts/AuthContext';

function shouldLoadRocketAnalytics(): boolean {
  const flag = process.env.NEXT_PUBLIC_ROCKET_ANALYTICS;
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return process.env.NODE_ENV === 'production';
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'MessMate — AI-Powered Smart Hostel Mess Management',
  description: 'MessMate helps hostels reduce food waste by 40%, predict meal demand with AI, and digitize mess operations for students, staff, and wardens.',
  icons: {
    icon: [{ url: '/favicon.ico', type: 'image/x-icon' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-sans">
        <AuthProvider>
          {children}
        </AuthProvider>

        {shouldLoadRocketAnalytics() ? (
          <>
            <script
              type="module"
              async
              src="https://static.rocket.new/rocket-web.js?_cfg=https%3A%2F%2Fmessmate1323back.builtwithrocket.new&_be=https%3A%2F%2Fappanalytics.rocket.new&_v=0.1.17"
            />
            <script type="module" defer src="https://static.rocket.new/rocket-shot.js?v=0.0.2" />
          </>
        ) : null}
      </body>
    </html>
  );
}