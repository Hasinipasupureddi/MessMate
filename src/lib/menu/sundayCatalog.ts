import { type VoteOption } from './votingBlueprints';

// ---------------------------------------------------------------------------
// SUNDAY SNACK — 4-Week Rotation
// Each week shows exactly 3 options. Student picks ONE. Highest vote wins.
// ---------------------------------------------------------------------------

export const SUNDAY_SNACK_W1: VoteOption[] = [
  { id: 'sun-sn-w1-1', comboId: 'sun-sn-w1-1', label: 'Mirchi Bajji',  emoji: '🌶️', items: ['Mirchi Bajji'],  category: 'snack', dietPreference: 'both' },
  { id: 'sun-sn-w1-2', comboId: 'sun-sn-w1-2', label: 'Onion Pakoda',  emoji: '🧅', items: ['Onion Pakoda'], category: 'snack', dietPreference: 'both' },
  { id: 'sun-sn-w1-3', comboId: 'sun-sn-w1-3', label: 'Masala Vada',   emoji: '🫓', items: ['Masala Vada'],  category: 'snack', dietPreference: 'both' },
];

export const SUNDAY_SNACK_W2: VoteOption[] = [
  { id: 'sun-sn-w2-1', comboId: 'sun-sn-w2-1', label: 'Punugulu',      emoji: '🟤', items: ['Punugulu'],    category: 'snack', dietPreference: 'both' },
  { id: 'sun-sn-w2-2', comboId: 'sun-sn-w2-2', label: 'Corn Samosa',   emoji: '🥟', items: ['Corn Samosa'], category: 'snack', dietPreference: 'both' },
  { id: 'sun-sn-w2-3', comboId: 'sun-sn-w2-3', label: 'Veg Cutlet',    emoji: '🫓', items: ['Veg Cutlet'],  category: 'snack', dietPreference: 'both' },
];

export const SUNDAY_SNACK_W3: VoteOption[] = [
  { id: 'sun-sn-w3-1', comboId: 'sun-sn-w3-1', label: 'Bread Pakoda',    emoji: '🍞', items: ['Bread Pakoda'],  category: 'snack', dietPreference: 'both' },
  { id: 'sun-sn-w3-2', comboId: 'sun-sn-w3-2', label: 'Aloo Bonda',      emoji: '🟡', items: ['Aloo Bonda'],    category: 'snack', dietPreference: 'both' },
  { id: 'sun-sn-w3-3', comboId: 'sun-sn-w3-3', label: 'Moong Dal Vada',  emoji: '🫓', items: ['Moong Dal Vada'], category: 'snack', dietPreference: 'both' },
];

export const SUNDAY_SNACK_W4: VoteOption[] = [
  { id: 'sun-sn-w4-1', comboId: 'sun-sn-w4-1', label: 'Paneer Roll',       emoji: '🧀', items: ['Paneer Roll'],       category: 'snack', dietPreference: 'both' },
  { id: 'sun-sn-w4-2', comboId: 'sun-sn-w4-2', label: 'Spring Roll',       emoji: '🥢', items: ['Spring Roll'],       category: 'snack', dietPreference: 'both' },
  { id: 'sun-sn-w4-3', comboId: 'sun-sn-w4-3', label: 'Mixed Veg Pakoda',  emoji: '🫘', items: ['Mixed Veg Pakoda'],  category: 'snack', dietPreference: 'both' },
];

// ---------------------------------------------------------------------------
// SUNDAY LUNCH — 4-Week Cycle (Biryani / Bagara Rice specials)
// ---------------------------------------------------------------------------

export const SUNDAY_LUNCH_W1: VoteOption[] = [
  { id: 'sun-l-w1-nv1', comboId: 'sun-l-w1-nv1', label: 'Chicken Dum Biryani', emoji: '🍛', items: ['Chicken Dum Biryani', 'Raita'],   category: 'main', dietPreference: 'non_veg' },
  { id: 'sun-l-w1-nv2', comboId: 'sun-l-w1-nv2', label: 'Fry Piece Biryani',   emoji: '🍗', items: ['Fry Piece Biryani', 'Raita'],    category: 'main', dietPreference: 'non_veg' },
  { id: 'sun-l-w1-nv3', comboId: 'sun-l-w1-nv3', label: 'Mughlai Biryani',     emoji: '🥘', items: ['Mughlai Biryani', 'Raita'],      category: 'main', dietPreference: 'non_veg' },
  { id: 'sun-l-w1-v1',  comboId: 'sun-l-w1-v1',  label: 'Paneer Biryani',      emoji: '🧀', items: ['Paneer Biryani', 'Raita'],       category: 'main', dietPreference: 'veg' },
  { id: 'sun-l-w1-v2',  comboId: 'sun-l-w1-v2',  label: 'Veg Biryani',         emoji: '🥗', items: ['Veg Biryani', 'Raita'],          category: 'main', dietPreference: 'veg' },
  { id: 'sun-l-w1-v3',  comboId: 'sun-l-w1-v3',  label: 'Mushroom Biryani',    emoji: '🍄', items: ['Mushroom Biryani', 'Raita'],     category: 'main', dietPreference: 'veg' },
];

export const SUNDAY_LUNCH_W2: VoteOption[] = [
  { id: 'sun-l-w2-nv1', comboId: 'sun-l-w2-nv1', label: 'Chicken Curry + Bagara Rice',       emoji: '🍗', items: ['Chicken Curry', 'Bagara Rice', 'Raita'],       category: 'main', dietPreference: 'non_veg' },
  { id: 'sun-l-w2-nv2', comboId: 'sun-l-w2-nv2', label: 'Butter Chicken + Bagara Rice',      emoji: '🍛', items: ['Butter Chicken', 'Bagara Rice', 'Raita'],      category: 'main', dietPreference: 'non_veg' },
  { id: 'sun-l-w2-nv3', comboId: 'sun-l-w2-nv3', label: 'Chicken Masala + Bagara Rice',      emoji: '🥘', items: ['Chicken Masala', 'Bagara Rice', 'Raita'],      category: 'main', dietPreference: 'non_veg' },
  { id: 'sun-l-w2-v1',  comboId: 'sun-l-w2-v1',  label: 'Paneer Butter Masala + Bagara Rice',emoji: '🧀', items: ['Paneer Butter Masala', 'Bagara Rice', 'Raita'],category: 'main', dietPreference: 'veg' },
  { id: 'sun-l-w2-v2',  comboId: 'sun-l-w2-v2',  label: 'Mushroom Masala + Bagara Rice',     emoji: '🍄', items: ['Mushroom Masala', 'Bagara Rice', 'Raita'],     category: 'main', dietPreference: 'veg' },
  { id: 'sun-l-w2-v3',  comboId: 'sun-l-w2-v3',  label: 'Mixed Veg Kurma + Bagara Rice',     emoji: '🥗', items: ['Mixed Veg Kurma', 'Bagara Rice', 'Raita'],     category: 'main', dietPreference: 'veg' },
];

export const SUNDAY_LUNCH_W3: VoteOption[] = [
  { id: 'sun-l-w3-nv1', comboId: 'sun-l-w3-nv1', label: 'Chicken Korma + Bagara Rice',  emoji: '🍗', items: ['Chicken Korma', 'Bagara Rice', 'Raita'],  category: 'main', dietPreference: 'non_veg' },
  { id: 'sun-l-w3-nv2', comboId: 'sun-l-w3-nv2', label: 'Chicken Mughlai + Bagara Rice',emoji: '🍛', items: ['Chicken Mughlai', 'Bagara Rice', 'Raita'],category: 'main', dietPreference: 'non_veg' },
  { id: 'sun-l-w3-nv3', comboId: 'sun-l-w3-nv3', label: 'Andhra Chicken + Bagara Rice', emoji: '🌶️', items: ['Andhra Chicken', 'Bagara Rice', 'Raita'], category: 'main', dietPreference: 'non_veg' },
  { id: 'sun-l-w3-v1',  comboId: 'sun-l-w3-v1',  label: 'Paneer Kurma + Bagara Rice',   emoji: '🧀', items: ['Paneer Kurma', 'Bagara Rice', 'Raita'],   category: 'main', dietPreference: 'veg' },
  { id: 'sun-l-w3-v2',  comboId: 'sun-l-w3-v2',  label: 'Mixed Veg Kurma + Bagara Rice',emoji: '🥗', items: ['Mixed Veg Kurma', 'Bagara Rice', 'Raita'],category: 'main', dietPreference: 'veg' },
  { id: 'sun-l-w3-v3',  comboId: 'sun-l-w3-v3',  label: 'Aloo Matar + Bagara Rice',      emoji: '🥔', items: ['Aloo Matar', 'Bagara Rice', 'Raita'],      category: 'main', dietPreference: 'veg' },
];

export const SUNDAY_LUNCH_W4: VoteOption[] = [
  { id: 'sun-l-w4-nv1', comboId: 'sun-l-w4-nv1', label: 'Chicken Masala + Bagara Rice',       emoji: '🍗', items: ['Chicken Masala', 'Bagara Rice', 'Raita'],       category: 'main', dietPreference: 'non_veg' },
  { id: 'sun-l-w4-nv2', comboId: 'sun-l-w4-nv2', label: 'Andhra Chicken Curry + Bagara Rice', emoji: '🌶️', items: ['Andhra Chicken Curry', 'Bagara Rice', 'Raita'], category: 'main', dietPreference: 'non_veg' },
  { id: 'sun-l-w4-nv3', comboId: 'sun-l-w4-nv3', label: 'Butter Chicken + Bagara Rice',      emoji: '🍛', items: ['Butter Chicken', 'Bagara Rice', 'Raita'],      category: 'main', dietPreference: 'non_veg' },
  { id: 'sun-l-w4-v1',  comboId: 'sun-l-w4-v1',  label: 'Paneer Masala + Bagara Rice',        emoji: '🧀', items: ['Paneer Masala', 'Bagara Rice', 'Raita'],        category: 'main', dietPreference: 'veg' },
  { id: 'sun-l-w4-v2',  comboId: 'sun-l-w4-v2',  label: 'Aloo Matar + Bagara Rice',           emoji: '🥔', items: ['Aloo Matar', 'Bagara Rice', 'Raita'],           category: 'main', dietPreference: 'veg' },
  { id: 'sun-l-w4-v3',  comboId: 'sun-l-w4-v3',  label: 'Mushroom Masala + Bagara Rice',      emoji: '🍄', items: ['Mushroom Masala', 'Bagara Rice', 'Raita'],      category: 'main', dietPreference: 'veg' },
];

// ---------------------------------------------------------------------------
// SUNDAY DINNER — 4-Week Cycle
// Special rice / pulao meals. Student picks ONE. Highest vote wins.
// ---------------------------------------------------------------------------

export const SUNDAY_DINNER_W1: VoteOption[] = [
  { id: 'sun-d-w1-v1', comboId: 'sun-d-w1-v1', label: 'Vegetable Pulao + Kurma + Sweet', emoji: '🍚', items: ['Vegetable Pulao', 'Kurma', 'Raita', 'Sweet'], category: 'main', dietPreference: 'both' },
  { id: 'sun-d-w1-v2', comboId: 'sun-d-w1-v2', label: 'Peas Pulao + Kurma + Sweet',      emoji: '🟢', items: ['Peas Pulao', 'Kurma', 'Raita', 'Sweet'],      category: 'main', dietPreference: 'both' },
  { id: 'sun-d-w1-v3', comboId: 'sun-d-w1-v3', label: 'Mint Pulao + Kurma + Sweet',      emoji: '🌿', items: ['Mint Pulao', 'Kurma', 'Raita', 'Sweet'],      category: 'main', dietPreference: 'both' },
];

export const SUNDAY_DINNER_W2: VoteOption[] = [
  { id: 'sun-d-w2-v1', comboId: 'sun-d-w2-v1', label: 'Paneer Pulao + Kurma + Sweet',   emoji: '🧀', items: ['Paneer Pulao', 'Kurma', 'Raita', 'Sweet'],   category: 'main', dietPreference: 'both' },
  { id: 'sun-d-w2-v2', comboId: 'sun-d-w2-v2', label: 'Corn Pulao + Kurma + Sweet',     emoji: '🌽', items: ['Corn Pulao', 'Kurma', 'Raita', 'Sweet'],     category: 'main', dietPreference: 'both' },
  { id: 'sun-d-w2-v3', comboId: 'sun-d-w2-v3', label: 'Mushroom Pulao + Kurma + Sweet', emoji: '🍄', items: ['Mushroom Pulao', 'Kurma', 'Raita', 'Sweet'], category: 'main', dietPreference: 'both' },
];

export const SUNDAY_DINNER_W3: VoteOption[] = [
  { id: 'sun-d-w3-v1', comboId: 'sun-d-w3-v1', label: 'Bagara Rice + Kurma + Sweet', emoji: '🍚', items: ['Bagara Rice', 'Kurma', 'Raita', 'Sweet'], category: 'main', dietPreference: 'both' },
  { id: 'sun-d-w3-v2', comboId: 'sun-d-w3-v2', label: 'Jeera Rice + Kurma + Sweet',  emoji: '🌾', items: ['Jeera Rice', 'Kurma', 'Raita', 'Sweet'],  category: 'main', dietPreference: 'both' },
  { id: 'sun-d-w3-v3', comboId: 'sun-d-w3-v3', label: 'Ghee Rice + Kurma + Sweet',   emoji: '🍯', items: ['Ghee Rice', 'Kurma', 'Raita', 'Sweet'],   category: 'main', dietPreference: 'both' },
];

export const SUNDAY_DINNER_W4: VoteOption[] = [
  { id: 'sun-d-w4-v1', comboId: 'sun-d-w4-v1', label: 'Soya Pulao + Kurma + Raita + Sweet',          emoji: '🫘', items: ['Soya Pulao', 'Kurma', 'Raita', 'Sweet'],          category: 'main', dietPreference: 'both' },
  { id: 'sun-d-w4-v2', comboId: 'sun-d-w4-v2', label: 'Coconut Milk Pulao + Kurma + Raita + Sweet', emoji: '🥥', items: ['Coconut Milk Pulao', 'Kurma', 'Raita', 'Sweet'], category: 'main', dietPreference: 'both' },
  { id: 'sun-d-w4-v3', comboId: 'sun-d-w4-v3', label: 'Kashmiri Pulao + Kurma + Raita + Sweet',      emoji: '🌸', items: ['Kashmiri Pulao', 'Kurma', 'Raita', 'Sweet'],      category: 'main', dietPreference: 'both' },
];

// ---------------------------------------------------------------------------
// Weekday specials
// ---------------------------------------------------------------------------

export const WEDNESDAY_SPECIAL_OPTIONS: VoteOption[] = [
  { id: 'wed-s-v1',  comboId: 'wed-s-v1',  label: 'Gulab Jamun',         emoji: '🍡', items: ['Gulab Jamun'],         category: 'side', dietPreference: 'veg' },
  { id: 'wed-s-v2',  comboId: 'wed-s-v2',  label: 'Kala Jamun',           emoji: '🍡', items: ['Kala Jamun'],           category: 'side', dietPreference: 'veg' },
  { id: 'wed-s-v3',  comboId: 'wed-s-v3',  label: 'Double Ka Meetha',     emoji: '🥘', items: ['Double Ka Meetha'],     category: 'side', dietPreference: 'veg' },
  { id: 'wed-s-v4',  comboId: 'wed-s-v4',  label: 'Fruit Salad with Ice Cream', emoji: '🍨', items: ['Fruit Salad', 'Ice Cream'], category: 'side', dietPreference: 'veg' },
  { id: 'wed-s-nv1', comboId: 'wed-s-nv1', label: 'Masala Egg',           emoji: '🥚', items: ['Masala Egg'],           category: 'side', dietPreference: 'non_veg' },
  { id: 'wed-s-nv2', comboId: 'wed-s-nv2', label: 'Egg Roast',            emoji: '🥚', items: ['Egg Roast'],            category: 'side', dietPreference: 'non_veg' },
  { id: 'wed-s-nv3', comboId: 'wed-s-nv3', label: 'Egg Masala',           emoji: '🥚', items: ['Egg Masala'],           category: 'side', dietPreference: 'non_veg' },
  { id: 'wed-s-nv4', comboId: 'wed-s-nv4', label: 'Egg Burji',            emoji: '🍳', items: ['Egg Burji'],            category: 'side', dietPreference: 'non_veg' },
];

export const FRIDAY_LUNCH_SPECIAL_ADDONS: VoteOption[] = [
  { id: 'fri-l-w2-nv1', comboId: 'fri-l-w2-nv1', label: 'Omelette',   emoji: '🍳', items: ['Omelette'],   category: 'non_veg_curry', dietPreference: 'non_veg' },
  { id: 'fri-l-w2-nv2', comboId: 'fri-l-w2-nv2', label: 'Boiled Egg', emoji: '🥚', items: ['Boiled Egg'], category: 'non_veg_curry', dietPreference: 'non_veg' },
  { id: 'fri-l-w2-nv3', comboId: 'fri-l-w2-nv3', label: 'Egg Roast',  emoji: '🥚', items: ['Egg Roast'],  category: 'non_veg_curry', dietPreference: 'non_veg' },
  { id: 'fri-l-w2-v1',  comboId: 'fri-l-w2-v1',  label: 'Papad',      emoji: '🍘', items: ['Papad'],      category: 'veg_curry',     dietPreference: 'both' },
  { id: 'fri-l-w2-v2',  comboId: 'fri-l-w2-v2',  label: 'Fryums',     emoji: '🍘', items: ['Fryums'],     category: 'veg_curry',     dietPreference: 'both' },
  { id: 'fri-l-w2-v3',  comboId: 'fri-l-w2-v3',  label: 'Sweet',      emoji: '🍬', items: ['Sweet'],      category: 'veg_curry',     dietPreference: 'both' },
];

export const FRIDAY_DINNER_SPECIAL: VoteOption[] = [
  { id: 'fri-d-w3-v1',  comboId: 'fri-d-w3-v1',  label: 'Veg Fried Rice',      emoji: '🍚', items: ['Veg Fried Rice', 'Manchurian'],    category: 'main', dietPreference: 'veg' },
  { id: 'fri-d-w3-v2',  comboId: 'fri-d-w3-v2',  label: 'Veg Noodles',         emoji: '🍜', items: ['Veg Noodles', 'Manchurian'],       category: 'main', dietPreference: 'veg' },
  { id: 'fri-d-w3-v3',  comboId: 'fri-d-w3-v3',  label: 'Veg Manchuria Combo', emoji: '🥘', items: ['Veg Manchuria', 'Fried Rice'],     category: 'main', dietPreference: 'veg' },
  { id: 'fri-d-w3-nv1', comboId: 'fri-d-w3-nv1', label: 'Egg Fried Rice',      emoji: '🍳', items: ['Egg Fried Rice', 'Manchurian'],   category: 'main', dietPreference: 'non_veg' },
  { id: 'fri-d-w3-nv2', comboId: 'fri-d-w3-nv2', label: 'Chicken Fried Rice',  emoji: '🍗', items: ['Chicken Fried Rice', 'Manchurian'],category: 'main', dietPreference: 'non_veg' },
  { id: 'fri-d-w3-nv3', comboId: 'fri-d-w3-nv3', label: 'Chicken Noodles',     emoji: '🍜', items: ['Chicken Noodles', 'Manchurian'],  category: 'main', dietPreference: 'non_veg' },
];

// ---------------------------------------------------------------------------
// Legacy / re-exports
// ---------------------------------------------------------------------------
export const SUNDAY_SNACK_OPTIONS = SUNDAY_SNACK_W1; // fallback (not used directly)
export const SUNDAY_CATALOG: VoteOption[] = SUNDAY_LUNCH_W1;
export const WEDNESDAY_LUNCH_SPECIAL = WEDNESDAY_SPECIAL_OPTIONS;
export const FRIDAY_LUNCH_OPTIONS = FRIDAY_LUNCH_SPECIAL_ADDONS;
export const FRIDAY_DINNER_OPTIONS = FRIDAY_DINNER_SPECIAL;
