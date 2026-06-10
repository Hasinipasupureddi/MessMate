'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Edit2, Plus, Trash2, Save, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getIstDateString } from '@/lib/utils/mealStatus';
import { getVoteBlueprintsForDate } from '@/lib/menu/votingBlueprints';
import type { VoteOption, VoteMealType } from '@/lib/menu/votingBlueprints';

interface ManageVoteOptionsProps {
  mealType?: VoteMealType | 'sunday';
  compact?: boolean;
}

export default function ManageVoteOptions({ mealType: filterMealType, compact }: ManageVoteOptionsProps) {
  const tomorrow = getIstDateString(1);
  const [options, setOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<VoteOption>>({});

  const loadOptions = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/vote-options?date=${tomorrow}${filterMealType ? `&mealType=${filterMealType}` : ''}${force ? '&force=true' : ''}`);
      const data = await res.json();
      setOptions(data.options || []);
      if (force) toast.success('Vote options regenerated successfully');
    } catch (error) {
      toast.error(force ? 'Failed to regenerate options' : 'Failed to load vote options');
    } finally {
      setLoading(false);
    }
  }, [tomorrow, filterMealType]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const handleRegenerate = () => {
    if (confirm('Are you sure you want to regenerate ALL options for tomorrow? This will delete any existing votes and manual edits.')) {
      loadOptions(true);
    }
  };

  const handleEdit = (opt: any) => {
    setEditingId(opt.id);
    setEditForm({
      label: opt.label,
      emoji: opt.emoji,
      items: opt.items
    });
  };

  const handleSave = async (mealType: VoteMealType | 'sunday') => {
    if (!editingId) return;
    try {
      const res = await fetch('/api/vote-options', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: tomorrow,
          option: {
            id: editingId,
            mealType,
            ...editForm
          }
        })
      });

      if (res.ok) {
        toast.success('Option updated successfully');
        setEditingId(null);
        loadOptions();
      } else {
        throw new Error('Failed to update');
      }
    } catch (error) {
      toast.error('Error saving option');
    }
  };

  const handleDelete = async (mealType: VoteMealType | 'sunday', id: string) => {
    if (!confirm('Are you sure you want to delete this option?')) return;
    try {
      const res = await fetch(`/api/vote-options?date=${tomorrow}&mealType=${mealType}&optionId=${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toast.success('Option deleted');
        loadOptions();
      }
    } catch (error) {
      toast.error('Error deleting option');
    }
  };

  const handleAddNew = async (mealType: VoteMealType | 'sunday') => {
    const newId = `manual-${Date.now()}`;
    const newOption = {
      id: newId,
      label: 'New Dish Name',
      emoji: '🍛',
      items: ['Main Item', 'Side Item']
    };

    // Determine categoryKey from blueprint if available, else fallback to 'main'
    const blueprint = getVoteBlueprintsForDate(new Date(tomorrow)).find(b => b.mealType === (mealType === 'sunday' ? 'lunch' : mealType));
    // Default to the first category in the blueprint if available
    const firstCategory = blueprint?.categories?.[0]?.id;
    const categoryKey = mealType === 'sunday' ? 'main' : (firstCategory || 'main');

    try {
      const res = await fetch('/api/vote-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: tomorrow,
          mealType: mealType === 'sunday' ? 'lunch' : mealType,
          categoryKey,
          option: newOption
        })
      });

      if (res.ok) {
        toast.success('New option added. Click edit to customize.');
        loadOptions();
      } else {
        throw new Error('Failed to add');
      }
    } catch (error) {
      toast.error('Error adding new option');
    }
  };

  const renderOptionCard = (mealType: VoteMealType | 'sunday', opt: any) => {
    const isEditingOption = editingId === opt.id;

    return (
      <div key={opt.id} className="group relative bg-white/3 border border-white/8 rounded-xl p-3 hover:bg-white/5 transition-colors">
        {isEditingOption ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                value={editForm.emoji}
                onChange={(e) => setEditForm((prev) => ({ ...prev, emoji: e.target.value }))}
                className="w-12 bg-white/5 border border-white/10 rounded-lg p-2 text-center text-lg"
                placeholder="Emoji"
              />
              <input
                value={editForm.label}
                onChange={(e) => setEditForm((prev) => ({ ...prev, label: e.target.value }))}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white"
                placeholder="Option Label"
              />
            </div>
            <textarea
              value={editForm.items?.join(', ')}
              onChange={(e) => setEditForm((prev) => ({ ...prev, items: e.target.value.split(',').map((s) => s.trim()) }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white/70"
              placeholder="Items (comma separated)"
              rows={2}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditingId(null)} className="btn-secondary py-1 px-3 text-xs flex items-center gap-1">
                <X size={14} /> Cancel
              </button>
              <button onClick={() => handleSave(mealType)} className="btn-primary py-1 px-3 text-xs flex items-center gap-1">
                <Save size={14} /> Save Changes
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{opt.emoji}</span>
              <div>
                <div className="text-sm font-semibold text-white">{opt.label}</div>
                <div className="mt-2 space-y-1">
                  {opt.items.map((item: string, idx: number) => (
                    <div key={`${item}-${idx}`} className="flex items-center gap-2 text-xs text-white/50">
                      <span className="w-1 h-1 rounded-full bg-indigo-500/40" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => handleEdit(opt)} className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-indigo-400">
                <Edit2 size={14} />
              </button>
              <button onClick={() => handleDelete(mealType, opt.id)} className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-red-400">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const meals: (VoteMealType | 'sunday')[] = filterMealType ? [filterMealType] : ['breakfast', 'lunch', 'snack', 'dinner', 'sunday'];

  if (compact) {
    return (
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2].map(i => <div key={i} className="h-16 bg-white/5 rounded-xl" />)}
          </div>
        ) : (
          <div className="space-y-4">
            {meals.map(mealType => {
              const mealOptions = options.filter(o => o.mealType === mealType);
              return (
                <div key={mealType} className="space-y-3">
                  <div className="grid grid-cols-1 gap-3">
                    {mealOptions.map((opt) => renderOptionCard(mealType, opt))}
                  </div>
                  <button 
                    onClick={() => handleAddNew(mealType)}
                    className="w-full border border-dashed border-white/10 rounded-xl p-3 text-[10px] text-white/30 hover:bg-white/5 hover:text-white/50 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={12} /> Add New {mealType} Option
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="glass-card p-5 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white">Manage Voting Options</h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Edit tomorrow's options before students start voting</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleRegenerate} 
            disabled={loading}
            className="btn-secondary py-2 px-3 text-xs flex items-center gap-2 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all"
            title="Regenerate all options for tomorrow"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Regenerate
          </button>
          <button onClick={() => loadOptions(false)} className="p-2 hover:bg-white/5 rounded-full text-white/60">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-white/5 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-8">
          {meals.map(mealType => {
            const mealOptions = options.filter(o => o.mealType === mealType);
            if (mealOptions.length === 0 && mealType === 'sunday' && new Date(tomorrow).getDay() !== 0) return null;
            const isSundayLunch = mealType === 'lunch' && new Date(tomorrow).getDay() === 0;
            const groupedMealOptions = (isSundayLunch
              ? Object.entries(mealOptions.reduce((acc, option) => {
                  const groupKey = option.categoryKey || option.category || 'main';
                  acc[groupKey] = acc[groupKey] || [];
                  acc[groupKey].push(option);
                  return acc;
                }, {} as Record<string, any[]>))
                .map(([groupKey, groupOptions]) => ({
                  id: groupKey,
                  label: groupKey === 'non_veg_combo' ? 'Non-Veg Options' : groupKey === 'veg_combo' ? 'Veg Options' : 'Options',
                  options: groupOptions,
                }))
              : [{ id: 'default', label: '', options: mealOptions }]) as { id: string; label: string; options: any[] }[];

            return (
              <div key={mealType} className="space-y-3">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  {mealType}
                </h4>
                
                <div className="space-y-4">
                  {groupedMealOptions.map((group) => (
                    <div key={group.id} className="space-y-3">
                      {group.label ? (
                        <div className="text-[10px] uppercase tracking-[0.24em] text-white/50 font-semibold">{group.label}</div>
                      ) : null}
                      <div className="grid grid-cols-1 gap-3">
                        {group.options.map((opt) => renderOptionCard(mealType, opt))}
                      </div>
                    </div>
                  ))}
                  <button 
                    onClick={() => handleAddNew(mealType)}
                    className="w-full border border-dashed border-white/10 rounded-xl p-3 text-xs text-white/30 hover:bg-white/5 hover:text-white/50 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={14} /> Add New {mealType} Option
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
