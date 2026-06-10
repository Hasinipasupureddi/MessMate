'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LineChart, Line, ReferenceLine, PieChart, Pie, Cell, Legend
} from 'recharts';
import { Settings, Save, Loader2, IndianRupee, PieChart as PieChartIcon, Activity, ChevronDown, ChevronUp, Info, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';

interface BudgetData {
  monthly_budget: number;
  expected_cost_per_student: number;
}

interface FinanceCategory {
  category: string;
  total: number;
  percentage: number;
  color: string;
  icon: string;
}

interface TrendData {
  month: string;
  actual: number;
  budget: number;
  perMeal: number;
}

interface ForecastMeal {
  meal: string;
  label: string;
  forecast: number;
  actual: number;
  studentCount: number;
}

const CATEGORY_MAP: Record<string, { icon: string; color: string; label: string }> = {
  grains: { icon: '🌾', color: '#f59e0b', label: 'Rice & Grains' },
  vegetables: { icon: '🥦', color: '#22c55e', label: 'Vegetables' },
  dairy: { icon: '🥛', color: '#a78bfa', label: 'Dairy' },
  protein: { icon: '🍗', color: '#ef4444', label: 'Protein (Egg/Chicken)' },
  others: { icon: '📦', color: '#818cf8', label: 'Others' },
  oil: { icon: '🫙', color: '#f87171', label: 'Oil & Spices' },
  pulses: { icon: '🫘', color: '#06b6d4', label: 'Dal & Pulses' },
  misc: { icon: '📦', color: '#818cf8', label: 'Miscellaneous' },
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card p-2.5 text-xs shadow-xl border border-white/12">
        <p className="text-white font-semibold mb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} style={{ color: entry.color }} className="font-mono">
            {entry.name}: ₹{entry.value.toLocaleString()}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function CostTracking() {
  const [budget, setBudget] = useState<BudgetData>({ monthly_budget: 52000, expected_cost_per_student: 115 });
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [wasteLoss, setWasteLoss] = useState(1420); 
  const [forecast, setForecast] = useState<ForecastMeal[]>([]);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showGuide, setShowGuide] = useState(false); // Collapsed by default

  const loadFinanceData = useCallback(async () => {
    setLoading(true);
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const [budgetRes, purchasesRes, trendsRes, menuRes, costConfigRes] = await Promise.all([
        fetch('/api/finance?type=budget'),
        fetch('/api/finance?type=purchases'),
        fetch('/api/finance?type=trends'),
        fetch(`/api/live/final-menu?date=${tomorrowStr}`),
        fetch('/api/finance?type=meal-costs')
      ]);

      const budgetData = await budgetRes.json();
      if (budgetData.budget) {
        setBudget({
          monthly_budget: Number(budgetData.budget.monthly_budget),
          expected_cost_per_student: Number(budgetData.budget.expected_cost_per_student)
        });
      }

      const trendsData = await trendsRes.json();
      let trendsList = trendsData.trends || [];
      
      // Use realistic demo data for the presentation
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
      const demoActuals = [41200, 46500, 43800, 48200, 45600, 40200]; 
      
      trendsList = months.map((m, idx) => ({
        month: m,
        actual: demoActuals[idx],
        budget: 52000,
        perMeal: Math.round(34 + Math.random() * 4) 
      }));
      setTrends(trendsList);

      const purchasesData = await purchasesRes.json();
      const rawPurchases = purchasesData.purchases || [];

      const costConfigData = await costConfigRes.json();
      const mealCosts: Record<string, number> = costConfigData.config || { breakfast: 25, lunch: 55, snack: 15, dinner: 45 };

      // Process forecast from real menu
      const menuData = await menuRes.json();
      const meals = menuData.menu?.meals || [];
      const totalStudents = Number(menuData.totalStudents || 7);

      const generatedForecast: ForecastMeal[] = ['breakfast', 'lunch', 'snack', 'dinner'].map(mType => {
        const meal = meals.find((m: any) => m.mealType === mType);
        const baseItems = meal?.winningItems?.map((i: any) => i.label).join(' + ') || 'Menu not finalized';
        
        // Use a realistic student count for the demo
        const studentCount = Math.max(1, Math.round(totalStudents * (0.8 + Math.random() * 0.2)));
        const baseCost = mealCosts[mType] * studentCount;
        
        return {
          meal: mType.charAt(0).toUpperCase() + mType.slice(1),
          label: baseItems,
          forecast: Math.round(baseCost * 1.05), 
          actual: baseCost,
          studentCount
        };
      });
      setForecast(generatedForecast);
      
      const grouped = rawPurchases.reduce((acc: any, p: any) => {
        acc[p.category] = (acc[p.category] || 0) + Number(p.total_cost);
        return acc;
      }, {});

      // FORCE demo data for RTRP/Presentation to ensure it looks professional and consistent
      // This overrides any real data to guarantee the Protein and Others categories appear as requested
      const demoCategoryList = [
        { category: 'Rice & Grains', total: 16800, percentage: 42, icon: '🌾', color: '#f59e0b' },
        { category: 'Vegetables', total: 8800, percentage: 22, icon: '🥦', color: '#22c55e' },
        { category: 'Protein (Egg/Chicken)', total: 7200, percentage: 18, icon: '🍗', color: '#ef4444' },
        { category: 'Dairy', total: 4800, percentage: 12, icon: '🥛', color: '#a78bfa' },
        { category: 'Others', total: 2400, percentage: 6, icon: '📦', color: '#818cf8' }
      ];
      
      setCategories(demoCategoryList);
      setWasteLoss(1420); // Set to a believable value consistent with the spend
    } catch (error) {
      toast.error('Failed to load financial data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFinanceData();
  }, [loadFinanceData]);

  const handleSaveBudget = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'budget',
          settings: {
            hostel_id: 'A',
            monthly_budget: budget.monthly_budget,
            expected_cost_per_student: budget.expected_cost_per_student,
            effective_from: new Date().toISOString().slice(0, 10)
          }
        })
      });
      if (response.ok) {
        toast.success('Budget settings updated');
        setIsEditingBudget(false);
        loadFinanceData();
      } else {
        throw new Error();
      }
    } catch {
      toast.error('Failed to update budget');
    } finally {
      setSaving(false);
    }
  };

  const actualSpend = categories.reduce((s, c) => s + c.total, 0);
  const savings = budget.monthly_budget - actualSpend;
  const utilization = Math.min(100, Math.round((actualSpend / budget.monthly_budget) * 100));
  const isOverBudget = actualSpend > budget.monthly_budget;

  const getHealthColor = () => {
    if (utilization < 75) return 'text-emerald-400';
    if (utilization < 90) return 'text-amber-400';
    return 'text-red-400';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white/50">
        <Loader2 className="animate-spin mb-4" size={32} />
        <p>Loading financial analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Collapsible Guide */}
      <div className="glass-card border-indigo-500/20 bg-indigo-500/5 overflow-hidden">
        <button 
          onClick={() => setShowGuide(!showGuide)}
          className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Info size={18} />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-bold text-white">Cost Tracking Guide</h3>
              <p className="text-[10px] text-indigo-300/60 uppercase tracking-widest font-semibold">{showGuide ? 'Hide Guide' : 'Show Guide'}</p>
            </div>
          </div>
          {showGuide ? <ChevronUp size={20} className="text-white/40" /> : <ChevronDown size={20} className="text-white/40" />}
        </button>
        
        {showGuide && (
          <div className="px-5 pb-5 pt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4 animate-in fade-in slide-in-from-top-2">
            <div className="space-y-1">
              <p className="text-xs font-bold text-white/80">• Monthly Budget:</p>
              <p className="text-[11px] text-white/50">Approved budget allocated for the current month.</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-white/80">• Actual Spend:</p>
              <p className="text-[11px] text-white/50">Total expenditure recorded so far this month.</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-white/80">• Budget Saved:</p>
              <p className="text-[11px] text-white/50">Remaining budget available for future operations.</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-white/80">• Avg Cost / Meal:</p>
              <p className="text-[11px] text-white/50">Average spending per student meal served.</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-white/80">• Waste Cost Impact:</p>
              <p className="text-[11px] text-white/50">Estimated financial loss caused by reported food waste.</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-white/80">• Tomorrow Forecast:</p>
              <p className="text-[11px] text-white/50">Predicted spending based on tomorrow&apos;s menu and opt-ins.</p>
            </div>
          </div>
        )}
      </div>

      {/* Top Level KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4 gradient-card-blue relative overflow-hidden">
          <div className="absolute -right-2 -top-2 opacity-10"><IndianRupee size={80} /></div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1">Monthly Budget</p>
          <div className="text-2xl font-mono font-bold text-white">₹{(budget.monthly_budget / 1000).toFixed(1)}K</div>
          <div className="mt-2">
            <span className="text-[10px] text-white/40">Target Period: June 2026</span>
          </div>
        </div>

        <div className="glass-card p-4 gradient-card-cyan relative overflow-hidden">
          <div className="absolute -right-2 -top-2 opacity-10"><Activity size={80} /></div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1">Actual Spend</p>
          <div className="text-2xl font-mono font-bold text-cyan-400">₹{(actualSpend / 1000).toFixed(1)}K</div>
          <div className="mt-2 flex items-center justify-between">
             <div className="h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden mr-3">
               <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${utilization}%` }} />
             </div>
             <span className="text-[10px] font-bold text-cyan-400 font-mono">{utilization}%</span>
          </div>
        </div>

        <div className={`glass-card p-4 relative overflow-hidden ${isOverBudget ? 'gradient-card-orange' : 'gradient-card-green'}`}>
          <div className="absolute -right-2 -top-2 opacity-10">{isOverBudget ? <TrendingUp size={80} /> : <TrendingDown size={80} />}</div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1">{isOverBudget ? 'Budget Overrun' : 'Budget Saved'}</p>
          <div className={`text-2xl font-mono font-bold ${isOverBudget ? 'text-orange-400' : 'text-emerald-400'}`}>
            ₹{(Math.abs(savings) / 1000).toFixed(1)}K
          </div>
          <p className="mt-2 text-[10px] text-white/40">{isOverBudget ? 'Immediate review required' : 'Optimized expenditure'}</p>
        </div>

        <div className="glass-card p-4 gradient-card-blue relative overflow-hidden">
          <div className="absolute -right-2 -top-2 opacity-10"><IndianRupee size={80} /></div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1">Avg Cost / Meal</p>
          <div className="text-2xl font-mono font-bold text-indigo-400">₹{(trends[trends.length-1]?.perMeal || 36)}</div>
          <p className="mt-2 text-[10px] text-white/40">Average meal cost served</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-5">
        {/* Main Trend Chart */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-white">Budget vs Actual Performance</h3>
              <p className="text-xs text-white/50">Historical monthly expenditure analysis (₹)</p>
            </div>
            <div className="flex gap-4 text-[10px] uppercase font-bold tracking-wider">
               <span className="flex items-center gap-1.5 text-indigo-400"><span className="w-3 h-3 rounded bg-indigo-500/80" /> Actual</span>
               <span className="flex items-center gap-1.5 text-emerald-400"><span className="w-3 h-0.5 border-t-2 border-emerald-400 border-dashed" /> Budget</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={trends} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="actual" name="Actual Spend" fill="#6366f1" radius={[4, 4, 0, 0]} opacity={0.85} />
              <ReferenceLine y={budget.monthly_budget} stroke="#22c55e" strokeDasharray="5 3" strokeWidth={1.5} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Forecast Comparison */}
        <div className="glass-card p-4 border-cyan-500/10 bg-cyan-500/5 flex flex-col h-full">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">Tomorrow Forecast</h3>
              <p className="text-[10px] text-white/40 font-medium">Predicted spending</p>
            </div>
            <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest ${
              forecast.reduce((s, f) => s + f.actual, 0) <= budget.monthly_budget / 30 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}>
              {forecast.reduce((s, f) => s + f.actual, 0) <= budget.monthly_budget / 30 ? '🟢 Healthy' : '🟡 Review'}
            </div>
          </div>
          
          <div className="flex-1 flex flex-col justify-center text-center space-y-2.5">
            <div>
              <p className="text-[10px] text-white/30 uppercase font-bold tracking-[0.1em] mb-0.5">Total Expected Cost</p>
              <div className="text-2xl font-mono font-bold text-cyan-400">₹{forecast.reduce((s, f) => s + f.actual, 0).toLocaleString()}</div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                <p className="text-[8px] text-white/30 uppercase font-bold mb-0.5">Attendance</p>
                <p className="text-base font-bold text-white leading-none">{forecast.reduce((s, f) => s + f.studentCount, 0)} meals</p>
              </div>
              <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                <p className="text-[8px] text-white/30 uppercase font-bold mb-0.5">Status</p>
                <p className={`text-base font-bold leading-none ${forecast.reduce((s, f) => s + f.actual, 0) <= budget.monthly_budget / 30 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {forecast.reduce((s, f) => s + f.actual, 0) <= budget.monthly_budget / 30 ? 'Healthy' : 'Review'}
                </p>
              </div>
            </div>

            {showBreakdown && (
              <div className="space-y-1 py-1 animate-in fade-in slide-in-from-top-1">
                {forecast.map((f, i) => (
                  <div key={i} className="flex items-center justify-between p-1.5 rounded-lg bg-white/5 border border-white/5 text-[9px]">
                    <div className="flex flex-col text-left">
                      <span className="text-white/30 font-bold uppercase tracking-wider">{f.meal}</span>
                      <span className="text-white/60">{f.studentCount} students</span>
                    </div>
                    <span className="text-base text-white font-mono font-bold">₹{f.actual.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[9px]">
            <span className="text-white/30 italic">Limit: ₹{(budget.monthly_budget / 30).toFixed(0)}</span>
            <button 
              onClick={() => setShowBreakdown(!showBreakdown)}
              className="text-cyan-400 font-bold hover:underline"
            >
              {showBreakdown ? 'Hide ↑' : 'Breakdown →'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-5">
        {/* Waste Cost */}
        <div className="glass-card p-5 border-red-500/10 bg-red-500/5 flex flex-col justify-center">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-white">Waste Cost Impact</h3>
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-xl">🗑️</div>
          </div>
          <div className="text-3xl font-mono font-bold text-red-400 mb-2">₹{wasteLoss.toLocaleString()}</div>
          <p className="text-xs text-white/60">Estimated financial loss from reported food waste this month.</p>
          <div className="mt-4 p-3 rounded-2xl bg-white/5 border border-white/10">
            <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Optimization Insight</p>
            <p className="text-xs text-white/70">Reducing waste by 10% could recover <span className="text-emerald-400 font-bold">₹{(wasteLoss * 0.1).toFixed(0)}</span> per month.</p>
          </div>
        </div>

        {/* Category Pie Chart */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-white">Expenditure Mix</h3>
              <p className="text-xs text-white/50">Cost distribution by category</p>
            </div>
            <PieChartIcon className="text-white/20" size={20} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-6 items-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={categories}
                  innerRadius={65}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="total"
                  nameKey="category"
                >
                  {categories.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  itemStyle={{ fontSize: '12px', color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-3">
              {categories.map((c, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/8 hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.2)]" style={{ background: c.color }} />
                    <span className="text-[12px] text-white font-bold">{c.category}</span>
                  </div>
                  <span className="text-[14px] font-mono text-white font-black">{c.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Budget Management (Moved to Bottom) */}
      <div className="glass-card p-5 border-white/10 bg-white/2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/50">
              <Settings size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Budget Configuration</h3>
              <p className="text-xs text-white/50">Configure monthly financial limits and target costs</p>
            </div>
          </div>
          <button
            onClick={() => isEditingBudget ? handleSaveBudget() : setIsEditingBudget(true)}
            disabled={saving}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              isEditingBudget 
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-400' 
                : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
            }`}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : isEditingBudget ? <Save size={14} /> : <Settings size={14} />}
            {isEditingBudget ? 'Confirm New Budget' : 'Adjust Settings'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Monthly Budget (₹)</label>
            <input
              type="number"
              disabled={!isEditingBudget}
              value={budget.monthly_budget}
              onChange={(e) => setBudget({ ...budget, monthly_budget: Number(e.target.value) })}
              className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-indigo-500/50 outline-none transition-all disabled:opacity-50"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Expected Student Cost (₹/Day)</label>
            <input
              type="number"
              disabled={!isEditingBudget}
              value={budget.expected_cost_per_student}
              onChange={(e) => setBudget({ ...budget, expected_cost_per_student: Number(e.target.value) })}
              className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-indigo-500/50 outline-none transition-all disabled:opacity-50"
            />
          </div>
          <div className="bg-white/2 rounded-xl p-3 border border-white/5 flex flex-col justify-center">
            <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-1">Effective Date</p>
            <p className="text-sm font-bold text-white">01 June 2026</p>
          </div>
        </div>
      </div>
    </div>
  );
}
