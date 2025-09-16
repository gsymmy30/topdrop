import { NextRequest, NextResponse } from 'next/server';
import { snapshotStore } from '@/lib/store';
import { checkGuess } from '@/lib/matcher';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { guess, snapshotId } = body;
    
    console.log('[/api/check-guess] Checking guess:', { guess, snapshotId });
    
    // Get all snapshots for debugging
    const allSnapshots = snapshotStore.getAll();
    console.log('[/api/check-guess] Total snapshots in store:', allSnapshots.length);
    console.log('[/api/check-guess] Available snapshot IDs:', allSnapshots.map(s => s.id).join(', '));

    if (!guess || !snapshotId) {
      return NextResponse.json(
        { error: 'Guess and snapshotId are required' },
        { status: 400 }
      );
    }

    const snapshot = snapshotStore.get(snapshotId);
    console.log('[/api/check-guess] Found snapshot:', snapshot ? `Yes (${snapshot.items.length} items)` : 'No');
    
    if (!snapshot) {
      return NextResponse.json(
        { error: `Snapshot not found. ID: ${snapshotId}. Available: ${allSnapshots.map(s => s.id).join(', ')}` },
        { status: 404 }
      );
    }

    const result = checkGuess(guess, snapshot.items);
    console.log('[/api/check-guess] Guess result:', result);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[/api/check-guess] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check guess', details: error.message },
      { status: 500 }
    );
  }
}