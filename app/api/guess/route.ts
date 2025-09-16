import { NextResponse } from 'next/server';
import { snapshotStore } from '@/lib/store';

export async function GET() {
  const snapshots = snapshotStore.getAll();
  
  return NextResponse.json({
    count: snapshots.length,
    snapshots: snapshots.map(s => ({
      id: s.id,
      category: s.category,
      itemCount: s.items.length,
      createdAt: s.createdAt,
    })),
  });
}