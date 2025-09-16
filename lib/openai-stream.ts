import OpenAI from 'openai';
import { ListItem } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Faster approach: Generate in batches
export async function generateQuickList(category: string): Promise<ListItem[]> {
  console.log('Quick generation for:', category);
  
  // Super optimized prompt for speed
  const prompt = `Top 30 ${category}. 
  JSON array only, no explanations.
  Format: [{"rank":1,"name":"X","aliases":[]}]
  Be fast and concise.`;

  try {
    const startTime = Date.now();
    
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // Fastest model
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.5,
      max_tokens: 1500,
      stream: false,
    });

    const elapsed = Date.now() - startTime;
    console.log(`Generated in ${elapsed}ms`);
    
    const content = response.choices[0].message.content || '[]';
    
    // Try to parse the response flexibly
    let items: any[] = [];
    try {
      // Try direct parse
      items = JSON.parse(content);
    } catch {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        items = JSON.parse(jsonMatch[0]);
      }
    }

    // Process and ensure we have valid items
    const processedItems: ListItem[] = [];
    const itemCount = Math.min(items.length, 30);
    
    for (let i = 0; i < itemCount; i++) {
      if (items[i]) {
        processedItems.push({
          rank: i + 1,
          name: items[i].name || items[i].title || items[i] || `Item ${i + 1}`,
          aliases: items[i].aliases || [],
        });
      }
    }

    // Pad to at least 30 items
    while (processedItems.length < 30) {
      processedItems.push({
        rank: processedItems.length + 1,
        name: `Item ${processedItems.length + 1}`,
        aliases: [],
      });
    }

    return processedItems;
  } catch (error: any) {
    console.error('Quick generation failed:', error);
    throw error;
  }
}