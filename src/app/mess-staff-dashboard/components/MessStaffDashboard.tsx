'use client';

import React, { useState, useEffect } from 'react';
import { Toaster } from 'sonner';
import StaffTopBar from './StaffTopBar';
import StaffKPIRow from './StaffKPIRow';
import CookingPlanTable from './CookingPlanTable';
import IngredientCalculator from './IngredientCalculator';
import InventoryManager from './InventoryManager';
import RatingsChart from './RatingsChart';
import WasteLogger from './WasteLogger';
import LiveOptInCounter from './LiveOptInCount';
import TomorrowMenuVotes from './TomorrowMenuVotes';
import LeftoverDeclarationWorkflow from './LeftoverDeclarationWorkflow';
import ComplaintQueue from './ComplaintQueue';
import ProcurementManager from './ProcurementManager';
import ReportDashboard from './ReportDashboard';

export default function MessStaffDashboardClient() {
  const [activeSection, setActiveSection] = useState<'overview' | 'cooking' | 'ingredients' | 'inventory' | 'procurement' | 'ratings' | 'reports'>('overview');

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const section = params.get('section');
      if (section === 'inventory' || section === 'cooking' || section === 'ingredients' || section === 'ratings' || section === 'overview' || section === 'procurement' || section === 'reports') {
        setActiveSection(section as any);
        // scroll to cooking if requested
        if (section === 'cooking') {
          window.requestAnimationFrame(() => {
            document.querySelector('[data-staff-cooking]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        }
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const handleRefreshPage = () => {
    window.location.reload();
  };

  const handleTodayPlanClick = () => {
    setActiveSection('cooking');
    window.requestAnimationFrame(() => {
      document.querySelector('[data-staff-cooking]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const sections = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'cooking' as const, label: 'Cooking Plan' },
    { id: 'ingredients' as const, label: 'Ingredients' },
    { id: 'inventory' as const, label: 'Inventory' },
    { id: 'procurement' as const, label: 'Procurement' },
    { id: 'ratings' as const, label: 'Ratings' },
    { id: 'reports' as const, label: 'Reports' },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'hsl(222 47% 6%)' }}>
      <Toaster position="top-right" richColors />

      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 right-0 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full opacity-8"
          style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }} />
      </div>

      <div className="relative z-10 max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-8 xl:px-10 pb-10 lg:pb-12">
        <StaffTopBar
          onTodayPlanClick={handleTodayPlanClick}
          onRefreshClick={handleRefreshPage}
        />

        {/* Section tabs */}
        <div className="flex gap-2 mb-4 sm:mb-5 overflow-x-auto scrollbar-hide pb-1">
          {sections.map(s => (
            <button
              key={`section-${s.id}`}
              onClick={() => setActiveSection(s.id)}
              className={`px-3.5 sm:px-4 py-2 rounded-[0.9rem] text-sm font-semibold whitespace-nowrap transition-all ${
                activeSection === s.id
                  ? 'tab-active' :'bg-white/4 border border-white/8 text-white/55 hover:bg-white/7'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {activeSection === 'overview' && (
          <div className="space-y-5 animate-fade-in" data-staff-overview>
            <StaffKPIRow />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <LiveOptInCounter />
              <WasteLogger />
            </div>
            <div className="grid grid-cols-1 gap-5">
              <TomorrowMenuVotes />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <LeftoverDeclarationWorkflow />
              <ComplaintQueue />
            </div>
            <RatingsChart />
          </div>
        )}

        {activeSection === 'cooking' && (
          <div className="animate-fade-in" data-staff-cooking>
            <CookingPlanTable />
          </div>
        )}

        {activeSection === 'ingredients' && (
          <div className="animate-fade-in">
            <IngredientCalculator />
          </div>
        )}

        {activeSection === 'inventory' && (
          <div className="animate-fade-in">
            <InventoryManager />
          </div>
        )}

        {activeSection === 'procurement' && (
          <div className="animate-fade-in">
            <ProcurementManager />
          </div>
        )}

        {activeSection === 'ratings' && (
          <div className="animate-fade-in">
            <RatingsChart expanded />
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