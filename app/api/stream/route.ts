import OpenAI from 'openai';
import { ListItem } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { category, itemCount = 50 } = body;

    if (!category) {
      return new Response('Category is required', { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return new Response('OpenAI API key not configured', { status: 500 });
    }

  // Create a streaming response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Stream initial message
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'start', message: 'Generating list...' })}\n\n`)
        );

        const prompt = `Generate a Top ${itemCount} list for: "${category}"
        
        Output a JSON array with exactly ${itemCount} items.
        Each item must have this exact structure:
        {"rank": number, "name": "string", "aliases": ["array", "of", "strings"]}
        
        Be creative, accurate, and include well-known items at the top.
        For each item, keep the name concise and include 1-2 common aliases.
        
        Output ONLY the JSON array, no other text.`;

        const completion = await openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a trivia expert. Generate accurate, well-researched lists in JSON format only.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 3000,
          stream: true,
        });

        let buffer = '';
        let currentItem = '';
        let itemsSent = 0;
        let inJsonArray = false;
        let depth = 0;

        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content || '';
          buffer += content;

          // Detect start of JSON array
          if (!inJsonArray && buffer.includes('[')) {
            inJsonArray = true;
            buffer = buffer.substring(buffer.indexOf('['));
          }

          if (inJsonArray) {
            currentItem += content;

            // Track JSON depth
            for (const char of content) {
              if (char === '{') depth++;
              if (char === '}') depth--;
              
              // When we complete an object
              if (char === '}' && depth === 0) {
                try {
                  // Try to parse the current item
                  const itemMatch = currentItem.match(/\{[^}]*\}/);
                  if (itemMatch) {
                    const itemJson = itemMatch[0];
                    const item = JSON.parse(itemJson);
                    
                    if (item.name) {
                      itemsSent++;
                      const listItem: ListItem = {
                        rank: item.rank || itemsSent,
                        name: item.name,
                        aliases: Array.isArray(item.aliases) ? item.aliases : [],
                      };

                      // Stream the item to the frontend
                      controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ 
                          type: 'item', 
                          item: listItem,
                          progress: Math.round((itemsSent / itemCount) * 100)
                        })}\n\n`)
                      );

                      // Small delay for visual effect
                      await new Promise(resolve => setTimeout(resolve, 50));
                    }
                    currentItem = '';
                  }
                } catch (e) {
                  // Continue collecting if parse fails
                }
              }
            }
          }
        }

        // Send completion message
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ 
            type: 'complete', 
            message: `Generated ${itemsSent} items`,
            totalItems: itemsSent 
          })}\n\n`)
        );
        
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error: any) {
        console.error('Streaming error:', error);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ 
            type: 'error', 
            message: error.message || 'Failed to generate list' 
          })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
  } catch (error: any) {
    console.error('Stream endpoint error:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}