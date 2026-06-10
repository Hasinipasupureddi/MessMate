export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';

export type MealStatus = 'open' | 'closed' | 'past';

type MealTiming = {
  displayWindow: string;
  optInCutoff: string;
  startMinutes: number;
  endMinutes: number;
  cutoffMinutes: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const MEAL_TIMINGS: Record<MealType, MealTiming> = {
  breakfast: {
    displayWindow: '7:30 AM – 8:30 AM',
    optInCutoff: '7:00 AM',
    startMinutes: 7 * 60 + 30,
    endMinutes: 8 * 60 + 30,
    cutoffMinutes: 7 * 60,
  },
  lunch: {
    displayWindow: '12:00 PM – 1:00 PM',
    optInCutoff: '11:30 AM',
    startMinutes: 12 * 60,
    endMinutes: 13 * 60,
    cutoffMinutes: 11 * 60 + 30,
  },
  snack: {
    displayWindow: '4:30 PM – 5:00 PM',
    optInCutoff: '3:30 PM',
    startMinutes: 16 * 60 + 30,
    endMinutes: 17 * 60,
    cutoffMinutes: 15 * 60 + 30,
  },
  dinner: {
    displayWindow: '7:00 PM – 8:00 PM',
    optInCutoff: '6:00 PM',
    startMinutes: 19 * 60,
    endMinutes: 20 * 60,
    cutoffMinutes: 18 * 60,
  },
};

export function getIstNow(offsetDays = 0): Date {
  const now = new Date();
  // now.getTime() is always UTC. 
  // We add IST_OFFSET_MS to get a "fake UTC" date where getUTC* methods return IST values.
  const istMillis = now.getTime() + IST_OFFSET_MS + offsetDays * DAY_MS;
  return new Date(istMillis);
}

export function getIstDateString(offsetDays = 0): string {
  const now = getIstNow(offsetDays);
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getIstTimeLabel(date = getIstNow()): string {
  const hours = date.getUTCHours();
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const hour12 = hours % 12 || 12;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  return `${hour12}:${minutes} ${suffix}`;
}

export function getMealTiming(mealType: MealType) {
  return MEAL_TIMINGS[mealType];
}

export function getMealStatus(mealType: MealType): MealStatus {
  const timing = MEAL_TIMINGS[mealType];
  const istNow = getIstNow();
  const minutes = istNow.getUTCHours() * 60 + istNow.getUTCMinutes();

  if (minutes < timing.cutoffMinutes) {
    return 'open';
  }

  if (minutes < timing.startMinutes) {
    return 'closed';
  }

  return 'past';
}

export function formatMealStatusLabel(status: MealStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function toSqlDatetime(date: Date | string): string {
  // If it's already a formatted SQL string, return it as-is to avoid timezone shifts.
  // We check for both space and 'T' separators, and optional seconds.
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(date.trim())) {
    return date.trim().replace('T', ' ');
  }

  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '1970-01-01 00:00:00';
  
  // Important: Our getIstNow() returns a "fake UTC" date where getUTC* methods return IST values.
  // However, if 'd' is a standard Date (e.g. from new Date(string)), getUTC* will shift it.
  // To keep it simple and consistent with our IST-first approach, if we're converting a Date 
  // to a SQL string, we want the IST representation.
  
  const pad = (n: number) => String(n).padStart(2, '0');
  
  const isFakeUtc = d.getTimezoneOffset() === 0; 
  
  const year = isFakeUtc ? d.getUTCFullYear() : d.getFullYear();
  const month = pad((isFakeUtc ? d.getUTCMonth() : d.getMonth()) + 1);
  const day = pad(isFakeUtc ? d.getUTCDate() : d.getDate());
  const hours = pad(isFakeUtc ? d.getUTCHours() : d.getHours());
  const minutes = pad(isFakeUtc ? d.getUTCMinutes() : d.getMinutes());
  const seconds = pad(isFakeUtc ? d.getUTCSeconds() : d.getSeconds());
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function parseIstDatetime(value: string): Date {
  const cleaned = String(value).trim();
  
  // If it's an ISO string (ends with Z), it's UTC.
  // We convert it to IST "fake UTC" by adding 5.5 hours to the UTC millis.
  if (cleaned.endsWith('Z')) {
    const d = new Date(cleaned);
    return new Date(d.getTime() + IST_OFFSET_MS);
  }

  // Otherwise, treat as "YYYY-MM-DD HH:mm:ss" in IST.
  // We use Date.UTC to create a "fake UTC" date that matches the IST values.
  const parts = cleaned.replace('T', ' ').split(' ');
  const datePart = parts[0];
  const timePart = parts[1] || '00:00:00';
  
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour = 0, minute = 0, second = 0] = timePart.split(':').map(val => Number(val.replace(/\D/g, '')));

  const istMillis = Date.UTC(year, month - 1, day, hour, minute, second);
  return new Date(istMillis);
}
