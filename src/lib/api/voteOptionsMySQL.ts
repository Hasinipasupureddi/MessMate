import { getMysqlPool } from '@/lib/db/mysql';
import { ensureMysqlSchema } from '@/lib/db/init';
import { 
  getVoteBlueprintsForDate, 
  type VoteOption, 
  type VoteMealType,
  DEFAULT_FIXED_ITEMS
} from '../menu/votingBlueprints';
import { BREAKFAST_CATALOG } from '../menu/breakfastCatalog';
import { LUNCH_CATALOG, NON_VEG_CURRY_OPTIONS } from '../menu/lunchCatalog';
import { SNACK_CATALOG } from '../menu/snackCatalog';
import { DINNER_CATALOG } from '../menu/dinnerCatalog';
import { FRIDAY_DINNER_SPECIAL, FRIDAY_LUNCH_SPECIAL_ADDONS, SUNDAY_CATALOG, WEDNESDAY_SPECIAL_OPTIONS } from '../menu/sundayCatalog';

const ALL_CATALOGS = [
  ...BREAKFAST_CATALOG,
  ...LUNCH_CATALOG,
  ...NON_VEG_CURRY_OPTIONS,
  ...SNACK_CATALOG,
  ...DINNER_CATALOG,
  ...WEDNESDAY_SPECIAL_OPTIONS,
  ...FRIDAY_LUNCH_SPECIAL_ADDONS,
  ...FRIDAY_DINNER_SPECIAL,
  ...SUNDAY_CATALOG
];

export function getOptionById(id: string): VoteOption | undefined {
  return ALL_CATALOGS.find(o => o.id === id);
}

async function hasColumn(pool: any, tableName: string, columnName: string) {
  const queryRunner = typeof pool.query === 'function'
    ? pool.query.bind(pool)
    : typeof pool.execute === 'function'
      ? pool.execute.bind(pool)
      : null;

  if (!queryRunner) {
    throw new Error('MySQL pool does not expose query or execute for schema inspection');
  }

  const result = await queryRunner(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );

  const rows = Array.isArray(result) && Array.isArray(result[0]) && Array.isArray(result[0][0])
    ? result[0]
    : Array.isArray(result) && Array.isArray(result[0])
      ? result[0]
      : result;

  const row = Array.isArray(rows) ? rows[0] : rows;

  return Number((row as any)?.cnt ?? 0) > 0;
}

function normalizeCatalogId(optionId: string | null | undefined): string | null {
  if (!optionId) return null;

  const trimmed = String(optionId).trim();
  const generatedMatch = trimmed.match(/^(.*)-\d{4}-\d{2}-\d{2}-[^-]+$/);

  return generatedMatch ? generatedMatch[1] : trimmed;
}

function matchesCategory(option: any, category: { id: string; type: string }) {
  const optionCategoryKey = option.categoryKey;

  if (optionCategoryKey) {
    return optionCategoryKey === category.id;
  }

  if (option.category === category.type) {
    return true;
  }

  if (category.id === 'main' && option.category === 'main') {
    return true;
  }

  return false;
}

export async function getVoteOptionsForDate(date: string, forceRegenerate: boolean = false, targetMealType?: string) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  if (!forceRegenerate) {
    const [rows] = await pool.execute(
      `SELECT id, meal_type, category_key, item_name, item_emoji, item_group, cooldown_weeks, diet_preference
       FROM vote_options
       WHERE vote_date = ?`,
      [date]
    );

    if (Array.isArray(rows) && rows.length > 0) {
      console.log(`[VOTE_OPTIONS] Loaded ${rows.length} existing options for ${date}`);
      
      const loadedOptions = (rows as any[]).map(row => {
        const mealType = row.meal_type as VoteMealType;
        const rawCategoryKey = String(row.category_key ?? 'main');
        const normalizedCategoryKey = rawCategoryKey === 'sunday_multi'
          ? mealType === 'snack'
            ? 'snack'
            : 'main'
          : rawCategoryKey;

        return {
          id: row.id,
          mealType,
          categoryKey: normalizedCategoryKey,
          category: normalizedCategoryKey,
          label: row.item_name,
          emoji: row.item_emoji,
          items: typeof row.item_group === 'string' ? JSON.parse(row.item_group) : (row.item_group || []),
          cooldownWeeks: row.cooldown_weeks,
          dietPreference: row.diet_preference
        };
      });

      // If we are NOT forcing, but we have missing meal types, we should generate them
      // This handles cases where a previous generation crashed halfway
      if (!targetMealType) {
         const foundMealTypes = new Set(loadedOptions.map(o => o.mealType));
         const requiredMealTypes: VoteMealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];
         const missing = requiredMealTypes.filter(m => !foundMealTypes.has(m));
         if (missing.length === 0) {
           return loadedOptions;
         }
         console.log(`[VOTE_OPTIONS] Found existing options but missing: ${missing.join(', ')}. Generating missing.`);
      } else {
        return loadedOptions;
      }
    }
  }

  console.log(`[VOTE_OPTIONS] Generating new options for ${date} using v2 Variety-First algorithm`);
  // If no options exist for this date, initialize from blueprints with rotation logic
  const dateObj = new Date(`${date}T00:00:00.000Z`);
  const blueprints = getVoteBlueprintsForDate(dateObj);
  const optionsToInsert: any[] = [];

  // Fetch rotation stats
  const [statsRows] = await pool.execute(
    `SELECT option_id, last_served_date, last_offered_date, times_shown, times_won
     FROM menu_rotation`
  );
  const stats = (statsRows as any[]).reduce((acc, row) => {
    acc[row.option_id] = {
      ...row,
      last_served_date: row.last_served_date ? new Date(row.last_served_date).toISOString().split('T')[0] : null,
      last_offered_date: row.last_offered_date ? new Date(row.last_offered_date).toISOString().split('T')[0] : null
    };
    return acc;
  }, {} as any);

  // Fetch recently served combos to prevent repetition (4 week cooldown = 28 days)
  const supportsFinalMenuOriginalCatalogId = await hasColumn(pool, 'final_menu', 'original_catalog_id');
  const [recentServedRows] = await pool.execute(
    supportsFinalMenuOriginalCatalogId
      ? `SELECT winning_item_id, original_catalog_id, menu_date 
         FROM final_menu 
         WHERE menu_date >= DATE_SUB(?, INTERVAL 28 DAY)`
      : `SELECT winning_item_id, menu_date 
         FROM final_menu 
         WHERE menu_date >= DATE_SUB(?, INTERVAL 28 DAY)`,
    [date]
  );
  // Normalize generated final_menu IDs back to their original catalog IDs so
  // the recency filter can compare them against the vote-option catalog entries.
  const recentlyServedIds = new Set<string>();

  for (const row of recentServedRows as any[]) {
    const normalized = normalizeCatalogId(row.winning_item_id);
    if (normalized) recentlyServedIds.add(normalized);

    if (supportsFinalMenuOriginalCatalogId && row.original_catalog_id) {
      recentlyServedIds.add(String(row.original_catalog_id));
    }
  }

  const recentlyServedOriginalIds = new Set<string>();

  for (const bp of blueprints) {
    // If targetMealType is provided, skip other meal types
    if (targetMealType && bp.mealType !== targetMealType) continue;

    console.log(`[VOTE_OPTIONS] Processing blueprint for ${bp.mealType} (Special: ${bp.isSpecialDay}, Fixed: ${bp.isFixedMenu})`);

    if (bp.isFixedMenu) {
      bp.options.forEach(opt => {
        optionsToInsert.push({
          id: opt.id,
          vote_date: date,
          meal_type: bp.mealType,
          category_key: bp.categories[0]?.id || 'main',
          item_name: opt.label,
          item_emoji: opt.emoji,
          item_group: JSON.stringify(opt.items),
          cooldown_weeks: bp.cooldownWeeks,
          diet_preference: opt.dietPreference || 'both'
        });
      });
      continue;
    }

    for (const cat of bp.categories) {
      let eligibleOptions = bp.options.filter((o) => matchesCategory(o, cat));
      
      console.log(`[VOTE_OPTIONS] MEAL: ${bp.mealType} | CATEGORY: ${cat.id} | ELIGIBLE: ${eligibleOptions.length}`);
      if (eligibleOptions.length === 0) {
        console.log(`[VOTE_OPTIONS]   WARNING: No eligible options for ${bp.mealType} ${cat.id}. Check blueprint logic.`);
        continue;
      }

      // --- NEW VARIETY-FIRST SELECTION ALGORITHM (V2) ---
      // Goal: Guaranteed 3 choices with maximum family/vegetable diversity for ALL meal types.
      
      // 1. Filter by 4-week cooldown (Recency)
      // Compare against the original catalog IDs that the live vote options use.
      let candidates = eligibleOptions.filter(o =>
        !recentlyServedIds.has(o.id) && !recentlyServedOriginalIds.has(o.id)
      );
        
        // Fallback: If recency filter is too aggressive, relax it to ensure we have enough options to pick from
        if (candidates.length < 3) {
           console.log(`[VOTE_OPTIONS] Recency filter left only ${candidates.length} items. Relaxing filter.`);
           candidates = [...eligibleOptions].sort((a, b) => 
             (stats[a.id]?.times_shown || 0) - (stats[b.id]?.times_shown || 0)
           );
        }

        // Final sanity check: If we still don't have 3, use all eligible options
      if (candidates.length < 3) {
        console.log(`[VOTE_OPTIONS] [CRITICAL] Pool size (${candidates.length}) below 3 for ${bp.mealType} ${cat.id}. Using all eligible.`);
        candidates = [...eligibleOptions];
      }

      // ULTIMATE FALLBACK: If eligibleOptions is still empty (shouldn't happen with correct catalogs)
      // we must ensure we don't crash but also don't save a broken state.
      if (candidates.length === 0) {
        const errorMsg = `[VOTE_OPTIONS_ERROR] mealType=${bp.mealType} generated 0 options because eligibleOptions is empty!`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      
      console.log(`[VOTE_OPTIONS] Picking candidates for ${bp.mealType} (${cat.id}): Pool size = ${candidates.length}`);
        
        const finalChoices: VoteOption[] = [];
        const usedFamilies = new Set<string>();
        const usedSubFamilies = new Set<string>(); 

        const violatesHardConstraints = (opt: VoteOption) => {
          if (opt.family && usedFamilies.has(opt.family)) return true;
          return false;
        };

        const getDiversityScore = (opt: VoteOption) => {
          let score = 0;
          if (opt.subFamilies) {
            opt.subFamilies.forEach(sub => {
              if (!usedSubFamilies.has(sub)) score += 2;
            });
          }
          const label = opt.label.toLowerCase();
          const pickedLabels = finalChoices.map(c => c.label.toLowerCase());
          if (label.includes('fry') && !pickedLabels.some(l => l.includes('fry'))) score += 1;
          if ((label.includes('sambar') || label.includes('pulusu')) && !pickedLabels.some(l => l.includes('sambar') || l.includes('pulusu'))) score += 1;
          return score;
        };

        const maxSlots = 3;
        for (let i = 0; i < maxSlots; i++) {
          if (candidates.length === 0) break;

          // Find the best candidate among remaining options
          let bestIdx = -1;
          let maxScore = -1;

          for (let j = 0; j < candidates.length; j++) {
            const opt = candidates[j];
            
            // Apply HARD constraints first (No repeated primary vegetable/meal family)
            const remainingNeeded = maxSlots - finalChoices.length;
            const otherCandidates = candidates.filter((_, idx) => idx !== j);
            
            const violates = violatesHardConstraints(opt);
            
            // CRITICAL FIX: Ensure we don't accidentally skip the last few candidates
            // if skipping them would make it impossible to fill the remaining slots.
            // We only skip if we have enough other candidates that do NOT violate constraints.
            const viableOthersCount = otherCandidates.filter(c => !violatesHardConstraints(c)).length;
            const canAffordToSkip = viableOthersCount >= remainingNeeded;

            if (violates && canAffordToSkip) {
              console.log(`[VOTE_OPTIONS]   Skipping ${opt.label} (Family: ${opt.family}) - Already used and have ${viableOthersCount} viable alternatives.`);
              continue; 
            }

            const score = getDiversityScore(opt);
            
            if (score > maxScore) {
              maxScore = score;
              bestIdx = j;
            }
          }

          // If no candidate passed hard constraints (or we couldn't afford to skip), take the one with best diversity score anyway
          if (bestIdx === -1) {
            console.log(`[VOTE_OPTIONS]   No candidate passed hard constraints for slot #${i+1}. Taking best available.`);
            // Sort remaining candidates by diversity score and take the best one
            const scoredRemaining = candidates.map((c, idx) => ({ idx, score: getDiversityScore(c) }));
            scoredRemaining.sort((a, b) => b.score - a.score);
            bestIdx = scoredRemaining[0].idx;
          }

          const picked = candidates.splice(bestIdx, 1)[0];
          finalChoices.push(picked);
          console.log(`[VOTE_OPTIONS]   Picked #${i+1}: ${picked.id} (${picked.label}) - Family: ${picked.family}`);
          
          if (picked.family) usedFamilies.add(picked.family);
          if (picked.subFamilies) picked.subFamilies.forEach(sub => usedSubFamilies.add(sub));
        }

        const selected = finalChoices;

        console.log(`[VOTE_OPTIONS] Selected ${selected.length} options for ${bp.mealType} (${cat.id})`);

        for (const opt of selected) {
          const insertData = {
            id: `${opt.id}-${date}-${cat.id}`, // Deterministic ID for each generation
            original_catalog_id: opt.id,
            vote_date: date,
            meal_type: bp.mealType,
            category_key: cat.id,
            item_name: opt.label,
            item_emoji: opt.emoji,
            item_group: JSON.stringify(opt.items),
            cooldown_weeks: bp.cooldownWeeks,
            diet_preference: opt.dietPreference || 'both'
          };
          console.log(`[VOTE_OPTIONS]   -> Adding: ${opt.label} (${cat.id}) [${insertData.diet_preference}]`);
          optionsToInsert.push(insertData);
        }
      }
  }

  // --- HARD VALIDATION BEFORE SAVING ---
  const mealCounts = optionsToInsert.reduce((acc: any, opt: any) => {
    acc[opt.meal_type] = (acc[opt.meal_type] || 0) + 1;
    return acc;
  }, {});

  const requiredMeals = ['breakfast', 'lunch', 'snack', 'dinner'];
  const errors: string[] = [];

  for (const meal of requiredMeals) {
    // Skip validation for meal types that weren't targeted if targetMealType is set
    if (targetMealType && meal !== targetMealType) continue;
    
    const count = mealCounts[meal] || 0;
    if (count < 3) {
      const errorMsg = `[VOTE_OPTIONS_ERROR] mealType=${meal} generated only ${count} options (Expected 3)`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Validation Failed: ${errors.join('; ')}`);
  }

  console.log(`[VOTE_OPTIONS] Finished loops. Total optionsToInsert count: ${optionsToInsert.length}`);

  if (optionsToInsert.length > 0) {
    const supportsOriginalCatalogId = await hasColumn(pool, 'vote_options', 'original_catalog_id');

    console.log(`[VOTE_OPTIONS] Saving ${optionsToInsert.length} options to database for ${date}...`);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // ALWAYS clear existing options for the date/meal combinations we are about to insert
      // This prevents the "3810 bug" (row accumulation)
      const mealsToClear = Array.from(new Set(optionsToInsert.map(o => o.meal_type)));
      console.log(`[VOTE_OPTIONS] Clearing existing options for ${date} and meals: ${mealsToClear.join(', ')}`);
      
      for (const meal of mealsToClear) {
        await connection.execute(
          `DELETE FROM vote_options WHERE vote_date = ? AND meal_type = ?`,
          [date, meal]
        );
      }

      console.log(`[VOTE_OPTIONS] Inserting ${optionsToInsert.length} new options into database`);
      for (const opt of optionsToInsert) {
        const insertColumns = supportsOriginalCatalogId
          ? '(id, original_catalog_id, vote_date, meal_type, category_key, item_name, item_emoji, item_group, cooldown_weeks, diet_preference)'
          : '(id, vote_date, meal_type, category_key, item_name, item_emoji, item_group, cooldown_weeks, diet_preference)';

        const insertValues = supportsOriginalCatalogId
          ? [
              opt.id,
              opt.original_catalog_id || opt.id,
              opt.vote_date,
              opt.meal_type,
              opt.category_key,
              opt.item_name || null,
              opt.item_emoji || null,
              opt.item_group || null,
              opt.cooldown_weeks || 3,
              opt.diet_preference || 'both'
            ]
          : [
              opt.id,
              opt.vote_date,
              opt.meal_type,
              opt.category_key,
              opt.item_name || null,
              opt.item_emoji || null,
              opt.item_group || null,
              opt.cooldown_weeks || 3,
              opt.diet_preference || 'both'
            ];

        await connection.execute(
          `INSERT INTO vote_options ${insertColumns}
           VALUES (${insertValues.map(() => '?').join(', ')})`,
          insertValues
        );
        
        // Track in rotation using catalog ID, not generated ID
        const catalogId = opt.original_catalog_id || opt.id;
        await connection.execute(
          `INSERT INTO menu_rotation (meal_type, option_id, times_shown, last_offered_date)
           VALUES (?, ?, 1, ?)
           ON DUPLICATE KEY UPDATE times_shown = times_shown + 1, last_offered_date = ?`,
          [opt.meal_type, catalogId, date, date]
        );
      }

      await connection.commit();
      console.log(`[VOTE_OPTIONS] Successfully committed ${optionsToInsert.length} options`);
    } catch (err: any) {
      await connection.rollback();
      console.error(`[VOTE_OPTIONS] Transaction failed, rolled back:`, err);
      throw err;
    } finally {
      connection.release();
    }
  }

  // Return the newly generated options in the same format as the DB load
  return optionsToInsert.map(opt => ({
    id: opt.id,
    mealType: opt.meal_type,
    categoryKey: opt.category_key,
    category: opt.category_key,
    label: opt.item_name,
    emoji: opt.item_emoji,
    items: JSON.parse(opt.item_group),
    cooldownWeeks: opt.cooldown_weeks,
    dietPreference: opt.diet_preference
  }));
}

export async function updateVoteOption(date: string, option: Partial<VoteOption> & { id: string, mealType: VoteMealType }) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  await pool.execute(
    `UPDATE vote_options
     SET item_name = COALESCE(?, item_name),
         item_emoji = COALESCE(?, item_emoji),
         item_group = COALESCE(?, item_group)
     WHERE vote_date = ? AND id = ? AND meal_type = ?`,
    [
      option.label || null,
      option.emoji || null,
      option.items ? JSON.stringify(option.items) : null,
      date,
      option.id,
      option.mealType
    ]
  );
}

export async function addVoteOption(date: string, mealType: VoteMealType, categoryKey: string, option: VoteOption) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  await pool.execute(
    `INSERT INTO vote_options (id, vote_date, meal_type, category_key, item_name, item_emoji, item_group)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       item_name = VALUES(item_name),
       item_emoji = VALUES(item_emoji),
       item_group = VALUES(item_group)`,
    [
      option.id,
      date,
      mealType,
      categoryKey || 'main',
      option.label,
      option.emoji,
      JSON.stringify(option.items)
    ]
  );
}

export async function deleteVoteOption(date: string, mealType: VoteMealType, optionId: string) {
  await ensureMysqlSchema();
  const pool = getMysqlPool();

  await pool.execute(
    `DELETE FROM vote_options WHERE vote_date = ? AND meal_type = ? AND id = ?`,
    [date, mealType, optionId]
  );
}
