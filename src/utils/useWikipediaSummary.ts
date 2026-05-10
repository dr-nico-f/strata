import { useEffect, useState } from "react";

/**
 * Live tooltip enrichment via Wikipedia's REST summary API.
 *
 *   GET https://en.wikipedia.org/api/rest_v1/page/summary/<title>
 *
 * The endpoint is CORS-enabled and unauthenticated. Returns the page's lead
 * paragraph, a short description, and (when available) a thumbnail image.
 *
 * We cache by slug in module scope so flipping between pinned tooltips for the
 * same feature doesn't re-fetch.
 */

export interface WikipediaSummary {
  extract: string;
  description?: string;
  thumbnail?: { source: string; width: number; height: number };
  url?: string;
}

const cache = new Map<string, WikipediaSummary | null>();
const inflight = new Map<string, Promise<WikipediaSummary | null>>();

function normalizeSlug(slug: string): string {
  return slug.replace(/ /g, "_");
}

async function fetchSummary(slug: string): Promise<WikipediaSummary | null> {
  const title = encodeURIComponent(normalizeSlug(slug));
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`;
  const r = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!r.ok) return null;
  const j = (await r.json()) as {
    extract?: string;
    description?: string;
    thumbnail?: { source: string; width: number; height: number };
    content_urls?: { desktop?: { page?: string } };
  };
  if (!j.extract) return null;
  return {
    extract: j.extract,
    description: j.description,
    thumbnail: j.thumbnail,
    url: j.content_urls?.desktop?.page,
  };
}

export function getCachedSummary(slug: string | undefined): WikipediaSummary | null {
  if (!slug) return null;
  return cache.get(slug) ?? null;
}

/**
 * Fetch the Wikipedia summary for `slug`. Pass `enabled=false` to defer the
 * fetch (e.g. only fire when a tooltip is pinned, not on every hover).
 */
export function useWikipediaSummary(
  slug: string | undefined,
  enabled = true,
): {
  summary: WikipediaSummary | null;
  loading: boolean;
  error: boolean;
} {
  const [, force] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!enabled || !slug) return;
    if (cache.has(slug)) {
      force((n) => n + 1);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    let p = inflight.get(slug);
    if (!p) {
      p = fetchSummary(slug)
        .then((s) => {
          cache.set(slug, s);
          return s;
        })
        .catch(() => {
          cache.set(slug, null);
          return null;
        })
        .finally(() => {
          inflight.delete(slug);
        });
      inflight.set(slug, p);
    }
    p.then((s) => {
      if (cancelled) return;
      setLoading(false);
      if (!s) setError(true);
      force((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [slug, enabled]);

  return { summary: slug ? cache.get(slug) ?? null : null, loading, error };
}
