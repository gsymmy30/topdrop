import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/ai";
import { store } from "@/lib/store";
import { Snapshot, SnapshotItem } from "@/lib/types";
import crypto from "node:crypto";

function extractJsonArray(raw: string): any {
  // Find the first [...] block
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("No JSON array found");
  return JSON.parse(match[0]);
}

export async function POST(req: NextRequest) {
  const { query } = await req.json();
  if (!query) {
    return NextResponse.json({ error: "query required" }, { status: 400 });
  }

  const prompt = `
  Generate the Top 100 for this category: "${query}".
  Rules:
  - Return ONLY a JSON array of 100 objects.
  - Each object: { "rank": number, "name": string, "aliases": string[] }.
  - No commentary, no markdown, just JSON.
  `;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: prompt }],
    temperature: 0,
    response_format: { type: "json_object" }
  });

  const raw = completion.choices[0].message?.content ?? "[]";

  let items: SnapshotItem[];
  try {
    items = extractJsonArray(raw);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to parse JSON", raw },
      { status: 500 }
    );
  }

  if (!Array.isArray(items) || items.length < 100) {
    return NextResponse.json(
      { error: "Expected 100 items", raw },
      { status: 422 }
    );
  }

  const id = crypto.randomUUID();
  const checksum = crypto
    .createHash("sha1")
    .update(JSON.stringify(items))
    .digest("hex");

  const snap: Snapshot = {
    id,
    title: query,
    createdAt: new Date().toISOString(),
    items: items.slice(0, 100),
    checksum,
    locked: true,
  };
  store.set(snap);

  return NextResponse.json({ snapshot: snap, raw });
}
