import { WeightedItem } from '../types';

/**
 * Select multiple items based on their weights without replacement
 * Uses cumulative weight method for efficient selection
 *
 * @param items - Array of items with weights
 * @param count - Number of items to select
 * @returns Selected items
 */
export function selectWeightedRandom<T>(
  items: WeightedItem<T>[],
  count: number
): WeightedItem<T>[] {
  if (items.length === 0) {
    return [];
  }

  if (count >= items.length) {
    return [...items];
  }

  const selected: WeightedItem<T>[] = [];
  const availableItems = [...items];

  for (let i = 0; i < count; i++) {
    if (availableItems.length === 0) break;

    // Calculate cumulative weights
    const cumulativeWeights: number[] = [];
    let totalWeight = 0;

    for (const item of availableItems) {
      totalWeight += item.weight;
      cumulativeWeights.push(totalWeight);
    }

    // Select random item based on weight
    const random = Math.random() * totalWeight;
    let selectedIndex = 0;

    for (let j = 0; j < cumulativeWeights.length; j++) {
      if (random <= cumulativeWeights[j]) {
        selectedIndex = j;
        break;
      }
    }

    // Add selected item and remove from available pool
    selected.push(availableItems[selectedIndex]);
    availableItems.splice(selectedIndex, 1);
  }

  return selected;
}

/**
 * Shuffle array using Fisher-Yates algorithm
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
