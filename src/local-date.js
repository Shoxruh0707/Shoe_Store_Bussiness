function isValidTimeZone(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatParts(year, month, day) {
  return `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`;
}

function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return null;
  const probe = new Date(0);
  probe.setUTCHours(0, 0, 0, 0);
  probe.setUTCFullYear(year, month - 1, day);
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  return { year, month, day };
}

function currentDate(nowMs, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(nowMs));
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function resolveLocalDateRange(value, timeZone, nowMs = Date.now()) {
  if (!isValidTimeZone(timeZone)) throw new RangeError('Invalid time zone');
  const date = value === undefined ? currentDate(nowMs, timeZone) : value;
  if (typeof date !== 'string') return null;
  const parsed = parseDate(date);
  if (!parsed) return null;

  const next = new Date(0);
  next.setUTCHours(0, 0, 0, 0);
  next.setUTCFullYear(parsed.year, parsed.month - 1, parsed.day + 1);
  const nextDate = formatParts(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
  return {
    date,
    start: `${date} 00:00:00`,
    end: `${nextDate} 00:00:00`
  };
}

module.exports = { isValidTimeZone, resolveLocalDateRange };
