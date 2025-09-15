// src/lib/match.ts
import Fuse from "fuse.js";
import type { Snapshot } from "./types";

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^the\s+/, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extraAliases(name: string): string[] {
  const aliases: string[] = [];
  if (name.includes(":")) {
    aliases.push(name.replace(/:/g, ""));
    aliases.push(name.split(":")[0].trim());
  }
  if (/^The\s+/i.test(name)) aliases.push(name.replace(/^The\s+/i, "").trim());
  return Array.from(new Set(aliases));
}

export function buildMatcher(snapshot: Snapshot) {
  const items = snapshot.items.map((it) => {
    const aliasList = [...(it.aliases || []), ...extraAliases(it.name)];
    return {
      ...it,
      _norm: normalize(it.name),
      _aliasNorms: aliasList.map(normalize),
      _aliases: aliasList,
    };
  });

  const fuse = new Fuse(items, {
    keys: ["name", "_aliases"],
    includeScore: true,
    threshold: 0.35,
  });

  return (guessRaw: string) => {
    const guess = normalize(guessRaw);

    // 1) Exact norm
    const exact = items.find(
      (it) => it._norm === guess || it._aliasNorms.includes(guess)
    );
    if (exact) return { match: exact, score: 0 };

    // 2) Substring contains (helps "Avengers" → "Avengers: Endgame")
    const contain = items.find(
      (it) => it._norm.includes(guess) || it._aliasNorms.some((a) => a.includes(guess))
    );
    if (contain) return { match: contain, score: 0.2 };

    // 3) Fuzzy
    const [best] = fuse.search(guess);
    if (best) return { match: best.item, score: best.score ?? 0.0 };

    return null;
  };
}
