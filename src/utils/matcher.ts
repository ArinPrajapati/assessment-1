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
  const threshold = [0.2, 0.4, 0.6];

  if (enabledOptions.length === 0) {
    return null;
  }

  for (let i = 0; i < 3; i++) {
    const fuse = new Fuse(enabledOptions, {
      keys: ['value', 'text'],
      threshold: threshold[i],
      includeScore: true,
      ignoreLocation: true,
    });

    const results = fuse.search(targetValue);

    if (results.length > 0 && results[0].item) {
      return results[0].item.value;
    }
  }

  return enabledOptions[0]?.value || null;
}
