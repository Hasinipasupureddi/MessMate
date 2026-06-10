'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Warehouse, PlusCircle, ArrowUpRight, ClipboardList } from 'lucide-react';
import { getIstDateString } from '@/lib/utils/mealStatus';

type InventoryRow = {
  ingredient_id: string;
  ingredient_name: string;
  unit: string;
  per_person_qty: number;
  current_stock: number;
  reorder_threshold: number;
  updated_at: string | null;
};

type PurchaseRequest = {
  id: string;
  ingredient_id: string;
  ingredient_name: string;
  requestedQty: number;
  unit: string;
  status: 'requested' | 'ordered' | 'received' | 'cancelled';
  requested_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export default function InventoryManager() {
  const tomorrow = getIstDateString(1);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState('');
  const [requestedQty, setRequestedQty] = useState(0);
  const [notes, setNotes] = useState('');
  const [editRowId, setEditRowId] = useState<string | null>(null);
  const [editStock, setEditStock] = useState({ currentStock: 0, reorderThreshold: 0 });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [inventoryRes, requestsRes] = await Promise.all([
        fetch('/api/inventory'),
        fetch('/api/purchase-requests'),
      ]);

      if (!inventoryRes.ok || !requestsRes.ok) {
        throw new Error('Unable to load inventory data');
      }

      const inventoryPayload = await inventoryRes.json();
      const requestsPayload = await requestsRes.json();

      setInventory(Array.isArray(inventoryPayload.inventory) ? inventoryPayload.inventory : []);
      setRequests(Array.isArray(requestsPayload.requests) ? requestsPayload.requests : []);
    } catch (error) {
      console.error('Inventory load failed:', error);
      toast.error('Unable to load inventory data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const lowStock = inventory.filter((item) => item.current_stock <= item.reorder_threshold);
  const nextOrderIngredients = lowStock.slice(0, 3).map((item) => item.ingredient_name).join(', ');

  const getStockStatus = (item: InventoryRow) => {
    const currentStock = Number(item.current_stock ?? 0);
    const threshold = Number(item.reorder_threshold ?? 0);

    if (currentStock <= 0) {
      return { label: 'Out of stock', style: 'bg-rose-500/15 text-rose-300' };
    }
    if (currentStock <= threshold) {
      return { label: 'Low stock', style: 'bg-amber-500/15 text-amber-300' };
    }
    return { label: 'Healthy', style: 'bg-emerald-500/15 text-emerald-300' };
  };

  const handleSaveRequest = async () => {
    if (!selectedIngredient || requestedQty <= 0) {
      toast.error('Select an ingredient and enter a quantity.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/purchase-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredientId: selectedIngredient,
          requestedQty,
          notes,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.message || 'Unable to create purchase request');
      }

      const result = await response.json();
      setRequests((prev) => [result.request, ...prev]);
      setSelectedIngredient('');
      setRequestedQty(0);
      setNotes('');
      toast.success('Purchase request created');
    } catch (error) {
      console.error('Create request failed:', error);
      toast.error((error as Error).message || 'Unable to create purchase request');
    } finally {
      setSaving(false);
    }
  };

  const handleEditInventory = (row: InventoryRow) => {
    setEditRowId(row.ingredient_id);
    setEditStock({ currentStock: row.current_stock, reorderThreshold: row.reorder_threshold });
  };

  const handleUpdateInventory = async () => {
    if (!editRowId || editStock.currentStock < 0 || editStock.reorderThreshold < 0) {
      toast.error('Enter valid stock values');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredientId: editRowId,
          currentStock: editStock.currentStock,
          reorderThreshold: editStock.reorderThreshold,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.message || 'Unable to update inventory');
      }

      const payload = await response.json();
      setInventory((prev) => prev.map((item) => item.ingredient_id === editRowId ? payload.inventoryItem : item));
      setEditRowId(null);
      toast.success('Inventory updated');
    } catch (error) {
      console.error('Update inventory failed:', error);
      toast.error((error as Error).message || 'Unable to update inventory');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3 text-white/80 mb-2">
              <Warehouse size={18} className="text-cyan-300" />
              <p className="text-sm font-semibold uppercase tracking-[0.22em]">Inventory Planner</p>
            </div>
            <h2 className="text-2xl font-bold text-white">Procurement & Stock Management</h2>
            <p className="max-w-2xl text-sm text-[hsl(var(--muted-foreground))] mt-2">
              Track ingredient availability, reorder threshold, and purchase requests in one place.
              Use inventory insights to keep tomorrow's meal plan on schedule.
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
            Target date: <span className="text-white font-semibold">{tomorrow}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-5 gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-white/40">Stock status</p>
              <h3 className="text-lg font-bold text-white mt-2">Live inventory snapshot</h3>
            </div>
            <div className="text-right text-sm text-white/70">
              <div>{inventory.length} ingredients</div>
              <div>{lowStock.length} low-stock items</div>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[...Array(4)].map((_, idx) => (
                <div key={idx} className="h-16 rounded-3xl bg-white/5 border border-white/10" />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 text-sm text-white">
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 border-b border-white/10 bg-slate-950/80 px-4 py-3 text-xs uppercase tracking-[0.22em] text-white/50">
                <div>Ingredient</div>
                <div className="text-right">Stock</div>
                <div className="text-right">Threshold</div>
                <div className="text-right">Status</div>
                <div className="text-right">Action</div>
              </div>
              <div className="divide-y divide-white/10">
                {inventory.map((item) => {
                  const status = getStockStatus(item);
                  return (
                    <div key={item.ingredient_id} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 items-center px-4 py-4">
                      <div>
                        <div className="font-semibold text-white">{item.ingredient_name}</div>
                        <div className="mt-1 text-xs text-slate-400">Usage {item.per_person_qty.toFixed(2)} {item.unit}/person</div>
                      </div>
                      <div className="text-right font-semibold text-white">{Number(item.current_stock ?? 0).toFixed(2)} {item.unit}</div>
                      <div className="text-right font-semibold text-white">{Number(item.reorder_threshold ?? 0).toFixed(2)} {item.unit}</div>
                      <div className="text-right">
                        <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${status.style}`}>{status.label}</span>
                      </div>
                      <div className="text-right">
                        <button
                          type="button"
                          onClick={() => handleEditInventory(item)}
                          className="rounded-full bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {lowStock.length > 0 && (
            <div className="mt-5 rounded-3xl border border-amber-500/15 bg-amber-500/5 p-4 text-sm text-amber-100">
              <p className="font-semibold">Shortage alert</p>
              <p className="mt-1 text-white/70">{nextOrderIngredients} {lowStock.length === 1 ? 'is' : 'are'} below reorder threshold.</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="glass-card p-5">
            <div className="flex items-center gap-3 mb-4">
              <PlusCircle size={18} className="text-cyan-300" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-white/40">New purchase request</p>
                <h3 className="text-lg font-bold text-white">Request supplies</h3>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-white/60 uppercase tracking-[0.2em]">Ingredient</label>
                <select
                  value={selectedIngredient}
                  onChange={(e) => setSelectedIngredient(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white"
                >
                  <option value="">Select an ingredient</option>
                  {inventory.map((item) => (
                    <option key={item.ingredient_id} value={item.ingredient_id}>
                      {item.ingredient_name} ({item.current_stock.toFixed(2)} {item.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-white/60 uppercase tracking-[0.2em]">Quantity</label>
                <input
                  type="number"
                  min={1}
                  step={0.5}
                  value={requestedQty}
                  onChange={(e) => setRequestedQty(Number(e.target.value))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-white/60 uppercase tracking-[0.2em]">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white"
                  placeholder="Supplier, expected delivery, or special instructions"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveRequest}
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 hover:bg-cyan-400 disabled:opacity-60"
              >
                <ClipboardList size={16} />
                {saving ? 'Submitting...' : 'Create request'}
              </button>
            </div>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center gap-3 mb-4">
              <Warehouse size={18} className="text-violet-300" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-white/40">Purchase requests</p>
                <h3 className="text-lg font-bold text-white">Open procurement tasks</h3>
              </div>
            </div>

            {loading ? (
              <div className="space-y-3 animate-pulse">
                {[...Array(3)].map((_, idx) => (
                  <div key={idx} className="h-20 rounded-3xl bg-white/5 border border-white/10" />
                ))}
              </div>
            ) : requests.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/60">
                No purchase requests yet. Create one to start the procurement flow.
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((req) => (
                  <div key={req.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">{req.ingredient_name}</p>
                        <p className="text-xs text-white/50">{Number(req.requestedQty ?? 0).toFixed(2)} {req.unit}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${req.status === 'requested' ? 'bg-cyan-500/10 text-cyan-300' : req.status === 'ordered' ? 'bg-indigo-500/10 text-indigo-300' : req.status === 'received' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'}`}>
                        {req.status}
                      </span>
                    </div>
                    {req.notes && <p className="mt-3 text-xs text-white/60">{req.notes}</p>}
                    <p className="mt-3 text-[11px] text-white/50">Requested by {req.requested_by ?? 'staff'} · {new Date(req.created_at).toLocaleString('en-IN')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {editRowId && (
        <div className="glass-card p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-white/40">Edit inventory</p>
              <h3 className="text-lg font-bold text-white">Update stock values</h3>
            </div>
            <button
              type="button"
              onClick={() => setEditRowId(null)}
              className="rounded-full bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 hover:bg-white/10"
            >
              Cancel
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 mt-4">
            <div>
              <label className="text-xs uppercase tracking-[0.18em] text-white/50">Current stock</label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={editStock.currentStock}
                onChange={(e) => setEditStock((prev) => ({ ...prev, currentStock: Number(e.target.value) }))}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.18em] text-white/50">Reorder threshold</label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={editStock.reorderThreshold}
                onChange={(e) => setEditStock((prev) => ({ ...prev, reorderThreshold: Number(e.target.value) }))}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleUpdateInventory}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 hover:bg-cyan-400 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save inventory'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
