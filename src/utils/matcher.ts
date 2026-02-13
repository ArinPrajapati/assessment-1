import Fuse from 'fuse.js';

export interface MatchableOption {
  value: string; text: string;
  disabled?: boolean;
}

export function findBestMatch(
  targetValue: string,
  options: MatchableOption[]
): string | null {
  const enabledOptions = options.filter(opt => !opt.disabled);
  const thresholds = [0.2, 0.4, 0.6];

  if (enabledOptions.length === 0) {
    return null;
  }

  for (let i = 0; i < thresholds.length; i++) {
    const fuse = new Fuse(enabledOptions, {
      keys: ['value', 'text'],
      threshold: thresholds[i],
      includeScore: true,
      ignoreLocation: true,
    });

    const results = fuse.search(targetValue);

    if (results.length > 0 && results[0].item) {
      if (thresholds[i] > 0.4) {
        console.warn(`[WARN] Weak fuzzy match: "${targetValue}" → "${results[0].item.text}" (threshold: ${thresholds[i]}, score: ${results[0].score?.toFixed(2)})`);
      }
      return results[0].item.value;
    }
  }

  return null;
}
