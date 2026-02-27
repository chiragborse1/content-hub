/**
 * instagramService.ts
 * Shared service module for Instagram scraping utilities.
 * Used by the extract-caption and download-media Edge Functions.
 *
 * IMPORTANT: Scraping only happens on explicit user action (button click).
 * No auto-fetching. No retry loops. One request per call.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface OembedResponse {
  title: string;           // contains the caption text
  thumbnail_url: string;
  thumbnail_width: number;
  thumbnail_height: number;
  author_name: string;
  author_url: string;
  provider_name: string;
  html: string;
  version: string;
}

export interface PostMetadata {
  caption: string | null;
  thumbnailUrl: string | null;
}

// ── Rate-limiting safeguard ───────────────────────────────────────────────────
// A simple in-memory timestamp map to prevent hammering the same URL.
// Edge function instances are short-lived, so this is a best-effort guard.
const lastFetchTime: Map<string, number> = new Map();
const MIN_INTERVAL_MS = 2000; // 2 seconds minimum between requests per URL

function checkRateLimit(url: string): void {
  const now = Date.now();
  const last = lastFetchTime.get(url) ?? 0;
  if (now - last < MIN_INTERVAL_MS) {
    throw new Error("Rate limit: please wait before retrying.");
  }
  lastFetchTime.set(url, now);
}

// ── fetchPostMetadata ─────────────────────────────────────────────────────────
/**
 * Fetches Instagram's public oembed endpoint for the given post URL.
 * Returns parsed JSON or throws on failure.
 *
 * Works only for public Instagram posts (images & reels).
 * No authentication required.
 */
export async function fetchPostMetadata(
  instagramUrl: string,
  signal?: AbortSignal
): Promise<OembedResponse> {
  checkRateLimit(instagramUrl);

  const oembedUrl =
    `https://api.instagram.com/oembed/?url=${encodeURIComponent(instagramUrl)}&omitscript=true`;

  const res = await fetch(oembedUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; InspireHub/1.0; +https://inspireapp.io)",
    },
    signal,
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        "Post not found — it may be private, deleted, or invalid."
      );
    }
    throw new Error(
      `Instagram oembed returned HTTP ${res.status}: ${res.statusText}`
    );
  }

  return res.json() as Promise<OembedResponse>;
}

// ── extractCaption ────────────────────────────────────────────────────────────
/**
 * Pulls the caption text from an oembed response.
 * Instagram stores the caption in the `title` field.
 */
export function extractCaption(meta: OembedResponse): string | null {
  const raw = meta.title?.trim();
  // Instagram oembed sometimes returns "Video by <username>" when there's no
  // caption — we treat those as null so the UI doesn't show junk.
  if (!raw || /^Video by /i.test(raw) || /^Photo by /i.test(raw)) {
    return null;
  }
  return raw;
}

// ── getThumbnailUrl ───────────────────────────────────────────────────────────
/**
 * Pulls the thumbnail URL from an oembed response.
 */
export function getThumbnailUrl(meta: OembedResponse): string | null {
  return meta.thumbnail_url?.trim() || null;
}

// ── getMediaUrl ───────────────────────────────────────────────────────────────
/**
 * Resolves the direct CDN URL for the media file (image or video) by fetching
 * the Instagram post page and reading og:video / og:image meta tags.
 *
 * Single request — no looping. Throws on failure.
 */
export async function getMediaUrl(
  instagramUrl: string,
  signal?: AbortSignal
): Promise<{ url: string; mimeType: string }> {
  checkRateLimit(instagramUrl + "__media");

  const res = await fetch(instagramUrl, {
    headers: {
      // Mimic a browser enough to get the og meta tags
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal,
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(
      `Failed to fetch post page: HTTP ${res.status} ${res.statusText}`
    );
  }

  const html = await res.text();

  // Try video first (Reels)
  const videoMatch =
    html.match(/<meta\s+property="og:video:secure_url"\s+content="([^"]+)"/i) ||
    html.match(/<meta\s+property="og:video"\s+content="([^"]+)"/i) ||
    html.match(/<meta\s+content="([^"]+)"\s+property="og:video:secure_url"/i) ||
    html.match(/<meta\s+content="([^"]+)"\s+property="og:video"/i);

  if (videoMatch?.[1]) {
    return {
      url: videoMatch[1],
      mimeType: "video/mp4",
    };
  }

  // Fallback to image
  const imageMatch =
    html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
    html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i);

  if (imageMatch?.[1]) {
    return {
      url: imageMatch[1],
      mimeType: "image/jpeg",
    };
  }

  throw new Error(
    "Could not find any media in this post. It may be private or the format is unsupported."
  );
}
