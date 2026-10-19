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

function utcMillis({ year, month, day }, hour = 0, minute = 0, second = 0) {
  const value = new Date(0);
  value.setUTCHours(hour, minute, second, 0);
  value.setUTCFullYear(year, month - 1, day);
  return value.getTime();
}

function zonedParts(timestamp, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(timestamp));
  return Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  );
}

function zonedMidnightUtc(parsed, timeZone) {
  const target = utcMillis(parsed);
  let candidate = target;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const local = zonedParts(candidate, timeZone);
    const representedAsUtc = utcMillis(
      { year: local.year, month: local.month, day: local.day },
      local.hour,
      local.minute,
      local.second
    );
    const adjustment = target - representedAsUtc;
    candidate += adjustment;
    if (adjustment === 0) break;
  }
  return candidate;
}

function databaseTimestamp(timestamp) {
  const value = new Date(timestamp);
  return `${formatParts(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate())} ${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())}`;
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
  const nextParsed = { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
  return {
    date,
    start: databaseTimestamp(zonedMidnightUtc(parsed, timeZone)),
    end: databaseTimestamp(zonedMidnightUtc(nextParsed, timeZone))
  };
}

module.exports = { isValidTimeZone, resolveLocalDateRange };
