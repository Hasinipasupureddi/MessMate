'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, TrendingUp, CheckCircle2, Edit2, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getIstDateString } from '@/lib/utils/mealStatus';
import { getVoteBlueprintsForDate } from '@/lib/menu/votingBlueprints';
import type { FinalMenuMeal } from '@/lib/menu/finalMenu';
import type { VoteMealType } from '@/lib/menu/votingBlueprints';
import ManageVoteOptions from './ManageVoteOptions';

type VoteRow = {
  mealType: VoteMealType;
  menuOption: string;
  option: string;
  votes: number;
};

type FinalMenuPayloadMeal = FinalMenuMeal & {
  winningItems: Array<{ label: string; emoji: string; items: string[]; selectedOptionId: string; votes: number }>;
};

type RankedOption = {
  selectedOptionId: string;
  label: string;
  emoji: string;
  items: string[];
  votes: number;
  categoryId?: string;
  categoryLabel?: string;
};

function groupRankedOptionsByCategory(
  rankedOptions: RankedOption[],
  categories: { id: string; label: string }[]
) {
  if (!categories.length) {
    return [{ category: { id: 'main', label: 'Options' }, options: rankedOptions }];
  }

  const grouped = categories.map((category) => ({
    category,
    options: rankedOptions.filter((option) => option.categoryId === category.id),
  })).filter((group) => group.options.length > 0);

  if (grouped.length > 1) {
    return grouped;
  }

  return [{ category: { id: 'main', label: 'Options' }, options: rankedOptions }];
}

function getMedal(index: number, votes: number) {
  if (votes === 0) return null;
  if (index === 0) return '🥇';
  if (index === 1) return '🥈';
  if (index === 2) return '🥉';
  return null;
}

const shortenDishName = (name: string) => {
  if (name.includes('+')) {
    return name.split('+')[0].trim() + ' Combo';
  }
  return name;
};

export default function TomorrowMenuVotes() {
  const tomorrow = getIstDateString(1);
  const [voteRows, setVoteRows] = useState<VoteRow[]>([]);
  const [dbOptions, setDbOptions] = useState<any[]>([]);
  const [finalMenu, setFinalMenu] = useState<FinalMenuPayloadMeal[]>([]);
  const [menuData, setMenuData] = useState<{ status?: string } | null>(null);
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalVotesCount, setTotalVotesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const [overrideMealType, setOverrideMealType] = useState<string | null>(null);
  const [selectedOverrideOptions, setSelectedOverrideOptions] = useState<Record<string, string>>({});
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [editingOptionsMealType, setEditingOptionsMealType] = useState<string | null>(null);

  const loadMenu = useCallback(async () => {
    try {
      const [votesResponse, menuResponse, optionsResponse] = await Promise.all([
        fetch(`/api/meal-votes?date=${tomorrow}`),
        fetch(`/api/live/final-menu?date=${tomorrow}`),
        fetch(`/api/vote-options?date=${tomorrow}`),
      ]);

      const votesPayload = await votesResponse.json().catch(() => ({}));
      const menuPayload = await menuResponse.json().catch(() => ({}));
      const optionsPayload = await optionsResponse.json().catch(() => ({}));

      if (!votesResponse.ok) {
        console.log('Load staff vote counts error:', votesPayload?.message || 'request failed');
        return;
      }

      setVoteRows(Array.isArray(votesPayload?.rows) ? votesPayload.rows : []);
      setDbOptions(Array.isArray(optionsPayload?.options) ? optionsPayload.options : []);
      setFinalMenu(Array.isArray(menuPayload?.rows) ? menuPayload.rows : []);
      setMenuData(menuPayload?.menu || null);
      setTotalStudents(menuPayload?.totalStudents || 0);
      setTotalVotesCount(menuPayload?.totalVotes || 0);
    } catch (error: any) {
      console.log('Load staff vote counts error:', error.message);
    } finally {
      setLoading(false);
    }
  }, [tomorrow]);

  const handleFinalize = async () => {
    if (currentMenuIsApproved) {
      toast.error('This menu is already approved and cannot be resubmitted.');
      return;
    }
    setFinalizing(true);
    try {
      const response = await fetch('/api/live/finalize-menu', {
        method: 'POST',
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message = errorBody?.message || 'Failed to submit menu for approval';
        throw new Error(message);
      }
      toast.success('Tomorrow\'s menu has been saved and is pending warden approval.');
      void loadMenu();
    } catch (err: any) {
      toast.error(`Error submitting menu for approval: ${err.message || 'Unknown error'}`);
      console.error('Submit menu approval error:', err);
    } finally {
      setFinalizing(false);
    }
  };

  const handleResetMenu = async () => {
    if (!window.confirm('Reset tomorrow\'s final menu and reopen it for approval?')) {
      return;
    }

    setResetting(true);
    try {
      const response = await fetch('/api/live/finalize-menu', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message = errorBody?.message || 'Failed to reset menu';
        throw new Error(message);
      }
      toast.success('Tomorrow\'s menu has been reset to live vote winners.');
      void loadMenu();
    } catch (err: any) {
      toast.error(`Error resetting menu: ${err.message || 'Unknown error'}`);
      console.error('Reset menu error:', err);
    } finally {
      setResetting(false);
    }
  };

  useEffect(() => {
    void loadMenu();

    const id = window.setInterval(() => {
      void loadMenu();
    }, 60000);

    return () => {
      window.clearInterval(id);
    };
  }, [loadMenu]);

  const participationRate = useMemo(() => {
    if (totalStudents === 0) return 0;
    return Math.round((totalVotesCount / totalStudents) * 100);
  }, [totalVotesCount, totalStudents]);

  const getRankedOptions = useCallback((mealType: VoteMealType) => {
    const dateObj = new Date(`${tomorrow}T00:00:00.000Z`);
    const blueprint = getVoteBlueprintsForDate(dateObj).find((b) => b.mealType === mealType);
    const mealVotes = voteRows.filter((row) => row.mealType === mealType);
    const voteMap = new Map(mealVotes.map((row) => [row.menuOption, row.votes]));
    const categoryLabels = new Map(blueprint?.categories.map((category) => [category.id, category.label]) ?? []);

    // Filter DB options for this meal type
    const mealOptions = dbOptions.filter((o) => o.mealType === mealType);

    // If we have DB options, use them. Otherwise, fall back to blueprint options (initial state)
    const optionsSource = mealOptions.length > 0 ? mealOptions : (blueprint?.options ?? []);

    const options = optionsSource.map((option) => {
      const categoryId = option.categoryKey ?? blueprint?.categories.find((category) => category.type === option.category)?.id ?? 'main';

      return {
        selectedOptionId: option.id,
        label: option.label,
        emoji: option.emoji,
        items: option.items,
        votes: voteMap.get(option.id) ?? 0,
        categoryId,
        categoryLabel: categoryLabels.get(categoryId) ?? undefined,
      };
    });

    return options.sort((left, right) => {
      if (right.votes !== left.votes) return right.votes - left.votes;
      if (left.categoryId !== right.categoryId) {
        return (left.categoryLabel ?? left.categoryId ?? '').localeCompare(right.categoryLabel ?? right.categoryId ?? '');
      }
      return left.label.localeCompare(right.label);
    });
  }, [tomorrow, voteRows, dbOptions]);

  const currentMenuIsApproved = menuData?.status === 'approved';
  const currentMenuIsAwaiting = menuData?.status === 'awaiting_approval';

  const handleRegenerateOptions = async (mealType: string) => {
    if (!window.confirm(`Regenerate all ${mealType} options for tomorrow? This will delete current votes for this meal type.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/vote-options?date=${tomorrow}&force=true&mealType=${mealType}`);
      const data = await res.json();
      console.log(`[REGENERATE DEBUG] Response for ${mealType}:`, data);
      
      if (res.ok) {
        toast.success(`${mealType} options regenerated`);
        void loadMenu();
      } else {
        throw new Error(data.message || 'Failed to regenerate');
      }
    } catch (error) {
      console.error(`[REGENERATE DEBUG] Error for ${mealType}:`, error);
      toast.error('Error regenerating options');
    }
  };

  const areIdSetsEqual = (first: string[], second: string[]) => {
    if (first.length !== second.length) return false;
    const firstSet = new Set(first);
    return second.every((id) => firstSet.has(id));
  };

  const buildSummary = (groups: Array<{ category: { id: string; label: string }; items: RankedOption[] }>) => {
    if (groups.length > 1) {
      return groups
        .map((group) => `${group.category.label}: ${group.items.map((item) => item.label).join(' + ')}`)
        .join(' · ');
    }
    return groups[0]?.items[0]?.label || 'TBD';
  };

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white">Tomorrow&apos;s Final Menu</h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Generated from student votes with fixed items, staff overrides, and pending warden approval.</p>
          <div className="mt-2 flex items-center gap-3">
            <div className="text-[10px] sm:text-xs text-white/50 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
              Registered Students: <span className="text-white font-medium">{totalStudents}</span>
            </div>
            <div className="text-[10px] sm:text-xs text-white/50 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
              Participation: <span className="text-indigo-400 font-medium">{participationRate}%</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button 
            onClick={handleFinalize}
            disabled={finalizing || loading || currentMenuIsApproved || currentMenuIsAwaiting}
            className={`py-1.5 px-3 text-[10px] sm:text-xs flex items-center gap-1.5 whitespace-nowrap rounded-[0.9rem] transition-all font-bold ${
              currentMenuIsApproved 
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                : currentMenuIsAwaiting
                ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                : 'btn-primary shadow-[0_0_15px_rgba(99,102,241,0.2)]'
            }`}
          >
            {finalizing ? (
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : currentMenuIsApproved ? (
              <CheckCircle2 size={14} />
            ) : currentMenuIsAwaiting ? (
              <CalendarClock size={14} />
            ) : (
              <CheckCircle2 size={14} />
            )}
            <span>
              {finalizing 
                ? 'Saving...' 
                : currentMenuIsApproved 
                ? 'Menu Approved' 
                : currentMenuIsAwaiting 
                ? 'Awaiting Approval' 
                : 'Submit for approval'}
            </span>
          </button>
          {currentMenuIsApproved && (
            <button
              type="button"
              onClick={handleResetMenu}
              disabled={loading || resetting || finalizing}
              className="rounded-2xl border border-amber-400 bg-amber-400/10 px-3 py-1.5 text-[10px] sm:text-xs font-semibold text-amber-200 hover:bg-amber-400/20 disabled:opacity-50"
            >
              {resetting ? 'Resetting...' : 'Reset Finalization'}
            </button>
          )}
          <div className="flex items-center gap-1.5 bg-indigo-500/12 border border-indigo-500/25 px-2.5 py-1 rounded-full">
            <TrendingUp size={12} className="text-indigo-400" />
            <span className="text-xs font-semibold text-indigo-400">{totalVotesCount} student voters</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-40 rounded-2xl bg-white/5 border border-white/8" />
          <div className="h-28 rounded-2xl bg-white/5 border border-white/8" />
        </div>
      ) : finalMenu.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-white/4 p-5 text-sm text-[hsl(var(--muted-foreground))]">
          No final menu has been generated yet for tomorrow.
        </div>
      ) : (
        <div className="space-y-4">
          {finalMenu.map((meal) => {
            const dateObj = new Date(`${tomorrow}T00:00:00.000Z`);
            const blueprint = getVoteBlueprintsForDate(dateObj).find((b) => b.mealType === meal.mealType);
            const categories = blueprint?.categories ?? [];
            const rankedOptions = getRankedOptions(meal.mealType);
            const groupedOptions = groupRankedOptionsByCategory(rankedOptions, categories);
            const recommendedGroups = groupedOptions
              .map((group) => ({
                category: group.category,
                items: group.options.slice(0, 1),
              }))
              .filter((group) => group.items.length > 0);
            const recommendedWinnerLabel = totalVotesCount === 0 ? 'Voting in progress...' : buildSummary(recommendedGroups);
            const finalWinnerLabel = meal.winningItems.map((item) => item.label).join(' + ');
            const recommendedWinnerIds = recommendedGroups.flatMap((group) => group.items.map((item) => item.selectedOptionId));
            const finalWinnerIds = meal.winningItems.map((item) => item.selectedOptionId);
            const isOverride = meal.winnerSource === 'staff_override';
            const showDifferentRecommended = totalVotesCount > 0 && recommendedWinnerIds.length > 0 && finalWinnerIds.length > 0 && !areIdSetsEqual(recommendedWinnerIds, finalWinnerIds);
            const selectedDifferentFromRecommended = !currentMenuIsApproved && showDifferentRecommended;
            const recommendedDifferentInApproved = currentMenuIsApproved && showDifferentRecommended;
            const activeOverride = overrideMealType === meal.mealType;
            const highlightedOptionIds = new Set(meal.winningItems.map((item) => item.selectedOptionId));

            const winningGroups = categories.length > 1
              ? categories.map((category) => ({
                  category,
                  items: meal.winningItems.filter((item) => item.categoryKey === category.id),
                })).filter((group) => group.items.length > 0)
              : [{ category: { id: 'main', label: 'Winner' }, items: meal.winningItems }];

            const finalWinnerSummary = winningGroups.length > 1
              ? winningGroups.map((group) => `${group.category.label}: ${group.items.map((item) => item.label).join(' + ')}`).join(' · ')
              : finalWinnerLabel;

            const isEditingOptions = editingOptionsMealType === meal.mealType;

            return (
              <div key={meal.mealType} className="rounded-2xl border border-white/8 bg-white/4 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-indigo-300/70 font-semibold">{meal.title}</p>
                    <div className="text-xs text-white/45 mt-1">{meal.subtitle}</div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-xs text-white/35">
                      {currentMenuIsApproved ? 'Finalized menu' : totalVotesCount === 0 ? 'No votes yet' : 'Current Leader'}
                    </div>
                    <div className="text-sm font-bold text-white">
                      {currentMenuIsApproved ? shortenDishName(finalWinnerSummary) : totalVotesCount === 0 ? 'Waiting for votes...' : shortenDishName(recommendedWinnerLabel)}
                    </div>
                    {totalVotesCount > 0 && !currentMenuIsApproved && (
                      <div className="text-[10px] text-indigo-300/60 flex items-center justify-end gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                        Live voting data
                      </div>
                    )}
                    {winningGroups.length > 1 && currentMenuIsApproved && (
                      <div className="space-y-1 text-xs text-white/50">
                        {winningGroups.map((group, gIdx) => (
                          <div key={`${group.category.id}-${gIdx}`}>
                            <span className="font-semibold text-white/80">{group.category.label}:</span>{' '}
                            {group.items.map((item, iIdx) => (
                              <span key={`${item.selectedOptionId}-${iIdx}`}>
                                {item.label}{iIdx < group.items.length - 1 ? ' + ' : ''}
                              </span>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                    {currentMenuIsApproved && recommendedDifferentInApproved && (
                      <div className="text-xs text-white/50">
                        Students chose: {recommendedWinnerLabel}
                      </div>
                    )}
                    {!currentMenuIsApproved && selectedDifferentFromRecommended && (
                      <div className="text-xs text-white/50">
                        Selected winner (pending approval): {finalWinnerSummary}
                      </div>
                    )}
                    {totalVotesCount === 0 && !currentMenuIsApproved && (
                      <div className="text-[10px] text-indigo-300/60">No winner yet. Waiting for student votes...</div>
                    )}
                    {isOverride && (
                      <div className="text-[10px] text-amber-300">Staff override{meal.overrideReason ? ` · ${meal.overrideReason}` : ''}</div>
                    )}
                  </div>
                </div>

                <div className="text-xs text-white/55 mb-3">Fixed: {meal.fixedItems.join(' · ')}</div>
                {currentMenuIsApproved && (
                  <div className="text-[11px] text-white/50 mb-3">
                    Voting has been locked because this menu is approved for tomorrow.
                  </div>
                )}

                {isEditingOptions ? (
                  <div className="mb-4 rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-indigo-300">Edit {meal.mealType} Options</h4>
                      <button 
                        onClick={() => setEditingOptionsMealType(null)}
                        className="p-1 hover:bg-white/10 rounded-lg text-white/40"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <ManageVoteOptions mealType={meal.mealType as any} compact />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {groupedOptions.map((group) => (
                      <div key={group.category.id} className="space-y-3">
                        {groupedOptions.length > 1 && (
                          <div className="text-[11px] uppercase tracking-[0.24em] text-indigo-300 font-semibold">
                            {group.category.label} Results
                          </div>
                        )}
                        <div className="space-y-2">
                          {group.options.map((option, index) => {
                            const medal = getMedal(index, option.votes);
                            return (
                              <div
                                key={`${option.selectedOptionId}-${index}`}
                                className={`rounded-xl border p-3 ${highlightedOptionIds.has(option.selectedOptionId) ? 'border-indigo-500/60 bg-indigo-500/10' : 'border-white/10 bg-white/5'}`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2 min-w-0">
                                    {medal ? (
                                      <span className="text-lg">{medal}</span>
                                    ) : (
                                      <span className="text-[11px] font-semibold text-indigo-200">{index + 1}.</span>
                                    )}
                                    <span className="flex items-center gap-2 text-sm font-semibold text-white truncate">
                                      <span>{option.emoji}</span>
                                      <span title={option.label}>{shortenDishName(option.label)}</span>
                                    </span>
                                  </div>
                                  <div className="text-xs font-mono text-indigo-300">{option.votes} vote{option.votes === 1 ? '' : 's'}</div>
                                </div>
                                <div className="mt-2 text-xs text-white/45">{option.items.join(' + ')}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 border-t border-white/10 pt-4">
                  {currentMenuIsApproved && (
                    <div className="text-[11px] text-white/50 mb-3">
                      This menu is approved. Saving an override will move it back to pending approval so you can finalize the updated selection.
                    </div>
                  )}
                  {activeOverride ? (
                      <div className="space-y-4">
                        <div className="text-sm font-bold text-white mb-2">Select Final Menu</div>
                        <div className="grid gap-2">
                          {groupedOptions.map((group) => (
                            <div key={group.category.id} className="space-y-3">
                              {groupedOptions.length > 1 && (
                                <div className="text-[11px] uppercase tracking-[0.24em] text-indigo-300 font-semibold">
                                  {group.category.label} Selection
                                </div>
                              )}
                              <div className="space-y-2">
                                {group.options.map((option, idx) => (
                                  <label 
                                    key={`${option.selectedOptionId}-${idx}`} 
                                    className={`flex items-center gap-3 rounded-xl border px-3 py-3 cursor-pointer transition-all ${
                                      selectedOverrideOptions[group.category.id] === option.selectedOptionId
                                        ? 'border-indigo-500 bg-indigo-500/10'
                                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name={`override-${meal.mealType}-${group.category.id}`}
                                      value={option.selectedOptionId}
                                      checked={selectedOverrideOptions[group.category.id] === option.selectedOptionId}
                                      onChange={() => setSelectedOverrideOptions((prev) => ({
                                        ...prev,
                                        [group.category.id]: option.selectedOptionId,
                                      }))}
                                      className="w-4 h-4 accent-indigo-400"
                                    />
                                    <div className="flex-1">
                                      <div className="text-sm font-semibold text-white">{option.label}</div>
                                      <div className="text-[10px] text-white/40">{option.items.join(' + ')}</div>
                                    </div>
                                    <span className="text-xs font-mono text-indigo-300">{option.votes} votes</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Override Reason (Optional)</label>
                          <textarea
                            rows={2}
                            value={overrideReason}
                            onChange={(event) => setOverrideReason(event.target.value)}
                            placeholder="Why are you choosing this option?"
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-indigo-400 focus:outline-none"
                          />
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setOverrideMealType(null);
                              setSelectedOverrideOptions({});
                              setOverrideReason('');
                            }}
                            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const selectedIds = Object.values(selectedOverrideOptions).filter(Boolean);
                              if (!overrideMealType || selectedIds.length === 0) return;
                              setOverrideSaving(true);
                              try {
                                const response = await fetch('/api/live/finalize-menu', {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    mealType: overrideMealType,
                                    selectedOptionIds: selectedIds,
                                    reason: overrideReason,
                                  }),
                                });
                                if (!response.ok) {
                                  throw new Error('Failed to save selection');
                                }
                                toast.success('Final selection saved.');
                                setOverrideMealType(null);
                                setSelectedOverrideOptions({});
                                setOverrideReason('');
                                void loadMenu();
                              } catch (err) {
                                toast.error('Failed to save selection');
                              } finally {
                                setOverrideSaving(false);
                              }
                            }}
                            disabled={overrideSaving}
                            className="rounded-2xl bg-indigo-500 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
                          >
                            {overrideSaving ? 'Saving...' : 'Save Final Selection'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {!isEditingOptions && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                const initialSelection = categories.reduce((acc, category) => {
                                  const existing = meal.winningItems.find((item) => item.categoryKey === category.id);
                                  const defaultOption = groupedOptions.find((group) => group.category.id === category.id)?.options[0];
                                  acc[category.id] = existing?.selectedOptionId || defaultOption?.selectedOptionId || '';
                                  return acc;
                                }, {} as Record<string, string>);

                                if (categories.length === 0) {
                                  const defaultOption = rankedOptions[0];
                                  initialSelection.main = defaultOption?.selectedOptionId || '';
                                }

                                setOverrideMealType(meal.mealType);
                                setSelectedOverrideOptions(initialSelection);
                                setOverrideReason(meal.overrideReason ?? '');
                              }}
                              className="rounded-2xl bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10"
                            >
                              {currentMenuIsApproved ? 'Change Final Selection' : 'Choose Final Winner'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingOptionsMealType(meal.mealType)}
                              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10 flex items-center gap-2"
                            >
                              <Edit2 size={12} />
                              Edit Options
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRegenerateOptions(meal.mealType)}
                              className="rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10 flex items-center gap-2"
                            >
                              <RefreshCw size={12} />
                              Regenerate
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
        <CalendarClock size={12} />
        <span>Refreshing every 60 seconds for IST day {tomorrow}</span>
      </div>
    </div>
  );
}
