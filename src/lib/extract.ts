// src/lib/extract.ts
import * as cheerio from "cheerio";
import type { SnapshotItem } from "./types";

/**
 * Strip refs/footnotes and whitespace from a cell's text.
 */
function cleanText(raw: string): string {
  return raw
    // remove [1], [a], etc.
    .replace(/\[[^\]]*?\]/g, "")
    // collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract plain text from a cheerio cell, preferring anchor text if present.
 */
function cellText($: cheerio.CheerioAPI, el: any): string {
  const $el = $(el);
  // Prefer visible link text if available
  const a = $el.find("a").first();
  const text = a.length ? a.text() : $el.text();
  return cleanText(text);
}

/**
 * Try to detect the header index for "rank" and "name" columns.
 */
function detectColumns(headers: string[]) {
  const lower = headers.map((h) => h.toLowerCase());

  // Rank column candidates
  const rankIdx =
    lower.findIndex(
      (h) =>
        h === "#" ||
        h.includes("rank") ||
        h.includes("no.") ||
        /^no\b/.test(h)
    );

  // Name column candidates
  const nameKeywords = [
    "title",
    "film",
    "movie",
    "song",
    "name",
    "artist",
    "album",
    "game",
    "book",
    "series",
    "track",
  ];
  let nameIdx = -1;
  for (let i = 0; i < lower.length; i++) {
    if (nameKeywords.some((k) => lower[i].includes(k))) {
      nameIdx = i;
      break;
    }
  }

  return { rankIdx, nameIdx };
}

/**
 * Parse an integer rank out of a string, e.g., "1", "No. 1", "1st".
 */
function parseRank(s: string): number | null {
  const m = s.match(/(\d{1,3})/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n)) return null;
  return n;
}

/**
 * Returns a SnapshotItem array (up to 100 items with rank 1..100) or null if not found.
 */
export function extractRankedFromWikipedia(html: string): SnapshotItem[] | null {
  const $ = cheerio.load(html);

  // Wikipedia tables are often .wikitable (sometimes .sortable)
  const tables = $("table.wikitable, table.sortable");

  // Iterate candidate tables
  for (let t = 0; t < tables.length; t++) {
    const table = tables[t];
    const rows = $(table).find("tr");
    if (rows.length < 5) continue;

    // Parse headers (th)
    const headers: string[] = [];
    $(rows[0])
      .find("th")
      .each((_, th) => {
        headers.push(cleanText($(th).text()));
      });

    // If no headers, try the second row as headers (some lists have multi-row heads)
    if (headers.length === 0 && rows.length > 1) {
      $(rows[1])
        .find("th")
        .each((_, th) => {
          headers.push(cleanText($(th).text()));
        });
    }

    const { rankIdx, nameIdx } = detectColumns(headers);

    // Collect items
    const items: { rank?: number; name: string }[] = [];

    // Start from the first data row (skip header row(s))
    const startDataRow = headers.length > 0 ? 1 : 1; // usually 1; headerless tables are rare
    for (let r = startDataRow; r < rows.length; r++) {
      const row = rows[r];
      const cells = $(row).find("td");
      // Skip if not a data row
      if (cells.length === 0) continue;

      // Fallbacks if columns are unknown:
      const rankCellIdx = rankIdx >= 0 ? rankIdx : 0;
      const nameCellIdx = nameIdx >= 0 ? nameIdx : Math.min(1, cells.length - 1);

      const rankStr = cellText($, cells[rankCellIdx]);
      const nameStr = cellText($, cells[nameCellIdx]);

      // Guard against empty names
      if (!nameStr) continue;

      const rankParsed = parseRank(rankStr ?? "");
      if (rankIdx >= 0 && rankParsed != null) {
        items.push({ rank: rankParsed, name: nameStr });
      } else {
        // If there's no explicit rank column, we’ll infer rank by row order later
        items.push({ name: nameStr });
      }
    }

    // If nothing parsed, try next table
    if (items.length < 10) continue;

    // If we have explicit ranks, filter to 1..100 and dedupe by rank
    let ranked: SnapshotItem[] = [];
    const seen = new Set<number>();

    if (items.some((it) => typeof it.rank === "number")) {
      for (const it of items) {
        const r = it.rank!;
        if (typeof r !== "number" || r < 1 || r > 100) continue;
        if (seen.has(r)) continue;
        seen.add(r);
        ranked.push({ rank: r, name: it.name, aliases: [] });
      }
      ranked.sort((a, b) => a.rank - b.rank);
    } else {
      // No explicit ranks -> infer by row order
      // Take the first 100 non-empty names
      const trimmed = items
        .map((it) => it.name)
        .filter((n) => n && n !== "-" && n.toLowerCase() !== "total")
        .slice(0, 100);
      if (trimmed.length >= 20) {
        ranked = trimmed.map((name, i) => ({
          rank: i + 1,
          name,
          aliases: [],
        }));
      }
    }

    // Require at least a decent chunk (e.g., 50+) to consider this table valid
    if (ranked.length >= 50) {
      // If fewer than 100, we’ll just return what we have (caller can pad if desired)
      return ranked.slice(0, 100);
    }
  }

  return null;
}
