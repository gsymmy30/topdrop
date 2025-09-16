import OpenAI from 'openai';
import { ListItem } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateTop100List(category: string): Promise<ListItem[]> {
  console.log('Generating list for category:', category);
  console.log('Using API key:', process.env.OPENAI_API_KEY?.substring(0, 10) + '...');
  
  const prompt = `Generate a Top 100 list for: "${category}"
  
  Return a JSON object with an "items" array containing exactly 100 items.
  Each item should have: rank (1-100), name (string), aliases (array of strings).
  
  Example format:
  {
    "items": [
      {"rank": 1, "name": "Example Item", "aliases": ["alt name", "nickname"]}
    ]
  }`;

  try {
    console.log('Calling OpenAI API...');
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a trivia expert. Generate accurate Top 100 lists in JSON format.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 4000,
    });

    console.log('OpenAI response received');
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No content received from OpenAI');
    }

    const parsed = JSON.parse(content);
    console.log('Parsed response, items count:', parsed.items?.length);
    
    // Handle the response
    const items = parsed.items || parsed.list || Object.values(parsed);
    
    if (!Array.isArray(items)) {
      console.error('Response is not an array:', parsed);
      throw new Error('Invalid response format');
    }

    // Ensure we have exactly 100 items
    const processedItems: ListItem[] = [];
    for (let i = 0; i < 100; i++) {
      if (items[i]) {
        processedItems.push({
          rank: items[i].rank || i + 1,
          name: items[i].name || `Item ${i + 1}`,
          aliases: Array.isArray(items[i].aliases) ? items[i].aliases : [],
        });
      } else {
        // Fill in missing items if less than 100
        processedItems.push({
          rank: i + 1,
          name: `Item ${i + 1}`,
          aliases: [],
        });
      }
    }

    console.log('Successfully processed', processedItems.length, 'items');
    return processedItems;
  } catch (error: any) {
    console.error('Error generating list:', error);
    console.error('Error details:', error?.response?.data || error?.message);
    throw new Error(`Failed to generate list: ${error?.message || 'Unknown error'}`);
  }
}