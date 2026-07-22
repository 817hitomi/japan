const taipeiUtcOffsetHours = 8;
const dailyResetHour = 5;
const millisecondsPerHour = 60 * 60 * 1000;
const millisecondsPerDay = 24 * millisecondsPerHour;

function getShiftedTaipeiTime(now: Date) {
  return new Date(now.getTime() + (taipeiUtcOffsetHours - dailyResetHour) * millisecondsPerHour);
}

export function getTaipeiDailySelectionKey(now = new Date()) {
  return getShiftedTaipeiTime(now).toISOString().slice(0, 10);
}

export function getMillisecondsUntilNextTaipeiReset(now = new Date()) {
  const shiftedTime = getShiftedTaipeiTime(now);
  const elapsedToday =
    shiftedTime.getUTCHours() * millisecondsPerHour +
    shiftedTime.getUTCMinutes() * 60 * 1000 +
    shiftedTime.getUTCSeconds() * 1000 +
    shiftedTime.getUTCMilliseconds();

  return millisecondsPerDay - elapsedToday;
}

function hashText(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function getDailySelectionIndex(total: number, dailyKey: string, group: string) {
  if (total <= 1) {
    return 0;
  }

  return hashText(`${dailyKey}:${group}`) % total;
}

export function selectDailyItems<Item extends { id: number | string }>(
  items: Item[],
  count: number,
  dailyKey: string,
  group: string
) {
  return [...items]
    .sort((first, second) => {
      const firstScore = hashText(`${dailyKey}:${group}:${first.id}`);
      const secondScore = hashText(`${dailyKey}:${group}:${second.id}`);

      return firstScore - secondScore || String(first.id).localeCompare(String(second.id));
    })
    .slice(0, count);
}
