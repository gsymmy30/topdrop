import { ListItem } from '@/types';

// Mock data generator for testing without OpenAI
export function generateMockTop100List(category: string): ListItem[] {
  const items: ListItem[] = [];
  
  // Generate mock data based on category
  const categoryLower = category.toLowerCase();
  
  let prefix = 'Item';
  if (categoryLower.includes('song')) prefix = 'Song';
  else if (categoryLower.includes('movie')) prefix = 'Movie';
  else if (categoryLower.includes('game')) prefix = 'Game';
  else if (categoryLower.includes('country')) prefix = 'Country';
  else if (categoryLower.includes('food')) prefix = 'Food';
  
  for (let i = 1; i <= 100; i++) {
    items.push({
      rank: i,
      name: `${prefix} #${i}`,
      aliases: [`${prefix.toLowerCase()}${i}`, `${prefix} Number ${i}`],
    });
  }
  
  return items;
}