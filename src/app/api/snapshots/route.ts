import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/ai";
import { store } from "@/lib/store";
import { Snapshot, SnapshotItem } from "@/lib/types";
import crypto from "node:crypto";

export async function POST(req: NextRequest) {
  const { query } = await req.json();
  if (!query) {
    return NextResponse.json({ error: "query required" }, { status: 400 });
  }

  const prompt = `
  Generate the Top 100 for this category: "${query}".
  Rules:
  - Return ONLY JSON array of objects.
  - Each object: { "rank": number, "name": string, "aliases": string[] }.
  - Include exactly 100 items ranked 1 to 100.
  - No text before or after JSON.
  `;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: prompt }],
    temperature: 0,
  });

  const raw = completion.choices[0].message?.content ?? "[]";
  let items: SnapshotItem[];
  try {
    items = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Failed to parse JSON", raw }, { status: 500 });
  }

  if (!Array.isArray(items) || items.length < 100) {
    return NextResponse.json({ error: "Expected 100 items", raw }, { status: 422 });
  }

  const id = crypto.randomUUID();
  const checksum = crypto.createHash("sha1").update(JSON.stringify(items)).digest("hex");

  const snap: Snapshot = {
    id,
    title: query,
    createdAt: new Date().toISOString(),
    items: items.slice(0, 100),
    checksum,
    locked: true,
  };
  store.set(snap);

  return NextResponse.json({ snapshot: snap });
}
