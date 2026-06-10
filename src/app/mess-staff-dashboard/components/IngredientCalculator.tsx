'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Calculator, RefreshCw, ChefHat } from 'lucide-react';
import { getIstDateString } from '@/lib/utils/mealStatus';

interface Ingredient {
  id: string;
  name: string;
  emoji: string;
  perPerson: number;
  unit: string;
  category: 'grain' | 'vegetable' | 'dairy' | 'spice' | 'other';
  currentStock: number;
  stockUnit: string;
}

type CalculatedIngredient = Ingredient & { required: number; stockOk: boolean; shortage: number };

type EditableIngredient = CalculatedIngredient & { adjustedRequired: number; isManual?: boolean };

type MenuMeal = {
  mealType: string;
  title: string;
  fixedItems: string[];
  winningItems: Array<{ label: string; items: string[] }>;
};

const EMOJI_MAP: Record<string, string> = {
  grain: '🌾', vegetable: '🥕', dairy: '🥛', spice: '🌶️', other: '🫙',
};

export default function IngredientCalculator() {
  const today = getIstDateString(0);
  const tomorrow = getIstDateString(1);

  const [headcount, setHeadcount] = useState(0);
  const [buffer, setBuffer] = useState(10);
  const [ingredients, setIngredients] = useState<CalculatedIngredient[]>([]);
  const [menuMeals, setMenuMeals] = useState<MenuMeal[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [headcountSource, setHeadcountSource] = useState<'optin' | 'manual'>('optin');
  const [forecast, setForecast] = useState({ confirmed: 0, predicted: 0 });
  const [totalStudents, setTotalStudents] = useState(0);
  const [actualQuantities, setActualQuantities] = useState<Record<string, number>>({});
  const [savingActuals, setSavingActuals] = useState(false);
  const [plannedQuantities, setPlannedQuantities] = useState<Record<string, number>>({});
  const [customIngredients, setCustomIngredients] = useState<EditableIngredient[]>([]);
  const [hiddenIngredientIds, setHiddenIngredientIds] = useState<string[]>([]);
  const [prepNotes, setPrepNotes] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);
  const [creatingRequests, setCreatingRequests] = useState<Record<string, boolean>>({});
  const [editingIngredientId, setEditingIngredientId] = useState<string | null>(null);
  const [editingIngredientName, setEditingIngredientName] = useState('');

  const effectiveCount = Math.ceil(headcount * (1 + buffer / 100));

  // 1. Load live opt-in counts for tomorrow and vote participation as forecast inputs
  const loadForecast = useCallback(async () => {
    try {
      const [optinsRes, votesRes] = await Promise.all([
        fetch(`/api/meal-optins?date=${tomorrow}`),
        fetch(`/api/meal-votes?date=${tomorrow}`)
      ]);
      
      const optinsData = await optinsRes.json().catch(() => ({}));
      const votesData = await votesRes.json().catch(() => ({}));

      if (!optinsRes.ok || !votesRes.ok) return;

      const mealCounts = (optinsData?.rows ?? []).reduce(
        (acc: Record<string, number>, row: any) => {
          const mealType = String(row.meal_type || row.mealType || '');
          if (!mealType) return acc;
          acc[mealType] = Math.max(acc[mealType] || 0, Number(row.confirmed || 0));
          return acc;
        },
        { breakfast: 0, lunch: 0, snack: 0, dinner: 0 }
      );

      const confirmed = Math.max(
        mealCounts.breakfast,
        mealCounts.lunch,
        mealCounts.snack,
        mealCounts.dinner,
        0
      );

      const uniqueVoters = Number(votesData?.totalUniqueVoters || 0);
      const extraPredicted = confirmed > 0
        ? Math.max(0, Math.ceil((uniqueVoters - confirmed) * 0.5))
        : Math.ceil(uniqueVoters * 0.7);

      const totalForecast = confirmed > 0
        ? confirmed + extraPredicted
        : Math.max(totalStudents, uniqueVoters, 0);

      setForecast({ confirmed, predicted: extraPredicted });

      if (totalForecast > 0 && headcountSource === 'optin') {
        setHeadcount(totalForecast);
      }
    } catch { /* non-blocking */ }
  }, [tomorrow, headcountSource, totalStudents]);

  // 2. Load tomorrow's finalized menu for context
  const loadMenu = useCallback(async () => {
    try {
      const res = await fetch(`/api/live/final-menu?date=${tomorrow}`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) return;

      const meals: MenuMeal[] = (payload?.rows ?? []).map((m: any) => ({
        mealType: m.mealType,
        title: m.title,
        fixedItems: m.fixedItems ?? [],
        winningItems: m.winningItems ?? [],
      }));
      setMenuMeals(meals);

      // Also fetch total students as fallback if no opt-ins/votes yet
      if (payload?.totalStudents) {
        setTotalStudents(Number(payload.totalStudents));
      }

      if (payload?.totalStudents && headcount === 0 && headcountSource === 'optin') {
        setHeadcount(Number(payload.totalStudents));
      }
    } catch { /* non-blocking */ }
    finally { setLoadingMenu(false); }
  }, [tomorrow, headcount, headcountSource]);

  // 3. Fetch calculated ingredients from API
  const fetchIngredients = useCallback(async (hc: number, buf: number) => {
    if (hc <= 0) return;
    try {
      const res = await fetch(`/api/ingredients/calculate?headcount=${hc}&buffer=${buf}&date=${tomorrow}`);
      if (!res.ok) return;
      const data = await res.json();
      setIngredients(data.ingredients || []);
    } catch { /* non-blocking */ }
  }, [tomorrow]);

  useEffect(() => { void loadForecast(); }, [loadForecast]);
  useEffect(() => { void loadMenu(); }, [loadMenu]);

  const [loadingPlan, setLoadingPlan] = useState(false);

  const loadSavedPlan = useCallback(async () => {
    setLoadingPlan(true);
    try {
      const response = await fetch(`/api/ingredient-plans?date=${tomorrow}`);
      if (!response.ok) return;
      const payload = await response.json();
      const planItems = Array.isArray(payload.plan) ? payload.plan : [];

      const loadedQuantities: Record<string, number> = {};
      const loadedPlanned: Record<string, number> = {};
      const loadedHidden: string[] = [];
      const loadedCustom: EditableIngredient[] = [];
      let savedNotes = '';

      planItems.forEach((item: any) => {
        if (item.notes) savedNotes = String(item.notes);
        if (item.is_custom) {
          if (!item.is_removed) {
            loadedCustom.push({
              id: String(item.id),
              name: String(item.ingredient_name),
              emoji: '🫙',
              perPerson: 0,
              unit: 'kg',
              category: 'other',
              currentStock: 0,
              stockUnit: String(item.unit || 'kg'),
              required: Number(item.planned_qty || 0),
              stockOk: !item.is_removed,
              shortage: Math.max(0, Number(item.planned_qty || 0) - 0),
              adjustedRequired: Number(item.planned_qty || 0),
              isManual: true,
            });
          }
        } else {
          const key = String(item.ingredient_id || item.id);
          if (item.is_removed) {
            loadedHidden.push(key);
          } else {
            loadedPlanned[key] = Number(item.planned_qty || 0);
          }
        }

        if (item.actual_qty !== null && item.actual_qty !== undefined) {
          loadedQuantities[String(item.ingredient_id || item.id)] = Number(item.actual_qty);
        }
      });

      setPrepNotes(savedNotes);
      setPlannedQuantities(loadedPlanned);
      setHiddenIngredientIds(loadedHidden);
      setCustomIngredients(loadedCustom);
      setActualQuantities(loadedQuantities);
    } catch {
      // non-blocking
    } finally {
      setLoadingPlan(false);
    }
  }, [tomorrow]);

  useEffect(() => { void loadSavedPlan(); }, [loadSavedPlan]);

  useEffect(() => {
    if (headcount > 0) void fetchIngredients(headcount, buffer);
  }, [headcount, buffer, fetchIngredients]);

  const handleActualQuantityChange = (id: string, value: number) => {
    setActualQuantities((prev) => ({
      ...prev,
      [id]: Number.isFinite(value) ? value : 0,
    }));
  };

  const handleSaveActuals = async () => {
    if (typeof window === 'undefined') return;
    setSavingActuals(true);
    try {
      window.localStorage.setItem(`ingredient-actual:${tomorrow}`, JSON.stringify(actualQuantities));
      toast.success('Actual ingredient quantities saved locally.');
    } catch (error) {
      console.error(error);
      toast.error('Unable to save actual quantities.');
    } finally {
      setSavingActuals(false);
    }
  };

  const createPurchaseRequest = async (ingredientId: string, quantity: number, name: string) => {
    if (quantity <= 0) {
      toast.error('Cannot create a request for zero quantity.');
      return;
    }
    setCreatingRequests((prev) => ({ ...prev, [ingredientId]: true }));
    try {
      const response = await fetch('/api/purchase-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredientId, requestedQty: quantity, notes: `Auto-generated from ingredient planner for ${name}` }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || 'Unable to create purchase request');
      }
      toast.success(`Purchase request created for ${name}`);
    } catch (error) {
      toast.error((error as Error).message || 'Unable to create purchase request');
    } finally {
      setCreatingRequests((prev) => ({ ...prev, [ingredientId]: false }));
    }
  };

  const handleAdjustRequiredAmount = (id: string, value: number) => {
    setPlannedQuantities((prev) => ({
      ...prev,
      [id]: Number.isFinite(value) ? value : 0,
    }));
  };

  const handleRemoveIngredient = (id: string) => {
    setHiddenIngredientIds((prev) => [...prev, id]);
    setCustomIngredients((prev) => prev.filter((ingredient) => ingredient.id !== id));
  };

  const handleAddIngredient = () => {
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    setCustomIngredients((prev) => [
      ...prev,
      {
        id,
        name: 'New ingredient',
        emoji: '🫙',
        perPerson: 0,
        unit: 'kg',
        category: 'other',
        currentStock: 0,
        stockUnit: 'kg',
        required: 0,
        stockOk: false,
        shortage: 0,
        adjustedRequired: 0,
        isManual: true,
      },
    ]);
  };

  const handleCustomIngredientChange = (id: string, field: keyof EditableIngredient, value: string | number) => {
    setCustomIngredients((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: value,
              adjustedRequired: field === 'required' || field === 'adjustedRequired' ? Number(value) : item.adjustedRequired,
              shortage: field === 'required' || field === 'adjustedRequired' ? Math.max(0, Number(value) - item.currentStock) : item.shortage,
              stockOk: field === 'required' || field === 'adjustedRequired' ? item.currentStock >= Number(value) : item.stockOk,
            }
          : item
      )
    );
  };

  const buildPlanPayload = () => {
    const planEntries = ingredients.map((ing) => ({
      id: ing.id,
      ingredientId: ing.id,
      ingredientName: ing.name,
      plannedQty: Number(plannedQuantities[ing.id] ?? ing.required),
      actualQty: actualQuantities[ing.id] ?? null,
      isCustom: false,
      isRemoved: hiddenIngredientIds.includes(ing.id),
      notes: prepNotes || null,
    }));

    const customEntries = customIngredients.map((item) => ({
      id: item.id,
      ingredientId: null,
      ingredientName: item.name,
      plannedQty: item.adjustedRequired,
      actualQty: actualQuantities[item.id] ?? null,
      isCustom: true,
      isRemoved: false,
      notes: prepNotes || null,
    }));

    return [...planEntries, ...customEntries];
  };

  const handleSavePrepPlan = async () => {
    if (typeof window === 'undefined') return;
    setSavingPlan(true);
    try {
      const response = await fetch('/api/ingredient-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: tomorrow,
          items: buildPlanPayload(),
          notes: prepNotes || null,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || 'Unable to save prep plan.');
      }

      toast.success('Preparation plan saved to database.');
    } catch (error) {
      console.error(error);
      toast.error((error as Error).message || 'Unable to save prep plan.');
    } finally {
      setSavingPlan(false);
    }
  };

  const plannerIngredients: EditableIngredient[] = useMemo(() => {
    const adjusted = ingredients
      .filter((ing) => !hiddenIngredientIds.includes(ing.id))
      .map((ing) => {
        const adjustedRequired = Number(plannedQuantities[ing.id] ?? ing.required);
        const shortage = Math.max(0, adjustedRequired - ing.currentStock);
        const stockOk = ing.currentStock >= adjustedRequired;
        return {
          ...ing,
          adjustedRequired,
          shortage,
          stockOk,
        };
      });

    return [
      ...adjusted,
      ...customIngredients.map((item) => {
        const adjustedRequired = Number(plannedQuantities[item.id] ?? item.adjustedRequired ?? item.required);
        return {
          ...item,
          adjustedRequired,
          shortage: Math.max(0, adjustedRequired - item.currentStock),
          stockOk: item.currentStock >= adjustedRequired,
        };
      }),
    ];
  }, [ingredients, plannedQuantities, hiddenIngredientIds, customIngredients]);

  const shortageItems = plannerIngredients.filter((i) => i.shortage > 0 && !i.isManual);

  const handleRecalculate = async () => {
    if (headcount <= 0) { toast.error('Enter a valid headcount.'); return; }
    setHeadcountSource('manual');
    try {
      const response = await fetch(`/api/ingredients/calculate?headcount=${headcount}&buffer=${buffer}&date=${tomorrow}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Calculation failed');
      }
      const data = await response.json();
      setIngredients(data.ingredients || []);
      toast.success(`Recalculated for ${data.calculation.effectiveHeadcount} portions (${buffer}% buffer)`);
    } catch (error) {
      toast.error((error as Error).message || 'Calculation failed');
    }
  };

  // Collect all dish names from tomorrow's menu for context
  const tomorrowDishes = menuMeals.flatMap(m => [
    ...m.fixedItems,
    ...m.winningItems.flatMap(w => w.items && w.items.length > 0 ? w.items : [w.label]),
  ]).filter(Boolean);

  return (
    <div className="space-y-5">
      {/* Tomorrow's Menu Context */}
      {!loadingMenu && menuMeals.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <ChefHat size={16} className="text-indigo-400" />
            <h4 className="text-sm font-bold text-white">Tomorrow's Menu (Ingredient basis)</h4>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tomorrowDishes.slice(0, 20).map((dish, idx) => (
              <span key={idx} className="text-[11px] text-white/60 bg-white/6 border border-white/10 px-2 py-0.5 rounded-full">
                {dish}
              </span>
            ))}
          </div>
          {tomorrowDishes.length === 0 && (
            <p className="text-xs text-white/40 italic">No finalized menu yet — showing full catalog</p>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <Calculator size={20} className="text-cyan-400" />
          <div>
            <h3 className="text-base font-bold text-white">Smart Ingredient Calculator</h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {headcountSource === 'optin' ? (
                <span>
                  Based on <span className="text-green-400">{forecast.confirmed}</span> confirmed attendance{forecast.predicted > 0 ? <> + <span className="text-indigo-400">{forecast.predicted}</span> forecasted</> : ''}
                </span>
              ) : (
                <span>Quantities based on <span className="text-cyan-400">manual entry</span></span>
              )}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Registered Students</p>
            <p className="text-lg font-semibold text-white">{totalStudents || '—'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Expected Attendance</p>
            <p className="text-lg font-semibold text-white">{forecast.confirmed + forecast.predicted}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-white/60 uppercase tracking-wide mb-2">
              Expected Headcount
            </label>
            <input
              type="number"
              value={headcount}
              onChange={e => { setHeadcount(Number(e.target.value)); setHeadcountSource('manual'); }}
              className="input-glass text-center font-mono text-lg font-bold"
              min={1}
              max={500}
            />
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 text-center">
              {headcountSource === 'optin' ? 'From today\'s opt-ins' : 'Manual entry'}
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/60 uppercase tracking-wide mb-2">
              Buffer Percentage
            </label>
            <div className="relative">
              <input
                type="number"
                value={buffer}
                onChange={e => setBuffer(Number(e.target.value))}
                className="input-glass text-center font-mono text-lg font-bold pr-8"
                min={0}
                max={30}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 font-bold">%</span>
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 text-center">Safety margin</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/60 uppercase tracking-wide mb-2">
              Effective Portions
            </label>
            <div className="input-glass text-center font-mono text-2xl font-bold text-cyan-400 flex items-center justify-center">
              {effectiveCount}
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 text-center">Total to prepare</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button onClick={handleRecalculate} className="btn-primary flex items-center gap-2 justify-center w-full sm:w-auto">
            <RefreshCw size={15} />
            <span>Recalculate Quantities</span>
          </button>
          <button
            onClick={handleSaveActuals}
            disabled={savingActuals}
            className="btn-secondary flex items-center gap-2 justify-center w-full sm:w-auto"
          >
            <span>{savingActuals ? 'Saving...' : 'Save Actual Quantities'}</span>
          </button>
        </div>
      </div>

      {/* Ingredient list */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white">Preparation Plan</h3>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Adjust planned quantities, add manual ingredients, and create requests for shortages.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button onClick={handleAddIngredient} className="btn-glass px-4 py-2 text-sm">
              + Add custom ingredient
            </button>
            <button onClick={handleSavePrepPlan} disabled={savingPlan} className="btn-primary px-4 py-2 text-sm">
              {savingPlan ? 'Saving...' : 'Save prep plan'}
            </button>
          </div>
        </div>

        {plannerIngredients.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <div className="text-3xl">📦</div>
            <p className="text-white/50 text-sm">
              {headcount <= 0 ? 'Enter a headcount and recalculate to build the plan' : 'No ingredients available yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {plannerIngredients.map((ing) => {
              const quantity = ing.adjustedRequired;
              const shortage = ing.shortage;
              const statusLabel = ing.stockOk ? 'In stock' : 'Short';
              const statusClass = ing.stockOk ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-300 bg-rose-500/10 border-rose-500/20';

              return (
                <div key={ing.id} className={`rounded-3xl border p-4 ${ing.stockOk ? 'border-white/10 bg-white/5' : 'border-rose-500/20 bg-rose-500/10'}`}>
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex items-center gap-3 w-full xl:w-auto">
                      <span className="text-2xl">{EMOJI_MAP[ing.category] || '🫙'}</span>
                      <div className="flex-1 xl:flex-none">
                        {ing.isManual && editingIngredientId === ing.id ? (
                          <input
                            type="text"
                            autoFocus
                            value={editingIngredientName}
                            onChange={(event) => setEditingIngredientName(event.target.value)}
                            onBlur={() => {
                              if (editingIngredientName.trim()) {
                                handleCustomIngredientChange(ing.id, 'name', editingIngredientName);
                              }
                              setEditingIngredientId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && editingIngredientName.trim()) {
                                handleCustomIngredientChange(ing.id, 'name', editingIngredientName);
                                setEditingIngredientId(null);
                              }
                              if (e.key === 'Escape') setEditingIngredientId(null);
                            }}
                            className="input-glass text-sm font-semibold text-white w-full mb-2"
                            placeholder="Enter ingredient name"
                          />
                        ) : (
                          <p
                            onClick={() => {
                              if (ing.isManual) {
                                setEditingIngredientId(ing.id);
                                setEditingIngredientName(ing.name);
                              }
                            }}
                            className={`text-sm font-semibold text-white mb-2 ${ing.isManual ? 'cursor-pointer hover:bg-white/10 px-2 py-1 rounded transition-all' : ''}`}
                            title={ing.isManual ? 'Click to edit' : ''}
                          >
                            {ing.name}
                          </p>
                        )}
                        <p className="text-[11px] text-white/60">Stock: <span className="font-mono text-white/70">{ing.currentStock} {ing.stockUnit}</span></p>
                      </div>
                    </div>
                    <div className={`flex flex-wrap items-center gap-2 text-[11px] font-semibold rounded-full px-3 py-1 ${statusClass}`}>
                      <span>{statusLabel}</span>
                      {!ing.stockOk && <span>{shortage} {ing.unit} short</span>}
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_0.9fr] mt-4">
                    <div className="space-y-2">
                      <label className="text-[11px] uppercase tracking-[0.18em] text-white/50">Planned quantity</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          value={quantity}
                          onChange={(event) => handleAdjustRequiredAmount(ing.id, Number(event.target.value))}
                          className="input-glass w-full text-right font-mono text-sm text-white"
                        />
                        {ing.isManual ? (
                          <input
                            type="text"
                            value={ing.unit}
                            onChange={(event) => handleCustomIngredientChange(ing.id, 'unit', event.target.value)}
                            className="input-glass w-16 text-center font-mono text-sm text-white"
                            placeholder="kg"
                          />
                        ) : (
                          <span className="text-xs text-white/50">{ing.unit}</span>
                        )}
                      </div>
                    </div>
                    {!ing.isManual ? (
                      <div className="space-y-2">
                        <label className="text-[11px] uppercase tracking-[0.18em] text-white/50">Required if cooked</label>
                        <div className="text-sm font-semibold text-white font-mono">{ing.required} {ing.unit}</div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="text-[11px] uppercase tracking-[0.18em] text-white/50">Current stock</label>
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          value={ing.currentStock}
                          onChange={(event) => handleCustomIngredientChange(ing.id, 'currentStock', Number(event.target.value))}
                          className="input-glass w-full text-right font-mono text-sm text-white"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-[11px] uppercase tracking-[0.18em] text-white/50">Plan comment</label>
                      <div className="text-xs text-white/60">{ing.isManual ? 'Manual item' : 'Auto-calculated ingredient'}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs text-white/70">
                      {ing.stockOk ? 'Ready to use from stock.' : `Need ${shortage} ${ing.unit} more.`}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!ing.isManual && shortage > 0 && (
                        <button
                          onClick={() => createPurchaseRequest(ing.id, shortage, ing.name)}
                          disabled={creatingRequests[ing.id]}
                          className="btn-primary py-2 px-3 text-sm"
                        >
                          {creatingRequests[ing.id] ? 'Requesting…' : 'Create purchase request'}
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveIngredient(ing.id)}
                        className="btn-secondary py-2 px-3 text-sm"
                      >
                        {ing.isManual ? 'Remove' : 'Hide from plan'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {plannerIngredients.length > 0 && (
          <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
            <label className="block text-xs uppercase tracking-[0.2em] text-white/50 mb-2">Preparation notes</label>
            <textarea
              value={prepNotes}
              onChange={(event) => setPrepNotes(event.target.value)}
              className="input-glass w-full min-h-[100px] resize-none p-3 text-sm text-white"
              placeholder="E.g. soak lentils, thaw paneer, confirm supplier delivery time."
            />
          </div>
        )}

        {plannerIngredients.filter((i) => i.shortage > 0 && !i.isManual).length > 0 ? (
          <div className="mt-4 p-3 rounded-xl bg-amber-500/8 border border-amber-500/20">
            <p className="text-xs font-semibold text-amber-400 mb-1">
              ⚠️ {plannerIngredients.filter((i) => i.shortage > 0 && !i.isManual).length} ingredient{plannerIngredients.filter((i) => i.shortage > 0 && !i.isManual).length > 1 ? 's' : ''} below required stock
            </p>
            <p className="text-xs text-white/60">
              {plannerIngredients.filter((i) => i.shortage > 0 && !i.isManual).map(i => i.name).join(', ')} — use the button on each row to raise a request.
            </p>
          </div>
        ) : plannerIngredients.length > 0 ? (
          <div className="mt-4 p-3 rounded-xl bg-green-500/8 border border-green-500/20">
            <p className="text-xs font-semibold text-green-400 mb-0.5">✅ All tracked ingredients have enough stock</p>
            <p className="text-xs text-white/60">
              Sufficient supplies for {effectiveCount} portions ({headcount} + {buffer}% buffer).
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}