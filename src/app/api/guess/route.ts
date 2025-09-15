import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { buildMatcher } from "@/lib/match";

export async function POST(req: NextRequest) {
  const { snapshotId, guess } = await req.json();
  const snap = store.get(snapshotId);
  if (!snap) return NextResponse.json({ error: "snapshot not found" }, { status: 404 });
  const matchFn = buildMatcher(snap);
  const result = matchFn(guess);
  if (!result) {
    return NextResponse.json({ found: false, suggestions: [] });
  }
  return NextResponse.json({
    found: true,
    rank: result.match.rank,
    name: result.match.name,
    points: result.match.rank, // Top Drop scoring
  });
}
