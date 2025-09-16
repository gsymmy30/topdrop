import Fuse from 'fuse.js';
import { ListItem, GuessResult } from '@/types';

export function checkGuess(guess: string, items: ListItem[]): GuessResult {
  try {
    // Normalize the guess
    const normalizedGuess = guess.trim().toLowerCase();

    // First, check for exact matches
    for (const item of items) {
      const normalizedName = item.name.toLowerCase();
      const normalizedAliases = item.aliases.map(a => a.toLowerCase());

      if (normalizedName === normalizedGuess || 
          normalizedAliases.includes(normalizedGuess)) {
        return {
          found: true,
          item,
          points: item.rank,
          exactMatch: true,
        };
      }
    }

    // Prepare data for fuzzy matching
    const searchData = items.flatMap(item => [
      { ...item, searchText: item.name },
      ...item.aliases.map(alias => ({ ...item, searchText: alias }))
    ]);

    // Set up Fuse.js for fuzzy matching
    const fuse = new Fuse(searchData, {
      keys: ['searchText'],
      threshold: 0.3, // Lower = stricter matching
      includeScore: true,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });

    const results = fuse.search(guess);

    if (results.length > 0 && results[0].score! < 0.3) {
      const matchedItem = results[0].item;
      return {
        found: true,
        item: {
          rank: matchedItem.rank,
          name: matchedItem.name,
          aliases: matchedItem.aliases,
        },
        points: matchedItem.rank,
        exactMatch: false,
      };
    }

    return {
      found: false,
      points: 0,
      exactMatch: false,
    };
  } catch (error) {
    console.error('Error in checkGuess:', error);
    return {
      found: false,
      points: 0,
      exactMatch: false,
    };
  }
}