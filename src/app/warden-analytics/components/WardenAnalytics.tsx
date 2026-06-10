'use client';

import React, { useCallback, useState } from 'react';
import WardenTopBar from './WardenTopBar';
import WardenKPIRow from './WardenKPIRow';
import WardenAlertCenter from './WardenAlertCenter';
import { getIstDateString } from '@/lib/utils/mealStatus';
import WardenMenuApprovalCenter from './WardenMenuApprovalCenter';
import WardenUserApprovalPanel from './WardenUserApprovalPanel';
import FoodWasteChart from './FoodWasteChart';
import SatisfactionMetrics from './SatisfactionMeter';
import AttendanceTrends from './AttendanceTrend';
import CostTracking from './CostTracking';
import SustainabilityKPIs from './SustainabilityKPI';
import WardenMenuVotesCard from './WardenMenuVotesCard';
import WardenComplaintInsights from './WardenComplaintInsights';
import WardenOperationsCenter from './WardenOperationsCenter';
import WardenMenuHistory from './WardenMenuHistory';
import ReportDashboard from '@/app/mess-staff-dashboard/components/ReportDashboard';

type Section = 'overview' | 'operations' | 'menuHistory' | 'waste' | 'satisfaction' | 'attendance' | 'cost' | 'sustainability' | 'reports';

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'operations', label: 'Operations', icon: '🛡️' },
  { id: 'menuHistory', label: 'Menu History', icon: '📜' },
  { id: 'waste', label: 'Food Waste', icon: '🗑️' },
  { id: 'satisfaction', label: 'Satisfaction', icon: '😊' },
  { id: 'attendance', label: 'Attendance', icon: '👥' },
  { id: 'cost', label: 'Cost Tracking', icon: '💰' },
  { id: 'sustainability', label: 'Sustainability', icon: '🌿' },
  { id: 'reports', label: 'Reports', icon: '📈' },
];

export default function WardenAnalyticsClient() {
  const [activeSection, setActiveSection] = useState<Section>('overview');

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleShortcutClick = useCallback((cardId: string) => {
    const navigation: Record<string, { section: Section; targetId?: string }> = {
      'alert-menu': { section: 'overview', targetId: 'menu-approval-center' },
      'alert-approvals': { section: 'operations', targetId: 'user-approval-center' },
      'alert-stock': { section: 'operations' },
      'alert-procurement': { section: 'operations' },
      'alert-plan': { section: 'operations' },
    };

    const destination = navigation[cardId] ?? { section: 'operations' };
    setActiveSection(destination.section);

    if (destination.targetId) {
      const targetId = destination.targetId;
      window.setTimeout(() => {
        const targetElement = document.getElementById(targetId);
        targetElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    }
  }, []);

  const handleExport = async () => {
    try {
      const response = await fetch('/api/reports/export', { method: 'GET' });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'MessMate-Report-June-2026.html';
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'hsl(222 47% 6%)' }}>
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-40 right-0 w-96 h-96 rounded-full opacity-[0.07]"
          style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-0 left-0 w-80 h-80 rounded-full opacity-[0.06]"
          style={{ background: 'radial-gradient(circle, #22c55e 0%, transparent 70%)' }}
        />
        <div
          className="absolute top-1/2 right-1/4 w-64 h-64 rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)' }}
        />
      </div>

      <div className="relative z-10 max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-8 xl:px-10 pb-10 lg:pb-12">
        <WardenTopBar onExportClick={handleExport} onRefreshClick={handleRefresh} />

        <div className="flex gap-2 mb-4 sm:mb-5 overflow-x-auto scrollbar-hide pb-1">
          {SECTIONS.map(s => (
            <button
              key={`tab-${s.id}`}
              onClick={() => setActiveSection(s.id)}
              className={`px-3.5 sm:px-4 py-2 rounded-[0.9rem] text-sm font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
                activeSection === s.id
                  ? 'tab-active' : 'bg-white/4 border border-white/8 text-white/55 hover:bg-white/7'
              }`}
            >
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        {activeSection === 'overview' && (
          <div className="space-y-5 animate-fade-in">
            <WardenKPIRow />
            
            {/* First row: 2 columns on lg, 1 column on smaller screens */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <WardenMenuApprovalCenter />
              <WardenAlertCenter onCardClick={handleShortcutClick} />
            </div>
            
            {/* Second row: 3 columns on xl, 2 columns on lg, 1 column on smaller screens */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
              <div className="lg:col-span-2">
                <WardenComplaintInsights />
              </div>
              <WardenUserApprovalPanel compact onViewAllClick={() => {
                setActiveSection('operations');
                window.setTimeout(() => {
                  document.getElementById('user-approval-center')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 120);
              }} />
            </div>
            
            {/* Third row: 2 columns on lg, 1 column on smaller screens */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div>
                <h2 className="text-xs sm:text-sm font-semibold text-white/50 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span>🗑️</span> Food Waste
                </h2>
                <FoodWasteChart />
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-semibold text-white/50 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span>😊</span> Satisfaction
                </h2>
                <SatisfactionMetrics />
              </div>
            </div>
          </div>
        )}

        {activeSection === 'waste' && (
          <div className="animate-fade-in">
            <FoodWasteChart />
          </div>
        )}

        {activeSection === 'satisfaction' && (
          <div className="animate-fade-in">
            <SatisfactionMetrics />
          </div>
        )}

        {activeSection === 'attendance' && (
          <div className="animate-fade-in">
            <AttendanceTrends />
          </div>
        )}

        {activeSection === 'cost' && (
          <div className="animate-fade-in">
            <CostTracking />
          </div>
        )}

        {activeSection === 'operations' && (
          <div className="animate-fade-in space-y-5">
            <WardenUserApprovalPanel />
            <WardenOperationsCenter />
          </div>
        )}

        {activeSection === 'menuHistory' && (
          <div className="animate-fade-in">
            <WardenMenuHistory />
          </div>
        )}

        {activeSection === 'sustainability' && (
          <div className="animate-fade-in">
            <SustainabilityKPIs />
          </div>
        )}
        
        {activeSection === 'reports' && (
          <div className="animate-fade-in">
            <ReportDashboard />
          </div>
        )}
      </div>
    </div>
  );
}
