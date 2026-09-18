const HINT_CHARACTERS = [
  "f", "j", "d", "k", "s", "l", "a", "g", "h",
  "e", "i", "o", "w", "r", "u", "v", "c", "m"
];

function generateTwoCharLabels(count: number): string[] {
  const labels: string[] = [];
  for (let i = 0; i < HINT_CHARACTERS.length && labels.length < count; i++) {
    for (let j = 0; j < HINT_CHARACTERS.length && labels.length < count; j++) {
      labels.push(`${HINT_CHARACTERS[i]}${HINT_CHARACTERS[j]}`);
    }
  }
  return labels;
}

/**
 * Generates distinct home-row letter labels for a given number of hint targets.
 *
 * @example generateHintLabels(5) // ["f", "j", "d", "k", "s"]
 */
export function generateHintLabels(count: number): string[] {
  if (count <= 0) return [];
  if (count <= HINT_CHARACTERS.length) {
    return HINT_CHARACTERS.slice(0, count);
  }
  return generateTwoCharLabels(count);
}
