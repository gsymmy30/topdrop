// src/lib/web.ts
import * as cheerio from "cheerio";

/** Normalize a DuckDuckGo result href into a usable absolute URL. */
function normalizeResultUrl(href: string): string | null {
  if (!href) return null;

  // Protocol-relative (e.g., //duckduckgo.com/...) -> prefix https
  if (href.startsWith("//")) {
    href = "https:" + href;
  }

  try {
    const u = new URL(href);

    // DuckDuckGo redirector, extract real target from ?uddg=
    if (
      (u.hostname === "duckduckgo.com" || u.hostname.endsWith(".duckduckgo.com")) &&
      u.pathname.startsWith("/l")
    ) {
      const uddg = u.searchParams.get("uddg");
      if (uddg) {
        // uddg is already percent-encoded; decode once
        const decoded = decodeURIComponent(uddg);
        // Ensure it has a protocol
        if (decoded.startsWith("//")) return "https:" + decoded;
        if (decoded.startsWith("http://") || decoded.startsWith("https://")) return decoded;
        // occasionally DDG returns relative bits; default to https
        return "https://" + decoded.replace(/^\/+/, "");
      }
    }

    // Already a proper URL
    return u.toString();
  } catch {
    // Not a full URL? Try to coerce into https
    if (href.startsWith("/")) return "https://duckduckgo.com" + href;
    if (!/^https?:\/\//i.test(href)) return "https://" + href;
    return null;
  }
}

/**
 * Very simple DuckDuckGo HTML search (no API key).
 * Filters to Wikipedia/Wikidata first, then returns others.
 */
export async function ddgSearch(
  query: string,
  limit = 5
): Promise<Array<{ title: string; url: string; snippet: string }>> {
  const url =
    "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query);

  const res = await fetch(url, {
    headers: {
      "User-Agent": "TopDrop/1.0 (+https://topdrop.local)",
      "Accept-Language": "en-US,en;q=0.9",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`DuckDuckGo search failed: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const results: { title: string; url: string; snippet: string }[] = [];

  $(".result")
    .slice(0, 20)
    .each((_, el) => {
      const a = $(el).find(".result__a").first();
      const rawHref = a.attr("href") ?? "";
      const url = normalizeResultUrl(rawHref);
      const title = a.text().trim();
      const snippet = $(el).find(".result__snippet").first().text().trim();

      if (!url || !title) return;

      results.push({ title, url, snippet });
    });

  const wikiFirst = [
    ...results.filter((r) => r.url.includes("wikipedia.org") || r.url.includes("wikidata.org")),
    ...results.filter((r) => !r.url.includes("wikipedia.org") && !r.url.includes("wikidata.org")),
  ];

  return wikiFirst.slice(0, limit);
}

/** Fetch raw HTML from a URL with a friendly UA and protocol fallback. */
export async function fetchHtml(url: string): Promise<string> {
  // If somehow a protocol-relative sneaks in
  if (url.startsWith("//")) url = "https:" + url;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "TopDrop/1.0 (+https://topdrop.local)",
      "Accept-Language": "en-US,en;q=0.9",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`fetchHtml failed: ${res.status} ${res.statusText}`);
  }
  return await res.text();
}
