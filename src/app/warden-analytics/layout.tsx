import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Warden Analytics | MessMate',
  description: 'Food waste, satisfaction, attendance, cost tracking and sustainability KPIs',
};

export default function WardenAnalyticsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
