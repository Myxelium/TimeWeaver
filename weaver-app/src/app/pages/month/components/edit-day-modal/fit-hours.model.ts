const hourHundredths = 100;

export function fitHoursToMax(hours: number[], maxHours: number): number[] {
  const weights = hours.map(value => Math.max(0, Math.round(value * hourHundredths)));
  const total = weights.reduce((sum, value) => sum + value, 0);
  const target = Math.max(0, Math.round(maxHours * hourHundredths));

  if (total === 0 || target === 0 || total <= target)
    return hours.slice();

  const raw = weights.map(weight => (weight * target) / total);
  const fitted = raw.map(value => Math.floor(value));

  let leftover = target - fitted.reduce((sum, value) => sum + value, 0);

  const order = raw
    .map((value, index) => ({
      index,
      fraction: value - Math.floor(value),
      weight: weights[index]
    }))
    .filter(entry => entry.weight > 0)
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);

  let cursor = 0;

  while (leftover > 0 && order.length > 0) {
    const entry = order[cursor % order.length];

    fitted[entry.index] += 1;
    leftover -= 1;
    cursor += 1;
  }

  return fitted.map(value => value / hourHundredths);
}
