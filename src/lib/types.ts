import { z } from "zod";

export const SnapshotItem = z.object({
  rank: z.number().int().min(1).max(100),
  name: z.string(),
  aliases: z.array(z.string()).default([]),
});
export type SnapshotItem = z.infer<typeof SnapshotItem>;

export const Snapshot = z.object({
    id: z.string(),
    title: z.string(),
    createdAt: z.string(),
    items: z.array(SnapshotItem).length(100),
    checksum: z.string(),
    locked: z.boolean().default(true),
  });
  export type Snapshot = z.infer<typeof Snapshot>;
  
