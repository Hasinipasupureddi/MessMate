import { BREAKFAST_CATALOG } from './breakfastCatalog';
import { LUNCH_CATALOG } from './lunchCatalog';
import { DINNER_CATALOG } from './dinnerCatalog';
import { SNACK_CATALOG } from './snackCatalog';
import { VoteOption } from './votingBlueprints';

const recentlyServed: Set<string> = new Set();

function simulateDiversityAlgorithm(options: VoteOption[]) {
    const candidates = options.filter(o => !recentlyServed.has(o.id));
    const finalChoices: VoteOption[] = [];
    const usedFamilies = new Set<string>();
    const usedSubFamilies = new Set<string>();

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
    finalChoices.forEach(c => recentlyServed.add(c.id));
    return finalChoices;
}

const stats = {
    Breakfast: { families: 0 },
    Lunch: { vegFamilies: 0, subFamilies: 0 },
    Snack: { families: 0 },
    Dinner: { vegFamilies: 0, subFamilies: 0 }
};

console.log("=== 30-DAY DIVERSITY SIMULATION REPORT ===\n");

const days = 30;
for (let d = 1; d <= days; d++) {
    const b = simulateDiversityAlgorithm(BREAKFAST_CATALOG);
    const l = simulateDiversityAlgorithm(LUNCH_CATALOG);
    const s = simulateDiversityAlgorithm(SNACK_CATALOG);
    const dn = simulateDiversityAlgorithm(DINNER_CATALOG);

    stats.Breakfast.families += new Set(b.map(o => o.family)).size;
    stats.Lunch.vegFamilies += new Set(l.map(o => o.family)).size;
    stats.Lunch.subFamilies += new Set(l.flatMap(o => o.subFamilies || [])).size;
    stats.Snack.families += new Set(s.map(o => o.family)).size;
    stats.Dinner.vegFamilies += new Set(dn.map(o => o.family)).size;
    stats.Dinner.subFamilies += new Set(dn.flatMap(o => o.subFamilies || [])).size;

    if (d % 10 === 0 || d === 1) {
        console.log(`DAY ${d} SAMPLE:`);
        console.log(`  Lunch: ${l.map(o => o.label).join(" | ")}`);
    }
}

console.log("\n--- AVERAGES OVER 30 DAYS ---");
console.log(`Breakfast Unique Families: ${(stats.Breakfast.families / days).toFixed(2)} / 3.00`);
console.log(`Lunch Unique Veg Families: ${(stats.Lunch.vegFamilies / days).toFixed(2)} / 3.00`);
console.log(`Lunch Avg Total Distinct Sub-Families: ${(stats.Lunch.subFamilies / days).toFixed(2)}`);
console.log(`Snack Unique Families: ${(stats.Snack.families / days).toFixed(2)} / 3.00`);
console.log(`Dinner Unique Veg Families: ${(stats.Dinner.vegFamilies / days).toFixed(2)} / 3.00`);
