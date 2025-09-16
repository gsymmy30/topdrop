import { Snapshot } from '@/types';

// In-memory store for snapshots (MVP)
// Later can be replaced with Redis or database
class SnapshotStore {
  private snapshots: Map<string, Snapshot> = new Map();

  create(snapshot: Snapshot): void {
    this.snapshots.set(snapshot.id, snapshot);
    console.log(`Snapshot stored: ${snapshot.id}, Total snapshots: ${this.snapshots.size}`);
  }

  get(id: string): Snapshot | undefined {
    const snapshot = this.snapshots.get(id);
    console.log(`Getting snapshot ${id}: ${snapshot ? 'found' : 'not found'}`);
    console.log(`Available IDs: ${Array.from(this.snapshots.keys()).join(', ')}`);
    return snapshot;
  }

  getAll(): Snapshot[] {
    return Array.from(this.snapshots.values());
  }

  delete(id: string): boolean {
    return this.snapshots.delete(id);
  }

  clear(): void {
    this.snapshots.clear();
  }
}

// Create a singleton that persists across hot reloads in development
// This uses a global variable to survive Next.js hot module replacement
declare global {
  var snapshotStore: SnapshotStore | undefined;
}

// Export singleton instance
export const snapshotStore = global.snapshotStore || new SnapshotStore();

// Only set the global in development to persist across hot reloads
if (process.env.NODE_ENV !== 'production') {
  global.snapshotStore = snapshotStore;
}

console.log('SnapshotStore initialized, current snapshots:', snapshotStore.getAll().length);