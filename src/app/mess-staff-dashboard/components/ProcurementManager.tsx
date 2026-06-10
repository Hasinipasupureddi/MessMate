'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, Plus, Loader2, Save, X, Calendar, User, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { getIstDateString } from '@/lib/utils/mealStatus';

interface Vendor {
  id: string;
  name: string;
  category: string;
}

interface Purchase {
  id: string;
  item_name: string;
  category: string;
  quantity: number;
  unit: string;
  total_cost: number;
  purchase_date: string;
  vendor_name: string;
  invoice_no?: string;
}

export default function ProcurementManager() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const [newPurchase, setNewPurchase] = useState({
    vendor_id: '',
    item_name: '',
    category: 'misc',
    quantity: 0,
    unit: 'kg',
    total_cost: 0,
    invoice_no: '',
    purchase_date: getIstDateString()
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, vRes] = await Promise.all([
        fetch('/api/finance?type=purchases'),
        fetch('/api/finance?type=vendors')
      ]);
      const pData = await pRes.json();
      const vData = await vRes.json();
      setPurchases(pData.purchases || []);
      setVendors(vData.vendors || []);
      if (vData.vendors?.length > 0) {
        setNewPurchase(prev => ({ ...prev, vendor_id: vData.vendors[0].id }));
      }
    } catch {
      toast.error('Failed to load procurement data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPurchase.item_name || !newPurchase.vendor_id || newPurchase.total_cost <= 0) {
      toast.error('Please fill all required fields');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'purchase', purchase: newPurchase })
      });
      if (res.ok) {
        toast.success('Purchase recorded successfully');
        setIsAdding(false);
        loadData();
        setNewPurchase({
          vendor_id: vendors[0]?.id || '',
          item_name: '',
          category: 'misc',
          quantity: 0,
          unit: 'kg',
          total_cost: 0,
          invoice_no: '',
          purchase_date: getIstDateString()
        });
      } else {
        throw new Error();
      }
    } catch {
      toast.error('Failed to save purchase');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-white/50"><Loader2 className="animate-spin mx-auto mb-2" /> Loading records...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Procurement & Purchases</h2>
          <p className="text-sm text-white/50">Record and track ingredient expenditures</p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/20"
        >
          {isAdding ? <X size={16} /> : <Plus size={16} />}
          {isAdding ? 'Cancel' : 'Add Purchase'}
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="glass-card p-6 border-indigo-500/30 bg-indigo-500/5 animate-in slide-in-from-top-4 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Vendor</label>
              <select
                value={newPurchase.vendor_id}
                onChange={e => setNewPurchase({...newPurchase, vendor_id: e.target.value})}
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500/50 outline-none"
              >
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name} ({v.category})</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Item Name</label>
              <input
                type="text"
                placeholder="e.g. Basmati Rice"
                value={newPurchase.item_name}
                onChange={e => setNewPurchase({...newPurchase, item_name: e.target.value})}
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500/50 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Category</label>
              <select
                value={newPurchase.category}
                onChange={e => setNewPurchase({...newPurchase, category: e.target.value})}
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500/50 outline-none"
              >
                <option value="grains">Rice & Grains</option>
                <option value="vegetables">Vegetables</option>
                <option value="dairy">Dairy</option>
                <option value="oil">Oil & Spices</option>
                <option value="pulses">Pulses</option>
                <option value="misc">Miscellaneous</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Quantity</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={newPurchase.quantity}
                  onChange={e => setNewPurchase({...newPurchase, quantity: Number(e.target.value)})}
                  className="flex-1 bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500/50 outline-none"
                />
                <select
                  value={newPurchase.unit}
                  onChange={e => setNewPurchase({...newPurchase, unit: e.target.value as any})}
                  className="w-24 bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500/50 outline-none"
                >
                  <option value="kg">kg</option>
                  <option value="litres">litres</option>
                  <option value="pcs">pcs</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Total Cost (₹)</label>
              <input
                type="number"
                value={newPurchase.total_cost}
                onChange={e => setNewPurchase({...newPurchase, total_cost: Number(e.target.value)})}
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500/50 outline-none font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Purchase Date</label>
              <input
                type="date"
                value={newPurchase.purchase_date}
                onChange={e => setNewPurchase({...newPurchase, purchase_date: e.target.value})}
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500/50 outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Confirm Purchase
            </button>
          </div>
        </form>
      )}

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10">
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/40 font-bold">Date</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/40 font-bold">Item</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/40 font-bold">Vendor</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/40 font-bold">Qty</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-white/40 font-bold text-right">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-white/30 text-sm italic">No purchase records found</td>
                </tr>
              ) : (
                purchases.map(p => (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-white/70 text-sm font-medium">
                        <Calendar size={14} className="text-white/20" />
                        {new Date(p.purchase_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-white text-sm font-bold">{p.item_name}</div>
                      <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider flex items-center gap-1 mt-0.5">
                        <Tag size={10} /> {p.category}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-white/70 text-sm">
                        <User size={14} className="text-white/20" />
                        {p.vendor_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-white/60 text-sm font-mono">
                      {p.quantity} {p.unit}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-emerald-400 font-mono font-bold text-sm">₹{Number(p.total_cost).toLocaleString()}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
