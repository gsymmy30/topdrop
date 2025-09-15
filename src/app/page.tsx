"use client";
import { useState } from "react";

type Snapshot = {
  id: string;
  title: string;
  createdAt: string;
  items: { rank: number; name: string; aliases?: string[] }[];
};

export default function Home() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [query, setQuery] = useState("");
  const [guess, setGuess] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<string>("");
  const [rawPreview, setRawPreview] = useState<string>("");

  async function createSnapshot() {
    setResult("Generating with AI…");
    const res = await fetch("/api/snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    if (data.snapshot) {
      setSnapshot(data.snapshot);
      setRawPreview(data.raw ?? "");
      setResult(`Locked: ${data.snapshot.title}`);
    } else {
      setResult(`Error: ${data.error || "failed"}`);
      setRawPreview(data.raw ?? "");
    }
  }

  async function checkGuess() {
    if (!snapshot) {
      setResult("Create a list first.");
      return;
    }
    const res = await fetch("/api/guess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshotId: snapshot.id, guess }),
    });
    const data = await res.json();
    if (data.found) {
      const line = `✅ ${data.name} — Rank #${data.rank} (Points ${data.points})`;
      setResult(line);
      setLog((l) => [line, ...l].slice(0, 10));
    } else {
      const line = `❌ Not on list: ${guess}`;
      setResult(line);
      setLog((l) => [line, ...l].slice(0, 10));
    }
    setGuess("");
  }

  return (
    <main className="mx-auto max-w-5xl p-6 grid md:grid-cols-3 gap-6">
      <section className="space-y-3 md:col-span-1">
        <h2 className="text-xl font-semibold">1) Build & Lock List</h2>
        <div className="border rounded p-3 space-y-2">
          <input
            className="w-full border rounded p-2"
            placeholder='e.g. "highest-grossing movies of all time"'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            className="w-full rounded bg-black text-white p-2"
            onClick={createSnapshot}
          >
            Generate List
          </button>
        </div>
        {snapshot ? (
          <div className="text-xs text-gray-500 space-y-2">
            <div>
              Locked: <b>{snapshot.title}</b>
            </div>
            <div className="max-h-40 overflow-auto border rounded p-2">
              <div className="font-semibold mb-1">Preview (first 15)</div>
              <ol className="list-decimal list-inside space-y-0.5">
                {snapshot.items.slice(0, 15).map((it) => (
                  <li key={it.rank}>
                    {it.rank}. {it.name}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-500">No snapshot locked.</div>
        )}
        {rawPreview && (
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer">Raw AI Output</summary>
            <pre className="overflow-auto max-h-40 whitespace-pre-wrap">
              {rawPreview}
            </pre>
          </details>
        )}
      </section>

      <section className="space-y-3 md:col-span-1">
        <h2 className="text-xl font-semibold">2) Verify Guesses</h2>
        <div className="border rounded p-3 space-y-2">
          <input
            className="w-full border rounded p-2 text-lg"
            placeholder="Type guess and press Enter"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") checkGuess();
            }}
          />
          <button
            className="w-full rounded bg-black text-white p-2"
            onClick={checkGuess}
          >
            Verify
          </button>
          <div className="mt-2 text-base">{result}</div>
        </div>
      </section>

      <section className="space-y-3 md:col-span-1">
        <h2 className="text-xl font-semibold">Recent Checks</h2>
        <div className="border rounded p-3 h-64 overflow-auto text-sm space-y-2">
          {log.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      </section>
    </main>
  );
}
