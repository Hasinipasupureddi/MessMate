'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ClipboardList, Clock3, Edit2, Loader2, ShieldCheck, Trash2 } from 'lucide-react';
import { getIstDateString, getIstTimeLabel, parseIstDatetime } from '@/lib/utils/mealStatus';
import { toast } from 'sonner';

const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast', deadline: '09:00' },
  { value: 'lunch', label: 'Lunch', deadline: '13:30' },
  { value: 'snack', label: 'Snack', deadline: '17:30' },
  { value: 'dinner', label: 'Dinner', deadline: '21:00' },
] as const;

type MealType = typeof MEAL_TYPES[number]['value'];

type DeclarationRow = {
  id: string;
  meal_date: string;
  meal_type: 'breakfast' | 'lunch' | 'snack' | 'dinner';
  status: 'pending' | 'declared' | 'none';
  note: string | null;
  dish_name: string | null;
  emoji: string | null;
  total_portions: number | null;
  available_until: string | null;
};

type ChecklistItem = {
  id: string;
  checklist_date: string;
  item_key: string;
  label: string;
  is_done: boolean;
};

function toLocalDateTime(value: string | null, fallbackDate: string) {
  if (!value) {
    return `${fallbackDate}T18:00`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return `${fallbackDate}T18:00`;
  }
  const parts = date.toISOString().slice(0, 16);
  return parts;
}

function formatStatusLabel(status: 'pending' | 'declared' | 'none') {
  switch (status) {
    case 'declared':
      return 'Declared';
    case 'none':
      return 'No leftovers';
    default:
      return 'Pending';
  }
}

export default function LeftoverDeclarationWorkflow() {
  const today = getIstDateString();
  const [declarations, setDeclarations] = useState<DeclarationRow[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [selectedMeal, setSelectedMeal] = useState<MealType>('lunch');
  const [dishName, setDishName] = useState('');
  const [emoji, setEmoji] = useState('🍛');
  const [totalPortions, setTotalPortions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editingMeal, setEditingMeal] = useState<MealType | null>(null);

  const resetForm = () => {
    setDishName('');
    setEmoji('🍛');
    setTotalPortions(0);
    setEditingMeal(null);
  };

  const currentDeadline = useMemo(() => {
    const meal = MEAL_TYPES.find(m => m.value === selectedMeal);
    return meal?.deadline || '18:00';
  }, [selectedMeal]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const [declarationRes, checklistRes] = await Promise.all([
        fetch(`/api/leftover-declarations?date=${today}`),
        fetch(`/api/leftover-checklist?date=${today}`),
      ]);

      const declarationPayload = await declarationRes.json().catch(() => ({}));
      const checklistPayload = await checklistRes.json().catch(() => ({}));

      if (!declarationRes.ok || !checklistRes.ok) {
        const status = declarationRes.status !== 200 ? declarationRes.status : checklistRes.status;
        if (status === 401 || status === 403) {
          setMessage('Your session has expired or you do not have permission. Please sign in again.');
          return;
        }
        
        const msg = declarationPayload.message || checklistPayload.message || 'Unable to load leftover declaration workflow.';
        setMessage(msg);
        return;
      }

      setDeclarations(Array.isArray(declarationPayload.rows) ? declarationPayload.rows : []);
      setChecklist(Array.isArray(checklistPayload.items) ? checklistPayload.items : []);
    } catch (error) {
      setMessage('Unable to load leftover declaration workflow.');
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const overallStatus = useMemo(() => {
    if (declarations.length === 0) return 'pending';
    
    // Check if all 4 main meal types are handled
    const handledMeals = declarations.filter(d => d.status === 'declared' || d.status === 'none');
    if (handledMeals.length >= 4) {
      return declarations.some(d => d.status === 'declared') ? 'declared' : 'none';
    }
    
    return 'pending';
  }, [declarations]);

  const allMealsHandled = useMemo(() => {
    const handled = new Set(declarations.filter(d => d.status === 'declared' || d.status === 'none').map(d => d.meal_type));
    return MEAL_TYPES.every(m => handled.has(m.value));
  }, [declarations]);

  const allMealsNone = useMemo(() => {
    return allMealsHandled && declarations.length === 4 && declarations.every(d => d.status === 'none');
  }, [allMealsHandled, declarations]);

  const completedCount = checklist.filter((item) => item.is_done).length;
  
  // Checklist is complete if all items are done AND all meals are handled
  const checklistComplete = checklist.length > 0 && completedCount === checklist.length && allMealsHandled;

  // Auto-update checklist based on meal declarations
  useEffect(() => {
    if (loading || checklist.length === 0) return;

    const updateChecklist = async () => {
      // 1. "Confirm leftovers declared" should be true if all meals are handled
      const declareItem = checklist.find(item => item.item_key === 'declare_leftovers');
      if (declareItem && allMealsHandled && !declareItem.is_done) {
        await toggleChecklist('declare_leftovers', true, true);
      }

      // 2. If all meals are "none", auto-complete the rest of the checklist
      if (allMealsNone) {
        const remainingItems = checklist.filter(item => !item.is_done && item.item_key !== 'declare_leftovers');
        if (remainingItems.length > 0) {
          await Promise.all(remainingItems.map(item => toggleChecklist(item.item_key, true, true)));
        }
      }
    };

    void updateChecklist();
  }, [allMealsHandled, allMealsNone, checklist, loading]);

  const startEdit = (declaration: DeclarationRow) => {
    setSelectedMeal(declaration.meal_type);
    setDishName(declaration.dish_name || '');
    setEmoji(declaration.emoji || '🍛');
    setTotalPortions(declaration.total_portions || 0);
    setEditingMeal(declaration.meal_type);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  const submitDeclaration = async () => {
    // Only validate if we are NOT marking as "none"
    // (Though submitDeclaration is only for 'declared' status)
    if (!dishName.trim()) {
      setMessage('Please enter a dish name for the leftover declaration.');
      toast.error('Dish name is required for leftovers.');
      return;
    }

    if (!totalPortions || totalPortions <= 0) {
      setMessage('Enter a valid number of portions.');
      toast.error('Portions must be greater than 0.');
      return;
    }

    setSaving(true);
    setMessage(null);

    const fullDeadline = `${today} ${currentDeadline}:00`;

    try {
      const response = await fetch('/api/leftover-declarations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mealDate: today,
          mealType: selectedMeal,
          status: 'declared',
          dishName: dishName.trim(),
          emoji,
          totalPortions: Number(totalPortions),
          availableUntil: fullDeadline,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Your session has expired or you do not have permission. Please sign in again.');
        }
        throw new Error(payload?.message || 'Unable to save leftover declaration.');
      }

      const successMsg = editingMeal ? 'Declaration updated successfully.' : 'Leftover declaration saved. Students can now claim extra portions.';
      setMessage(successMsg);
      toast.success(successMsg);
      resetForm();
      
      // Auto-check checklist items
      if (!editingMeal) {
        try {
          await Promise.all([
            toggleChecklist('declare_leftovers', true, true),
            toggleChecklist('verify_pickup_window', true, true),
            toggleChecklist('notify_students', true, true),
          ]);
        } catch (e) {
          console.warn('Auto-checklist update failed:', e);
        }
      }

      await loadData();
    } catch (error: any) {
      setMessage(error?.message || 'Unable to save leftover declaration.');
      toast.error(error?.message || 'Unable to save leftover declaration.');
    } finally {
      setSaving(false);
    }
  };

  const markNoLeftovers = async () => {
    // Clear inputs and error before starting
    setDishName('');
    setTotalPortions(0);
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/leftover-declarations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mealDate: today,
          mealType: selectedMeal,
          status: 'none',
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Your session has expired or you do not have permission. Please sign in again.');
        }
        throw new Error(payload?.message || 'Unable to mark no leftovers.');
      }

      const successMsg = `Marked ${selectedMeal} as no leftovers today.`;
      setMessage(successMsg);
      toast.success(successMsg);
      resetForm();

      await loadData();
    } catch (error: any) {
      setMessage(error?.message || 'Unable to mark no leftovers.');
      toast.error(error?.message || 'Unable to mark no leftovers.');
    } finally {
      setSaving(false);
    }
  };

  const deleteDeclaration = async (mealType: string) => {
    if (!confirm(`Are you sure you want to delete the ${mealType} declaration? This will also remove any active items and claims.`)) {
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/leftover-declarations?mealDate=${today}&mealType=${mealType}`, {
        method: 'DELETE',
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.message || 'Unable to delete declaration.');
      }

      const successMsg = `Deleted ${mealType} declaration.`;
      setMessage(successMsg);
      toast.success(successMsg);
      await loadData();
    } catch (error: any) {
      setMessage(error?.message || 'Unable to delete declaration.');
      toast.error(error?.message || 'Unable to delete declaration.');
    } finally {
      setSaving(false);
    }
  };

  const toggleChecklist = async (itemKey: string, isDone: boolean, silent = false) => {
    try {
      const response = await fetch('/api/leftover-checklist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today, itemKey, isDone }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.message || 'Unable to update checklist.');
      }

      setChecklist((prev) => prev.map((item) => (item.item_key === itemKey ? { ...item, is_done: isDone } : item)));
    } catch (error: any) {
      if (!silent) {
        setMessage(error?.message || 'Unable to update checklist.');
        toast.error(error?.message || 'Unable to update checklist.');
      }
      throw error;
    }
  };

  const closeOperationalDay = async () => {
    setSaving(true);
    setMessage(null);

    try {
      await Promise.all(
        checklist.map((item) =>
          fetch('/api/leftover-checklist', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: today, itemKey: item.item_key, isDone: true }),
          })
        )
      );

      setMessage('Operational day closed successfully. Checklist state saved.');
      toast.success('Day closed successfully! All operational tasks for today are complete.');
      await loadData();
    } catch (error: any) {
      setMessage(error?.message || 'Unable to close operational day.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-white/40 mb-2 flex items-center gap-2">
            <ShieldCheck size={14} /> Leftover workflow
          </div>
          <h2 className="text-xl font-semibold text-white">Declare today’s extras</h2>
          <p className="text-sm text-slate-400 mt-1">Record leftovers, keep claim windows visible, and finish the daily checklist.</p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
          {formatStatusLabel(overallStatus)}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-36 rounded-3xl bg-white/5 animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="h-24 rounded-3xl bg-white/5 animate-pulse" />
            <div className="h-24 rounded-3xl bg-white/5 animate-pulse" />
          </div>
        </div>
      ) : (
        <>
          {message && (
            <div className="rounded-3xl border border-slate-500/30 bg-slate-950/80 p-3 text-sm text-slate-200">{message}</div>
          )}

          <div className="grid gap-3 sm:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-slate-900/80 p-3 text-slate-200">
                  <ClipboardList size={20} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Meals tracked</div>
                  <div className="text-xs text-slate-400 mt-1">{declarations.length || 0} meal declaration{declarations.length === 1 ? '' : 's'} recorded today</div>
                </div>
              </div>

              <div className="space-y-2">
                {MEAL_TYPES.map((mealType) => {
                  const declaration = declarations.find(d => d.meal_type === mealType.value);
                  return (
                    <div key={mealType.value} className={`rounded-3xl border p-3 transition-colors ${declaration?.status === 'declared' ? 'border-emerald-500/20 bg-emerald-500/5' : declaration?.status === 'none' ? 'border-white/5 bg-white/2' : 'border-dashed border-white/10 bg-white/2 opacity-60'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${declaration?.status === 'declared' ? 'bg-emerald-500/20 text-emerald-400' : declaration?.status === 'none' ? 'bg-slate-500/20 text-slate-400' : 'bg-white/5 text-white/20'}`}>
                            {declaration?.status === 'declared' || declaration?.status === 'none' ? <CheckCircle2 size={14} /> : <span>?</span>}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-white capitalize">{mealType.label}</div>
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider">{declaration ? formatStatusLabel(declaration.status) : 'Not recorded'}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {declaration && (
                            <>
                              <button
                                onClick={() => startEdit(declaration)}
                                disabled={saving}
                                className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                                title="Edit declaration"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => deleteDeclaration(declaration.meal_type)}
                                disabled={saving}
                                className="p-1.5 rounded-full hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                                title="Delete declaration"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {declaration?.status === 'declared' && (
                        <div className="mt-3 pl-11 space-y-1 text-sm text-slate-300">
                          <div className="flex items-center gap-2">
                            <span>{declaration.emoji ?? '🍽️'}</span>
                            <span className="font-medium">{declaration.dish_name}</span>
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-3">
                            <span>{declaration.total_portions} portions</span>
                            <span className="w-1 h-1 rounded-full bg-white/10" />
                            <span>
                              Until {(() => {
                                const date = parseIstDatetime(String(declaration.available_until));
                                if (isNaN(date.getTime())) return "Closing time";
                                return getIstTimeLabel(date);
                              })()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-white">Daily checklist</p>
                  <p className="text-xs text-slate-400">{completedCount} of {checklist.length} done</p>
                </div>
                <div className={`text-[11px] font-semibold uppercase rounded-full px-2.5 py-1 ${checklistComplete ? 'bg-emerald-500/20 text-emerald-200' : 'bg-amber-500/20 text-amber-200'}`}>
                  {checklistComplete ? 'Complete' : 'In progress'}
                </div>
              </div>
              <div className="space-y-2">
                {checklist.map((item) => (
                  <button
                    key={item.item_key}
                    type="button"
                    onClick={() => toggleChecklist(item.item_key, !item.is_done)}
                    className={`w-full rounded-3xl border px-4 py-3 text-left transition ${item.is_done ? 'border-emerald-500/20 bg-emerald-500/10 text-white' : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-sm">{item.label}</span>
                      {item.is_done ? <CheckCircle2 size={16} className="text-emerald-300" /> : <AlertCircle size={16} className="text-amber-300" />}
                    </div>
                  </button>
                ))}
              </div>
              {checklistComplete && (
                <button
                  className="w-full mt-4 rounded-3xl bg-indigo-500 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400 flex items-center justify-center gap-2"
                  onClick={closeOperationalDay}
                  disabled={saving}
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                  Close Operational Day
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className={`rounded-3xl border p-4 space-y-4 transition-colors ${editingMeal ? 'border-indigo-500/30 bg-indigo-500/5' : 'border-white/10 bg-white/5'}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                  {editingMeal ? `Editing ${editingMeal} declaration` : 'New declaration'}
                </h3>
                {editingMeal && (
                  <button onClick={resetForm} className="text-xs text-slate-400 hover:text-white transition-colors">
                    Cancel Edit
                  </button>
                )}
              </div>
              
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-1 flex-1">
                  <label className="text-sm text-slate-400 uppercase tracking-[0.24em]">Meal type</label>
                  <select
                    value={selectedMeal}
                    onChange={(event) => setSelectedMeal(event.target.value as any)}
                    disabled={!!editingMeal}
                    className="input-glass w-full bg-slate-950/90 text-white disabled:opacity-50"
                  >
                    {MEAL_TYPES.map((meal) => (
                      <option key={meal.value} value={meal.value}>{meal.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1 flex-1">
                  <label className="text-sm text-slate-400 uppercase tracking-[0.24em]">Claim Deadline</label>
                  <div className="input-glass w-full bg-slate-950/40 text-indigo-300 font-mono flex items-center gap-2 h-[42px] px-3">
                    <Clock3 size={16} />
                    {currentDeadline} (Automated)
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm text-slate-400">
                  Dish name
                  <input
                    value={dishName}
                    onChange={(event) => setDishName(event.target.value)}
                    className="input-glass w-full bg-slate-950/90 text-white"
                    placeholder="Dish name or mix"
                  />
                </label>
                <label className="space-y-1 text-sm text-slate-400">
                  Portions
                  <input
                    type="number"
                    min={1}
                    value={totalPortions}
                    onChange={(event) => setTotalPortions(Number(event.target.value))}
                    className="input-glass w-full bg-slate-950/90 text-white"
                  />
                </label>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={submitDeclaration}
                  disabled={saving}
                  className="rounded-full bg-emerald-500 px-6 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                  {editingMeal ? 'Update declaration' : 'Declare leftovers'}
                </button>
                {!editingMeal && (
                  <button
                    type="button"
                    onClick={markNoLeftovers}
                    disabled={saving}
                    className="rounded-full border border-white/10 bg-white/5 px-6 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
                  >
                    Mark no leftovers
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
