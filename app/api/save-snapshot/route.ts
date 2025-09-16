import { NextResponse } from 'next/server';
import { snapshotStore } from '@/lib/store';
import { Snapshot } from '@/types';

export async function POST(request: Request) {
  try {
    const { category, items } = await request.json();

    if (!category || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Category and items are required' },
        { status: 400 }
      );
    }

    // Create and save snapshot
    const snapshot: Snapshot = {
      id: Math.random().toString(36).substring(7),
      category,
      items,
      createdAt: new Date(),
    };
    
    // Store in memory
    snapshotStore.create(snapshot);
    console.log('Snapshot saved via /save-snapshot with ID:', snapshot.id);
    console.log('Total snapshots in store:', snapshotStore.getAll().length);
    
    return NextResponse.json(snapshot);
  } catch (error: any) {
    console.error('Error saving snapshot:', error);
    return NextResponse.json(
      { 
        error: 'Failed to save snapshot', 
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}