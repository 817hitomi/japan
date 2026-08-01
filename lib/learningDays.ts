const taipeiTimeZone = "Asia/Taipei";
const millisecondsPerDay = 86_400_000;

function getCalendarDayStart(dateText: string) {
  const [year, month, day] = dateText.slice(0, 10).split("-").map(Number);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const start = Date.UTC(year, month - 1, day);
  const parsed = new Date(start);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return start;
}

export function getTaipeiDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: taipeiTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));

  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

export function getElapsedLearningDays(firstPublishedDate?: string | null, currentDate?: string) {
  if (!firstPublishedDate) {
    return 0;
  }

  const start = getCalendarDayStart(firstPublishedDate);
  const today = getCalendarDayStart(currentDate ?? getTaipeiDateKey());

  if (start === null || today === null) {
    return 0;
  }

  return Math.max(Math.floor((today - start) / millisecondsPerDay) + 1, 1);
}
