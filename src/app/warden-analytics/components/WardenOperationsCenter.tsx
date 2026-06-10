'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, Bell, CheckCircle2, Loader2, MessageCircle, Package, ShieldCheck, Sparkles, XCircle, Zap } from 'lucide-react';
import { getIstDateString } from '@/lib/utils/mealStatus';
import WardenTimeline from './WardenTimeline';

type InventoryRow = {
  ingredient_id: string;
  ingredient_name: string;
  unit: 'kg' | 'litres' | 'pcs';
  per_person_qty: number;
  current_stock: number;
  reorder_threshold: number;
  updated_at: string | null;
};

type PurchaseRequestRow = {
  id: string;
  ingredient_id: string;
  ingredient_name: string;
  requestedQty: number;
  unit: 'kg' | 'litres' | 'pcs';
  status: 'requested' | 'ordered' | 'received' | 'cancelled';
  requested_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type CookingTaskRow = {
  id: string;
  taskDate: string;
  mealType: string;
  taskName: string;
  status: 'pending' | 'cooking' | 'served';
  assignedTo: string;
  portions: number;
  notes: string | null;
  quantity: string;
  startTime: string;
};

type WardenMenuFeedback = {
  id: string;
  menu_date: string;
  meal_type: string | null;
  warden_id: string;
  action: 'approve' | 'request_changes';
  comment: string | null;
  created_at: string;
};

type PendingMenuDetail = {
  menu: any;
  feedback: WardenMenuFeedback | null;
};

type MenuSnapshot = {
  date: string;
  label: string;
  status: string;
  generated: boolean;
  meals: Array<{ mealType: string; label: string; items: string[] }>;
};

const DATE_OFFSETS = [-1, 0, 1] as const;

function formatMenuDateLabel(date: string) {
  return new Date(`${date}T00:00:00+05:30`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

export default function WardenOperationsCenter() {
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [requests, setRequests] = useState<PurchaseRequestRow[]>([]);
  const [menuSnapshots, setMenuSnapshots] = useState<MenuSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [menuApprovalMessage, setMenuApprovalMessage] = useState<string | null>(null);
  const [requestChangesOpen, setRequestChangesOpen] = useState(false);
  const [requestChangesComment, setRequestChangesComment] = useState('');
  const [requestChangesMessage, setRequestChangesMessage] = useState<string | null>(null);
  const [cookingTasks, setCookingTasks] = useState<CookingTaskRow[]>([]);
  const [wasteLogCount, setWasteLogCount] = useState(0);
  const [pendingMenuDetail, setPendingMenuDetail] = useState<PendingMenuDetail | null>(null);

  const lowStockItems = useMemo(
    () => inventory.filter((item) => item.current_stock <= item.reorder_threshold),
    [inventory]
  );

  const pendingRequests = useMemo(
    () => requests.filter((request) => request.status === 'requested' || request.status === 'ordered'),
    [requests]
  );

  const procurementStats = useMemo(() => {
    return requests.reduce(
      (stats, req) => {
        if (req.status === 'requested') stats.pending += 1;
        if (req.status === 'ordered') stats.ordered += 1;
        if (req.status === 'received') stats.delivered += 1;
        return stats;
      },
      { pending: 0, ordered: 0, delivered: 0 }
    );
  }, [requests]);

  const kitchenStats = useMemo(() => {
    const mealStatusMap = {
      breakfast: 'Pending',
      lunch: 'Pending',
      snack: 'Pending',
      dinner: 'Pending'
    };

    cookingTasks.forEach(task => {
      const type = task.mealType.toLowerCase();
      if (type in mealStatusMap) {
        if (task.status === 'served') mealStatusMap[type as keyof typeof mealStatusMap] = 'Completed';
        else if (task.status === 'cooking') mealStatusMap[type as keyof typeof mealStatusMap] = 'Preparing';
      }
    });

    return mealStatusMap;
  }, [cookingTasks]);

  const today = getIstDateString();
  const tomorrow = getIstDateString(1);

  const menuStatus = useMemo(() => {
    const tomorrowSnapshot = menuSnapshots.find(s => s.date === tomorrow);
    return tomorrowSnapshot?.status || 'No data';
  }, [menuSnapshots, tomorrow]);

  console.log('pendingMenuDetail:', pendingMenuDetail);

  const alerts = useMemo(() => {
    const list = [];
    
    // Critical alerts
    const criticalLowStock = inventory.filter(item => item.current_stock === 0);
    criticalLowStock.forEach(item => {
      list.push({
        severity: 'critical',
        title: `${item.ingredient_name} Out Of Stock`,
        message: 'Kitchen operations may be affected. Approve procurement immediately.',
        icon: <XCircle size={16} className="text-rose-400" />,
        bg: 'bg-rose-500/10',
        border: 'border-rose-500/20',
        text: 'text-rose-200'
      });
    });

    // High alerts
    if (procurementStats.pending > 0) {
      list.push({
        severity: 'high',
        title: `${procurementStats.pending} Procurement Reqs Pending`,
        message: 'New ingredient requests from staff need your review.',
        icon: <Package size={16} className="text-amber-400" />,
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/20',
        text: 'text-amber-200'
      });
    }

    // Medium alerts: Staff overrides that need review
    const staffOverrides = pendingMenuDetail?.menu?.meals?.filter((m: any) => m.winnerSource === 'staff_override') || [];
    if (staffOverrides.length > 0) {
      list.push({
        severity: 'medium',
        title: 'Menu Changes: Overrides Detected',
        message: `Staff modified ${staffOverrides.length} voting results. Review before approving.`,
        icon: <Zap size={16} className="text-amber-400" />,
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/20',
        text: 'text-amber-200'
      });
    }

    // Info
    if (menuStatus === 'Approved') {
      list.push({
        severity: 'info',
        title: 'Tomorrow Menu Approved',
        message: 'Menu is finalized and visible to students.',
        icon: <CheckCircle2 size={16} className="text-emerald-400" />,
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/20',
        text: 'text-emerald-200'
      });
    }

    return list;
  }, [inventory, procurementStats, menuStatus, pendingMenuDetail]);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const dates = DATE_OFFSETS.map((offset) => getIstDateString(offset));
      const today = getIstDateString();
      const tomorrow = getIstDateString(1);

      const [inventoryRes, requestsRes, menuResponses, cookingTasksRes, wasteLogsRes, pendingMenuRes] = await Promise.all([
        fetch('/api/inventory'),
        fetch('/api/purchase-requests'),
        Promise.all(
          dates.map(async (date) => {
            const response = await fetch(`/api/live/final-menu?date=${date}`);
            const payload = await response.json().catch(() => null);
            return { date, response, payload };
          })
        ),
        fetch(`/api/cooking-tasks?date=${today}`),
        fetch(`/api/waste-logs?date=${today}`),
        fetch(`/api/warden/final-menu?date=${tomorrow}`),
      ]);

      if (!inventoryRes.ok || !requestsRes.ok) {
        const errorPayload = await inventoryRes.json().catch(() => null);
        throw new Error(errorPayload?.message || 'Unable to load operations data');
      }

      const [inventoryPayload, requestsPayload, cookingTasksPayload, wasteLogsPayload, pendingMenuPayload] = await Promise.all([
        inventoryRes.json().catch(() => ({})),
        requestsRes.json().catch(() => ({})),
        cookingTasksRes.ok ? cookingTasksRes.json().catch(() => ({ rows: [] })) : Promise.resolve({ rows: [] }),
        wasteLogsRes.ok ? wasteLogsRes.json().catch(() => ({ rows: [] })) : Promise.resolve({ rows: [] }),
        pendingMenuRes.ok ? pendingMenuRes.json().catch(() => null) : Promise.resolve(null),
      ]);

      console.log('WARDEN FINAL MENU PAYLOAD:', pendingMenuPayload);
      console.log('TOMORROW DATE:', tomorrow);

      setInventory(Array.isArray(inventoryPayload.inventory) ? inventoryPayload.inventory : []);
      setRequests(Array.isArray(requestsPayload.requests) ? requestsPayload.requests : []);
      setCookingTasks(Array.isArray(cookingTasksPayload.rows) ? cookingTasksPayload.rows : []);
      setWasteLogCount(Array.isArray(wasteLogsPayload.rows) ? wasteLogsPayload.rows.length : 0);
      setPendingMenuDetail(
        pendingMenuPayload && pendingMenuPayload.menu
          ? { menu: pendingMenuPayload.menu, feedback: pendingMenuPayload.feedback ?? null }
          : null
      );

      const snapshots = menuResponses.map(({ date, response, payload }) => {
        const label = formatMenuDateLabel(date);
        const generated = Boolean(payload?.generated);
        const rawStatus = String(payload?.menu?.status || '').toLowerCase();
        let status = 'Pending approval';
        if (rawStatus === 'approved') {
          status = 'Approved';
        } else if (generated) {
          status = 'Draft preview';
        } else if (!payload?.menu) {
          status = 'No menu available';
        }

        const meals = Array.isArray(payload?.menu?.meals)
          ? payload.menu.meals.map((meal: any) => ({
              mealType: String(meal.mealType || meal.meal_type || 'unknown'),
              label: String(meal.label || meal.mealType || 'Menu'),
              items: Array.isArray(meal.winningItems)
                ? meal.winningItems.map((item: any) => String(item.label || item.selectedOptionId || 'Item'))
                : [],
            }))
          : [];

        return { date, label, status, generated, meals };
      });

      setMenuSnapshots(snapshots);
    } catch (error: any) {
      setError(error?.message || 'Unable to load operations dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  const updateRequestStatus = async (id: string, status: 'ordered' | 'received' | 'cancelled') => {
    setActionInProgress(id);
    try {
      const response = await fetch('/api/purchase-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || 'Unable to update request status');
      }

      setRequests((prev) => prev.map((request) => (request.id === id ? payload.request : request)));
    } catch (error: any) {
      setError(error?.message || 'Unable to update request status');
    } finally {
      setActionInProgress(null);
    }
  };

  const approveMenu = async (date: string) => {
    setActionInProgress(date);
    setError(null);
    setMenuApprovalMessage(null);

    try {
      const response = await fetch(`/api/warden/final-menu?date=${date}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Unable to approve menu.');
      }

      setMenuApprovalMessage(`Menu for ${formatMenuDateLabel(date)} approved.`);
      setRequestChangesMessage(null);
      setRequestChangesOpen(false);
      setRequestChangesComment('');
      await loadDashboardData();
    } catch (error: any) {
      setError(error?.message || 'Unable to approve menu.');
    } finally {
      setActionInProgress(null);
    }
  };

  const requestMenuChanges = async (date: string) => {
    if (!requestChangesComment.trim()) {
      setError('Please add a short change request note before sending.');
      return;
    }

    setActionInProgress(date);
    setError(null);
    setRequestChangesMessage(null);

    try {
      const response = await fetch(`/api/warden/final-menu?date=${date}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_changes', comment: requestChangesComment }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Unable to send change request.');
      }

      setRequestChangesMessage(payload?.message || 'Change request submitted.');
      setRequestChangesOpen(false);
      setRequestChangesComment('');
      await loadDashboardData();
    } catch (error: any) {
      setError(error?.message || 'Unable to send change request.');
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-5">
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white">Operations Snapshot</h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Live menu, inventory health, and procurement approval.</p>
            </div>
            <div className="text-xs uppercase tracking-[0.24em] text-white/40 flex items-center gap-1">
              <Sparkles size={14} /> Real-time
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              <div className="h-48 rounded-3xl bg-white/5 animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="h-24 rounded-3xl bg-white/5 animate-pulse" />
                <div className="h-24 rounded-3xl bg-white/5 animate-pulse" />
                <div className="h-24 rounded-3xl bg-white/5 animate-pulse" />
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
                  {error}
                </div>
              )}

              {menuApprovalMessage && (
                <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                  {menuApprovalMessage}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-300">Inventory</div>
                    <button 
                      onClick={() => {
                        document.getElementById('warden-inventory-alerts')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-wider"
                    >
                      View All →
                    </button>
                  </div>
                  <div className="mt-4 text-3xl font-bold text-white">{inventory.length}</div>
                  <div className="text-xs text-white/50 mt-1">tracked ingredients</div>
                  <div className="mt-3 text-xs flex flex-col gap-1">
                    <span className={lowStockItems.length > 0 ? 'text-amber-400 font-bold' : 'text-slate-500'}>
                      {lowStockItems.length} low stock
                    </span>
                    <span className="text-slate-500">0 critical</span>
                  </div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-4">
                  <div className="text-sm font-semibold text-slate-300">Procurement</div>
                  <div className="mt-4 text-3xl font-bold text-white">{procurementStats.pending}</div>
                  <div className="text-xs text-white/50 mt-1">pending approval</div>
                  <div className="mt-3 text-xs flex flex-col gap-1 text-slate-500">
                    <span className={procurementStats.ordered > 0 ? 'text-indigo-300 font-medium' : ''}>
                      Approved/In Progress: {procurementStats.ordered}
                    </span>
                    <span>Delivered: {procurementStats.delivered}</span>
                  </div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-4">
                  <div className="text-sm font-semibold text-slate-300">Kitchen Workflow</div>
                  <div className="mt-4 space-y-1.5">
                    {Object.entries(kitchenStats).map(([meal, status]) => (
                      <div key={meal} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="capitalize text-slate-400 font-medium">{meal}</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1 h-1 rounded-full ${status === 'Completed' ? 'bg-emerald-400' : status === 'Preparing' ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'}`} />
                          <span className={status === 'Completed' ? 'text-emerald-400 font-bold' : status === 'Preparing' ? 'text-amber-400 font-bold' : 'text-slate-500'}>
                            {status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3.5 text-[10px] text-slate-500/80 italic border-t border-white/5 pt-2">Today&apos;s operational status</div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-4">
                  <div className="text-sm font-semibold text-slate-300">Tomorrow Menu</div>
                  <div className="mt-4 text-lg font-bold text-white truncate">{menuStatus}</div>
                  <div className="text-xs text-white/50 mt-1">approval status</div>
                  <div className="mt-3 text-xs text-slate-500">
                    {menuStatus === 'Approved' ? '✅ Ready for students' : '🔶 Action required'}
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Pending menu approval</h3>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Review the draft and either approve it for students or request changes from staff.</p>
                  </div>
                  <div className="text-xs uppercase tracking-[0.24em] text-white/40 flex items-center gap-1">
                    <MessageCircle size={14} /> Approval
                  </div>
                </div>
                {pendingMenuDetail?.menu?.status === 'awaiting_approval' ? (
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4 space-y-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-white">{formatMenuDateLabel(tomorrow)} draft is waiting for your review.</p>
                        {pendingMenuDetail.feedback?.comment ? (
                          <p className="mt-2 text-sm text-amber-200">Last request: {pendingMenuDetail.feedback.comment}</p>
                        ) : (
                          <p className="mt-2 text-sm text-slate-300">No previous change requests have been made for this draft.</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void approveMenu(tomorrow)}
                          disabled={actionInProgress === tomorrow}
                          className="rounded-2xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                        >
                          {actionInProgress === tomorrow ? 'Approving...' : 'Approve menu'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRequestChangesOpen((open) => !open)}
                          className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20"
                        >
                          Request changes
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {pendingMenuDetail?.menu?.meals?.map((meal: any, idx: number) => (
                        <div key={`${meal.mealType}-${idx}-preview`} className="rounded-3xl border border-white/10 bg-slate-950/80 p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-[10px] uppercase tracking-[0.24em] text-indigo-400 font-bold">{meal.mealType}</div>
                            {meal.winnerSource === 'staff_override' && (
                              <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full border border-amber-500/20">Override</span>
                            )}
                          </div>
                          <div className="text-sm font-bold text-white mb-1">{meal.title}</div>
                          <div className="text-xs text-slate-300 line-clamp-2">
                            {meal.winningItems?.map((item: any) => item.label).join(' + ') || 'No selection available'}
                          </div>
                        </div>
                      ))}
                    </div>

                    {requestChangesOpen && (
                      <div className="space-y-3">
                        <label className="text-sm text-slate-300">Change request details</label>
                        <textarea
                          value={requestChangesComment}
                          onChange={(event) => setRequestChangesComment(event.target.value)}
                          rows={3}
                          className="input-glass w-full resize-none bg-slate-950/90 text-white placeholder:text-slate-500"
                          placeholder="Ask staff to swap a dish, adjust quantities, or preserve a vote override."
                        />
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => void requestMenuChanges(tomorrow)}
                            disabled={actionInProgress === tomorrow}
                            className="rounded-2xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-400 disabled:opacity-50"
                          >
                            {actionInProgress === tomorrow ? 'Sending...' : 'Send request'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setRequestChangesOpen(false)}
                            className="rounded-2xl border border-white/10 px-3 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/5"
                          >
                            Cancel
                          </button>
                        </div>
                        {requestChangesMessage && (
                          <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                            {requestChangesMessage}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <p className="text-sm text-slate-300">No menu draft is currently pending warden approval for tomorrow.</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-4 space-y-4">
                  <h3 className="text-sm font-semibold text-white">Menu control quick view</h3>
                  {menuSnapshots.map((snapshot) => (
                    <div key={snapshot.date} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white">{snapshot.label}</div>
                          <div className="text-xs text-white/50">{snapshot.status}</div>
                        </div>
                        <div className={`text-[11px] font-semibold uppercase rounded-full px-2.5 py-1 ${snapshot.status === 'Approved' ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/20' : 'bg-amber-500/15 text-amber-200 border border-amber-500/20'}`}>
                          {snapshot.status === 'Approved' ? 'Approved' : 'Draft'}
                        </div>
                      </div>
                      <div className="mt-3 text-sm text-slate-200 space-y-2">
                        {snapshot.meals.slice(0, 2).map((meal) => (
                          <div key={`${snapshot.date}-${meal.mealType}`}>
                            <div className="text-xs uppercase tracking-[0.24em] text-white/40">{meal.mealType}</div>
                            <div>{meal.items.join(' + ') || 'No menu items available'}</div>
                          </div>
                        ))}
                      </div>
                      {snapshot.status === 'Pending approval' && (
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void approveMenu(snapshot.date)}
                            disabled={actionInProgress === snapshot.date}
                            className="rounded-2xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                          >
                            {actionInProgress === snapshot.date ? 'Approving...' : 'Approve menu'}
                          </button>
                          <span className="text-xs text-slate-400">This draft is ready for warden approval and student notification.</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div id="warden-inventory-alerts" className="rounded-3xl border border-white/10 bg-slate-950/80 p-4 space-y-4">
                  <h3 className="text-sm font-semibold text-white">Inventory alerts</h3>
                  {lowStockItems.length === 0 ? (
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">All tracked ingredients are above reorder thresholds.</div>
                  ) : (
                    <div className="space-y-3">
                      {lowStockItems.slice(0, 4).map((item) => (
                        <div key={item.ingredient_id} className="rounded-3xl bg-zinc-950/80 p-3 border border-white/10">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm text-white">{item.ingredient_name}</div>
                            <div className="text-xs uppercase tracking-[0.24em] text-rose-300">Low stock</div>
                          </div>
                          <div className="mt-2 text-xs text-white/60">{item.current_stock.toFixed(1).replace(/\.0$/, '')} / {item.reorder_threshold.toFixed(1).replace(/\.0$/, '')} {item.unit}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white">Procurement approval</h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Approve purchase requests and keep the kitchen stocked.</p>
            </div>
            <div className="text-xs uppercase tracking-[0.24em] text-white/40 flex items-center gap-1">
              <Package size={14} /> Purchase flow
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 className="animate-spin text-white/60" size={24} />
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  No pending purchase approvals. All current requests have been processed.
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingRequests.slice(0, 5).map((request) => (
                    <div key={request.id} className="rounded-3xl border border-white/10 bg-slate-950/80 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white">{request.ingredient_name}</div>
                          <div className="text-xs text-white/50">{request.requestedQty} {request.unit}</div>
                          {request.notes ? <div className="mt-2 text-xs text-slate-300">Note: {request.notes}</div> : null}
                        </div>
                        <div className="text-xs uppercase tracking-[0.24em] text-white/40">{request.status}</div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {request.status === 'requested' ? (
                          <>
                            <button
                              disabled={actionInProgress === request.id}
                              onClick={() => void updateRequestStatus(request.id, 'ordered')}
                              className="btn-glass inline-flex items-center gap-2 text-sm"
                            >
                              <ArrowRight size={14} /> Mark ordered
                            </button>
                            <button
                              disabled={actionInProgress === request.id}
                              onClick={() => void updateRequestStatus(request.id, 'cancelled')}
                              className="btn-glass inline-flex items-center gap-2 text-sm text-rose-200 border-rose-500/20 hover:bg-rose-500/10"
                            >
                              <XCircle size={14} /> Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              disabled={actionInProgress === request.id}
                              onClick={() => void updateRequestStatus(request.id, 'received')}
                              className="btn-glass inline-flex items-center gap-2 text-sm"
                            >
                              <CheckCircle2 size={14} /> Mark received
                            </button>
                            <button
                              disabled={actionInProgress === request.id}
                              onClick={() => void updateRequestStatus(request.id, 'cancelled')}
                              className="btn-glass inline-flex items-center gap-2 text-sm text-rose-200 border-rose-500/20 hover:bg-rose-500/10"
                            >
                              <XCircle size={14} /> Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <WardenTimeline />
      </div>

      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white">Alerts & notes</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Operational updates prioritized by severity.</p>
          </div>
          <div className="text-xs uppercase tracking-[0.24em] text-white/40 flex items-center gap-1">
            <Bell size={14} /> Alerts
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {alerts.length > 0 ? (
            alerts.map((alert, idx) => (
              <div key={`${alert.title}-${idx}`} className={`rounded-3xl border ${alert.border} ${alert.bg} p-4`}>
                <div className={`flex items-center gap-2 text-sm ${alert.text} font-semibold`}>
                  {alert.icon} {alert.title}
                </div>
                <p className="mt-2 text-xs text-slate-300">
                  {alert.message}
                </p>
              </div>
            ))
          ) : (
            <div className="col-span-full rounded-3xl border border-white/10 bg-white/5 p-4 text-center text-sm text-slate-400">
              No active operational alerts at the moment.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
