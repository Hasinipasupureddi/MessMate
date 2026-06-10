import { BREAKFAST_CATALOG } from './breakfastCatalog';
import { LUNCH_CATALOG } from './lunchCatalog';
import { DINNER_CATALOG } from './dinnerCatalog';
import { SNACK_CATALOG } from './snackCatalog';
import { VoteOption } from './votingBlueprints';

/**
 * SIMULATED VOTE GENERATION TEST
 * This script simulates the selection of 3 voting options for 10 consecutive days.
 * It demonstrates how the new Variety-First Selection algorithm prevents family/ingredient overlap.
 */

const recentlyServed: Set<string> = new Set();

function simulateDiversityAlgorithm(options: VoteOption[], mealType: string) {
    const candidates = options.filter(o => !recentlyServed.has(o.id));
    const finalChoices: VoteOption[] = [];
    const usedFamilies = new Set<string>();
    const usedSubFamilies = new Set<string>();

    const getDiversityScore = (opt: VoteOption) => {
        let score = 0;
        if (opt.subFamilies) {
            opt.subFamilies.forEach(sub => {
                if (!usedSubFamilies.has(sub)) score += 1;
            });
        }
        return score;
    };

    const tempCandidates = [...candidates];
    for (let i = 0; i < 3; i++) {
        if (tempCandidates.length === 0) break;
        let bestIdx = -1;
        let maxScore = -1;

        for (let j = 0; j < tempCandidates.length; j++) {
            const opt = tempCandidates[j];
            if (opt.family && usedFamilies.has(opt.family)) continue;
            
            const score = getDiversityScore(opt);
            if (score > maxScore) {
                maxScore = score;
                bestIdx = j;
            }
        }

        if (bestIdx === -1) bestIdx = 0;

        const picked = tempCandidates.splice(bestIdx, 1)[0];
        finalChoices.push(picked);
        if (picked.family) usedFamilies.add(picked.family);
        if (picked.subFamilies) picked.subFamilies.forEach(sub => usedSubFamilies.add(sub));
    }
    
    // Add picked items to recently served for next "day"
    finalChoices.forEach(c => recentlyServed.add(c.id));
    return finalChoices;
}

console.log("=== DIVERSITY SELECTION SIMULATION (10 DAYS) ===\n");

const mealCatalogs = {
    Breakfast: BREAKFAST_CATALOG,
    Lunch: LUNCH_CATALOG,
    Snack: SNACK_CATALOG,
    Dinner: DINNER_CATALOG
};

for (let day = 1; day <= 10; day++) {
    console.log(`DAY ${day}`);
    Object.entries(mealCatalogs).forEach(([name, catalog]) => {
        const choices = simulateDiversityAlgorithm(catalog, name);
        const display = choices.map(c => `${c.label} (${c.family})`).join(" | ");
        console.log(`  ${name.padEnd(10)}: ${display}`);
    });
    console.log("");
}
