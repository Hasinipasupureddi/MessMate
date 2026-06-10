export function isValidSqlDate(input: unknown): boolean {
  const s = String(input ?? '').trim();
  if (!s) return false;
  if (s === '0000-00-00') return false;
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  // Basic range checks
  if (mo < 1 || mo > 12) return false;
  if (d < 1 || d > 31) return false;
  // JS Date sanity check
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (isNaN(dt.getTime())) return false;
  return dt.getUTCFullYear() === y && dt.getUTCMonth() + 1 === mo && dt.getUTCDate() === d;
}

export default isValidSqlDate;
