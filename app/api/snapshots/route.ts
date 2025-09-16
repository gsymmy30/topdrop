import { NextResponse } from 'next/server';
import { generateTop100List } from '@/lib/openai';
import { generateQuickList } from '@/lib/openai-stream';
import { generateMockTop100List } from '@/lib/mock-generator';
import { snapshotStore } from '@/lib/store';
import { Snapshot } from '@/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { category, useMock, quickMode = true } = body;

    if (!category || typeof category !== 'string') {
      return NextResponse.json(
        { error: 'Category is required' },
        { status: 400 }
      );
    }

    console.log('Creating snapshot for:', category);
    console.log('Mock mode:', useMock);
    console.log('Quick mode:', quickMode);

    let generatedItems;
    
    // Check if we should use mock data (for testing)
    if (useMock || !process.env.OPENAI_API_KEY) {
      console.log('Using mock data generator');
      generatedItems = generateMockTop100List(category);
    } else {
      try {
        // Use quick generation by default for speed
        if (quickMode) {
          generatedItems = await generateQuickList(category);
        } else {
          generatedItems = await generateTop100List(category);
        }
      } catch (openAIError) {
        console.error('OpenAI failed, falling back to mock:', openAIError);
        // Fallback to mock if OpenAI fails
        generatedItems = generateMockTop100List(category);
      }
    }

    // Create snapshot
    const snapshot: Snapshot = {
      id: Math.random().toString(36).substring(7),
      category,
      items: generatedItems,
      createdAt: new Date(),
    };

    // Store snapshot
    snapshotStore.create(snapshot);
    console.log('Snapshot created and stored with ID:', snapshot.id);
    console.log('Total snapshots in store after creation:', snapshotStore.getAll().length);

    return NextResponse.json(snapshot);
  } catch (error: any) {
    console.error('Error in snapshot creation:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate list', 
        details: error?.message || 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  const snapshots = snapshotStore.getAll();
  return NextResponse.json(snapshots);
}