import type { Snapshot } from "./types";

const SNAPSHOTS = new Map<string, Snapshot>();

export const store = {
  get: (id: string) => SNAPSHOTS.get(id),
  set: (snap: Snapshot) => { SNAPSHOTS.set(snap.id, snap); },
  list: () => Array.from(SNAPSHOTS.values()),
  remove: (id: string) => { SNAPSHOTS.delete(id); },
};
