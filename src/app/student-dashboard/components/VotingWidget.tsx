'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { TrendingUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { formatIstDateLabel, getIstDateString } from '@/lib/utils/mealStatus';
import { fetchWithRetry } from '@/lib/utils/fetchWithRetry';
import { useDietPreference } from '@/hooks/useDietPreference';
import { getVoteBlueprintsForDate, type VoteMealType } from '@/lib/menu/votingBlueprints';

type VoteCounts = Record<string, Record<string, Record<string, number>>>;

interface VotingWidgetProps {
  expanded?: boolean;
}

export default function VotingWidget({ expanded = false }: VotingWidgetProps) {
  const { user } = useAuth();
  const dietPreference = useDietPreference();
  const tomorrow = getIstDateString(1);
  const tomorrowDate = useMemo(() => new Date(`${tomorrow}T00:00:00.000Z`), [tomorrow]);
  const blueprints = useMemo(() => getVoteBlueprintsForDate(tomorrowDate), [tomorrowDate]);
  const tomorrowLabel = formatIstDateLabel(tomorrowDate, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  const [selectedVotes, setSelectedVotes] = useState<Record<string, string[]>>({});
  const [voteCounts, setVoteCounts] = useState<VoteCounts>({});
  const [dbOptions, setDbOptions] = useState<any[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalVotedCount, setTotalVotedCount] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [participationData, setParticipationData] = useState<Record<string, number>>({});
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const isEditingRef = useRef(false);

  const loadVotes = useCallback(async (signal?: AbortSignal) => {
    try {
      const [votesResponse, optionsResponse] = await Promise.all([
        fetchWithRetry(`/api/meal-votes?date=${tomorrow}`, { signal }, { retries: 2, backoffMs: 300, timeoutMs: 15000 }),
        fetchWithRetry(`/api/vote-options?date=${tomorrow}`, { signal }, { retries: 2, backoffMs: 300, timeoutMs: 15000 }),
      ]);

      if (signal?.aborted) return;

      const votesPayload = await votesResponse.json().catch(() => ({}));
      const optionsPayload = await optionsResponse.json().catch(() => ({}));

      if (!votesResponse.ok) {
        console.log('Load votes error:', votesPayload?.message || 'request failed');
        setIsLoadingData(false);
        return;
      }

      const nextCounts: VoteCounts = {};

      (votesPayload?.rows ?? []).forEach((row: any) => {
        const mealType = String(row.mealType ?? row.meal_type ?? '');
        const categoryKey = String(row.categoryKey ?? row.category_key ?? 'main');
        const optionId = String(row.menuOption ?? row.dish_option_id ?? row.option ?? '');
        const votes = Number(row.votes ?? row.total_votes ?? 0);

        if (!mealType || !optionId) return;

        if (!nextCounts[mealType]) nextCounts[mealType] = {};
        if (!nextCounts[mealType][categoryKey]) nextCounts[mealType][categoryKey] = {};
        nextCounts[mealType][categoryKey][optionId] = votes;
      });

      setVoteCounts(nextCounts);
      setParticipationData((votesPayload?.participation || {}) as Record<string, number>);
      setTotalVotedCount(Number(votesPayload?.totalUniqueVoters || 0));
      // totalStudents is already returned by /api/meal-votes (from getVotes)
      setTotalStudents(Number(votesPayload?.totalStudents || 0));

      // Handle vote options
      if (!optionsResponse.ok) {
        const errMsg = optionsPayload?.message || 'Failed to load vote options';
        console.log('Load vote options error:', errMsg);
        setOptionsError(errMsg);
      } else {
        setDbOptions(optionsPayload?.options || []);
        setOptionsError(null);
      }

      if (votesPayload?.totalUniqueVoters === 0) {
        setSubmitted(false);
      }
    } catch (err: any) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.log('Load votes error:', err.message);
    } finally {
      setIsLoadingData(false);
    }
  }, [tomorrow]);

  const blueprintsWithDbOptions = useMemo(() => {
    // If we have DB options, use them as the source of truth for all blueprints.
    // If DB options are empty, we fall back to blueprints for structural skeleton,
    // but we'll show "Loading options..." or similar.
    const rawBlueprints = blueprints.map((bp) => {
      const bpOptions = dbOptions.filter((o) => o.mealType === bp.mealType);
      
      // If we have database options for this meal, use them.
      // Otherwise, use an empty list to avoid showing old/hardcoded blueprint options.
      const currentOptions = bpOptions.length > 0 
        ? bpOptions.map((o) => ({
            id: o.id,
            label: o.label,
            emoji: o.emoji,
            items: o.items,
            category: o.category,
            categoryKey: o.categoryKey,
            dietPreference: o.dietPreference,
          }))
        : [];

      return {
        ...bp,
        options: currentOptions,
      };
    });

    // Filter by student's food preference
    const preference = dietPreference;

    // Check if it's Week 2 Friday
    const weekNum = Math.ceil(tomorrowDate.getDate() / 7);
    const isWeek2Friday = 
      tomorrowDate.getDay() === 5 && 
      (weekNum === 2 || 
       (tomorrowDate.getMonth() === 5 && 
        (tomorrowDate.getDate() === 5 || tomorrowDate.getDate() === 12)));

    return rawBlueprints
      .map((bp) => {
        let filteredOptions = [...bp.options];
        
        // Apply Week 2 Friday rules
        if (isWeek2Friday && bp.mealType === 'lunch') {
          filteredOptions = filteredOptions.filter((opt) => {
            // For non-veg students on Week 2 Friday:
            // - Exclude "Special Add-on" (categoryKey: 'side')
            if (preference === 'non_veg' && opt.categoryKey === 'side') {
              return false;
            }
            return true;
          });
        }

        // Now apply the normal diet preference filter
        filteredOptions = filteredOptions.filter((opt) => {
          // If option has no preference set, it's for everyone
          if (!opt.dietPreference || opt.dietPreference === 'both') return true;
          // Otherwise, must match student's preference
          return opt.dietPreference === preference;
        });

        // 2. Adjust titles/subtitles for special days to reflect the preference group only for lunch.
        // On Sundays, snack and dinner use the same shared menu for all students.
        let title = bp.title;
        let subtitle = bp.subtitle;

        if (bp.isSpecialDay && bp.mealType === 'lunch') {
          const prefLabel = preference === 'veg' ? 'Veg' : 'Non-Veg';
          title = `${title} (${prefLabel})`;
          subtitle =
            preference === 'veg'
              ? 'Curated vegetarian selection for you'
              : 'Special non-vegetarian menu for you';
        } else if (bp.mealType === 'lunch' || bp.mealType === 'dinner') {
          // Explain weekday veg menu to non-veg students
          if (preference === 'non_veg') {
            subtitle = `${subtitle} (Weekday menus are vegetarian; Non-Veg specials on Wed/Fri/Sun)`;
          } else {
            subtitle = `${subtitle} (Recently served combos are hidden for variety)`;
          }
        }

        const filteredCategories = bp.categories.filter((category) =>
          filteredOptions.some((opt) => {
            const optionCategoryKey = 'categoryKey' in opt ? opt.categoryKey : undefined;
            const matchesCategory = optionCategoryKey
              ? optionCategoryKey === category.id
              : opt.category === category.type || (category.id === 'main' && opt.category === 'main');
            return matchesCategory;
          })
        );

        return {
          ...bp,
          title,
          subtitle,
          options: filteredOptions,
          categories: filteredCategories,
        };
      })
      .filter((bp) => bp.options.length > 0); // Only show blueprints that have relevant options
  }, [blueprints, dbOptions, dietPreference, tomorrowDate]);

  const loadMyVotes = useCallback(async (signal?: AbortSignal) => {
    if (!user?.id) {
      return;
    }

    try {
      const response = await fetchWithRetry(`/api/meal-votes?date=${tomorrow}&studentId=${user.id}`, { signal }, { retries: 2, backoffMs: 300, timeoutMs: 15000 });
      
      if (signal?.aborted) return;
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.log('Load my votes error:', payload?.message || 'request failed');
        return;
      }

      const nextVotes: Record<string, string[]> = {};
      (payload?.rows ?? []).forEach((row: any) => {
        const mealType = String(row.mealType ?? row.meal_type ?? '');
        const categoryKey = String(row.categoryKey ?? row.category_key ?? 'main');
        const optionId = String(row.menuOption ?? row.dish_option_id ?? '');
        if (mealType && optionId) {
          const key = `${mealType}:${categoryKey}`;
          if (!nextVotes[key]) {
            nextVotes[key] = [];
          }
          nextVotes[key].push(optionId);
        }
      });

      setSelectedVotes(nextVotes);
    } catch (err: any) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.log('Load my votes error:', err.message);
    }
  }, [tomorrow, user?.id]);

  // Determine submitted status when blueprints or votes are loaded/changed
  useEffect(() => {
    if (isEditingRef.current) return;
    if (blueprintsWithDbOptions.length === 0) return;

    const requiredMealTypes = ['breakfast', 'lunch', 'snack', 'dinner'];
    const relevantBps = blueprintsWithDbOptions.filter(bp => requiredMealTypes.includes(bp.mealType));

    const allVoted = relevantBps.length > 0 && relevantBps.every((bp) => {
      return bp.categories.every((cat) => {
        const catMaxSelections = cat.maxSelections ?? 1;
        const catVotes = selectedVotes[`${bp.mealType}:${cat.id}`] || [];
        return catVotes.length >= catMaxSelections;
      });
    });
    setSubmitted(allVoted);
  }, [blueprintsWithDbOptions, selectedVotes]);

  useEffect(() => {
    const controller = new AbortController();
    void loadVotes(controller.signal);
    void loadMyVotes(controller.signal);

    const id = window.setInterval(() => {
      void loadVotes(controller.signal);
    }, 60000);

    return () => {
      controller.abort();
      window.clearInterval(id);
    };
  }, [loadMyVotes, loadVotes]);

  const handleVote = async (mealType: VoteMealType, categoryKey: string, optionId: string) => {
    if (!user?.id) {
      toast.error('Please sign in to vote.');
      return;
    }

    const voteKey = `${mealType}:${categoryKey}`;
    const blueprint = blueprintsWithDbOptions.find((b) => b.mealType === mealType);
    const category = blueprint?.categories.find((c) => c.id === categoryKey);
    const maxSelections = category?.maxSelections ?? 1;

    const currentSelections = selectedVotes[voteKey] || [];
    let nextSelections: string[] = [];

    if (maxSelections > 1) {
      if (currentSelections.includes(optionId)) {
        nextSelections = currentSelections.filter((id) => id !== optionId);
      } else {
        if (currentSelections.length >= maxSelections) {
          toast.error(`You can select at most ${maxSelections} options.`);
          return;
        }
        nextSelections = [...currentSelections, optionId];
      }
    } else {
      nextSelections = [optionId];
    }

    // Optimistic update
    const previousVotes = { ...selectedVotes };
    setSelectedVotes((prev) => ({ ...prev, [voteKey]: nextSelections }));

    try {
      const votesToSave = nextSelections.map((id) => {
        const option = blueprint?.options.find((o) => o.id === id);
        return {
          student_id: user.id,
          meal_date: tomorrow,
          meal_type: mealType,
          category_key: categoryKey,
          menu_option: id,
          dish_option_id: id,
          dish_name: option?.label ?? option?.items.join(' + ') ?? id,
        };
      });

      const response = await fetchWithRetry('/api/meal-votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          votes: votesToSave,
          clearCategories: [{ mealType, categoryKey }],
        }),
      }, { retries: 2, backoffMs: 300, timeoutMs: 15000 });

      if (!response.ok) {
        const bodyText = await response.text().catch(() => '');
        let errorBody = null;
        try {
          errorBody = bodyText ? JSON.parse(bodyText) : null;
        } catch {
          errorBody = null;
        }

        const message =
          errorBody?.message ||
          (response.status === 403
            ? 'Voting has closed for tomorrow. No new votes are accepted after 10:00 PM IST.'
            : bodyText || `Failed to save vote (${response.statusText}). Please try again.`);
        throw new Error(message);
      }

      // Check if all meals are now voted (multi-select categories need maxSelections picks)
      const nextVotes = { ...selectedVotes, [voteKey]: nextSelections };
      const requiredMealTypes = ['breakfast', 'lunch', 'snack', 'dinner'];
      const relevantBps = blueprintsWithDbOptions.filter(bp => requiredMealTypes.includes(bp.mealType));

      const allVoted = relevantBps.length > 0 && relevantBps.every((bp) => {
        return bp.categories.every((cat) => {
          const catMaxSelections = cat.maxSelections ?? 1;
          const catVotes = nextVotes[`${bp.mealType}:${cat.id}`] || [];
          return catVotes.length >= catMaxSelections;
        });
      });

      if (allVoted) {
        isEditingRef.current = false;
        setSubmitted(true);
        toast.success('All votes submitted and saved! 🗳️');
      } else {
        toast.success(`Updated selections for ${category?.label || categoryKey}!`);
      }

      // Automatically mark attendance as "attending" for tomorrow when voting
      // This helps with forecasting (Option B requested by user)
      try {
        await fetchWithRetry('/api/meal-optins', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mealDate: tomorrow,
            mealType,
            status: 'attending',
          }),
        }, { retries: 1, backoffMs: 300, timeoutMs: 15000 });
      } catch (err) {
        console.warn('Auto-attendance failed (non-blocking):', err);
      }

      void loadVotes();
    } catch (err: any) {
      console.error('Vote save error:', err);
      // Rollback optimistic update
      setSelectedVotes(previousVotes);
      toast.error(err?.message || 'Failed to save vote. Please try again.');
    }
  };

  const participationStats = useMemo(() => {
    const stats: Record<string, { voted: number; total: number; pct: number }> = {};

    blueprintsWithDbOptions.forEach((bp) => {
      const voted = participationData[bp.mealType] || 0;
      stats[bp.mealType] = {
        voted,
        total: totalStudents,
        pct: Math.min(100, Math.round((voted / totalStudents) * 100)) || 0,
      };
    });

    return stats;
  }, [blueprintsWithDbOptions, participationData, totalStudents]);

  const allMealsVoted = blueprintsWithDbOptions.every((bp) =>
    bp.categories.every((cat) => {
      const catMaxSelections = cat.maxSelections ?? 1;
      const catVotes = selectedVotes[`${bp.mealType}:${cat.id}`] || [];
      return catVotes.length >= catMaxSelections;
    })
  );

  return (
    <div className={`glass-card ${expanded ? 'p-5' : 'p-4 sm:p-5'}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold" style={{ color: 'var(--student-text)' }}>Vote for Tomorrow</h2>
          <p className="text-xs sm:text-sm" style={{ color: 'var(--student-muted)' }}>
            {tomorrowLabel} · voting closes at 10 PM
          </p>

          {/* Info Banner */}
          <div className="mt-3 p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2">
            <div className="p-1 rounded-lg bg-indigo-500/20 text-indigo-400 mt-0.5">
              <TrendingUp size={12} />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">
                Variety-First Selection
              </p>
              <p className="text-[10px] text-white/60 leading-relaxed">
                Options are chosen from different meal families and ingredients to maximize variety.
              </p>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-3">
            <div className="text-[10px] text-white/40 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
              {isLoadingData ? 'Loading...' : `${totalStudents} Eligible Students`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-indigo-500/15 border border-indigo-500/25 px-2.5 py-1 rounded-full shrink-0">
          <TrendingUp size={12} className="text-indigo-400" />
          <span className="text-xs font-semibold text-indigo-400">
            {isLoadingData ? '...' : `${totalVotedCount}/${totalStudents}`} students voted
          </span>
        </div>
      </div>

      {submitted ? (
        <div className="text-center py-6 space-y-3">
          <div className="text-4xl">🗳️</div>
          <p className="text-white font-semibold">Votes submitted!</p>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            The final menu will be generated automatically from these votes.
          </p>
          <button
            onClick={() => {
              isEditingRef.current = true;
              setSubmitted(false);
            }}
            className="text-xs text-indigo-400 hover:underline"
          >
            Edit my votes
          </button>
        </div>
      ) : (
        <>
          {optionsError && (
            <div className="p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
              <p className="text-xs text-red-400 font-medium">
                ⚠️ Could not load vote options: {optionsError}
              </p>
              <button
                onClick={() => { setOptionsError(null); void loadVotes(); }}
                className="mt-1 text-[10px] text-red-300 hover:underline"
              >
                Retry
              </button>
            </div>
          )}
          {isLoadingData && blueprintsWithDbOptions.length === 0 && !optionsError && (
            <div className="text-center py-6">
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading vote options...</p>
            </div>
          )}
          <div className="space-y-6 mb-4">
            {blueprintsWithDbOptions.map((blueprint) => (
              <div key={blueprint.mealType} className="space-y-4">
                <div className="flex flex-col border-b border-white/5 pb-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">
                      {blueprint.title || blueprint.mealType}
                    </h3>
                    <div className="text-[10px] text-white/60">
                      {participationStats[blueprint.mealType]?.voted}/{totalStudents} Voted (
                      {participationStats[blueprint.mealType]?.pct}%)
                    </div>
                  </div>
                  {blueprint.subtitle && (
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                      {blueprint.subtitle}
                    </p>
                  )}
                </div>

                {blueprint.categories.map((category) => {
                  const categoryOptions = blueprint.options.filter((o) => {
                    const optionCategoryKey = 'categoryKey' in o ? o.categoryKey : undefined;
                    const matchesCategory = optionCategoryKey
                      ? optionCategoryKey === category.id
                      : o.category === category.type ||
                        (category.id === 'main' && o.category === 'main');
                    const matchesDiet =
                      !o.dietPreference ||
                      o.dietPreference === 'both' ||
                      o.dietPreference === dietPreference;
                    return matchesCategory && matchesDiet;
                  });

                  const selectedIds = selectedVotes[`${blueprint.mealType}:${category.id}`] || [];
                  const maxSelections = category.maxSelections ?? 1;

                  const isMultiSelect = maxSelections > 1;
                  const selectionComplete = selectedIds.length >= maxSelections;

                  return (
                    <section key={category.id} className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-semibold text-white/80 flex items-center gap-1.5">
                          {category.label}
                          {isMultiSelect && (
                            <span
                              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                selectionComplete
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                              }`}
                            >
                              {selectionComplete ? '✓ ' : ''}
                              {selectedIds.length}/{maxSelections}
                            </span>
                          )}
                        </h4>
                        {isMultiSelect && !selectionComplete && (
                          <span className="text-[9px] text-white/35 italic">
                            tap to select · tap again to deselect
                          </span>
                        )}
                        {category.description && !isMultiSelect && (
                          <span className="text-[10px] text-white/40">{category.description}</span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        {categoryOptions.map((option) => {
                          const isSelected = selectedIds.includes(option.id);
                          const counts =
                            (voteCounts[blueprint.mealType] || {})[category.id] ||
                            ({} as Record<string, number>);
                          const optionVotes = (counts[option.id] || 0) as number;
                          const categoryTotal =
                            (Object.values(counts) as number[]).reduce((sum, v) => sum + v, 0) || 1;
                          const pct = Math.round((optionVotes / categoryTotal) * 100);

                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => handleVote(blueprint.mealType, category.id, option.id)}
                              className={`w-full p-3 rounded-xl border text-left transition-all active:scale-98 ${
                                isSelected
                                  ? 'bg-indigo-500/20 border-indigo-500/50'
                                  : 'bg-white/3 border-white/8 hover:bg-white/6 hover:border-white/15'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5 gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-lg">{option.emoji}</span>
                                    <span className={`text-sm font-semibold text-white`}>
                                      {option.label}
                                    </span>
                                    {isSelected && (
                                      <span className="ml-auto text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold">
                                        Selected
                                      </span>
                                    )}
                                  </div>
                                  {option.items && option.items.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {option.items.map((item: string, idx: number) => (
                                        <span
                                          key={idx}
                                          className="text-[10px] text-white/40 bg-white/5 px-1.5 py-0.5 rounded"
                                        >
                                          {item}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <span className="text-[10px] font-bold text-white/40">{pct}%</span>
                              </div>
                              <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                <div
                                  className="progress-fill"
                                  style={{
                                    width: `${pct}%`,
                                    background: isSelected ? '#818cf8' : 'rgba(255,255,255,0.2)',
                                  }}
                                />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-center">
            <p className="text-xs text-indigo-300 font-medium">
              {allMealsVoted
                ? '✨ All your votes are saved to the database!'
                : '👆 Your selections are saved automatically as you click.'}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
