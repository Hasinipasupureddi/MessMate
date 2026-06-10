'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle2, ClipboardList, Package, ShieldCheck, Sparkles, TrendingUp, Users, Zap } from 'lucide-react';
import { getIstDateString } from '@/lib/utils/mealStatus';

type AlertCard = {
  id: string;
  label: string;
  value: string;
  detail: string;
  actionText: string;
  icon: React.ReactNode;
  colorClass: string;
};

type WardenAlertCenterProps = {
  onCardClick?: (cardId: string) => void;
};

export default function WardenAlertCenter({ onCardClick }: WardenAlertCenterProps) {
  const [displayMode, setDisplayMode] = useState<'expanded' | 'compact' | 'collapsed'>('expanded');
  const [loading, setLoading] = useState(true);
  const [inventoryCount, setInventoryCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [pendingProcurement, setPendingProcurement] = useState(0);
  const [totalRequests, setTotalRequests] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [openComplaints, setOpenComplaints] = useState(0);
  const [planCount, setPlanCount] = useState(0);
  const [planItems, setPlanItems] = useState(0);
  const [planShortages, setPlanShortages] = useState(0);
  const [menuStatus, setMenuStatus] = useState('Unknown');
  const [menuApproved, setMenuApproved] = useState(false);
  const [menuSummary, setMenuSummary] = useState<string | null>(null);
  const [kpis, setKpis] = useState<{ totalWasteKg: number; avgRating: number; totalOptins: number; totalUniqueParticipants: number; totalStudents: number; } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAlerts = async () => {
      setLoading(true);
      setError(null);

      try {
        const today = getIstDateString();
        const tomorrow = getIstDateString(1);
        const [inventoryRes, requestsRes, complaintsRes, planRes, menuRes, usersRes, kpiRes] = await Promise.all([
          fetch('/api/inventory'),
          fetch('/api/purchase-requests'),
          fetch('/api/complaints?role=warden'),
          fetch(`/api/ingredient-plans?date=${tomorrow}`),
          fetch(`/api/live/final-menu?date=${tomorrow}`),
          fetch('/api/warden/users?status=pending'),
          fetch(`/api/warden/kpis?date=${today}`),
        ]);

        const inventoryPayload = await inventoryRes.json().catch(() => ({}));
        const requestsPayload = await requestsRes.json().catch(() => ({}));
        const complaintsPayload = await complaintsRes.json().catch(() => ({}));
        const planPayload = await planRes.json().catch(() => ({}));
        const menuPayload = await menuRes.json().catch(() => ({}));
        const usersPayload = await usersRes.json().catch(() => ({}));
        const kpiPayload = await kpiRes.json().catch(() => ({}));

        const inventoryList = Array.isArray(inventoryPayload.inventory) ? inventoryPayload.inventory : [];
        const requestList = Array.isArray(requestsPayload.requests) ? requestsPayload.requests : [];
        const complaintList = Array.isArray(complaintsPayload.rows) ? complaintsPayload.rows : [];

        setInventoryCount(inventoryList.length);
        setLowStockCount(inventoryList.filter((item: any) => Number(item.current_stock || 0) <= Number(item.reorder_threshold || 0)).length);
        setPendingProcurement(requestList.filter((request: any) => request.status === 'requested' || request.status === 'ordered').length);
        setTotalRequests(requestList.length);
        setPendingApprovals(Array.isArray(usersPayload.users) ? usersPayload.users.length : 0);
        setOpenComplaints(complaintList.filter((complaint: any) => complaint.status !== 'resolved').length);

        const planRows = Array.isArray(planPayload.plan) ? planPayload.plan : [];
        const activePlanRows = planRows.filter((item: any) => !item.is_removed);
        const shortageCount = activePlanRows.filter((item: any) => Number(item.planned_qty || 0) > 0 && item.is_custom === false && Number(item.planned_qty || 0) > 0).length;

        setPlanCount(planRows.length);
        setPlanItems(activePlanRows.length);
        setPlanShortages(shortageCount);

        const menu = menuPayload?.menu;
        const status = String(menu?.status || 'Pending approval');
        const isApproved = status.toLowerCase() === 'approved';
        setMenuStatus(isApproved ? 'Approved' : status || 'Awaiting approval');
        setMenuApproved(isApproved);

        if (isApproved && menu?.meals) {
          const summary = menu.meals.map((m: any) => `${m.mealType}: ${m.winningItems.map((i: any) => i.label).join(' + ')}`).join(' · ');
          setMenuSummary(summary);
        } else {
          setMenuSummary(null);
        }

        if (kpiRes.ok) {
          setKpis({
            totalWasteKg: Number(kpiPayload.totalWasteKg || 0),
            avgRating: Number(kpiPayload.avgRating || 0),
            totalOptins: Number(kpiPayload.totalOptins || 0),
            totalUniqueParticipants: Number(kpiPayload.totalUniqueParticipants || 0),
            totalStudents: Number(kpiPayload.totalStudents || 0),
          });
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    void loadAlerts();
  }, []);

  const engineStatus = useMemo(() => {
    if (!kpis) return 'Loading metrics...';
    if (kpis.avgRating < 3.8) return 'Satisfaction below target';
    if (kpis.totalWasteKg > 8) return 'Waste is trending high';
    if (kpis.totalUniqueParticipants === 0) return 'Awaiting meal opt-ins';
    return 'Operations running within expected bounds';
  }, [kpis]);

  const cards: AlertCard[] = [
    {
      id: 'alert-stock',
      label: 'Inventory',
      value: `${inventoryCount}`,
      detail: `${lowStockCount} item${lowStockCount === 1 ? '' : 's'} below reorder threshold`,
      actionText: 'View inventory',
      icon: <Zap size={18} />,
      colorClass: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    },
    {
      id: 'alert-procurement',
      label: 'Purchases',
      value: `${pendingProcurement}`,
      detail: `${totalRequests} active requests`,
      actionText: 'Review purchase requests',
      icon: <ClipboardList size={18} />,
      colorClass: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
    },
    {
      id: 'alert-plan',
      label: 'Plan',
      value: planCount > 0 ? `${planItems}` : '0',
      detail: planCount > 0 ? `${planShortages} items need review` : 'Tomorrow plan missing',
      actionText: 'Open ingredient plan',
      icon: <Package size={18} />,
      colorClass: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
    },
    {
      id: 'alert-approvals',
      label: 'Accounts',
      value: `${pendingApprovals}`,
      detail: pendingApprovals > 0 ? 'Review new registrations' : 'No pending approvals',
      actionText: 'Open user approvals',
      icon: <Users size={18} />,
      colorClass: pendingApprovals > 0 ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    },
    {
      id: 'alert-menu',
      label: 'Menu',
      value: menuApproved ? 'OK' : 'Review',
      detail: menuApproved ? 'Tomorrow’s menu approved' : 'Needs approval',
      actionText: 'Review tomorrow menu',
      icon: <CheckCircle2 size={18} />,
      colorClass: menuApproved ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    },
  ];

  const alerts = useMemo(() => {
    if (loading) {
      return ['Loading warden alerts…'];
    }

    const messages: string[] = [];
    if (lowStockCount > 0) {
      messages.push(`⚠️ ${lowStockCount} low-stock ingredient${lowStockCount === 1 ? '' : 's'} need review.`);
    }
    if (pendingProcurement > 0) {
      messages.push(`🛒 ${pendingProcurement} purchase request${pendingProcurement === 1 ? '' : 's'} await approval.`);
    }
    if (pendingApprovals > 0) {
      messages.push(`🔴 ${pendingApprovals} new account${pendingApprovals === 1 ? '' : 's'} awaiting approval.`);
    }
    if (planCount === 0) {
      messages.push('📝 No ingredient plan has been saved for tomorrow yet.');
    } else {
      messages.push(`📝 ${planItems} planned ingredient${planItems === 1 ? '' : 's'} saved for tomorrow.`);
      if (planShortages > 0) {
        messages.push(`🚨 ${planShortages} plan item${planShortages === 1 ? '' : 's'} may still need stock review.`);
      }
    }
    if (menuStatus) {
      messages.push(menuApproved ? '✅ Tomorrow\'s menu is approved.' : `🔶 Tomorrow's menu: ${menuStatus}.`);
    }
    if (openComplaints > 0) {
      messages.push(`📝 ${openComplaints} unresolved complaint${openComplaints === 1 ? '' : 's'}.`);
    }
    if (kpis) {
      if (kpis.avgRating > 0 && kpis.avgRating < 3.8) {
        messages.push('📉 Student satisfaction is under 3.8. Review meal feedback.');
      }
      if (kpis.totalWasteKg > 8) {
        messages.push('♻️ Waste is above 8kg today. Adjust portions for high-waste meals.');
      }
      const participationRate = kpis.totalStudents > 0 ? Math.round((kpis.totalUniqueParticipants / kpis.totalStudents) * 100) : 0;
      if (participationRate > 0 && participationRate < 80) {
        messages.push(`👥 Participation is ${participationRate}%. Encourage early opt-ins.`);
      }
    }

    return messages.length > 0 ? messages : ['✅ All core operations are stable.'];
  }, [kpis, lowStockCount, openComplaints, pendingProcurement, pendingApprovals, loading]);

  return (
    <div className="space-y-5">
      <div className="glass-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-white/40 mb-2 flex items-center gap-2">
              <Bell size={14} /> Quick actions
            </div>
            <h2 className="text-2xl font-bold text-white">Warden dashboard shortcuts</h2>
            <p className="max-w-2xl text-sm text-[hsl(var(--muted-foreground))] mt-2">Quick access to inventory, purchase approvals, ingredient planning, menu review, and registrations.</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
            Status: <span className="font-semibold text-white">{engineStatus}</span>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
            {error}
          </div>
        )}

        {displayMode === 'collapsed' ? (
          <div className="mt-5 rounded-3xl border border-white/10 bg-slate-950/80 p-4 text-sm text-white/80 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.24em] text-white/40">Quick actions</p>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">Inventory {inventoryCount}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">Purchases {pendingProcurement}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">Accounts {pendingApprovals}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">Menu {menuApproved ? 'Approved' : 'Pending'}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDisplayMode('compact')}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
            >
              Show shortcuts
            </button>
          </div>
        ) : (
          <>
            <div className="mt-5 flex flex-wrap gap-3 items-center">
              <button
                type="button"
                onClick={() => setDisplayMode('expanded')}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${displayMode === 'expanded' ? 'bg-white text-slate-950' : 'bg-white/10 text-white/70 hover:bg-white/15'}`}
              >
                Expanded
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('compact')}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${displayMode === 'compact' ? 'bg-white text-slate-950' : 'bg-white/10 text-white/70 hover:bg-white/15'}`}
              >
                Compact
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('collapsed')}
                className="rounded-full px-3 py-1.5 text-xs font-semibold transition bg-white/10 text-white/70 hover:bg-white/15"
              >
                Hide
              </button>
            </div>

            {displayMode === 'compact' ? (
              <div className="mt-5 overflow-x-auto pb-2">
                <div className="inline-flex gap-3 min-w-[700px]">
                  {cards.map(card => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => onCardClick?.(card.id)}
                      className={`inline-flex items-center gap-3 rounded-full border ${card.colorClass} px-4 py-3 text-left transition hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-white/20`}
                    >
                      <div className="rounded-full bg-white/10 p-2 text-white">{card.icon}</div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-white/40">{card.label}</div>
                        <div className="text-sm font-semibold text-white">{card.value}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid gap-3 mt-5 grid-cols-1 sm:grid-cols-2">
                {cards.map(card => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => onCardClick?.(card.id)}
                    className={`rounded-3xl border ${card.colorClass} p-4 text-left transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-white/20`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-white/40">{card.label}</p>
                        <p className="mt-2 text-xl font-semibold text-white">{card.value}</p>
                      </div>
                      <div className="rounded-2xl bg-white/10 p-2 text-white">{card.icon}</div>
                    </div>
                    <p className="mt-3 text-xs text-white/60">{card.detail}</p>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        <div className="mt-5 rounded-3xl border border-white/10 bg-slate-950/80 p-4 text-sm text-white/80">
          <div className="flex flex-wrap gap-3">
            {alerts.map((message, index) => (
              <span key={index} className="rounded-full border border-white/10 bg-white/5 px-3 py-2">
                {message}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
